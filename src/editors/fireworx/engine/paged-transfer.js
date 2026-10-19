// Each slice is a complete documented DataPart21 message, never a split SysEx frame.
import {deviceMap,decodeDeviceBuffer} from './device-codec.js';
import {frameWithPayload,writeBufferPart} from './live-protocol.js';
const gates=deviceMap.fields.filter(f=>['out_l','out_r'].includes(f.fieldName)&&f.sourceStatus==='verified'&&f.values?.['0']==='off');
export function gatePayload(payload){
 const p=payload.slice();for(const f of gates){if(f.type==='bits'){const [lo,hi]=f.bits;p[f.offset]&=~(((1<<(hi-lo+1))-1)<<lo);}else p[f.offset]=0;}return p;
}
export function payloadSlices(before,after,{size=32,first=0,last=1366}={}){
 if(before.length!==1366||after.length!==1366||!Number.isInteger(size)||size<2||size>120)throw Error('Bounded 1366-byte images and 2–120 data bytes required');
 const result=[];
 for(let from=first;from<last;){let end=Math.min(last,from+size);
  // Preserve every known 16-bit scalar as a unit.
  if(end<last&&deviceMap.fields.some(f=>f.width===2&&f.offset===end-1))end--;
  const changed=[];for(let i=from;i<end;i++)if(before[i]!==after[i])changed.push(i);
  if(changed.length){const address=changed[0],stop=changed.at(-1)+1;result.push({address,data:after.slice(address,stop)});}from=end;
 }
 return result;
}
export function imageTransferPlan(current,target,{size=32}={}){
 decodeDeviceBuffer(current.frame,current.device);decodeDeviceBuffer(frameWithPayload(current.frame,target),current.device);
 if(current.payload.every((v,i)=>v===target[i]))return [];
 const silenced=gatePayload(current.payload),staged=gatePayload(target),expanded=silenced.slice();expanded[172]=Math.max(current.payload[172],target[172]);
 const phases=[{name:'silence',before:current.payload,after:silenced},{name:'expand',before:silenced,after:expanded}];
 let working=expanded.slice();
 for(const [name,first,last]of [['matrix',44,172],['presence',178,208],['engines-and-modulation',232,1366],['header',0,44],['grid-and-special-nodes',172,178],['special-node-records',208,232]]){
  const after=working.slice();after.set(staged.slice(first,last),first);phases.push({name,before:working,after,first,last});working=after;
 }
 phases.push({name:'outputs',before:working,after:target});
 return phases.map(p=>({name:p.name,payload:p.after,slices:payloadSlices(p.before,p.after,{size,first:p.first??0,last:p.last??1366}).map(s=>({...s,frame:writeBufferPart(current.device,s.address,s.data)}))}));
}
