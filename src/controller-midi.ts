import { is14Bit, isRelative, valueLimit, type Encoder, type Bcr32Profile } from './profile'
import { currentDevice } from './devices'
import type { DeviceDefinition } from './device-definition'
import { statementValue } from './parameter-state'
import { gsAssignment, validVoiceMessage } from './bcontrol-voice'

export type Control = { kind: 'encoders' | 'pushes' | 'buttons'; id: number }
export type LiveValue = { value: number | null; source: 'local' | 'midi' | 'relative'; msb?: number; pairKey?: string }
export type Change = { control: Control; value?: number; delta?: number }
export const validCC = (data: number[]) => data.length === 3 && data.every(n => Number.isInteger(n) && n >= 0 && n <= 255) && (data[0] & 0xf0) === 0xb0 && data[1] <= 127 && data[2] <= 127

// Relative encodings differ between BCR32 and the B-Control family; choose by protocol, not knob shape.
export function relativeDelta(e: Encoder, raw: number, device: DeviceDefinition = currentDevice): number | null {
  switch (e.mode) {
    case 'rel1': return device.protocol === 'bcl' ? raw < 64 ? raw : raw - 128 : e.minimum === e.maximum ? null : raw === e.minimum ? -1 : raw === e.maximum ? 1 : null
    case 'rel2': return raw - 64
    case 'rel3': return device.protocol === 'bcl' ? raw >= 64 ? -(raw - 64) : raw : raw >= 64 ? raw - 64 : -raw
    case 'r1_14': return device.protocol === 'bcl' ? raw < 8192 ? raw : raw - 16384 : raw < 8192 ? -raw : 16384 - raw
    case 'r2_14': return raw - 8192
    case 'r3_14': return raw >= 8192 ? -(raw - 8192) : raw
    default: return null
  }
}
export function applyChange(e: Encoder, previous: LiveValue | undefined, change: Pick<Change, 'value' | 'delta'>): LiveValue {
  if (change.value !== undefined) return { value: change.value, source: 'midi' }
  // Relative MIDI contains no absolute position. Minimum is a local reference.
  return { value: Math.max(e.minimum, Math.min(e.maximum, (previous?.value ?? e.minimum) + (change.delta ?? 0))), source: 'relative' }
}
export function matchesCC(e: Encoder, data: number[]) {
  return validCC(data) && e.type === 'cc' && !e.parameterOff && e.channel === (data[0] & 15) + 1 && e.mode !== 'inc_dec' &&
    (is14Bit(e) ? e.parameter <= 31 && [e.parameter, e.parameter + 32].includes(data[1]) : e.parameter === data[1])
}
export function receiveControlCC(e: Encoder, previous: LiveValue | undefined, data: number[], device: DeviceDefinition = currentDevice): LiveValue | undefined {
  if (!matchesCC(e, data)) return previous
  let raw = data[2]
  const pairKey = `${e.channel}:${e.parameter}:${e.mode}`
  if (is14Bit(e)) {
    if (data[1] === e.parameter) return { value: previous?.value ?? null, source: previous?.source ?? 'midi', msb: raw, pairKey }
    if (previous?.pairKey !== pairKey || previous.msb === undefined) return previous
    raw += previous.msb * 128
  }
  const delta = relativeDelta(e, raw, device)
  const result = isRelative(e) ? delta === null || delta === 0 ? previous : applyChange(e, previous, { delta }) : applyChange(e, previous, { value: raw })
  // A relative pair represents an event: consume its MSB, don't replay it.
  if (is14Bit(e) && isRelative(e) && result) return { value: result.value, source: result.source }
  return is14Bit(e) && !isRelative(e) && result ? { ...result, msb: previous!.msb, pairKey } : result
}

