// Atomic, bounded composition of seeded engines and a column-connected audio graph.
// No MIDI, DOM or global PRNG. Existing modulated/locked records remain untouched.
import {deviceMap,decodeDeviceBuffer,fieldById,samePayload,controlsForDevice,readField} from './device-codec.js';
import {frameWithPayload} from './live-protocol.js';
import {defaultDeviceRecord,deriveDevicePresence,validateDeviceMatrix,changeDeviceAlgorithm} from './device-graph.js';
import {deviceDspEstimate} from './dsp-model.js';
import {readModulation} from './modulation-codec.js';
import {editorTransfers} from './editor-transfer.js';
const offset=(c,r)=>44+c*16+r*2;
const algorithms=Object.entries(deviceMap.algorithms).map(([id,a])=>({id,...a})).filter(a=>Number.isFinite(a.dsp)&&a.dsp>=0&&deviceMap.defaults[a.document]).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const familyDefinitions=Object.entries(deviceMap.defaults).map(([document,d])=>({document,...d,min:Math.min(...algorithms.filter(a=>a.document===document).map(a=>a.dsp))})).sort((a,b)=>a.block_type_id-b.block_type_id);
const record=n=>{const a=deviceMap.algorithms[n.algorithm],d=deviceMap.defaults[a.document];return {start:d.base+n.instanceIndex*d.stride,end:d.base+(n.instanceIndex+1)*d.stride};};
function protectedNode(buffer,n,request){
 return n.row>=buffer.rows||request.locks.blocks.includes(n.id)||request.locks.groups.some(k=>k.startsWith(n.id+'/'))||request.locks.fields.some(id=>id.startsWith(`${deviceMap.algorithms[n.algorithm].document}.inst[${n.instanceIndex}].`))||readModulation(buffer).some(l=>l.connected&&(l.destinationInfo??l.destination).block===n.blockTypeId&&(l.destinationInfo??l.destination).instance===n.instanceIndex);
}
function analysis(buffer,request){
 const keep=buffer.nodes.filter(n=>protectedNode(buffer,n,request)),visible=keep.filter(n=>n.row<buffer.rows);
 const known=deviceDspEstimate(buffer).estimated;
 const reasons=[];
 if(known===null)reasons.push('unknown-cost');
 const frozenRouting=buffer.cells.some(c=>c.type>=3&&c.type<=6);
 if(request.locks.graph&&!frozenRouting)reasons.push('locked');
 if(readModulation(buffer).some(l=>l.connected&&!l.destinationInfo))reasons.push('modulation-conflict');
 const cost=keep.reduce((v,n)=>v+deviceMap.algorithms[n.algorithm].dsp,0),counts=new Map();
 for(const n of keep)counts.set(n.blockTypeId,(counts.get(n.blockTypeId)??0)+1);
 if(frozenRouting){
  const ceiling=Math.max(known??0,request.dspBudgetPoints),freeNodes=buffer.nodes.filter(n=>!keep.some(k=>k.id===n.id));
  if(!freeNodes.some(n=>variantOptions(buffer,n,ceiling).length))reasons.push('no-proposal');
  return {keep,visible,cost,counts,free:0,reasons,frozenRouting,ceiling};
 }
 const minima=familyDefinitions.flatMap(d=>Array(Math.max(0,d.count-(counts.get(d.block_type_id)??0))).fill(d.min)).sort((a,b)=>a-b);
 let free=0,total=cost;for(const v of minima){if(total+v>request.dspBudgetPoints||free+visible.length>=buffer.rows*8)break;total+=v;free++;}
 if(cost>request.dspBudgetPoints||!free&&!visible.length)reasons.push('dsp-budget');
 return {keep,visible,cost,counts,free,reasons};
}
export const compositionPreflight=(buffer,request)=>analysis(buffer,request).reasons;
export function compositionNodeStatus(buffer,request){const info=analysis(buffer,request);return buffer.nodes.map(n=>({id:n.id,protected:protectedNode(buffer,n,request),variants:info.frozenRouting?variantOptions(buffer,n,info.ceiling).length:null}));}
// An existing loop or Insert fixes the complete matrix, not every free algorithm.
const gainField=f=>/^(mix|input|out_l|out_r|mute_mode)$|level|feedback|(^|_)fb($|_)|gain/.test(f.fieldName)&&!f.selector;
function variantOptions(buffer,node,ceiling){const total=deviceDspEstimate(buffer).estimated;return algorithms.filter(a=>a.blockTypeId===node.blockTypeId&&a.id!==node.algorithm&&total-deviceMap.algorithms[node.algorithm].dsp+a.dsp<=ceiling);}
function variant(buffer,node,algorithm){
 const next=decodeDeviceBuffer(frameWithPayload(buffer.frame,changeDeviceAlgorithm(buffer,node.id,algorithm)));
 // Do not change gain/routing/feedback to make the new variant fit its domain.
 for(const f of controlsForDevice(buffer,node).filter(gainField))if(readField(buffer,f)!==readField(next,f))throw Error('locked');
 return next;
}
function buildFrozenRouting(buffer,request,salt,info){
 const draw=rng((request.seed^Math.imul(salt+1,0x9e3779b9))>>>0),free=shuffle(buffer.nodes.filter(n=>!info.keep.some(k=>k.id===n.id)),draw);
 let next=buffer;
 for(const original of free){const node=next.nodes.find(n=>n.id===original.id),options=variantOptions(next,node,info.ceiling);if(!options.length)continue;
  // Try each shuffled admissible variant; reject any that would change common gains.
  for(const a of shuffle(options,draw)){try{next=variant(next,node,a.id);break;}catch{}}
 }
 return next.payload.slice();
}
function rng(seed){let x=seed||0x6d2b79f5,draws=0;return n=>{if(++draws>4096||!Number.isInteger(n)||n<1)throw Error('draw-limit');x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)%n;};}
const shuffle=(values,draw)=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=draw(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function cheapest(counts,n){const costs=familyDefinitions.flatMap(d=>Array(Math.max(0,d.count-(counts.get(d.block_type_id)??0))).fill(d.min)).sort((a,b)=>a-b);return costs.length<n?Infinity:costs.slice(0,n).reduce((a,b)=>a+b,0);}
export function buildComposition(buffer,request,salt){
 if(!Number.isInteger(salt)||salt<0||salt>=32)throw Error('invalid-request');
 const info=analysis(buffer,request);if(info.reasons.length)throw Error(info.reasons[0]);
 if(info.frozenRouting)return buildFrozenRouting(buffer,request,salt,info);
 const draw=rng((request.seed^Math.imul(salt+1,0x9e3779b9))>>>0),counts=new Map(info.counts),created=[];
 let budget=request.dspBudgetPoints-info.cost;
 for(let remaining=info.free;remaining>0;remaining--){
  const feasible=algorithms.filter(a=>{
   const d=deviceMap.defaults[a.document],used=counts.get(a.blockTypeId)??0;if(used>=d.count||a.dsp>budget)return false;
   const next=new Map(counts);next.set(a.blockTypeId,used+1);return a.dsp+cheapest(next,remaining-1)<=budget;
  });
  if(!feasible.length)throw Error('dsp-budget');
  // Prefer family diversity when this does not reduce the maximum engine count.
  const fresh=feasible.filter(a=>!counts.get(a.blockTypeId)),choices=fresh.length?fresh:feasible,a=choices[draw(choices.length)];
  const occupied=new Set([...info.keep,...created].filter(n=>n.blockTypeId===a.blockTypeId).map(n=>n.instanceIndex));let instanceIndex=0;while(occupied.has(instanceIndex))instanceIndex++;
  created.push({id:`hw-${a.blockTypeId}-${instanceIndex}`,algorithm:a.id,blockTypeId:a.blockTypeId,instanceIndex});counts.set(a.blockTypeId,(counts.get(a.blockTypeId)??0)+1);budget-=a.dsp;
 }
 const movable=shuffle([...info.visible.filter(n=>!request.locks.blocks.includes(n.id)),...created],draw),fixed=info.visible.filter(n=>request.locks.blocks.includes(n.id));
 const engineCount=info.visible.length+created.length,minFixedCols=Math.max(0,...fixed.map(n=>n.col+1)),minFixedHeights=Array(minFixedCols).fill(1);for(const n of fixed)minFixedHeights[n.col]=Math.max(minFixedHeights[n.col],n.row+1);
 const requiredPipelines=Math.max(0,minFixedHeights.reduce((a,b)=>a+b,0)-engineCount),pipeCapacity=Math.min(Math.max(4,requiredPipelines),Math.floor(budget),buffer.rows*8-engineCount);
 if(pipeCapacity<requiredPipelines)throw Error('invalid-graph');
 const pipelines=pipeCapacity?requiredPipelines+draw(pipeCapacity-requiredPipelines+1):0,total=engineCount+pipelines;
 const minCols=Math.max(1,Math.ceil(total/buffer.rows),...fixed.map(n=>n.col+1)),maxCols=Math.min(8,total);if(minCols>maxCols)throw Error('invalid-graph');
 const cols=minCols+draw(maxCols-minCols+1),heights=Array(cols).fill(1);
 for(const n of fixed)heights[n.col]=Math.max(heights[n.col],n.row+1);
 if(heights.reduce((a,b)=>a+b,0)>total)throw Error('invalid-graph');
 while(heights.reduce((a,b)=>a+b,0)<total){const choices=heights.map((v,i)=>v<buffer.rows?i:-1).filter(i=>i>=0);heights[choices[draw(choices.length)]]++;}
 const slots=shuffle(heights.flatMap((height,col)=>Array.from({length:height},(_,row)=>({col,row}))).filter(pos=>!fixed.some(n=>n.col===pos.col&&n.row===pos.row)),draw),p=buffer.payload.slice();
 for(let col=0;col<8;col++)for(let row=0;row<buffer.rows;row++)p.fill(0,offset(col,row),offset(col,row)+2);
 const place=(n,pos)=>{p[offset(pos.col,pos.row)]=n.blockTypeId;p[offset(pos.col,pos.row)+1]=n.instanceIndex;};
 for(const n of fixed)place(n,n);
 movable.forEach((n,i)=>place(n,slots[i]));
 for(const pos of slots.slice(movable.length)){p[offset(pos.col,pos.row)]=1;p[offset(pos.col,pos.row)+1]=255;}
 const keptIds=new Set(info.keep.map(n=>n.id));
 for(const n of buffer.nodes.filter(n=>!keptIds.has(n.id)))p[171+n.blockTypeId]&=~(1<<n.instanceIndex);
 for(const n of created){const a=deviceMap.algorithms[n.algorithm],d=deviceMap.defaults[a.document];p.set(d.records[n.instanceIndex],d.base+n.instanceIndex*d.stride);const selector=a.selector&&fieldById.get(a.selector.replace('.inst[0]',`.inst[${n.instanceIndex}]`));if(selector)p[selector.offset]=a.variant;p[171+n.blockTypeId]&=~(1<<n.instanceIndex);}
 deriveDevicePresence(p);
 let next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));
 for(const n of created){const current=next.nodes.find(z=>z.id===n.id),r=record(current);p.set(defaultDeviceRecord(next,current),r.start);next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));}
 validateDeviceMatrix(next);return p;
}
export function validateComposition(before,after,request){
 const info=analysis(before,request),reasons=[...info.reasons],changes=[],allowed=new Uint8Array(before.payload.length),keptIds=new Set(info.keep.map(n=>n.id));
 if(info.frozenRouting){
  let expected=before;
  if(before.nodes.length!==after.nodes.length)reasons.push('quota');
  // Reconstruct only the declared algorithm changes through the existing helper.
  for(const original of before.nodes){const next=after.nodes.find(n=>n.id===original.id);if(!next){reasons.push('quota');continue;}
   if(next.algorithm!==original.algorithm){
    if(keptIds.has(original.id))reasons.push('locked');
    else try{expected=variant(expected,expected.nodes.find(n=>n.id===original.id),next.algorithm);changes.push({kind:'block',target:original.id,label:next.algorithm,before:original.algorithm,after:next.algorithm});}catch{reasons.push('locked');}
   }
  }
  if(!samePayload(expected.payload,after.payload))reasons.push('opaque-data');
  if(!samePayload(before.payload.slice(44,232),after.payload.slice(44,232)))reasons.push('new-feedback');
  try{editorTransfers(before,after);}catch{reasons.push('invalid-codec');}
  return {reasons,changes,preservedRouting:true,estimatedCeiling:info.ceiling};
 }
 for(let col=0;col<8;col++)for(let row=0;row<before.rows;row++)allowed.fill(255,offset(col,row),offset(col,row)+2);
 allowed.fill(255,190,206);
 for(const n of info.keep){
  const next=after.nodes.find(z=>z.id===n.id),r=record(n);
  if(!next||next.algorithm!==n.algorithm||next.muted!==n.muted||!samePayload(before.payload.slice(r.start,r.end),after.payload.slice(r.start,r.end)))reasons.push('locked');
  if(next&&(request.locks.blocks.includes(n.id)||n.row>=before.rows)&&(next.col!==n.col||next.row!==n.row))reasons.push('locked');
 }
 for(const n of before.nodes.filter(n=>!keptIds.has(n.id))){allowed[171+n.blockTypeId]|=1<<n.instanceIndex;if(!after.nodes.some(z=>z.id===n.id))changes.push({kind:'block',target:n.id,label:n.algorithm,before:n.algorithm,after:'Retiré'});}
 for(const n of after.nodes.filter(n=>!keptIds.has(n.id))){
  const r=record(n),seed=defaultDeviceRecord(after,n);if(n.row>=after.rows||n.muted||!samePayload(after.payload.slice(r.start,r.end),seed))reasons.push('invalid-codec');
  allowed.fill(255,r.start,r.end);allowed[171+n.blockTypeId]|=1<<n.instanceIndex;
  const old=before.nodes.find(z=>z.id===n.id);changes.push({kind:'block',target:n.id,label:n.algorithm,before:old?.algorithm??'Absent',after:n.algorithm});
 }
 for(const n of after.nodes){const old=before.nodes.find(z=>z.id===n.id);if(!old||old.col!==n.col||old.row!==n.row)changes.push({kind:'position',target:n.id,label:n.algorithm,before:old?[old.col,old.row]:null,after:[n.col,n.row]});}
 for(const c of after.cells.filter(c=>c.type===1&&c.row<after.rows))changes.push({kind:'connection',target:`${c.col}:${c.row}`,label:'Pipeline',before:'Routage source',after:`C${c.col+1}:L${c.row+1}`});
 if(after.rows!==before.rows||after.payload.some((v,i)=>((v^before.payload[i])&~allowed[i])!==0))reasons.push('opaque-data');
 const count=after.nodes.filter(n=>n.row<after.rows).length;if(count!==info.visible.length+info.free)reasons.push('quota');
 if(after.cells.some(c=>c.row<after.rows&&c.type&&c.type!==1&&c.type<7))reasons.push('new-feedback');
 // All generated writes must also pass the existing hardware editor's admission.
 try{editorTransfers(before,after);}catch{reasons.push('invalid-codec');}
 return {reasons,changes};
}
