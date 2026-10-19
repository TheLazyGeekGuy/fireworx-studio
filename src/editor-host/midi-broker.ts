import type { MidiAccess, MidiPort } from '../web-midi'
import { validVoiceMessage } from '../bcontrol-voice'
import {validMidiMessage as validMessage} from '../midi-message'

export type MidiOperation = 'value' | 'query' | 'brightness' | 'feedback' | 'device-control' | 'edit-buffer' | 'preset-store'
export type MidiAuthorization = Readonly<{ operation: MidiOperation }>
export interface EndpointBinding { inputId: string; outputId: string }
export interface BrokerPacket { inputId: string; generation: number; timestamp: number; bytes: number[] }
export interface MidiActivity { direction: 'rx' | 'tx'; generation: number; timestamp: number }
export type MidiPresence = 'checking' | 'online' | 'offline' | null
export interface LeaseState { connected: boolean; generation: number; binding: EndpointBinding | null; error: string | null }
export interface MidiLease {
  supportsSysex?():boolean
  bind(binding: EndpointBinding): void
  getState(): LeaseState
  subscribe(listener: (packet: BrokerPacket) => void): () => void
  onState(listener: (state: LeaseState) => void): () => void
  onActivity(listener: (activity: MidiActivity) => void): () => void
  getPresence(): MidiPresence
  onPresence(listener: (presence: MidiPresence) => void): () => void
  reportPresence(presence: MidiPresence, generation: number): void
  send(messages: readonly (readonly number[])[], authorization: MidiAuthorization): void
  release(): void
  dispose(): void
}
type InternalLease = {
  state: LeaseState; input: MidiPort | null; output: MidiPort | null; disposed: boolean
  listener: MidiPort['onmidimessage']; packets: Set<(packet: BrokerPacket) => void>; states: Set<(state: LeaseState) => void>
  validateQuery: (bytes: readonly number[]) => boolean
  validateBrightness: (bytes: readonly number[]) => boolean
  validateFeedback: (bytes: readonly number[]) => boolean
  validateDeviceControl: (bytes: readonly number[]) => boolean
  validateEditBuffer: (bytes: readonly number[]) => boolean
  validatePresetStore: (bytes: readonly number[]) => boolean
  offInput?:()=>void
  activity: Set<(activity: MidiActivity) => void>
  presence: MidiPresence; presenceListeners: Set<(presence: MidiPresence) => void>
}
const copyState = (s: LeaseState): LeaseState => ({ ...s, binding: s.binding ? { ...s.binding } : null })