export function createMidiDecoder(profile: Bcr32Profile, device: DeviceDefinition = currentDevice) {
  const controls = (['encoders', 'pushes', 'buttons'] as const).flatMap(kind => profile[kind].filter(e => !e.parameterState?.opaque).map(e => ({ e: device.protocol === 'bcl' && e.type === 'gs' ? gsAssignment(e) ?? e : e, control: { kind, id: e.id } })))
  const pending = new Map<string, LiveValue>()
  const banks = new Map<number, { msb?: number; lsb?: number }>()
  const nrpn = new Map<number, { msb?: number; lsb?: number; data?: number; active: boolean; freshMsb?: boolean; freshLsb?: boolean }>()
  return (data: number[]): Change[] => {
    if (!validCC(data)) {
      if (device.protocol !== 'bcl' || !validVoiceMessage(data)) return []
      const type = data[0] & 0xf0, ch = (data[0] & 15) + 1
      return controls.flatMap(({e,control}) => {
        if (e.channel !== ch) return []
        if (e.type === 'note' && [0x80,0x90].includes(type) && e.parameter === data[1]) return [{control,value:type === 0x80 ? 0 : data[2]}]
        if (e.type === 'pb' && type === 0xe0) return [{control,value:data[2]}]
        if (e.type === 'at' && (e.aftertouchAll ? type === 0xd0 : type === 0xa0 && e.parameter === data[1])) return [{control,value:data[e.aftertouchAll ? 1 : 2]}]
        if (e.type === 'pc' && e.pc && type === 0xc0 && (e.pc.continuous || e.pc.program === data[1])) {
          const bank = banks.get(ch)
          if (e.pc.bankMsb !== 'off' && bank?.msb !== e.pc.bankMsb || e.pc.bankLsb !== 'off' && bank?.lsb !== e.pc.bankLsb) return []
          return [{control,value:data[1]}]
        }
        return []
      })
    }
    const channel = (data[0] & 15) + 1, cc = data[1], raw = data[2]
    if (cc === 0 || cc === 32) banks.set(channel,{...banks.get(channel),[cc === 0 ? 'msb' : 'lsb']:raw})
    if (cc === 121) banks.delete(channel)
    const selected: { msb?: number; lsb?: number; data?: number; active: boolean; freshMsb?: boolean; freshLsb?: boolean } = nrpn.get(channel) ?? { active: false }
    if (cc === 99 || cc === 98) {
      // Require both fresh address bytes, in either order. No stale selector.
      if (selected.active) { selected.freshMsb = false; selected.freshLsb = false }
      if (cc === 99) { selected.msb = raw; selected.freshMsb = true }
      else { selected.lsb = raw; selected.freshLsb = true }
      selected.data = undefined; selected.active = !!selected.freshMsb && !!selected.freshLsb; nrpn.set(channel, selected)
    }
    if (cc === 100 || cc === 101 || cc === 121) { nrpn.delete(channel); selected.active = false }
    const parameter = selected.msb !== undefined && selected.lsb !== undefined ? selected.msb * 128 + selected.lsb : -1
    const changes: Change[] = []
    for (const { e: configured, control } of controls) {
      const e: Encoder = control.kind !== 'encoders' && configured.mode === 'inc_dec' ? { ...configured, mode: 'absolute' } : configured
      if (e.channel !== channel) continue
      if (e.type === 'cc' && matchesCC(e, data)) {
        const key = `${control.kind}:${e.id}`, old = pending.get(key)
        const next = receiveControlCC(e, old, data, device)
        if (next) pending.set(key, next)
        if (is14Bit(e) && cc === e.parameter) continue
        if (!next || next === old) continue
        if (isRelative(e)) {
          const word = is14Bit(e) ? (old?.msb ?? 0) * 128 + raw : raw
          const delta = relativeDelta(e, word, device)
          if (delta) changes.push({ control, delta })
        } else changes.push({ control, value: next.value! })
      } else if (e.type === 'nrpn' && selected.active && parameter !== 16383 && e.parameter === parameter) {
        if (e.mode === 'inc_dec' && control.kind === 'encoders') {
          if (cc === 96 || cc === 97) changes.push({ control, delta: cc === 96 ? 1 : -1 })
        } else if (cc === 6 && !is14Bit(e)) {
          const delta = relativeDelta(e, raw, device)
          if (isRelative(e)) { if (delta) changes.push({ control, delta }) }
          else changes.push({ control, value: raw })
        } else if (cc === 38 && is14Bit(e) && selected.data !== undefined) {
          const word = selected.data * 128 + raw, delta = relativeDelta(e, word, device)
          if (isRelative(e)) { if (delta) changes.push({ control, delta }) }
          else changes.push({ control, value: word })
        }
      }
    }
    if (selected.active && cc === 6) selected.data = raw
    if (cc === 38) selected.data = undefined
    return changes
  }
}

