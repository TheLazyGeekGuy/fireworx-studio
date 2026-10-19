// Pure local edits. All hardware output remains with the existing P0 session.
import {decodeDeviceBuffer,controlsForDevice,editedPayload,readField} from './device-codec.js';
import {changeDeviceAlgorithm} from './device-graph.js';
import {frameWithPayload} from './live-protocol.js';
const io=new Set(['mix','in_level','out_level','out_l','out_r','input','mute_mode']);
export function copyEffectSettings(target,targetId,source,sourceId,{includeIO=false}={}){
 const from=source.nodes.find(n=>n.id===sourceId),to=target.nodes.find(n=>n.id===targetId);
 if(target.preset!==0||!from||!to||from.blockTypeId!==to.blockTypeId)throw Error('Copie : deux moteurs de la même famille et une destination P0 sont requis');
 const p=to.algorithm===from.algorithm?target.payload:changeDeviceAlgorithm(target,targetId,from.algorithm);
 const next=decodeDeviceBuffer(frameWithPayload(target.frame,p)),node=next.nodes.find(n=>n.id===targetId),fields=controlsForDevice(next,node),changes=new Map();
 for(const f of controlsForDevice(source,from)){
  if(!f.editable||!f.range||!includeIO&&io.has(f.fieldName))continue;
  const id=f.id.replace(/\.inst\[\d+\]/,`.inst[${to.instanceIndex}]`),dest=fields.find(d=>d.id===id&&d.editable);
  if(!dest)throw Error('Champ de destination absent : '+id);changes.set(id,readField(source,f));
 }
 return {payload:editedPayload(next,changes),fields:[...changes.keys()],algorithm:from.algorithm};
}
export function applyFreeformCurve(buffer,samples){
 if(!Array.isArray(samples)||samples.length<1||samples.length>32||samples.some(v=>!Number.isInteger(v)||v<0||v>100))throw Error('Courbe : 1 à 32 valeurs entières de 0 à 100 requises');
 const changes=new Map([['modifiers.freeform[0].num_samples',samples.length]]);
 samples.forEach((v,i)=>changes.set(`modifiers.freeform[0].curve_samples[${i}]`,v));
 return editedPayload(buffer,changes);
}
export function resampleAlphaRecording(events,count=32){
 if(!Array.isArray(events)||events.length<2||!Number.isInteger(count)||count<1||count>32)throw Error('Enregistrement Alpha insuffisant');
 for(let i=0;i<events.length;i++)if(!Number.isFinite(events[i].at)||!Number.isInteger(events[i].value)||events[i].value<0||events[i].value>127||i&&events[i].at<events[i-1].at)throw Error('Échantillon Alpha invalide');
 const start=events[0].at,end=events.at(-1).at;if(end<=start)throw Error('Durée Alpha nulle');
 let j=0;return Array.from({length:count},(_,i)=>{const at=start+(end-start)*(count===1?0:i/(count-1));while(j+1<events.length&&events[j+1].at<=at)j++;return Math.round(events[j].value*100/127);});
}
