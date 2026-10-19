import catalog from './device-catalog.json'
import type { DeviceDefinition } from './device-definition'
// Wire identity and protocol capabilities as portable JSON; layout and protocol behavior remain adapters.
export function catalogDefinition(id: keyof typeof catalog.models): Pick<DeviceDefinition, 'profileModel' | 'sysex' | 'portName' | 'presetSlots' | 'protocol' | 'parameterSchema'> {
  const m = catalog.models[id]
  if (m.manufacturer.length !== 3 || !m.manufacturer.every(n => Number.isInteger(n) && n >= 0 && n <= 127)) throw new Error('Invalid manufacturer')
  return { profileModel: m.profileModel, sysex: { manufacturer: m.manufacturer as [number,number,number], deviceId: m.deviceId, model: m.modelByte }, portName: new RegExp(m.portPattern, 'i'), presetSlots: m.presetSlots, protocol: m.protocol, parameterSchema: m.parameterSchema ?? undefined }
}
export const modelCatalog = catalog.models