// Limit synthetic gestures to 256 unit increments: no unbounded MIDI burst.
export function relativeWords(e: Encoder, delta: number, device: DeviceDefinition = currentDevice): number[] | null {
  if (!Number.isInteger(delta) || Math.abs(delta) > 256 || e.mode === 'rel1' && e.minimum === e.maximum) return null
  const positive = delta > 0
  const word = device.protocol === 'bcl' && e.mode === 'rel1' ? positive ? 1 : 127 : device.protocol === 'bcl' && e.mode === 'rel3' ? positive ? 1 : 65 : device.protocol === 'bcl' && e.mode === 'r1_14' ? positive ? 1 : 16383 : e.mode === 'rel1' ? positive ? e.maximum : e.minimum :
    e.mode === 'rel2' ? positive ? 65 : 63 : e.mode === 'rel3' ? positive ? 65 : 1 :
    e.mode === 'r1_14' ? positive ? 16383 : 1 : e.mode === 'r2_14' ? positive ? 8193 : 8191 :
    e.mode === 'r3_14' ? positive ? 1 : 8193 : null
  return word === null ? null : Array(Math.abs(delta)).fill(word)
}
export function buttonValue(e: Encoder, previous: number | null, pressed: boolean, device: DeviceDefinition = currentDevice): number | null {
  if (!pressed && device.protocol === 'bcl' && (e.minimumOff || e.type === 'pc' || e.type === 'mmc')) return null
  if (e.mode === 'momentary') return pressed ? e.maximum : e.minimum
  if (!pressed) return null
  if (e.mode === 'toggle') return previous === e.maximum ? e.minimum : e.maximum
  if (e.mode === 'inc_dec') {
    const configured = Number(statementValue(e.parameterState, 'default')), initial = Number.isFinite(configured) ? configured : e.minimum
    const next = (previous ?? initial) + (e.increment ?? 1)
    return device.protocol === 'bcl' ? next > e.maximum ? e.minimum : next < e.minimum ? e.maximum : next : Math.max(e.minimum, Math.min(e.maximum, next))
  }
  return null
}
export function transportIssue(e: Encoder, device: DeviceDefinition = currentDevice): string | null {
  if (e.parameterState?.opaque) return 'BCL preserved · live interpretation unavailable.'
  if (device.protocol === 'bcl' && ['note','pb','at'].includes(e.type)) return null
  if (device.protocol === 'bcl' && e.type === 'pc') return e.pc ? null : 'PC bank settings required in BCL parameters.'
  if (device.protocol === 'bcl' && e.type === 'gs') return gsAssignment(e) ? null : 'Choose a B-Control GS/XG parameter.'
  if (e.type === 'cc' && e.parameterOff) return 'Parameter Off · no MIDI messages.'
  if (!['cc', 'nrpn'].includes(e.type)) return 'Transport available for CC and NRPN only.'
  if (e.type === 'nrpn' && e.parameter === 16383) return 'NRPN 16383 is the null selector: choose 0–16382.'
  if (e.mode === 'rel1' && e.minimum === e.maximum) return 'REL1: minimum and maximum must differ to distinguish directions.'
  if (is14Bit(e) && e.type === 'cc' && e.parameter > 31) return '14-bit CC: base parameter 0–31 required.'
  if (e.mode === 'inc_dec' && e.type === 'cc') return 'Rotary INC/DEC requires NRPN; an Inc button sends an absolute value.'
  if (e.minimum < 0 || e.maximum > valueLimit(e)) return 'Range incompatible with mode.'
  return null
}

// Fields createMidiDecoder actually reads (matchesCC also reads parameterOff).
// Labels, LED mode, display flags, MMC and settings are excluded so that editing
// them does not reset the decoder (pending NRPN selector and 14-bit MSBs).
export const decoderKey = (profile: Bcr32Profile, device: DeviceDefinition = currentDevice) => JSON.stringify((['encoders', 'pushes', 'buttons'] as const).map(kind =>
  profile[kind].map(e => [e.id, e.type, e.channel, e.parameter, e.mode, e.minimum, e.maximum, e.parameterOff ?? false, e.parameterState?.opaque ?? false, ...(device.protocol === 'bcl' ? [e.pc,e.gsParameter,e.aftertouchAll] : [])])))
