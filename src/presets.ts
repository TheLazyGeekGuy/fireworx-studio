import { parseProfile, valueLimit, type Bcr32Profile } from './profile'
import { currentDevice, scopedKey } from './devices'
import { validLedMode, type LedMode } from './led-modes'
import type { DeviceDefinition } from './device-definition'

// Per controller model (src/devices.ts): the BCR32 keeps these keys, another model gets bcr-studio.<model>.…
export const presetStorageKey = scopedKey('bcr32-studio.presets.v1')
export const draftStorageKey = scopedKey('bcr32-studio.draft.v1')
export const groups = ['encoders', 'pushes', 'buttons'] as const
export type ControlGroup = typeof groups[number]
export type VisualLabels = Record<ControlGroup, string[]>
export type PresetValues = Record<ControlGroup, (number | null)[]>
export interface ControllerState {
  profile: Bcr32Profile
  labels: VisualLabels
  values: PresetValues
  ringMode: LedMode
}
export interface ControllerPreset extends ControllerState {
  format: 'bcr32-controller-preset'
  version: 1
  id: string
  name: string
  updatedAt: string
}
export const controlIndex = (kind: ControlGroup, id: number, device: DeviceDefinition = currentDevice) => kind === 'buttons' ? device.controls.buttonIds.indexOf(id) : id - 1
export const emptyLabels = (device: DeviceDefinition = currentDevice): VisualLabels => ({ encoders: Array(device.controls.encoders).fill(''), pushes: Array(device.controls.pushes).fill(''), buttons: Array(device.controls.buttonIds.length).fill('') })
export const emptyValues = (device: DeviceDefinition = currentDevice): PresetValues => ({ encoders: Array(device.controls.encoders).fill(null), pushes: Array(device.controls.pushes).fill(null), buttons: Array(device.controls.buttonIds.length).fill(null) })
export const cleanLabel = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 48)

export function parseControllerState(value: unknown, device: DeviceDefinition = currentDevice): ControllerState {
  if (!value || typeof value !== 'object') throw new Error('Invalid state')
  const s = value as ControllerState
  const profile = parseProfile(s.profile, device)
  if (!validLedMode(s.ringMode)) throw new Error('Invalid LED ring mode')
  const labels = emptyLabels(device), values = emptyValues(device)
  for (const kind of groups) {
    const count = kind === 'buttons' && s.profile.buttons?.length === 20 ? 20 : kind === 'encoders' && device.id === 'bcf2000' && s.profile.encoders?.length === 40 ? 40 : profile[kind].length
    if (!Array.isArray(s.labels?.[kind]) || s.labels[kind].length !== count ||
      !s.labels[kind].every(v => typeof v === 'string' && v.length <= 48 && cleanLabel(v) === v)) throw new Error('Invalid labels')
    if (!Array.isArray(s.values?.[kind]) || s.values[kind].length !== count ||
      !s.values[kind].every((v, i) => v === null || (Number.isInteger(v) && v >= 0 && v <= valueLimit(profile[kind][i])))) throw new Error('Invalid values')
    labels[kind] = [...s.labels[kind], ...Array(profile[kind].length - count).fill('')]
    values[kind] = [...s.values[kind], ...Array(profile[kind].length - count).fill(null)]
  }
  return JSON.parse(JSON.stringify({ profile, labels, values, ringMode: s.ringMode })) as ControllerState
}
export function parsePreset(value: unknown, device: DeviceDefinition = currentDevice): ControllerPreset {
  const p = value as ControllerPreset
  if (!p || p.format !== 'bcr32-controller-preset' || p.version !== 1 ||
    typeof p.id !== 'string' || !p.id.length || p.id.length > 100 ||
    typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || /[\u0000-\u001f\u007f]/.test(p.name) ||
    typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt))) throw new Error('Invalid preset')
  return { ...parseControllerState(p, device), format: p.format, version: 1, id: p.id, name: p.name, updatedAt: p.updatedAt }
}
export function makePreset(state: ControllerState, name: string, id: string = crypto.randomUUID(), updatedAt = new Date().toISOString(), device: DeviceDefinition = currentDevice): ControllerPreset {
  return parsePreset({ ...state, format: 'bcr32-controller-preset', version: 1, id, name: name.trim(), updatedAt }, device)
}
export function parseLibrary(value: unknown, device: DeviceDefinition = currentDevice): ControllerPreset[] {
  const bank = value as { format: string; version: number; presets: unknown[] }
  if (!bank || bank.format !== 'bcr32-preset-library' || bank.version !== 1 || !Array.isArray(bank.presets) || bank.presets.length > 500) throw new Error('Invalid library')
  const result = bank.presets.map(p => parsePreset(p, device))
  if (new Set(result.map(p => p.id)).size !== result.length) throw new Error('Duplicate identifiers')
  return result
}
export const libraryFile = (presets: ControllerPreset[]) => ({ format: 'bcr32-preset-library', version: 1, presets })
export const sameState = (a: ControllerState, b: ControllerState) => JSON.stringify(parseControllerState(a)) === JSON.stringify(parseControllerState(b))
