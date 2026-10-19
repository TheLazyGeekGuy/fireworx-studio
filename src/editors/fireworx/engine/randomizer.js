import {defaultDspCeiling,maximumDspCeiling} from './dsp-policy.js';
import {compositionPreflight,buildComposition,validateComposition} from './randomizer-composition.js';
// Deterministic, bounded, cancellable LOCAL proposals. No MIDI/DOM/file access.
import {decodeDeviceBuffer,controlsForDevice,readField,editedPayload,samePayload,deviceMap} from './device-codec.js';
import {localEditFrame} from './preset-library-model.js';
import {frameWithPayload} from './live-protocol.js';
import {validateDeviceMatrix,moveDeviceBlock,connectDeviceBlock} from './device-graph.js';
import {matrixTopology} from './routing-topology.js';
import {deviceDspEstimate} from './dsp-model.js';
import {randomizerGroups,linkedGroup,normalizedFieldId,randomizerGroupsVersion} from './randomizer-groups.js';
export const randomizerSpec='fireworx-randomizer-design-r1';
export const ascii=(a,b)=>a<b?-1:a>b?1:0;
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function randomizerSnapshot(frame){const local=localEditFrame(Uint8Array.from(frame));return {frame:local,sha256:await sha256(local)};}
export function createRandomizerRng(seed,maxDraws=4096){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(maxDraws)||maxDraws<1||maxDraws>4096)throw Error('invalid-request');
 let x=seed||0x6D2B79F5,draws=0;
 const next=()=>{if(draws>=maxDraws)throw Error('draw-limit');draws++;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>=0;};
 return {next,get draws(){return draws;},integer(n){if(!Number.isInteger(n)||n<1||n>0x7fffffff)throw Error('invalid-request');const M=0xffffffff,limit=M-M%n;let r;do{r=next()-1;}while(r>=limit);return r%n;}};
}
export function versionsForCorpus(corpus){return {adapter:'fireworx-randomizer-adapter-r4',codec:corpus.sourceHashes?.['device-codec.js']??'',graph:corpus.sourceHashes?.['routing-topology.js']??'',cost:corpus.sourceHashes?.['dsp-model.js']??'',groups:randomizerGroupsVersion,policy:'donor-uniform-r1',corpusProfileSha256:corpus.corpusProfileSha256,donorManifestSha256:corpus.captureManifestSha256,donorIndexSha256:corpus.indexSha256??'unspecified-local-index'};}
export function randomizerRequest(base,corpus,{mode='parameters',seed=1,blocks=[],groups=[],fields=[],graph=false,dspBudgetPoints=defaultDspCeiling,sampleRateHz=44100}={}){
 return {spec:randomizerSpec,mode,seed,baseSha256:base.sha256,versions:versionsForCorpus(corpus),locks:{blocks:[...blocks],groups:[...groups],fields:[...fields],graph,io:true,modulation:true,opaque:true,feedback:true},context:{sampleRateHz,resourceProfileId:mode==='blocks'?'seeded-family-defaults-r1':'fixed-algorithm-options-r1'},limits:{maxAttempts:100,maxDraws:4096,maxProposals:4096},dspBudgetPoints};
}
const pause=()=>new Promise(r=>setTimeout(r,0));
const cancelled=s=>s?.aborted;
const activeNodes=b=>b.nodes.filter(n=>n.row<b.rows);
const fail=reason=>{throw Error(reason);};
const sameVersion=(a,b)=>Object.keys(b).every(k=>a?.[k]===b[k]);
const lockGroup=(r,n,g)=>r.locks.blocks.includes(n.id)||r.locks.groups.includes(n.id+'/'+g.id)||g.fields.some(f=>r.locks.fields.includes(f.id));
function validRequest(r){
 if(!r||r.spec!==randomizerSpec||!['parameters','structure','blocks'].includes(r.mode)||!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||!/^([a-f0-9]{64})$/.test(r.baseSha256??''))return false;
 if(!r.locks||!['blocks','groups','fields'].every(k=>Array.isArray(r.locks[k])&&r.locks[k].every(v=>typeof v==='string'))||r.locks.io!==true||r.locks.modulation!==true||r.locks.opaque!==true||r.locks.feedback!==true||typeof r.locks.graph!=='boolean')return false;
 if(![44100,48000].includes(r.context?.sampleRateHz)||r.context.resourceProfileId!==(r.mode==='blocks'?'seeded-family-defaults-r1':'fixed-algorithm-options-r1')||!Number.isInteger(r.dspBudgetPoints)||r.dspBudgetPoints<1||r.dspBudgetPoints>maximumDspCeiling)return false;
 return [['maxAttempts',100],['maxDraws',4096],['maxProposals',4096]].every(([k,max])=>Number.isInteger(r.limits?.[k])&&r.limits[k]>0&&r.limits[k]<=max);
}
function topologyValid(b){
 const cells=b.cells.filter(c=>c.type&&c.row<b.rows),g=matrixTopology(cells,b.rows);if(g.warnings.length)return false;
 const key=c=>typeof c==='string'?c:`${c.col}:${c.row}`,out=new Map(),ins=new Map();
 const add=(a,z)=>{a=key(a);z=key(z);if(!out.has(a))out.set(a,new Set());out.get(a).add(z);if(!ins.has(z))ins.set(z,new Set());ins.get(z).add(a);};
 for(const c of cells)for(const s of g.sourcesOf(c))add(s,c);
 for(const e of g.edges)if(e.kind==='output')add(e.from,'OUT');
 const visiting=new Set(),done=new Set();const cycle=k=>{if(visiting.has(k))return true;if(done.has(k))return false;visiting.add(k);for(const z of out.get(k)??[])if(cycle(z))return true;visiting.delete(k);done.add(k);return false;};
 if(cells.some(c=>cycle(key(c))))return false;
 const walk=(start,map)=>{const set=new Set(start),q=[...start];for(let i=0;i<q.length;i++)for(const z of map.get(q[i])??[])if(!set.has(z)){set.add(z);q.push(z);}return set;};
 const fed=walk(['IN',...cells.filter(c=>c.type===18).map(key)],out),exits=walk(['OUT'],ins);
 return cells.every(c=>fed.has(key(c))&&exits.has(key(c)));
}
export function createFireworxRandomizerAdapter(corpus){
 if(corpus?.kind!=='fireworx-randomizer-donors'||corpus.schema!==1||corpus.groupsVersion!==randomizerGroupsVersion||!/^[a-f0-9]{64}$/.test(corpus.indexSha256??'')||!Array.isArray(corpus.donors)||corpus.donors.length>10000)throw Error('incompatible-version');
 const donors=new Map();for(const d of corpus.donors){if(typeof d.id!=='string'||!/^[-a-zA-Z0-9|]+$/.test(d.id)||!d.values||typeof d.values!=='object')throw Error('invalid-request');const key=d.algorithm+'/'+d.group;if(!donors.has(key))donors.set(key,[]);donors.get(key).push(d);}
 const versions=versionsForCorpus(corpus);
 return {versions,preflight(base,request){const buffer=decodeDeviceBuffer(base.frame);if(request.mode==='blocks')return compositionPreflight(buffer,request);const cost=deviceDspEstimate(buffer).estimated;return cost===null?['unknown-cost']:request.mode!=='parameters'&&cost>request.dspBudgetPoints?['dsp-budget']:[];},
 async *enumerate(base,request,signal){
  const b=decodeDeviceBuffer(base.frame),nodes=activeNodes(b);
  if(request.mode==='blocks'){for(let salt=0;salt<32;salt++){if(cancelled(signal))return;yield {id:`composition|${String(salt).padStart(2,'0')}`,weight:1,operation:'composition',targetIds:nodes.map(n=>n.id),plan:{salt,request}};}return;}
  if(request.mode==='parameters'){
   for(const n of nodes)for(const g of randomizerGroups(b,n)){
    if(lockGroup(request,n,g)||linkedGroup(b,n,g))continue;
    for(const d of donors.get(n.algorithm+'/'+g.id)??[]){
     if(cancelled(signal))return;
     const changes=g.fields.map(f=>[f.id,d.values[normalizedFieldId(f.id)]]);
     if(changes.some(([,v])=>!Number.isInteger(v))||!changes.some(([id,v])=>readField(b,g.fields.find(f=>f.id===id))!==v))continue;
     yield {id:`parameter|${n.id}|${g.id}|${d.id}`,weight:1,operation:'parameter-group',donor:{presetSha256:d.presetSha256,algorithm:d.algorithm,instance:d.instance,group:d.group},targetIds:[n.id],plan:{node:n.id,group:g.id,changes}};
    }
    await pause();
   }
  }else{
   if(request.locks.graph)return;
   // First version keeps every feedback/insert topology fully locked.
   if(b.cells.some(c=>c.type>=3&&c.type<=6))return;
   for(const n of nodes){
    if(request.locks.blocks.includes(n.id))continue;
    for(const c of b.cells.filter(c=>!c.type&&c.row<b.rows))yield {id:`move|${n.id}|${c.col}:${c.row}`,weight:1,operation:'move',targetIds:[n.id],plan:{node:n.id,to:{col:c.col,row:c.row}}};
    for(const other of nodes){
     if(other.id===n.id||request.locks.blocks.includes(other.id))continue;
     if(ascii(n.id,other.id)<0)yield {id:`swap|${n.id}|${other.id}`,weight:1,operation:'swap',targetIds:[n.id,other.id],plan:{node:n.id,to:{col:other.col,row:other.row}}};
     for(const mode of ['series','parallel','return'])yield {id:`connect|${n.id}|${other.id}|${mode}`,weight:1,operation:mode==='return'?'branch-return':'series-parallel',targetIds:[n.id,other.id],plan:{node:n.id,anchor:other.id,mode}};
    }
    if(cancelled(signal))return;await pause();
   }
  }
 },
 async materialize(base,proposal,signal){
  if(cancelled(signal))fail('cancelled');const b=decodeDeviceBuffer(base.frame),p=proposal.plan;let payload;
  if(proposal.operation==='composition')payload=buildComposition(b,p.request,p.salt);
  else if(proposal.operation==='parameter-group')payload=editedPayload(b,new Map(p.changes));
  else if(['move','swap'].includes(proposal.operation))payload=moveDeviceBlock(b,p.node,p.to,{swap:proposal.operation==='swap'});
  else payload=connectDeviceBlock(b,{kind:'node',id:p.node},p.anchor,p.mode);
  return randomizerSnapshot(frameWithPayload(b.frame,payload));
 },
 validate(base,candidate,request){
  const reasons=[],changes=[];let estimatedDspPoints=null,preservedRouting=false,estimatedCeiling=request.dspBudgetPoints;
  try{
   const before=decodeDeviceBuffer(base.frame),after=decodeDeviceBuffer(candidate.frame),allowed=new Uint8Array(1366);
   validateDeviceMatrix(after);
   if(!sameVersion(request.versions,versions))reasons.push('incompatible-version');
   if(after.preset!==0||after.device!==before.device)reasons.push('invalid-codec');
   if(request.mode!=='blocks'&&(before.nodes.length!==after.nodes.length||before.nodes.some(n=>!after.nodes.some(z=>z.id===n.id&&z.algorithm===n.algorithm&&z.muted===n.muted))))reasons.push('quota');
   if(request.mode==='parameters'){
    for(const n of activeNodes(before))for(const g of randomizerGroups(before,n)){
     if(lockGroup(request,n,g)||linkedGroup(before,n,g))continue;
     for(const f of g.fields){allowed.fill(255,f.offset,f.offset+f.width);const z=readField(after,f),v=readField(before,f);if(v!==z){editedPayload(after,new Map([[f.id,z]]));changes.push({kind:'field',target:f.id,label:f.displayLabel,before:v,after:z});}}
    }
   }else if(request.mode==='blocks'){
    const composed=validateComposition(before,after,request);reasons.push(...composed.reasons);changes.push(...composed.changes);preservedRouting=!!composed.preservedRouting;estimatedCeiling=composed.estimatedCeiling??request.dspBudgetPoints;
   }else{
    if(request.locks.graph)reasons.push('locked');
    if(before.cells.some(c=>c.type>=3&&c.type<=6))reasons.push('new-feedback');
    for(let col=0;col<8;col++)for(let row=0;row<before.rows;row++)allowed.fill(255,44+col*16+row*2,46+col*16+row*2);
    for(const n of before.nodes){const z=after.nodes.find(z=>z.id===n.id);if(z&&(n.col!==z.col||n.row!==z.row)){if(request.locks.blocks.includes(n.id))reasons.push('locked');changes.push({kind:'position',target:n.id,label:n.algorithm,before:[n.col,n.row],after:[z.col,z.row]});}}
    for(const c of after.cells.filter(c=>c.type&&c.type<7)){const old=before.cells.find(z=>z.col===c.col&&z.row===c.row);if(c.type!==1&&(c.type!==old?.type||c.instance!==old?.instance))reasons.push('new-feedback');if(c.type===1&&old?.type!==1)changes.push({kind:'connection',target:`${c.col}:${c.row}`,label:'Pipeline',before:'Case vide',after:`C${c.col+1}:L${c.row+1}`});}
    if(before.cells.some(c=>c.type&&c.type<7&&!after.cells.some(z=>z.col===c.col&&z.row===c.row&&z.type===c.type&&z.instance===c.instance)))reasons.push('opaque-data');
   }
   if(request.mode!=='blocks'&&after.payload.some((v,i)=>((v^before.payload[i])&~allowed[i])!==0))reasons.push('opaque-data');
   if(!topologyValid(after))reasons.push('invalid-graph');
   const dsp=deviceDspEstimate(after);estimatedDspPoints=dsp.estimated;
   const baselineDspPoints=deviceDspEstimate(before).estimated;
   if(estimatedDspPoints===null||baselineDspPoints===null)reasons.push('unknown-cost');
   else if(request.mode==='parameters'?estimatedDspPoints!==baselineDspPoints:estimatedDspPoints>estimatedCeiling)reasons.push('dsp-budget');
   if(samePayload(before.payload,after.payload))reasons.push('empty-diff');
  }catch{reasons.push('invalid-codec');}
  const order=['invalid-request','stale-base','incompatible-version','proposal-limit','invalid-codec','opaque-data','locked','quota','collision','invalid-graph','new-feedback','modulation-conflict','unknown-cost','dsp-budget','empty-diff'];
  return {reasons:[...new Set(reasons)].sort((a,b)=>order.indexOf(a)-order.indexOf(b)),estimatedDspPoints,hardwareMeasured:false,changes,preservedRouting,estimatedCeiling};
 }};
}
export async function generateRandomizer(base,request,adapter,signal){
 request=structuredClone(request);base={frame:base.frame.slice(),sha256:base.sha256};
 const replay={request,prng:'xorshift32-nonzero-r1',outcome:'rejected',attempts:[],totalDraws:0};
 const rejected=reasons=>({status:'rejected',reasons,replay});
 const cancel=()=>{replay.outcome='cancelled';return {status:'cancelled',replay};};
 if(cancelled(signal))return cancel();
 if(!validRequest(request))return rejected(['invalid-request']);
 if(await sha256(base.frame)!==base.sha256||base.sha256!==request.baseSha256)return rejected(['stale-base']);
 if(!sameVersion(request.versions,adapter.versions))return rejected(['incompatible-version']);
 const preflight=adapter.preflight?.(base,request)??[];if(preflight.length)return rejected(preflight);
 const rng=createRandomizerRng(request.seed,request.limits.maxDraws),proposals=[],ids=new Set();
 try{
  for await(const p of adapter.enumerate(base,request,signal)){
   if(cancelled(signal))return cancel();
   if(typeof p.id!=='string'||!/^[\x21-\x7e]+$/.test(p.id)||ids.has(p.id)||!Number.isInteger(p.weight)||p.weight<1)fail('invalid-request');
   ids.add(p.id);proposals.push(p);if(proposals.length>request.limits.maxProposals)return rejected(['proposal-limit']);
  }
  if(cancelled(signal))return cancel();
  proposals.sort((a,b)=>ascii(a.id,b.id));
  if(!proposals.length)return rejected([request.mode==='parameters'?'no-donor':'no-proposal']);
  let attempts=0;
  while(proposals.length&&attempts<request.limits.maxAttempts){
   if(cancelled(signal))return cancel();await pause();if(cancelled(signal))return cancel();
   const total=proposals.reduce((s,p)=>s+p.weight,0);if(total>0x7fffffff)fail('invalid-request');
   let t=rng.integer(total),i=0;while(t>=proposals[i].weight)t-=proposals[i++].weight;
   const p=proposals.splice(i,1)[0];attempts++;let candidate,validation;
   try{candidate=await adapter.materialize(base,p,signal);if(cancelled(signal))return cancel();if(await sha256(candidate.frame)!==candidate.sha256||await sha256(base.frame)!==base.sha256)fail('invalid-codec');validation=adapter.validate(base,candidate,request);}catch(e){if(cancelled(signal))return cancel();validation={reasons:[e.message==='cancelled'?'invalid-request':'invalid-codec']};}
   replay.totalDraws=rng.draws;replay.attempts.push({proposalId:p.id,reasons:validation.reasons,drawCountAfter:rng.draws});
   if(!validation.reasons.length){if(cancelled(signal))return cancel();replay.outcome='accepted';replay.acceptedProposalId=p.id;replay.acceptedFrameSha256=candidate.sha256;return {status:'accepted',candidate,validation,replay};}
  }
  return rejected([...new Set([...replay.attempts.flatMap(a=>a.reasons),...(proposals.length?['attempt-limit']:[])])]);
 }catch(e){replay.totalDraws=rng.draws;return rejected([e.message==='draw-limit'?'draw-limit':'invalid-request']);}
}
