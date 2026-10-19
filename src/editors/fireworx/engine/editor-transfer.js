import {validatePresetValues} from './preset-validation.js';
// User-authorized full editor operations, still restricted to the volatile P0.
// Experimental codec coverage is not manufacturer or full hardware certification.
// #67 write classes: DataPart21 stays reserved for the trialled scalar planner
// (17/19-byte frames). Every other editor change is planned as ONE full Data20 image
// of P0 built from the verified reference; the session and the guarded transport
// precede it with a compare GET and follow it with a silent structural settle.
import {deviceMap,readField,editedPayload,samePayload} from './device-codec.js';
import {frameWithPayload} from './live-protocol.js';
import {parameterTransfers} from './parameter-transfer.js';
import {validateDeviceMatrix,defaultDeviceRecord} from './device-graph.js';
import {readModulation,assignModulation,deleteModulation} from './modulation-codec.js';
const familyNames={7:'Dynamics',8:'Filter',9:'Pan/Tremolo',10:'Pitch',11:'Delay',12:'Distortion',13:'Chorus/Flanger',14:'Reverb',15:'Vocoder',16:'Formant',17:'EQ',18:'Synth'};
// Engine records 232–1029 (one per family instance) and special-node records 208–231.
export const engineRecords=Object.freeze(Object.values(deviceMap.defaults).flatMap(d=>Array.from({length:d.count},(_,i)=>Object.freeze({blockTypeId:d.block_type_id,instanceIndex:i,start:d.base+i*d.stride,end:d.base+(i+1)*d.stride,label:`${familyNames[d.block_type_id]??'Moteur '+d.block_type_id} ${i+1}`}))).sort((a,b)=>a.start-b.start));
export const specialRecords=Object.freeze(['FB Return','FB Send','Insert Return','Insert Send'].map((label,k)=>Object.freeze({type:k+3,start:208+k*6,end:214+k*6,label})));
const present=(b,type,i)=>b.nodes.some(n=>n.blockTypeId===type&&n.instanceIndex===i);
const specialPresent=(b,type)=>b.cells.some(c=>c.type===type);
// Inactive record = engine absent from the matrix. Absent before and after, or removed
// by this operation: no byte may change. Created by this operation: only the bytes of
// its family seed (defaultDeviceRecord). Also refuses mute bits of absent instances and
// special-node records whose node is absent from the target matrix.
export function inactiveRecordWrites(before,after){
 const refused=[],p=after.payload,q=before.payload;
 for(const r of engineRecords){
  const was=present(before,r.blockTypeId,r.instanceIndex),is=present(after,r.blockTypeId,r.instanceIndex);
  if(was&&is)continue;
  const seed=is?defaultDeviceRecord(after,after.nodes.find(n=>n.blockTypeId===r.blockTypeId&&n.instanceIndex===r.instanceIndex)):null;
  for(let i=r.start;i<r.end;i++)if(p[i]!==q[i]&&(!seed||p[i]!==seed[i-r.start]))refused.push({offset:i,label:r.label,reason:seed?'seed':was?'removed':'inactive'});
 }
 for(let type=7;type<=18;type++){const diff=p[171+type]^q[171+type];for(let i=0;i<8;i++)if(diff&(1<<i)&&!present(before,type,i)&&!present(after,type,i))refused.push({offset:171+type,label:`${familyNames[type]} ${i+1}`,reason:'mute'});}
 for(const r of specialRecords)if(!specialPresent(after,r.type))for(let i=r.start;i<r.end;i++)if(p[i]!==q[i])refused.push({offset:i,label:r.label,reason:'special'});
 return refused;
}
// Undo/redo targets keep the current bytes of records that are inactive in the target,
// so undoing a creation behaves like a removal instead of rewriting a dormant record.
export function preserveInactiveRecords(current,target){
 const p=target.payload.slice();
 for(const r of engineRecords)if(!present(target,r.blockTypeId,r.instanceIndex))p.set(current.payload.subarray(r.start,r.end),r.start);
 for(const r of specialRecords)if(!specialPresent(target,r.type))p.set(current.payload.subarray(r.start,r.end),r.start);
 return p;
}
const regions=[[4,24,'name'],[24,44,'alpha-text'],[44,172,'matrix'],[172,173,'grid'],[173,174,'meter'],[178,190,'mute'],[190,206,'presence'],[208,232,'special-node'],[232,1030,'engine-record'],[1030,1126,'modifier'],[1126,1366,'modulation-link']];
const selectorOffsets=new Set(deviceMap.fields.filter(f=>f.selector).map(f=>f.offset));
const routingOffsets=new Set(deviceMap.fields.filter(f=>['out_l','out_r','mute_mode','input'].includes(f.fieldName)).flatMap(f=>Array.from({length:f.width},(_,k)=>f.offset+k)));
// Documentation and journal aid only: why a change is not a trialled scalar.
export function structuralReasons(before,after){
 const reasons=new Set();
 before.payload.forEach((v,i)=>{if(v===after.payload[i])return;if(selectorOffsets.has(i))reasons.add('algorithm');else if(routingOffsets.has(i))reasons.add('output-routing');else{const r=regions.find(([a,b])=>i>=a&&i<b);reasons.add(r?.[2]??'other');}});
 return [...reasons];
}
export function editorTransfers(before,after){
 if(before.preset!==0||after.preset!==0||before.device!==after.device)throw Error('Même appareil et buffer temporaire P0 requis');
 if(samePayload(before.payload,after.payload))return [];
 // Preserve the complete scalar width and avoid spanning unrelated parameters.
 try{return parameterTransfers(before,after).map(op=>({...op,kind:'scalar'}));}catch{}
 const p=after.payload,masks=new Uint8Array(1366);
 validatePresetValues(after,{reference:before});
 // Refused before any send: no compare GET, no frame (incident n°2 wrote inactive records).
 const inactive=inactiveRecordWrites(before,after);
 if(inactive.length)throw Error(`Écriture refusée : enregistrement inactif ${inactive[0].label} @${[...new Set(inactive.map(r=>r.offset))].slice(0,8).join(',')} (${{seed:'octets hors graine du moteur créé',removed:'moteur retiré',inactive:'moteur absent de la matrice',mute:'mute d’un moteur absent',special:'routage absent de la matrice'}[inactive[0].reason]}) ; aucun envoi`);
 for(let i=4;i<44;i++)if(p[i]!==before.payload[i]){if(p[i]<32||p[i]>126)throw Error('Texte ASCII imprimable requis');masks[i]=255;}
 masks.fill(255,44,173);masks.fill(255,178,206);
 for(const f of deviceMap.fields){
  if(!f.editable&&!f.selector||f.condition&&p[f.condition.offset]!==f.condition.value)continue;
  const value=readField(after,f),changed=readField(before,f)!==value;
  if(!changed)continue;
  if(f.selector){
   if(!after.nodes.some(n=>n.blockTypeId===f.blockTypeId&&n.instanceIndex===f.instanceIndex))throw Error('Sélecteur sans moteur actif');
   if(!f.range||value<f.range[0]||value>f.range[1])throw Error('Algorithme hors domaine');
  }else editedPayload(after,new Map([[f.id,value]]));
  if(f.type==='bits')masks[f.offset]|=((1<<(f.bits[1]-f.bits[0]+1))-1)<<f.bits[0];
  else masks.fill(255,f.offset,f.offset+f.width);
 }
 // New engines copy the retained family seed. Permit its otherwise noneditable
 // bytes only when they equal that seed, never arbitrary dormant record writes.
 for(const node of after.nodes){
  const previous=before.nodes.find(n=>n.id===node.id);
  if(previous?.algorithm===node.algorithm)continue;
  const a=deviceMap.algorithms[node.algorithm],d=deviceMap.defaults[a.document],start=d.base+node.instanceIndex*d.stride,seed=defaultDeviceRecord(after,node);
  for(let i=0;i<d.stride;i++)if(p[start+i]===seed[i])masks[start+i]=255;
 }
 for(let i=0;i<4;i++)if(after.cells.some(c=>c.type===i+3)&&!before.cells.some(c=>c.type===i+3)&&p[208+i*6]===0)masks[208+i*6]=255;
 const links=readModulation(after);
 for(const link of links){
  const start=1126+link.slot*12;
  if(samePayload(before.payload.slice(start,start+12),p.slice(start,start+12)))continue;
  if(link.connected){
   assignModulation(after,link.slot,link.source,link.destination);
   if([link.low,link.mid,link.high].some(v=>v>100)||Math.abs(link.slope)>90||link.glide>30)throw Error('Transformation de modulation hors domaine');
   if(link.ordinal!==0&&link.ordinal!==before.payload[start+5])throw Error('Ordinal de modulation réservé au matériel');
  }else if(!samePayload(deleteModulation(before,link.slot).slice(start,start+12),p.slice(start,start+12)))throw Error('Lien de modulation invalide');
  masks.fill(255,start,start+12);
 }
 const refused=[];p.forEach((v,i)=>{if((v^before.payload[i])&~masks[i])refused.push(i);});
 if(refused.length)throw Error('Octets hors des opérations de l’éditeur @'+refused.slice(0,8).join(','));
 // One complete P0 image, header/checksum rebuilt from the verified reference frame.
 let changed=0;p.forEach((v,i)=>{if(v!==before.payload[i])changed++;});
 return [{kind:'full',field:'editor-p0-image',address:0,width:1366,changed,reasons:structuralReasons(before,after),image:after,frame:frameWithPayload(before.frame,p)}];
}
