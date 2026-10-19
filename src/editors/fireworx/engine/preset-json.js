// Lossless preset archive + backward-compatible local study. No MIDI access.
import {decodeDeviceBuffer,controlsForDevice,readField} from './device-codec.js';
import {localEditFrame} from './preset-library-model.js';
import {validateStudy} from './study-model.js';
import {editableControlsFor} from './parameters.js';
const viewOf=b=>({name:b.name,alphaText:b.alphaText,rows:b.rows,
 blocks:b.nodes.map(n=>({algorithm:n.algorithm,instance:n.instanceIndex,col:n.col,row:n.row,muted:n.muted,
  parameters:Object.fromEntries(controlsForDevice(b,n).map(f=>[f.id,readField(b,f)]))})),
 routing:b.cells.filter(c=>c.type).map(({col,row,type,instance})=>({col,row,type,instance}))});
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
export function archivePreset(frame){
 const b=decodeDeviceBuffer(frame);
 return {kind:'midi-studio-fireworx-preset',schema:1,
  scope:'Complete preset data; not global device setup, external clock/controllers, audio connections or firmware.',
  authority:'rawSysEx is authoritative. readOnlyView is descriptive; edit parameters in the editor, then save again.',
  rawSysEx:Array.from(frame),readOnlyView:viewOf(b)};
}
export function archiveStudy(state){
 const copy=validateStudy({kind:'midi-studio-fireworx-offline-study',hardware:false,...structuredClone(state)});
 for(const n of copy.nodes)for(const c of editableControlsFor(n.algorithm))n.values[`${n.algorithm}:${c.label}`]??=c.value;
 return {kind:'midi-studio-fireworx-offline-study',hardware:false,...copy,
  scope:'Local study, including demo values; not a hardware preset or an audio engine.'};
}
export function restoreJSON(document){
 if(document?.kind==='midi-studio-fireworx-offline-study')return {kind:'study',state:validateStudy(document)};
 if(document?.kind!=='midi-studio-fireworx-preset'||document.schema!==1)throw Error('Format JSON FireworX non reconnu');
 const bytes=document.rawSysEx;
 if(!Array.isArray(bytes)||bytes.length!==2745||bytes.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Image SysEx complète de 2745 octets requise');
 const original=Uint8Array.from(bytes),b=decodeDeviceBuffer(original);
 if(document.readOnlyView&&canonical(document.readOnlyView)!==canonical(viewOf(b)))throw Error('La vue descriptive diffère de l’image SysEx. Modifiez les réglages dans l’éditeur puis sauvegardez à nouveau.');
 return {kind:'preset',frame:localEditFrame(original),original,name:b.name};
}
