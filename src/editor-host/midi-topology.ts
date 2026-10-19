import type {MidiAccess,MidiConnectionEvent,MidiPort} from '../web-midi'
import {nativePortAvailable,validateNativeInventory,type NativeInventory,type NativePresenceProvider} from './native-presence'

type StateTarget=Partial<Pick<MidiAccess,'onstatechange'|'addEventListener'|'removeEventListener'>>
export interface TopologyTimers {set:(fn:()=>void,delay:number)=>unknown;clear:(id:unknown)=>void}
const defaultTimers:TopologyTimers={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>)}

/** Observe topology, never packet inactivity. No permissions, MIDI output or model knowledge. */
export function watchMidiTopology(source:MidiAccess,target:MidiAccess,changed:()=>void,
  options:{timers?:TopologyTimers;interval?:number;nativePresence?:NativePresenceProvider;onNativeStatus?:(status:'checking'|'available'|'unavailable'|'lost')=>void}={}){
  const timers=options.timers??defaultTimers,interval=options.interval??1000
  if(!Number.isFinite(interval)||interval<100)throw Error('Invalid MIDI topology interval')
  const attached=new Map<MidiPort,()=>void>(),identities=new WeakMap<MidiPort,number>()
  const disconnected={input:new Map<string,MidiPort>(),output:new Map<string,MidiPort>()}
  let nextIdentity=0,signature='',disposed=false,scanning=false,pending=false,timer:unknown
  let inventory:NativeInventory|null=null,nativePending=!!options.nativePresence,nativeEstablished=false,nativeFailed=false,nativeRequest:AbortController|null=null
  let nativeStatus=''
  const status=(value:'checking'|'available'|'unavailable'|'lost')=>{if(value!==nativeStatus){nativeStatus=value;options.onNativeStatus?.(value)}}
  const allowed=(direction:'input'|'output',port:MidiPort)=>!nativePending&&!(nativeEstablished&&nativeFailed)&&(!inventory||nativePortAvailable(inventory,direction,port))
  function listen(object:StateTarget){
    if(object.addEventListener&&object.removeEventListener){object.addEventListener('statechange',event);return()=>object.removeEventListener!('statechange',event)}
    const previous=object.onstatechange,handler=(e?:MidiConnectionEvent)=>{event(e);try{previous?.call(object,e)}catch{/* unrelated observer */}}
    object.onstatechange=handler
    return()=>{if(object.onstatechange===handler)object.onstatechange=previous??null}
  }
  function refresh(force=false){
    if(disposed)return
    if(scanning){pending=true;return}
    scanning=true
    try{
      for(const direction of ['input','output'] as const)for(const [id,port]of disconnected[direction])
        if((direction==='input'?source.inputs:source.outputs).get(id)!==port)disconnected[direction].delete(id)
      const inputs=new Map([...source.inputs].filter(([id,p])=>p.state==='connected'&&disconnected.input.get(id)!==p&&allowed('input',p))),outputs=new Map([...source.outputs].filter(([id,p])=>p.state==='connected'&&disconnected.output.get(id)!==p&&allowed('output',p)))
      const ports=new Set([...source.inputs.values(),...source.outputs.values()])
      for(const [port,off]of attached)if(!ports.has(port)){off();attached.delete(port)}
      for(const port of ports)if(!attached.has(port))attached.set(port,listen(port))
      const describe=(map:Map<string,MidiPort>)=>[...map].map(([id,p])=>{if(!identities.has(p))identities.set(p,++nextIdentity);return [id,identities.get(p),p.state,p.name,p.manufacturer]})
      const next=JSON.stringify([source.sysexEnabled,describe(inputs),describe(outputs)])
      target.inputs=inputs;target.outputs=outputs;target.sysexEnabled=source.sysexEnabled
      if(next!==signature||force){signature=next;changed()}
    }finally{scanning=false;if(pending){pending=false;queueMicrotask(()=>refresh())}}
  }
  function event(e?:MidiConnectionEvent){
    const port=e?.port
    if(port)for(const direction of ['input','output'] as const){
      const current=(direction==='input'?source.inputs:source.outputs).get(port.id)
      if(port.type!==direction&&!(port.type===undefined&&current===port))continue
      // Some shims expose an event-port object before updating their cached map object.
      if(port.state==='disconnected'&&current&&current!==port)disconnected[direction].set(port.id,current)
      else if(port.state==='connected')disconnected[direction].delete(port.id)
    }
    refresh(true)
  }
  const offAccess=listen(source)
  function readNative(){
    if(disposed||!options.nativePresence||nativeRequest)return
    const controller=new AbortController();nativeRequest=controller
    if(nativeStatus==='')status('checking')
    void Promise.resolve().then(()=>options.nativePresence!(controller.signal)).then(raw=>{
      if(disposed)return
      inventory=validateNativeInventory(raw);nativePending=false;nativeEstablished=true;nativeFailed=false;status('available');refresh()
    }).catch(()=>{if(disposed)return;nativePending=false;nativeFailed=true;status(nativeEstablished?'lost':'unavailable');refresh()})
      .finally(()=>{if(nativeRequest===controller)nativeRequest=null})
  }
  const poll=()=>{if(disposed)return;try{refresh();readNative()}finally{if(!disposed)timer=timers.set(poll,interval)}}
  function dispose(){if(disposed)return;disposed=true;nativeRequest?.abort();nativeRequest=null;timers.clear(timer);offAccess();for(const off of attached.values())off();attached.clear();disconnected.input.clear();disconnected.output.clear()}
  try{refresh();readNative();timer=timers.set(poll,interval)}catch(error){dispose();throw error}
  return {refresh,dispose}
}
