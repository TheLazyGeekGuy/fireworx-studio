// Outgoing full images have a different trust boundary from lossless file import.
// Unknown/inactive bytes stay archived; every mapped active value must be in its
// domain. A device's already-received exceptional value may only be retained in
// the same active field, never introduced by a different algorithm or instance.
import {deviceMap,controlsForDevice,readField,representableValue} from './device-codec.js';
import {validateDeviceMatrix} from './device-graph.js';
export function activePresetFields(buffer){
 const fields=new Map();
 for(const node of buffer.nodes)for(const f of controlsForDevice(buffer,node))if(f.editable||f.selector)fields.set(f.id,f);
 for(const f of deviceMap.fields){
  if(!f.editable||!['common','modifiers','modmatrix'].includes(f.documentId)||f.condition&&buffer.payload[f.condition.offset]!==f.condition.value)continue;
  const special=/^common\.nodes\[(\d+)\]/.exec(f.id);
  if(special&&!buffer.cells.some(c=>c.type===Number(special[1])+3))continue;
  const sample=/curve_samples\[(\d+)\]/.exec(f.id);
  if(sample&&Number(sample[1])>=buffer.payload[1081])continue;
  if(f.documentId==='modmatrix'){
   const slot=/\[(\d+)\]/.exec(f.id);if(slot){const o=1126+Number(slot[1])*12,p=buffer.payload;if(p[o+6]<20||p[o+6]>28||p[o+10]*256+p[o+11]===0)continue;}
  }
  fields.set(f.id,f);
 }
 return [...fields.values()];
}
export function validatePresetValues(buffer,{reference=null}={}){
 validateDeviceMatrix(buffer);
 const prior=reference?new Set(activePresetFields(reference).map(f=>f.id)):new Set();
 for(const f of activePresetFields(buffer)){
  const value=readField(buffer,f);if(representableValue(f,value))continue;
  if(reference&&prior.has(f.id)&&readField(reference,f)===value)continue;
  throw Error(`Valeur active hors domaine : ${f.id} = ${value} ; aucun preset envoyé`);
 }
 return buffer;
}
