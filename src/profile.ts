import { validLedMode, type LedMode } from './led-modes'
import { currentDevice } from './devices'
import type { DeviceDefinition } from './device-definition'
import { validParameterState, validProfileParameters, type ParameterState, type ProfileParameters } from './parameter-state'
export type EncoderType = 'off' | 'cc' | 'nrpn' | 'pb' | 'at' | 'gs' | 'pc' | 'note' | 'mmc'
export const buttonIds = [...currentDevice.controls.buttonIds]
export const mmcCommands = ['Play', 'Pause', 'Stop', 'Forward', 'Rewind', 'Location', 'In', 'Out'] as const
export interface ControllerSettings {
  startupMode: 'ctrl' | 'zqr'; deviceId: number; operationMode: 'usb' | 'stdl' | 'mixed'
  footswitchModes: ('ctrl' | 'zaq')[]; outputRouting: string; thruSource: 'off' | 'midi' | 'usb'; thruDestination: string; thruFiltered: boolean
  // Other global settings read from (or chosen for) the controller, by SysEx command in hex (src/device-globals.ts).
  deviceValues?: Record<string, number>
}
export const routingOptions = ['USB', 'MIDI A', 'MIDI B', 'MIDI A & B', 'USB & MIDI A', 'USB & MIDI B', 'USB & MIDI A & B']
// The controller output can also be Off (device value 0).
export const outputRoutingOptions = ['Off', ...routingOptions]
export const defaultSettings = (): ControllerSettings => ({ startupMode: 'ctrl', deviceId: 1, operationMode: 'mixed', footswitchModes: ['ctrl', 'ctrl'], outputRouting: 'USB', thruSource: 'off', thruDestination: 'Off', thruFiltered: false })
export type EncoderMode = 'absolute' | 'abs_14' | 'rel1' | 'rel2' | 'rel3' | 'r1_14' | 'r2_14' | 'r3_14' | 'inc_dec' | 'toggle' | 'momentary'
export const rotationModes: EncoderMode[] = ['absolute', 'abs_14', 'rel1', 'rel2', 'rel3', 'r1_14', 'r2_14', 'r3_14', 'inc_dec']
export const is14Bit = (encoder: Pick<Encoder, 'mode'>) => ['abs_14', 'r1_14', 'r2_14', 'r3_14'].includes(encoder.mode)
export const isRelative = (encoder: Pick<Encoder, 'mode'>) => ['rel1', 'rel2', 'rel3', 'r1_14', 'r2_14', 'r3_14', 'inc_dec'].includes(encoder.mode)
export const parameterLimit = (encoder: Pick<Encoder, 'type'>) => encoder.type === 'nrpn' ? 16383 : 127
export const modesFor = (type: EncoderType, rotation: boolean, device: DeviceDefinition = currentDevice): EncoderMode[] => !rotation ? type === 'pc' ? ['momentary', 'inc_dec'] : type === 'gs' ? ['momentary', 'toggle'] : type === 'mmc' ? ['momentary'] : ['momentary', 'toggle', 'inc_dec'] :
  type === 'pb' || type === 'at' || type === 'pc' || type === 'gs' && device.protocol === 'bcl' ? ['absolute'] : type === 'cc' ? rotationModes.filter(m => m !== 'inc_dec') : rotationModes
export const typesFor = (rotation: boolean): EncoderType[] => rotation ? ['off', 'pc', 'cc', 'nrpn', 'pb', 'at', 'gs'] : ['off', 'pc', 'cc', 'nrpn', 'note', 'at', 'gs', 'mmc']

export interface Encoder {
  parameterState?: ParameterState
  pc?: { bankMsb: number | 'off'; bankLsb: number | 'off'; program: number | 'off'; continuous?: boolean }
  gsParameter?: string
  id: number
  type: EncoderType
  channel: number
  parameter: number
  minimum: number
  maximum: number
  mode: EncoderMode
  increment?: number
  ledMode?: LedMode
  display?: boolean
  parameterOff?: boolean
  minimumOff?: boolean
  aftertouchAll?: boolean
  mmc?: { deviceId: number | 'all'; command: typeof mmcCommands[number]; locate: number[]; locateOff?: boolean[]; frameRate: 'off' | '24' | '25' | '30' | '30d' }
}
export const valueLimit = (encoder: Pick<Encoder, 'mode'>) => is14Bit(encoder) ? 16383 : 127

export interface ControllerProfile {
  schemaVersion: 2
  device: { model: string; firmwareObserved: string | null } // model: DeviceDefinition.profileModel
  encoders: Encoder[]
  pushes: Encoder[]
  buttons: Encoder[]
  settings?: ControllerSettings
  parameters?: ProfileParameters
}
// Compatibility name for existing imports; new integrations can use the model-neutral name.
export type Bcr32Profile = ControllerProfile

export const createEncoder = (id: number): Encoder => ({
  id,
  type: 'off',
  channel: 1,
  parameter: 0,
  minimum: 0,
  maximum: 127,
  mode: 'absolute',
})

export const createProfile = (device: DeviceDefinition = currentDevice): Bcr32Profile => ({
  schemaVersion: 2,
  device: { model: device.profileModel, firmwareObserved: null },
  encoders: Array.from({ length: device.controls.encoders }, (_, index) => createEncoder(index + 1)),
  pushes: Array.from({ length: device.controls.pushes }, (_, index) => ({ ...createEncoder(index + 1), mode: 'momentary' })),
  buttons: device.controls.buttonIds.map(id => ({ ...createEncoder(id), mode: 'momentary' })),
  settings: defaultSettings(),
})

