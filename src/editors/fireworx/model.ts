import {archivePreset,archiveStudy,restoreJSON} from './engine/preset-json.js'
import {decodeDeviceBuffer} from './engine/device-codec.js'
import {validateStudy} from './engine/study-model.js'

export interface FireworxState {format:'fireworx-workspace';version:1;patch:Record<string,unknown>;originalImport?:number[]}
export function defaultState():FireworxState {
 return {format:'fireworx-workspace',version:1,patch:archiveStudy({schema:3,nextId:4,rows:4,selected:null,target:null,rate:44100,costs:{},baselines:{44100:null,48000:null},pitchDetector:false,routes:[],nodes:[],links:[]})}
}
/** Accept old complete preset/study archives without discarding their opaque bytes. */
export function validateState(value:unknown):FireworxState {
 const input=value as Partial<FireworxState>|null
 const patch=input?.format==='fireworx-workspace'&&input.version===1?input.patch:value
 if(input?.format==='fireworx-workspace'&&input.version!==1)throw Error('Unsupported FireworX workspace version')
 if(!patch||typeof patch!=='object'||JSON.stringify(patch).length>1024*1024)throw Error('Invalid FireworX archive')
 const restored=restoreJSON(patch)
 // Preserve archived bank address/original bytes. Conversion to P0 happens only on local load.
 const original=input?.originalImport??(restored.kind==='preset'?Array.from(restored.original) as number[]:undefined)
 if(original){if(!Array.isArray(original)||original.length!==2745||original.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Invalid original import');decodeDeviceBuffer(Uint8Array.from(original))}
 return {format:'fireworx-workspace',version:1,patch:restored.kind==='preset'?archivePreset(restored.original):archiveStudy(validateStudy(patch)),...(original?{originalImport:[...original]}:{})}
}
export function patchName(state:FireworxState):string {
 const bytes=state.patch.rawSysEx
 return Array.isArray(bytes)?decodeDeviceBuffer(Uint8Array.from(bytes)).name:'Local draft'
}
