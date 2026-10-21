import type { ReactNode } from 'react'
import type { EditorSession, Appearance, AppearanceOverride } from './contracts'
import type { MidiBroker, MidiLease } from './midi-broker'
import type { MidiAccess, MidiPort } from '../web-midi'
import type { automaticMidiAccess } from '../midi-permission'
import type {ParameterBus} from './parameters'
import type {PresentationInstance} from './presentation-preferences'
import type {PresetExchange} from './preset-exchange'
import type {LocalAppearance} from './local-appearance'
export interface EditorViewProps { active: boolean; locked: boolean; appearance: Appearance; onAppearance: (change: AppearanceOverride)=>void; checkpoint: (state:unknown)=>void; presentation?:PresentationInstance }
export interface EditorViewContext {
  lifecycle?: {signal:AbortSignal;onDispose:(cleanup:()=>void)=>(()=>void)}
  id: string; initial: unknown; session: EditorSession; lease: MidiLease; broker: MidiBroker; access: MidiAccess
  request: ()=>ReturnType<typeof automaticMidiAccess>
  parameters?:ParameterBus
  presets?:PresetExchange
  /** Optional instance-local display name; never changes module identity or device selection. */
  setDisplayName?:(name:string)=>void
}
export interface EditorViewRuntime { render: (props:EditorViewProps)=>ReactNode; refresh: ()=>void; dispose: ()=>void; /** Optional local manual, with no server navigation or MIDI side effects. */ openDocumentation?:()=>void; /** Optional: opens the editor's own MIDI settings (ports, connection) beside the host's connection status; opening sends nothing. */ openMidiSettings?:()=>void }
export const editorViewContractVersion=1
export interface EditorPresentation {
  manufacturer:string
  model:string
  preview:{src:string;width:number;height:number;kind:'schematic'|'reference-aligned'}
  /** Optional module-local palettes/layouts; legacy views keep host appearance inheritance. */
  localAppearance?:LocalAppearance
}
export interface EditorViewRegistration {
  moduleId: string
  viewVersion:typeof editorViewContractVersion
  presentation:EditorPresentation
  matchesPort: (port:MidiPort)=>boolean
  loadInitial?: (id?:string)=>unknown
  create: (context:EditorViewContext)=>EditorViewRuntime
}
export function createViewRegistry(registrations:readonly EditorViewRegistration[]) {
  const map=new Map<string,EditorViewRegistration>()
  for(const r of registrations){if(r.viewVersion!==editorViewContractVersion||map.has(r.moduleId)||typeof r.create!=='function'||typeof r.matchesPort!=='function')throw Error('Invalid editor view registration');map.set(r.moduleId,r)}
  return {list:()=>[...map.values()],get(id:string){const r=map.get(id);if(!r)throw Error('Editor has no registered view');return r}}
}
export function uniqueViewPorts(access:MidiAccess,matches:(port:MidiPort)=>boolean){
  const inputs=[...access.inputs.values()].filter(matches),outputs=[...access.outputs.values()].filter(matches)
  return {input:inputs.length===1?inputs[0]:undefined,output:outputs.length===1?outputs[0]:undefined}
}
