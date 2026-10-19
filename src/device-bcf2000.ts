import type { DeviceDefinition } from './device-definition'
import { catalogDefinition, modelCatalog } from './device-catalog'

// BCF2000 (B-Control Fader, firmware 1.10 documented). Source: "B-Control MIDI Implementation" 1.2.9 (third-party
// reference), not yet checked on a unit. Same language and preset format as the BCR2000, model byte 14, BCL model F.
// Controls: encoders 1–32 are the 8 push encoders in 4 groups; the 8 motorised faders are kept as encoders 33–40 of the
// profile (BCL $fader 1–8, mapped in src/bcl.ts); buttons 1–32 are the pushes (profile "pushes"), 33–48 the two key
// rows, 49–52 the user keys, 53–56 the function keys, 57–60 the group keys, 61 the footswitch, 63–64 the preset keys
// (62 exists in the language, not on the unit).
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const keyNames: Record<number, string> = { 49: 'USER 1', 50: 'USER 2', 51: 'USER 3', 52: 'USER 4', 53: 'STORE', 54: 'LEARN', 55: 'EDIT', 56: 'EXIT', 57: 'GROUP 1', 58: 'GROUP 2', 59: 'GROUP 3', 60: 'GROUP 4', 61: 'FOOTSW', 62: '(62)', 63: 'PRESET ◀', 64: 'PRESET ▶' }
const buttonIds = range(33, 64)
const name = (kind: 'encoders' | 'pushes' | 'buttons', id: number) => kind === 'buttons' ? keyNames[id] ?? `${id}` : id === 41 ? 'FOOT CONTROLLER' : id > 32 ? `FADER ${id - 32}` : `ENC ${id}`
export const bcf2000: DeviceDefinition = {
  id: 'bcf2000',
  name: 'BCF2000',
  ...catalogDefinition('bcf2000'),
  display: 'led4',
  controls: { encoders: modelCatalog.bcf2000.encoders, pushes: modelCatalog.bcf2000.pushes, buttonIds },
  features: { productProbe: false, brightness: false, globals: false, frontPanelExport: false, studioConfig: false, pdfSheet: false, cubase: false },
  // Faders have no LED ring.
  ringModes: id => id > 32 ? ['off'] : ['off', '1dot_in', '1dot_ex', '2dot_in', '2dot_ex', 'bar', 'bar_ex', 'spread', 'pan', 'qual', 'cut', 'damp'],
  encoderGroups: 4,
  bclModel: 'F',
  faders: modelCatalog.bcf2000.faders,
  printedName: name,
  panel: {
    width: 1000, height: 900,
    encoderNames: range(1, 41).map(id => name('encoders', id)),
    buttonNames: buttonIds.map(id => name('buttons', id)),
    encoderPosition: id => id <= 32 ? { x: 80 + ((id - 1) % 8) * 120, y: 120 } : { x: 80 + (id - 33) * 120, y: 560 },
    buttonPosition: order => ({ x: 35 + (order % 8) * 120, y: 240 + Math.floor(order / 8) * 70, width: 90 }),
    extraButtonPosition: id => ({ x: 35 + ((id - 33) % 8) * 120, y: 240 + Math.floor((id - 33) / 8) * 70, width: 90 }),
    sections: [
      { title: 'Push encoders', kind: 'encoders', ids: group => range(1, 8).map(i => i + 8 * (group - 1)), push: true, group: true },
      { title: 'Keys 33–48', kind: 'buttons', ids: () => range(33, 48) },
      { title: 'Faders', kind: 'encoders', ids: () => range(33, 40), fader: true },
      { title: 'User, function and group keys', kind: 'buttons', ids: () => range(49, 60) },
      { title: 'Footswitch and preset keys', kind: 'buttons', ids: () => [61, 63, 64] },
      { title: 'Foot controller', kind: 'encoders', ids: () => [41], fader: true },
    ],
  },
}
