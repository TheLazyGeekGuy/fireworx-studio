import {validatePresetValues} from './preset-validation.js';
// Local preparation of P0, never an exception to strict readback comparison.
// Recorded OS 2 loads keep these UNUSED Soft Compressor thresholds from P0
// (D6 in an archive, E2 still returned). Preserve only those dedicated bytes.
import {deviceMap,readField,decodeDeviceBuffer} from './device-codec.js';
import {frameWithPayload} from './live-protocol.js';
const thresholds=deviceMap.fields.filter(f=>f.documentId==='dynamics'&&f.fieldName==='soft_threshold');
export function preparePresetAudition(reference,target){
 if(reference.preset!==0||target.preset!==0||reference.device!==target.device)throw Error('Même appareil et buffer temporaire P0 requis');
 validatePresetValues(target,{reference});
 const payload=target.payload.slice();
 for(const f of thresholds){
  const active=target.nodes.some(n=>n.blockTypeId===f.blockTypeId&&n.instanceIndex===f.instanceIndex)&&target.payload[f.condition.offset]===f.condition.value;
  if(active){const value=readField(target,f);if(value<f.range[0]||value>f.range[1])throw Error(`Seuil Soft Compressor actif hors domaine : ${value} dB ; aucun preset envoyé`);continue;}
  // The schema must still identify an isolated, one-byte, conditional field.
  if(f.width!==1||!f.condition||deviceMap.fields.some(other=>other!==f&&other.offset<=f.offset&&other.offset+other.width>f.offset))throw Error('Cartographie du seuil inactif ambiguë ; aucun preset envoyé');
  payload[f.offset]=reference.payload[f.offset];
 }
 return decodeDeviceBuffer(frameWithPayload(target.frame,payload),reference.device);
}
