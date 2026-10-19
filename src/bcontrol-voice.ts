import type { Encoder } from './profile'
// B-Control GS/XG aliases are MIDI CC/NRPN shortcuts, not GS SysEx.
const aliases: Record<string, ['cc' | 'nrpn', number]> = {
  cutoff: ['nrpn',160], resonance: ['nrpn',161], 'v-rate': ['nrpn',136], 'v-depth': ['nrpn',137], 'v-delay': ['nrpn',138],
  'eg-attack': ['nrpn',227], 'eg-decay': ['nrpn',228], 'eg-release': ['nrpn',230], modulation: ['cc',1], 'p-time': ['cc',5],
  volume: ['cc',7], panorama: ['cc',10], 'rev-send': ['cc',91], 'crs-send': ['cc',93], 'dly-send': ['cc',94],
}
export function gsAssignment(e: Encoder): Encoder | null {
  const a = e.gsParameter && aliases[e.gsParameter]
  return a ? { ...e, type:a[0], parameter:a[1] } : null
}
export function voiceMessages(e: Encoder, value: number): number[][] | null {
  if (!Number.isInteger(e.channel) || e.channel < 1 || e.channel > 16 || !Number.isFinite(value)) return null
  const channel = e.channel - 1, v = Math.max(0,Math.min(127,Math.round(value)))
  if (e.type === 'note') return [[0x90|channel,e.parameter,v]]
  if (e.type === 'pb') return [[0xe0|channel,0,v]]
  if (e.type === 'at') return [e.aftertouchAll ? [0xd0|channel,v] : [0xa0|channel,e.parameter,v]]
  if (e.type === 'pc') {
    const p = e.pc
    // A legacy assignment lacks the B-Control bank/continuous metadata: don't guess its bank.
    if (!p) return null
    const messages: number[][] = []
    if (p.bankMsb !== 'off') messages.push([0xb0|channel,0,p.bankMsb])
    if (p.bankLsb !== 'off') messages.push([0xb0|channel,32,p.bankLsb])
    if (p.continuous || p.program !== 'off') messages.push([0xc0|channel,p.continuous ? v : p.program as number])
    return messages
  }
  return null
}
export const validVoiceMessage = (bytes: number[]) => bytes.length >= 2 && bytes.every(Number.isInteger) && bytes[0] >= 0x80 && bytes[0] <= 0xef && bytes.slice(1).every(n => n >= 0 && n <= 127) && bytes.length === ([0xc0,0xd0].includes(bytes[0]&0xf0) ? 2 : 3)
