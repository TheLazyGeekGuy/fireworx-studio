import type { MidiLease, MidiAuthorization } from './midi-broker'
import type { Control } from '../controller-midi'
import type { Encoder } from '../profile'
import type { ControllerState } from '../presets'
import type { Theme } from '../themes'
import type { DisplayStyle } from '../display-styles'
import type {ControlActivity} from './interaction-feedback'
import type {InstrumentDefinition} from '../instrument-sdk/contracts'
import type {DeviceFamilyMember} from './device-family'

export const editorSdkVersion = 1
export interface Appearance { theme: Theme; displayStyle: DisplayStyle }
export type AppearanceOverride = { [K in keyof Appearance]?: Appearance[K] | 'inherit' }
export interface EditorManifest {
  id: string; version: string; sdkVersion: number; stateSchemaVersion: number
  modelId: string; name: string; capabilities: readonly string[]
}
export interface EditorContext { instanceId: string; midi: MidiLease; now: () => number }
export type EditorAction =
  | { type: 'select'; control: Control | null }
  | { type: 'configure'; control: Control; patch: Partial<Encoder> }
  | { type: 'label'; control: Control; value: string }
  | { type: 'value'; control: Control; value: number }
  | { type: 'replace'; state: unknown }
  | { type: 'undo' }
  | { type: 'redo' }
export interface EditorSnapshot<State = unknown, Selection = unknown> {
  state: State; selection: Selection | null; locked: boolean; sending: boolean
  activeControl?: Selection | null
  valueSources?: Record<string, 'local' | 'midi' | 'relative'>
  activity?:ControlActivity|null
  history: { undo: number; redo: number }; lastError: string | null
}
export interface EditorSession {
  getSnapshot(): EditorSnapshot
  subscribe(listener: () => void): () => void
  dispatch(action: unknown): void
  serialize(): unknown
  setLocked(locked: boolean): void
  setSending(enabled: boolean, authorization?: MidiAuthorization): void
  dispose(): void
}
export interface EditorModule {
  /** Optional immutable reuse metadata. Does not inherit operations, state or permissions. */
  family?:DeviceFamilyMember
  instrument?:InstrumentDefinition
  manifest: EditorManifest
  validateState(state: unknown): unknown
  validateQuery(bytes: readonly number[]): boolean
  validateBrightnessWrite?(bytes: readonly number[]): boolean
  validateFeedbackWrite?(bytes: readonly number[]): boolean
  /** Explicit mode/layer control only; absent validators deny all packets. Not STORE/configuration/firmware. */
  validateDeviceControlWrite?(bytes: readonly number[]): boolean
  /** Volatile synth edit-buffer/mode writes only. Exact model validator required; no STORE/global/firmware. */
  validateEditBufferWrite?(bytes: readonly number[]): boolean
  /** Persistent preset destination write; separate from P0, exact bank/address validation required. */
  validatePresetStoreWrite?(bytes: readonly number[]): boolean
  create(context: EditorContext, restored?: unknown): EditorSession
}
// Built-in controller payload; SDK session/state remains unknown so a future module need not use encoder arrays.
export interface ControllerSnapshot extends EditorSnapshot<ControllerState, Control> {}