export function parseProfile(value: unknown, device: DeviceDefinition = currentDevice): Bcr32Profile {
  if (!value || typeof value !== 'object') throw new Error('Invalid profile')
  const p = value as Bcr32Profile
  // Older BCF profiles contain only the eight physical faders. Add the newly exposed pedal, never truncate.
  const buttonIds = [...device.controls.buttonIds]
  const encoders = device.id === 'bcf2000' && p.encoders?.length === 40 ? [...p.encoders,createEncoder(41)] : p.encoders
  if (Number(p.schemaVersion) !== 1 && p.schemaVersion !== 2) throw new Error('Unknown version')
  // A profile belongs to one model (absent model: an early BCR32 profile).
  if ((p.device?.model ?? 'BCR-32') !== device.profileModel) throw new Error('Profile for another controller model')
  const valid = (list: Encoder[], ids: number[]) => Array.isArray(list) && list.length === ids.length && list.every((e, i) =>
    e && e.id === ids[i] && ['off', 'cc', 'nrpn', 'pb', 'at', 'gs', 'pc', 'note', 'mmc'].includes(e.type) &&
    [...rotationModes, 'toggle', 'momentary'].includes(e.mode) &&
    Number.isInteger(e.channel) && e.channel >= 1 && e.channel <= 16 &&
    Number.isInteger(e.parameter) && e.parameter >= 0 && e.parameter <= parameterLimit(e) &&
    [e.minimum, e.maximum].every(n => Number.isInteger(n) && n >= 0 && n <= valueLimit(e)) && e.minimum <= e.maximum &&
    (e.increment === undefined || Number.isInteger(e.increment) && e.increment >= -127 && e.increment <= 127) &&
    (e.ledMode === undefined || validLedMode(e.ledMode)) &&
    (e.parameterState === undefined || validParameterState(e.parameterState)) &&
    (e.pc === undefined || [e.pc.bankMsb, e.pc.bankLsb, e.pc.program].every(v => v === 'off' || Number.isInteger(v) && v >= 0 && v <= 127) && (e.pc.continuous === undefined || typeof e.pc.continuous === 'boolean')) &&
    (e.gsParameter === undefined || typeof e.gsParameter === 'string' && /^[a-z-]{1,32}$/.test(e.gsParameter)) &&
    ['display', 'parameterOff', 'minimumOff', 'aftertouchAll'].every(k => (e as unknown as Record<string, unknown>)[k] === undefined || typeof (e as unknown as Record<string, unknown>)[k] === 'boolean') &&
    (e.mmc === undefined || (e.mmc.deviceId === 'all' || Number.isInteger(e.mmc.deviceId) && e.mmc.deviceId >= 0 && e.mmc.deviceId <= 126) && mmcCommands.includes(e.mmc.command) && ['off','24','25','30','30d'].includes(e.mmc.frameRate) && Array.isArray(e.mmc.locate) && e.mmc.locate.length === 4 && e.mmc.locate.every(v => Number.isInteger(v) && v >= 0 && v <= 127) && (e.mmc.locateOff === undefined || Array.isArray(e.mmc.locateOff) && e.mmc.locateOff.length === 2 && e.mmc.locateOff.every(v=>typeof v==='boolean'))))
  if (!valid(encoders, Array.from({ length: device.controls.encoders }, (_, i) => i + 1))) throw new Error('Invalid encoders')
  if (Number(p.schemaVersion) === 2 && (!valid(p.pushes, Array.from({ length: device.controls.pushes }, (_, i) => i + 1)) || !valid(p.buttons, p.buttons?.length === 20 ? buttonIds.slice(0, 20) : buttonIds))) throw new Error('Invalid buttons')
  const settings = { ...defaultSettings(), ...p.settings }
  if (p.parameters !== undefined && !validProfileParameters(p.parameters)) throw new Error('Invalid protocol parameters')
  if (settings.deviceValues !== undefined && (typeof settings.deviceValues !== 'object' || settings.deviceValues === null || Object.entries(settings.deviceValues).some(([k, v]) => !/^[0-9a-f]{2}$/.test(k) || !Number.isInteger(v) || v < 0 || v > 127))) throw new Error('Invalid settings')
  if (!['ctrl','zqr'].includes(settings.startupMode) || !['usb','stdl','mixed'].includes(settings.operationMode) || !Number.isInteger(settings.deviceId) || settings.deviceId < 1 || settings.deviceId > 255 || !outputRoutingOptions.includes(settings.outputRouting) || !['off','midi','usb'].includes(settings.thruSource) || !['Off',...routingOptions].includes(settings.thruDestination) || typeof settings.thruFiltered !== 'boolean' || !Array.isArray(settings.footswitchModes) || settings.footswitchModes.length !== 2 || !settings.footswitchModes.every(m => ['ctrl','zaq'].includes(m))) throw new Error('Invalid settings')
  return { ...createProfile(device), ...p, schemaVersion: 2, device: { model: device.profileModel, firmwareObserved: typeof p.device?.firmwareObserved === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p.device.firmwareObserved) ? p.device.firmwareObserved : null },
    encoders,
    pushes: Number(p.schemaVersion) === 1 ? createProfile(device).pushes : p.pushes,
    buttons: Number(p.schemaVersion) === 1 ? createProfile(device).buttons : [...p.buttons, ...createProfile(device).buttons.slice(p.buttons.length)], settings }
}

export const ccPlan = (current: Bcr32Profile): Bcr32Profile => ({
  ...current,
  encoders: current.encoders.map((encoder, index) => ({
    ...encoder,
    type: 'cc',
    channel: 1,
    parameter: index,
    minimum: 0,
    maximum: 127,
    mode: 'absolute',
  })),
})

export const updateEncoder = (
  profile: Bcr32Profile,
  updated: Encoder,
): Bcr32Profile => ({
  ...profile,
  encoders: profile.encoders.map((encoder) => encoder.id === updated.id ? updated : encoder),
})
