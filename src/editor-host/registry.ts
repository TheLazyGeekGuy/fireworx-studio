import { editorSdkVersion, type EditorModule } from './contracts'
import {validateInstrumentDefinition} from '../instrument-sdk/contracts'
import {validateDeviceFamilyMember} from './device-family'

// Explicit static registration. Validation never calls an editor factory.
export function createEditorRegistry(definitions: readonly EditorModule[]) {
  const modules = new Map<string, EditorModule>()
  for (const module of definitions) {
    const m = module.manifest
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(m.id) || !/^[a-z][a-z0-9-]{0,63}$/.test(m.modelId) || modules.has(m.id) ||
      !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(m.version) || m.sdkVersion !== editorSdkVersion ||
      !Number.isInteger(m.stateSchemaVersion) || m.stateSchemaVersion < 1 || !m.name || m.name.length > 80 ||
      !Array.isArray(m.capabilities) || m.capabilities.some(c => typeof c !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(c)) ||
      typeof module.create !== 'function' || typeof module.validateQuery !== 'function' || typeof module.validateState !== 'function') throw Error('Invalid or incompatible editor module')
    const instrument=module.instrument===undefined?undefined:validateInstrumentDefinition(module.instrument)
    if(instrument&&instrument.modelId!==m.modelId)throw Error('Instrument/model mismatch')
    const family=module.family===undefined?undefined:validateDeviceFamilyMember(module.family)
    if(family&&family.modelId!==m.modelId)throw Error('Family/model mismatch')
    modules.set(m.id, Object.freeze({ ...module,...(instrument?{instrument}:{}),...(family?{family}:{}), manifest: Object.freeze({ ...m, capabilities: Object.freeze([...m.capabilities]) }) }))
  }
  return {
    list: () => [...modules.values()].map(m => m.manifest),
    get(id: string) { const module = modules.get(id); if (!module) throw Error('Unknown editor module'); return module },
  }
}
export type EditorRegistry = ReturnType<typeof createEditorRegistry>
