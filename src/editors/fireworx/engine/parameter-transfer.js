// Conservative post-incident admission: active, previously trialled effect scalars.
// Never interpret the span between unrelated parameters as a writable record.
import {deviceMap,readField,editedPayload,decodeDeviceBuffer} from './device-codec.js';
import {frameWithPayload,writeBufferPart} from './live-protocol.js';
const excluded=new Set(['out_l','out_r','mute_mode','input']);
export function isLiveFieldEligible(f,b){return f.editable&&f.locallyTrialled&&!f.selector&&f.sourceStatus==='verified'&&f.blockTypeId>=7&&f.blockTypeId<=18&&f.width<=2&&f.type!=='bits'&&!excluded.has(f.fieldName)&&(!f.condition||b.payload[f.condition.offset]===f.condition.value)&&b.nodes.some(n=>n.blockTypeId===f.blockTypeId&&n.instanceIndex===f.instanceIndex&&n.row<b.rows);}
export function parameterTransfers(before,after){
 if(before.preset!==0||after.preset!==0||before.device!==after.device)throw Error('Même appareil et buffer P0 requis');
 const masks=new Uint8Array(1366),fields=[];
 for(const f of deviceMap.fields.filter(f=>isLiveFieldEligible(f,before)&&isLiveFieldEligible(f,after))){
  const value=readField(after,f);if(readField(before,f)===value)continue;
  // The common codec enforces sparse enum values, signed range and active instance.
  editedPayload(before,new Map([[f.id,value]]));fields.push(f);masks.fill(255,f.offset,f.offset+f.width);
 }
 const refused=[];before.payload.forEach((v,i)=>{if((v^after.payload[i])&~masks[i])refused.push(i);});
 if(refused.length)throw Error('Écriture refusée : structure, routage ou champ absent/non validé @'+refused.slice(0,8).join(',')+' ; édition locale requise');
 return fields.sort((a,b)=>a.offset-b.offset).map(f=>{
  const payload=editedPayload(before,new Map([[f.id,readField(after,f)]]));
  return {field:f.id,address:f.offset,width:f.width,image:decodeDeviceBuffer(frameWithPayload(before.frame,payload),before.device),frame:writeBufferPart(before.device,f.offset,payload.slice(f.offset,f.offset+f.width))};
 });
}