// Host-owned transport only. No permissions requested, port auto-selection, sends, timers or physical writes at construction.
// Device-control is optional and exact-validator gated. Configuration/STORE/firmware/reset remain unavailable.
export function createMidiBroker(access: MidiAccess, now = () => performance.now()) {
  const leases = new Map<string, InternalLease>()
  const inputOwners = new Map<string, string>(), outputOwners = new Map<string, string>()
  const grants = new WeakMap<MidiAuthorization, { lease: InternalLease; generation: number; revoked: boolean }>()
  const observers = new Set<() => void>()
  const hubs=new Map<string,{port:MidiPort;listener:MidiPort['onmidimessage'];subscribers:Set<(bytes:number[])=>void>}>()
  const routers=new Set<()=>void>()
  const routingOwners=new Set<string>(),routingChecks=new Set<()=>void>()
  let closed = false
  function observeInput(id:string,fn:(bytes:number[])=>void){
    if(closed)throw Error('MIDI broker closed')
    const port=access.inputs.get(id);if(!port||port.state!=='connected')throw Error('MIDI input unavailable')
    let hub=hubs.get(id)
    if(hub&&(hub.port!==port||port.onmidimessage!==hub.listener))throw Error('MIDI input binding changed')
    if(!hub){if(port.onmidimessage)throw Error('MIDI input already reserved outside broker');const subscribers=new Set<(bytes:number[])=>void>();const listener:MidiPort['onmidimessage']=event=>{for(const callback of [...subscribers])try{callback(Array.from(event.data))}catch{/* subscriber isolation */}};hub={port,listener,subscribers};try{port.onmidimessage=listener;hubs.set(id,hub)}catch(e){try{port.onmidimessage=null}catch{/* cleanup best effort */}throw e}}
    hub.subscribers.add(fn);const current=hub
    return ()=>{current.subscribers.delete(fn);if(!current.subscribers.size){if(current.port.onmidimessage===current.listener)current.port.onmidimessage=null;if(hubs.get(id)===current)hubs.delete(id)}}
  }
  const notify = (l: InternalLease) => { for (const fn of l.states) { try { fn(copyState(l.state)) } catch { /* observer isolation */ } }; for (const fn of observers) { try { fn() } catch { /* observer isolation */ } } }
  const activity = (l: InternalLease, direction: MidiActivity['direction'], bytes: readonly number[]) => {
    if (bytes.length === 1 && bytes[0] >= 0xf8) return // Clock/active sensing must not keep an idle editor flashing.
    const event={ direction, generation: l.state.generation, timestamp: now() }
    for (const fn of l.activity) try { fn(event) } catch { /* observer isolation */ }
  }
  const presence = (l: InternalLease, value: MidiPresence) => {
    if(l.presence===value)return
    l.presence=value
    for(const fn of l.presenceListeners)try{fn(value)}catch{/* observer isolation */}
  }
  function release(owner: string, l: InternalLease, error: string | null = null) {
    const b = l.state.binding
    l.offInput?.();l.offInput=undefined
    if (b && inputOwners.get(b.inputId) === owner) inputOwners.delete(b.inputId)
    if (b && outputOwners.get(b.outputId) === owner) outputOwners.delete(b.outputId)
    l.input = null; l.output = null; l.listener = null
    l.state = { connected: false, generation: l.state.generation + 1, binding: null, error }; notify(l)
    presence(l,null)
  }
  function refresh() {
    for (const [owner, l] of leases) {
      const b = l.state.binding
      if (b && (access.inputs.get(b.inputId) !== l.input || access.outputs.get(b.outputId) !== l.output ||
        l.input?.state !== 'connected' || l.output?.state !== 'connected' || l.input.onmidimessage !== l.listener)) {
        release(owner, l, 'MIDI binding lost; reconnect explicitly')
      }
    }
    for(const check of routingChecks)try{check()}catch{/* Route is disarmed by its check. */}
  }
  const previousStateChange = access.onstatechange
  const stateChange = () => { refresh(); try { previousStateChange?.() } catch { /* unrelated observer */ } }
  access.onstatechange = stateChange
  return {
    available(direction: 'input' | 'output', id: string, owner: string) { const reserved = (direction === 'input' ? inputOwners : outputOwners).get(id); return !closed && (reserved === undefined || reserved === owner) },
    subscribe(fn: () => void) { if (closed) throw Error('MIDI broker closed'); observers.add(fn); return () => { observers.delete(fn) } },
    createLease(owner: string, validateQuery: InternalLease['validateQuery'] = () => false, validateBrightness: InternalLease['validateBrightness'] = () => false, validateFeedback: InternalLease['validateFeedback'] = () => false, validateDeviceControl: InternalLease['validateDeviceControl'] = () => false, validateEditBuffer: InternalLease['validateEditBuffer'] = () => false, validatePresetStore: InternalLease['validatePresetStore'] = () => false): MidiLease {
      if (closed || !/^[a-zA-Z0-9_-]{1,100}$/.test(owner) || leases.has(owner)) throw Error('Invalid or duplicate MIDI lease owner')
      const l: InternalLease = { state: { connected: false, generation: 0, binding: null, error: null }, input: null,
        output: null, listener: null, disposed: false, packets: new Set(), states: new Set(), activity: new Set(), presence: null, presenceListeners: new Set(), validateQuery, validateBrightness, validateFeedback, validateDeviceControl, validateEditBuffer, validatePresetStore }
      leases.set(owner, l)
      const usable = () => { if (closed || l.disposed) throw Error('MIDI lease closed') }
      return {
        supportsSysex(){return !closed&&!l.disposed&&access.sysexEnabled},
        bind(binding) {
          usable(); refresh()
          const input = access.inputs.get(binding.inputId), output = access.outputs.get(binding.outputId)
          if (!input || !output?.send || input.state !== 'connected' || output.state !== 'connected') throw Error('MIDI endpoints unavailable')
          if (inputOwners.has(binding.inputId) && inputOwners.get(binding.inputId) !== owner ||
            outputOwners.has(binding.outputId) && outputOwners.get(binding.outputId) !== owner ||
            input.onmidimessage && input.onmidimessage !== l.listener && input.onmidimessage!==hubs.get(binding.inputId)?.listener) throw Error('MIDI endpoints already reserved')
          // Preflight the replacement before relinquishing the current pair. Every bind invalidates old authorizations.
          release(owner, l)
          usable()
          l.input = input; l.output = output
          l.state = { connected: true, generation: l.state.generation + 1, binding: { ...binding }, error: null }
          const generation = l.state.generation
          const inputId = binding.inputId
          try{l.offInput=observeInput(inputId,bytes=>{
            refresh()
            if (!l.state.connected || l.state.generation !== generation || l.disposed) return
            activity(l, 'rx', bytes)
            const timestamp = now()
            for (const fn of l.packets) { try { fn({ bytes: [...bytes], inputId, generation, timestamp }) } catch { /* observer isolation */ } }
          });l.listener=hubs.get(inputId)!.listener}catch(e){release(owner,l,'MIDI input could not be opened');throw e}
          inputOwners.set(binding.inputId, owner); outputOwners.set(binding.outputId, owner)
          notify(l)
        },
        getState() { refresh(); return copyState(l.state) },
        subscribe(fn) { usable(); l.packets.add(fn); return () => { l.packets.delete(fn) } },
        onState(fn) { usable(); l.states.add(fn); return () => { l.states.delete(fn) } },
        onActivity(fn) { usable(); l.activity.add(fn); return () => { l.activity.delete(fn) } },
        getPresence() { return l.presence },
        onPresence(fn) { usable(); l.presenceListeners.add(fn); return () => { l.presenceListeners.delete(fn) } },
        reportPresence(value, generation) {
          usable()
          if(![null,'checking','online','offline'].includes(value))throw Error('Invalid MIDI presence')
          if(l.state.connected&&generation===l.state.generation)presence(l,value)
        },
        send(messages, authorization) {
          usable(); refresh()
          const grant = grants.get(authorization)
          if (!l.state.connected || !grant || grant.lease !== l || grant.revoked || grant.generation !== l.state.generation) throw Error('Stale or foreign MIDI authorization')
          if (messages.length > 4096 || messages.reduce((n, b) => n + b.length, 0) > 16384) throw Error('MIDI batch budget exceeded')
          const packets = messages.map(b => [...b])
          for (const bytes of packets) {
            if(authorization.operation==='preset-store'){
              if(!access.sysexEnabled||!validMessage(bytes)||bytes[0]!==240||!l.validatePresetStore(bytes))throw Error('MIDI preset-store packet refused by operation policy')
              continue
            }
            if(authorization.operation==='edit-buffer'){
              if(!access.sysexEnabled||!validMessage(bytes)||bytes[0]!==240||!l.validateEditBuffer(bytes))throw Error('MIDI edit-buffer packet refused by operation policy')
              continue
            }
            if(authorization.operation==='device-control'){
              if(!validVoiceMessage(bytes)||!l.validateDeviceControl(bytes))throw Error('MIDI packet refused by operation policy')
              continue
            }
            if (authorization.operation === 'feedback' && bytes[0] !== 240) {
              if (!validVoiceMessage(bytes) || !l.validateFeedback(bytes)) throw Error('MIDI packet refused by operation policy')
              continue
            }
            if (authorization.operation === 'value' ? !validVoiceMessage(bytes) :
              !access.sysexEnabled || bytes.length < (authorization.operation === 'query' ? 6 : 8) || bytes[0] !== 240 || bytes.at(-1) !== 247 ||
              bytes.slice(1, -1).some(b => !Number.isInteger(b) || b < 0 || b > 127) ||
              !(authorization.operation === 'brightness' ? l.validateBrightness(bytes) : authorization.operation === 'feedback' ? l.validateFeedback(bytes) : l.validateQuery(bytes))) throw Error('MIDI packet refused by operation policy')
          }
          for (const bytes of packets) {
            refresh()
            if (!l.state.connected || grant.revoked || l.state.generation !== grant.generation) throw Error('MIDI binding changed during batch')
            try { l.output!.send!(bytes); activity(l, 'tx', bytes) } catch (e) { release(owner, l, 'MIDI send failed; output may be partial'); throw e }
          }
        },
        release() { if (!l.disposed) release(owner, l) },
        dispose() { if (l.disposed) return; release(owner, l); l.disposed = true; l.packets.clear(); l.states.clear(); l.activity.clear(); l.presenceListeners.clear(); leases.delete(owner) },
      }
    },
    // Host issues opaque, binding-scoped authorization. A fabricated object or another instance's token fails.
    authorize(owner: string, operation: MidiOperation): MidiAuthorization {
      refresh(); const l = leases.get(owner)
      if (closed || !l?.state.connected || !['value', 'query', 'brightness', 'feedback','device-control','edit-buffer','preset-store'].includes(operation) || ['query','brightness','edit-buffer','preset-store'].includes(operation) && !access.sysexEnabled) throw Error('MIDI authorization unavailable')
      const token = Object.freeze({ operation }); grants.set(token, { lease: l, generation: l.state.generation, revoked: false }); return token
    },
    revoke(token: MidiAuthorization) { const grant = grants.get(token); if (grant) grant.revoked = true },
    // Trusted host utility: passive RX may share an editor input; physical outputs stay exclusive.
    // It cannot borrow editor grants or disguise custom SysEx as a read/query operation.
    createRoutingClient(owner:string,onInvalidation?:(message:string)=>void){
      if(closed||!/^[a-zA-Z0-9_-]{1,90}$/.test(owner))throw Error('Invalid routing owner')
      const key='route:'+owner;if(routingOwners.has(key))throw Error('Routing owner already active');routingOwners.add(key)
      let stopped=false,armed=false,epoch=0,offInputs:(()=>void)[]=[],outputs=new Map<string,MidiPort>(),inputs=new Map<string,MidiPort>(),allowSysex=false
      const disarm=()=>{epoch++;armed=false;offInputs.forEach(off=>off());offInputs=[];for(const id of outputs.keys())if(outputOwners.get(id)===key)outputOwners.delete(id);outputs.clear();inputs.clear()}
      const invalid=(message:string):never=>{disarm();onInvalidation?.(message);throw Error(message)}
      const check=()=>{if(closed||stopped||!armed)throw Error('Translator output is disarmed');for(const[id,p]of outputs)if(access.outputs.get(id)!==p||p.state!=='connected'||outputOwners.get(id)!==key)invalid('Translator output binding lost');for(const[id,p]of inputs)if(access.inputs.get(id)!==p||p.state!=='connected'||p.onmidimessage!==hubs.get(id)?.listener)invalid('Translator input binding lost')}
      const close=()=>{const wasArmed=armed;disarm();stopped=true;routers.delete(close);routingOwners.delete(key);routingChecks.delete(check);if(wasArmed)onInvalidation?.('Translator routing client closed')};routers.add(close);routingChecks.add(check)
      return {disarm,close,check,arm(inputIds:string[],outputIds:string[],sysex:boolean,receive:(inputId:string,bytes:number[])=>void){
        if(stopped||closed)throw Error('Routing client closed');disarm();refresh()
        try{
          if(inputIds.length>32||outputIds.length>32||new Set(inputIds).size!==inputIds.length||new Set(outputIds).size!==outputIds.length)throw Error('Invalid route endpoints')
          if(sysex&&!access.sysexEnabled)throw Error('SysEx permission required')
          for(const id of outputIds){const p=access.outputs.get(id);if(!p?.send||p.state!=='connected'||outputOwners.has(id))throw Error('Translator output unavailable or owned by an editor');outputs.set(id,p)}
          for(const[id]of outputs)outputOwners.set(id,key)
          const revision=epoch
          for(const id of inputIds){const p=access.inputs.get(id);if(!p||p.state!=='connected')throw Error('Translator input unavailable');inputs.set(id,p);offInputs.push(observeInput(id,bytes=>{if(revision!==epoch)return;try{check();receive(id,bytes)}catch{disarm()}}))}
          allowSysex=sysex;armed=true
        }catch(e){disarm();throw e}
      },send(outputId:string,bytes:number[]){check();const p=outputs.get(outputId);if(!p||!validMessage(bytes)||bytes[0]===240&&(!allowSysex||!access.sysexEnabled))throw Error('Translator MIDI packet refused');try{p.send!([...bytes])}catch(e){disarm();throw e}}}
    },
    refresh,
    close() {
      if (closed) return; closed = true
      for(const close of [...routers])close()
      for (const [owner, l] of leases) { release(owner, l); l.disposed = true; l.packets.clear(); l.states.clear(); l.activity.clear(); l.presenceListeners.clear() }
      leases.clear()
      observers.clear()
      if (access.onstatechange === stateChange) access.onstatechange = previousStateChange
    },
  }
}
export type MidiBroker = ReturnType<typeof createMidiBroker>
