import type { MidiPort } from './web-midi'
import type { LedMode } from './led-modes'

// A controller model described as data: identity on MIDI, controls, front-panel geometry, what the editor can do with
// it. The editor reads the current definition (src/devices.ts) instead of model constants, so another model is a new
// definition (plus its protocol adapter), not a change spread across the code.
export type PanelPoint = { x: number; y: number }
export type PanelKey = PanelPoint & { width: number }
export type ControlKind = 'encoders' | 'pushes' | 'buttons'
// A row of controls on a panel drawn from the definition (models without a dedicated drawing). `group`: the ids
// depend on the selected encoder group (B-Control push encoders 1–32 on 8 knobs).
export type PanelSection = { title: string; kind: 'encoders' | 'buttons'; ids: (group: number) => number[]; push?: boolean; group?: boolean; fader?: boolean }
export interface DeviceDefinition {
  id: string
  name: string // shown to the user
  protocol?: string // registered adapter, distinct from front-panel renderer
  parameterSchema?: string // declarative schema id; no assumption that a new device speaks BCL
  profileModel: string // `device.model` of the profiles made for this model
  sysex: { manufacturer: readonly [number, number, number]; deviceId: number; model: number }
  portName: RegExp // MIDI port names that belong to this model (no `g` flag: test() must stay stateless)
  presetSlots: number
  display: 'oled' | 'led4'
  controls: { encoders: number; pushes: number; buttonIds: readonly number[] } // profile ids, in profile order
  // What the editor offers for this model; everything else is common (assignments, Learn, values, presets, screens).
  features: {
    productProbe: boolean // BCR32 product/firmware request at connection
    brightness: boolean // BCR32 LED brightness read/write
    globals: boolean // BCR32 global settings (short reads)
    frontPanelExport: boolean // BCR32 front-panel export decoder
    studioConfig: boolean // BCR32 right-hand keys, footswitches, routing, MIDI thru
    pdfSheet: boolean // A4 overlay drawn for this panel
    cubase: boolean // Cubase MIDI Remote surface for this panel
  }
  ringModes?: (encoderId: number) => readonly LedMode[] // LED ring modes the hardware shows on that encoder (default: all)
  encoderGroups?: number // B-Control: the 8 push encoders carry 4 groups of 8
  bclModel?: 'R' | 'F' // B-Control Language model letter: BCL files and transfers (src/bcl.ts)
  faders?: { first: number; count: number; physicalCount?: number } // Includes a pedal where the protocol numbers it as a fader.
  printedName(kind: ControlKind, id: number): string // name printed on the panel (a push takes its encoder's name)
  panel: {
    width: number; height: number // panel coordinate space
    encoderNames: readonly string[]; buttonNames: readonly string[] // printed names, by encoder id - 1 and button order
    encoderPosition(id: number): PanelPoint // centre of the knob
    buttonPosition(order: number): PanelKey // top-left of a key, by button order (profile order)
    extraButtonPosition(id: number): PanelKey // keys outside the main rows (right-hand column), by profile id
    sections?: readonly PanelSection[] // drawn from data (src/DevicePanel.tsx) when the model has no dedicated drawing
  }
}

// F0 <manufacturer> <device id> <model>: the start of every SysEx message to and from the model.
export const sysexHeader = (device: DeviceDefinition) => [0xf0, ...device.sysex.manufacturer, device.sysex.deviceId, device.sysex.model]
export const startsWithHeader = (device: DeviceDefinition, bytes: ArrayLike<number>) => sysexHeader(device).every((byte, i) => bytes[i] === byte)
export const isDevicePort = (device: DeviceDefinition, port?: MidiPort): port is MidiPort =>
  !!port && port.state === 'connected' && device.portName.test(port.name ?? '')
