import type { DeviceDefinition } from './device-definition'
import { catalogDefinition, modelCatalog } from './device-catalog'

// Names printed on the panel: the 16 keys (long form) and the right-hand column, top to bottom.
export const bcr32KeyLabels = ['PITCH', 'VELOCITY', 'MUTE', 'DELAY', 'LENGTH', 'MIDI CTRL α', 'MIDI CTRL β', 'WAVE GEN', 'CHORD', 'STEP SKIP', 'SEQ START', 'SEQ LENGTH', 'SEQ OFFSET', 'CLK DIVIDER', 'SHUFFLE', 'DIRECTION']
export const bcr32RightKeys = ['EDIT / GLOBAL', 'EXIT', 'STORE', 'LD / LRN', 'TAP DELETE', 'TAP WRITE', 'INST SEL', 'MIXER', 'LOOP', 'PLAY / STOP']

// BCR32 (firmware 0.56.0 observed). Values moved unchanged from the code that used them (P0 of the multi-controller work).
// SysEx: F0 00 20 32 7F 64 (docs/PROTOCOL.md). Panel: 1717 x 1440 coordinate space of src/FrontPanel.tsx.
export const bcr32: DeviceDefinition = {
  id: 'bcr32',
  name: 'BCR32',
  ...catalogDefinition('bcr32'),
  display: 'oled',
  features: { productProbe: true, brightness: true, globals: true, frontPanelExport: true, studioConfig: true, pdfSheet: true, cubase: true },
  printedName(kind, id) {
    if (kind !== 'buttons') return this.panel.encoderNames[id - 1] ?? `${id}`
    if (id >= 5 && id <= 20) return bcr32KeyLabels[id - 5]
    if (id >= 21 && id <= 24) return `T${id - 20}`
    if (id >= 65 && id <= 68) return bcr32RightKeys[id - 65 + 6]
    return id === 74 || id === 75 ? `FOOTSW ${id - 73}` : `${id}`
  },
  // Buttons 5–24: 16 keys then T1–T4; 65–68: right-hand keys; 74, 75: footswitches.
  controls: { encoders: modelCatalog.bcr32.encoders, pushes: modelCatalog.bcr32.pushes, buttonIds: [...Array.from({ length: 20 }, (_, i) => i + 5), 65, 66, 67, 68, 74, 75] },
  panel: {
    width: 1717, height: 1440,
    encoderNames: ['BPM', 'CLOCK', 'CLOCK OUT', 'MIDI THRU', 'NOTES', 'SCALE', 'ROOT', 'TRANSPOSE', 'WAVE / TRIG', 'GAIN / TRIG CC', 'RATE / QUANT', 'OFFSET / Q-MIX', 'MODE T1', 'MODE T2', 'MODE T3', 'MODE T4', 'UAB T1', 'CH T1', 'UAB T2', 'CH T2', 'UAB T3', 'CH T3', 'UAB T4', 'CH T4', 'CTRL α T1', 'CTRL β T1', 'CTRL α T2', 'CTRL β T2', 'CTRL α T3', 'CTRL β T3', 'CTRL α T4', 'CTRL β T4'],
    buttonNames: ['PITCH', 'VEL', 'MUTE', 'DELAY', 'LEN', 'CTRL α', 'CTRL β', 'WAVE', 'CHORD', 'SKIP', 'START', 'SEQ LEN', 'OFFSET', 'DIV', 'SHUFFLE', 'DIR', 'T1', 'T2', 'T3', 'T4', 'INST SEL', 'MIXER', 'LOOP', 'PLAY / STOP', 'FOOTSW 1', 'FOOTSW 2'],
    encoderPosition: id => ({ x: 107 + ((id - 1) % 8) * 161.4, y: 567 + Math.floor((id - 1) / 8) * 215.5 }),
    buttonPosition: order => order < 16
      ? { x: 37 + (order % 8) * 161.4, y: order < 8 ? 247 : 369, width: 140 }
      : { x: order % 2 ? 1583 : 1422, y: order < 18 ? 247 : 369, width: 96 },
    extraButtonPosition: id => ({ x: id % 2 ? 1422 : 1583, y: id < 67 ? 1085 : 1207, width: 96 }),
  },
}
