import type { DeviceDefinition } from './device-definition'
import { catalogDefinition, modelCatalog } from './device-catalog'

// BCR2000 (B-Control Rotary, firmware 1.10 documented). Source: "B-Control MIDI Implementation" 1.2.9 (third-party
// reference, kept by the maintainers), not yet checked on a unit.
// Controls as the BCL language numbers them: encoders 1–32 are the 8 push encoders in 4 groups, 33–56 the three rows
// below (no push, LED rings showing off/1dot/1dot-off only); buttons 1–32 are the pushes of encoders 1–32 (profile
// "pushes"), 33–48 the two key rows, 49–52 the user keys, 53–56 the function keys (STORE, LEARN, EDIT, EXIT; programmable
// only when the preset sets .fkeys off), 57–60 the encoder-group keys, 61–62 the footswitches, 63–64 the preset keys.
// Panel coordinates: a 1000 x 900 space for the grid drawn by src/DevicePanel.tsx, the Cubase surface and selection.
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const keyNames: Record<number, string> = { 49: 'USER 1', 50: 'USER 2', 51: 'USER 3', 52: 'USER 4', 53: 'STORE', 54: 'LEARN', 55: 'EDIT', 56: 'EXIT', 57: 'GROUP 1', 58: 'GROUP 2', 59: 'GROUP 3', 60: 'GROUP 4', 61: 'FOOTSW 1', 62: 'FOOTSW 2', 63: 'PRESET ◀', 64: 'PRESET ▶' }
const buttonIds = range(33, 64)
const name = (kind: 'encoders' | 'pushes' | 'buttons', id: number) => kind === 'buttons' ? keyNames[id] ?? `${id}` : `ENC ${id}`
export const bcr2000: DeviceDefinition = {
  id: 'bcr2000',
  name: 'BCR2000',
  ...catalogDefinition('bcr2000'),
  display: 'led4',
  controls: { encoders: modelCatalog.bcr2000.encoders, pushes: modelCatalog.bcr2000.pushes, buttonIds },
  features: { productProbe: false, brightness: false, globals: false, frontPanelExport: false, studioConfig: false, pdfSheet: false, cubase: false },
  ringModes: id => id >= 33 ? ['off', '1dot_in', '1dot_ex'] : ['off', '1dot_in', '1dot_ex', '2dot_in', '2dot_ex', 'bar', 'bar_ex', 'spread', 'pan', 'qual', 'cut', 'damp'],
  encoderGroups: 4,
  bclModel: 'R',
  printedName: name,
  panel: {
    width: 1000, height: 900,
    encoderNames: range(1, 56).map(id => name('encoders', id)),
    buttonNames: buttonIds.map(id => name('buttons', id)),
    encoderPosition: id => id <= 32
      ? { x: 80 + ((id - 1) % 8) * 120, y: 120 }
      : { x: 80 + ((id - 33) % 8) * 120, y: 260 + Math.floor((id - 33) / 8) * 120 },
    buttonPosition: order => ({ x: 35 + (order % 8) * 120, y: 620 + Math.floor(order / 8) * 70, width: 90 }),
    extraButtonPosition: id => ({ x: 35 + ((id - 33) % 8) * 120, y: 620 + Math.floor((id - 33) / 8) * 70, width: 90 }),
    sections: [
      { title: 'Push encoders', kind: 'encoders', ids: group => range(1, 8).map(i => i + 8 * (group - 1)), push: true, group: true },
      { title: 'Encoders 33–56', kind: 'encoders', ids: () => range(33, 56) },
      { title: 'Keys 33–48', kind: 'buttons', ids: () => range(33, 48) },
      { title: 'User, function and group keys', kind: 'buttons', ids: () => range(49, 60) },
      { title: 'Footswitches and preset keys', kind: 'buttons', ids: () => range(61, 64) },
    ],
  },
}
