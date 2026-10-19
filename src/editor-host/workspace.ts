import type { EditorRegistry } from './registry'
import type { MidiBroker, MidiAuthorization, EndpointBinding } from './midi-broker'
import type { Appearance, AppearanceOverride, EditorSession } from './contracts'
import { themes } from '../themes'
import { validDisplayStyle } from '../display-styles'
import {nextInstanceName} from './catalog'
import {validatePresentation,type createPresentationPreferences} from './presentation-preferences'

export interface WorkspaceEntry {
  id: string; moduleId: string; name: string; pinned: boolean; appearance: AppearanceOverride
  session: EditorSession
}
export function createEditorWorkspace(registry: EditorRegistry, broker: MidiBroker, options: {
  id?: () => string; now?: () => number; appearance?: Appearance;presentation?:ReturnType<typeof createPresentationPreferences>
} = {}) {
  const entries = new Map<string, WorkspaceEntry>(), enabled = new Set(registry.list().map(m => m.id))
  const viewStates = new Map<string, unknown>()
  const closingListeners=new Set<(id:string)=>void>()
  const grants = new Map<string, MidiAuthorization>(), subscriptions = new Map<string, () => void>(), listeners = new Set<() => void>(), shellListeners=new Set<()=>void>()
  let active: string | null = null, closed = false
  let defaults: Appearance = { theme: 'original', displayStyle: 'ice', ...options.appearance }
  const validAppearance = (v: AppearanceOverride, inherit = true) => {
    if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['theme','displayStyle'].includes(k)) ||
      v.theme !== undefined && !(inherit && v.theme === 'inherit') && !themes.some(t => t.id === v.theme) ||
      v.displayStyle !== undefined && !(inherit && v.displayStyle === 'inherit') && !validDisplayStyle(v.displayStyle)) throw Error('Invalid editor appearance')
  }
  validAppearance(defaults, false)
  const notifySession = () => { for (const fn of listeners) { try { fn() } catch { /* observer isolation */ } } }
  const notifyShell = () => { for (const fn of shellListeners) { try { fn() } catch { /* observer isolation */ } } }
  const notify = () => {notifySession();notifyShell()}
  const ensure = () => { if (closed) throw Error('Editor workspace closed') }
  const entry = (id: string) => { ensure(); const e = entries.get(id); if (!e) throw Error('Unknown editor instance'); return e }
  const revoke = (id: string) => { const token = grants.get(id); if (token) broker.revoke(token); grants.delete(id) }
  const closeEntry = (id: string) => {
    // Abort view-owned auto-connect/poll work before releasing its lease. A queued broker observer
    // otherwise can try to rebind a closed transport before the deferred view-manager sync.
    for(const fn of closingListeners)try{fn(id)}catch{/* teardown of one adapter cannot block the host */}
    options.presentation?.release(id)
    revoke(id)
    try { subscriptions.get(id)?.() } catch { /* A module cannot prevent host cleanup. */ }
    subscriptions.delete(id)
    try { entries.get(id)!.session.dispose() } catch { /* Isolate a faulty module's teardown. */ }
    finally { bindings.get(id)?.dispose(); entries.delete(id); viewStates.delete(id) }
    if (active === id) active = entries.keys().next().value ?? null
  }
  // Transport leases stay private. The shell can bind a pair but cannot hand raw ports to modules.
  const bindings = new Map<string, ReturnType<MidiBroker['createLease']>>()
  return {
    create(moduleId: string, opts: { id?: string; name?: string; restored?: unknown } = {}) {
      ensure(); const module = registry.get(moduleId)
      if (entries.size >= 32) throw Error('Workspace instance limit reached')
      if (!enabled.has(moduleId)) throw Error('Editor module disabled')
      const id = opts.id ?? options.id?.() ?? crypto.randomUUID(), name = opts.name ?? nextInstanceName(module.manifest.name,[...entries.values()].map(e=>e.name))
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || entries.has(id) || typeof name !== 'string' || !name.trim() || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) throw Error('Invalid editor instance')
      const midi = broker.createLease(id, module.validateQuery, module.validateBrightnessWrite, module.validateFeedbackWrite,module.validateDeviceControlWrite,module.validateEditBufferWrite,module.validatePresetStoreWrite)
      let session: EditorSession
      try { session = module.create({ instanceId: id, midi, now: options.now ?? (() => performance.now()) }, opts.restored) }
      catch (e) { midi.dispose(); throw e }
      entries.set(id, { id, moduleId, name, pinned: false, appearance: {}, session }); bindings.set(id, midi)
      const offSession=session.subscribe(notifySession),offState=midi.onState(notifyShell)
      subscriptions.set(id,()=>{offSession();offState()}); active = id; notify(); return id
    },
    list() { return [...entries.values()].map(e => ({ id: e.id, moduleId: e.moduleId, name: e.name, pinned: e.pinned,
      appearance: { ...e.appearance }, snapshot: { ...e.session.getSnapshot(), ...(viewStates.has(e.id) ? { state: viewStates.get(e.id) } : {}) }, connection: bindings.get(e.id)!.getState() })) },
    getTransport(id: string) { entry(id); return bindings.get(id)! },
    updateViewState(id: string, value: unknown) {
      const e = entry(id)
      viewStates.set(id, registry.get(e.moduleId).validateState(value))
      // The mounted full editor owns the UI state during migration. Do not rerender the shell on every MIDI value.
    },
    getSession(id: string) { return entry(id).session },
    getActive: () => active,
    activate(id: string) { entry(id); active = id; notify() },
    subscribe(fn: () => void) { ensure(); listeners.add(fn); return () => { listeners.delete(fn) } },
    // Rail/tabs subscribe here, never to per-packet live values. Views subscribe to their own authoritative state.
    subscribeShell(fn:()=>void){ensure();shellListeners.add(fn);return()=>{shellListeners.delete(fn)}},
    subscribeClosing(fn:(id:string)=>void){ensure();closingListeners.add(fn);return()=>{closingListeners.delete(fn)}},
    bind(id: string, pair: EndpointBinding) { entry(id); bindings.get(id)!.bind(pair); revoke(id); notify() },
    disconnect(id: string) { entry(id); revoke(id); bindings.get(id)!.release(); notify() },
    setSending(id: string, value: boolean) {
      const e = entry(id); if (typeof value !== 'boolean') throw Error('Invalid sending policy')
      revoke(id); e.session.setSending(false)
      if (value) { const grant = broker.authorize(id, 'value'); grants.set(id, grant); e.session.setSending(true, grant) }
      notify()
    },
    setLocked(id: string, value: boolean) { entry(id).session.setLocked(value);notifyShell() },
    pin(id: string, value: boolean) { if (typeof value !== 'boolean') throw Error('Invalid pin'); entry(id).pinned = value; notify() },
    rename(id: string, name: string) {
      if (!name.trim() || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) throw Error('Invalid editor name')
      entry(id).name = name; notify()
    },
    setAppearance(id: string, override: AppearanceOverride) { validAppearance(override); entry(id).appearance = { ...override }; notify() },
    setDefaults(value: Appearance) { ensure(); validAppearance(value, false); defaults = { ...value }; notify() },
    appearance(id: string): Appearance {
      const e = entry(id), result = { ...defaults }
      if (e.appearance.theme && e.appearance.theme !== 'inherit') result.theme = e.appearance.theme
      if (e.appearance.displayStyle && e.appearance.displayStyle !== 'inherit') result.displayStyle = e.appearance.displayStyle
      return result
    },
    closeInstance(id: string, confirmation: { discardChanges?: boolean; unpin?: boolean } = {}) {
      const e = entry(id)
      if (e.pinned && confirmation.unpin !== true) throw Error('Editor tab pinned')
      // Until a persistent save/revision service is integrated, explicit close confirmation protects every draft.
      if (confirmation.discardChanges !== true) throw Error('Confirm editor close or export its state first')
      closeEntry(id); bindings.delete(id); notify()
    },
    setEnabled(moduleId: string, value: boolean, confirmClose = false) {
      ensure(); registry.get(moduleId); if (typeof value !== 'boolean') throw Error('Invalid module state')
      const ids = [...entries.values()].filter(e => e.moduleId === moduleId).map(e => e.id)
      if (!value && ids.length && confirmClose !== true) throw Error('Confirm closing module instances first')
      if (value) enabled.add(moduleId)
      else { ids.forEach(id => { closeEntry(id); bindings.delete(id) }); enabled.delete(moduleId) }
      notify()
    },
    isEnabled: (id: string) => enabled.has(id),
    exportState() {
      ensure(); return { format: 'studio-editor-workspace', version: 1, defaults: { ...defaults }, active,
        ...(options.presentation?{presentation:options.presentation.serialize()}:{}),
        disabledModules: registry.list().filter(m => !enabled.has(m.id)).map(m => m.id),
        instances: [...entries.values()].map(e => ({ id: e.id, moduleId: e.moduleId, moduleVersion: registry.get(e.moduleId).manifest.version,
          stateSchemaVersion: registry.get(e.moduleId).manifest.stateSchemaVersion, name: e.name, pinned: e.pinned, locked: e.session.getSnapshot().locked,
          appearance: { ...e.appearance }, state: viewStates.has(e.id) ? viewStates.get(e.id) : e.session.serialize() })) }
      // No MIDI bindings, authorizations, volatile live connection or enabled sending state are restored implicitly.
    },
    restoreState(value: unknown) {
      ensure(); if (entries.size) throw Error('Restore into an empty workspace to preserve existing instances')
      if (!value || typeof value !== 'object') throw Error('Invalid editor workspace')
      const saved = value as ReturnType<typeof this.exportState>
      if (saved.format !== 'studio-editor-workspace' || saved.version !== 1 || !Array.isArray(saved.instances) || saved.instances.length > 32 ||
        !Array.isArray(saved.disabledModules) || saved.disabledModules.some(id => typeof id !== 'string') ||
        new Set(saved.instances.map(e => e.id)).size !== saved.instances.length) throw Error('Invalid editor workspace')
      validAppearance(saved.defaults, false)
      if (!saved.defaults.theme || !saved.defaults.displayStyle || saved.active !== null && !saved.instances.some(e => e.id === saved.active)) throw Error('Invalid workspace defaults or active tab')
      saved.disabledModules.forEach(id => registry.get(id))
      const presentation=saved.presentation===undefined?undefined:validatePresentation(saved.presentation)
      if(presentation&&Object.keys(presentation.instances).some(id=>!saved.instances.some(e=>e.id===id)))throw Error('Unknown presentation instance')
      // Validate every payload before creating even the first session. No binding or authorization is restored.
      const validated = saved.instances.map(e => {
        const module = registry.get(e.moduleId)
        if (saved.disabledModules.includes(e.moduleId) || module.manifest.version !== e.moduleVersion || module.manifest.stateSchemaVersion !== e.stateSchemaVersion ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(e.id) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80 ||
          /[\x00-\x1f\x7f]/.test(e.name) || typeof e.pinned !== 'boolean' || typeof e.locked !== 'boolean') throw Error('Incompatible editor workspace instance')
        validAppearance(e.appearance)
        return { ...e, state: module.validateState(e.state) }
      })
      const created: string[] = [], oldEnabled = new Set(enabled), oldDefaults = defaults
      try {
        enabled.clear(); registry.list().forEach(m => { if (!saved.disabledModules.includes(m.id)) enabled.add(m.id) })
        for (const e of validated) {
          const id = this.create(e.moduleId, { id: e.id, name: e.name, restored: e.state }); created.push(id)
          entries.get(id)!.pinned = e.pinned; entries.get(id)!.appearance = { ...e.appearance }; entries.get(id)!.session.setLocked(e.locked)
        }
        if(presentation)options.presentation?.restore(presentation)
        defaults = { ...saved.defaults }; active = saved.active; notify()
      } catch (error) {
        created.forEach(id => { closeEntry(id); bindings.delete(id) }); enabled.clear(); oldEnabled.forEach(id => enabled.add(id)); defaults = oldDefaults; active = null; notify(); throw error
      }
    },
    dispose() { if (closed) return; [...entries.keys()].forEach(closeEntry); bindings.clear(); closed = true; listeners.clear();shellListeners.clear();closingListeners.clear() },
  }
}
