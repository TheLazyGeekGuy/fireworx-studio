// #67 offline evidence: structural writes as one verified full Data20 of P0.
// Synthetic ports and simulated clocks only; no MIDI driver, no physical port.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {mock} from 'node:test';
import {deviceMap,decodeDeviceBuffer,controlsForDevice,editedPayload,readField,samePayload} from '../src/editors/fireworx/engine/device-codec.js';
import {frameWithPayload,parseBufferPart,writeBufferPart,changedSpan} from '../src/editors/fireworx/engine/live-protocol.js';
import * as g from '../src/editors/fireworx/engine/device-graph.js';
import {editorTransfers,inactiveRecordWrites,engineRecords,structuralReasons} from '../src/editors/fireworx/engine/editor-transfer.js';
import {createGuardedTransport} from '../src/editors/fireworx/engine/guarded-transport.js';
import {parameterTransfers} from '../src/editors/fireworx/engine/parameter-transfer.js';
import {createLiveSession} from '../src/editors/fireworx/engine/live-session.js';
import {editorLivePolicy,guardedLivePolicy,structuralSettleBounds} from '../src/editors/fireworx/engine/hardware-policy.js';
import {requestExpanded} from '../src/editors/fireworx/engine/protocol.js';
import {createModulation,modulationSources,modulationDestinations} from '../src/editors/fireworx/engine/modulation-codec.js';
const fixture=decodeDeviceBuffer(new Uint8Array(fs.readFileSync(new URL('generated/synthetic-p0.syx',import.meta.url))));
const decode=(b,p)=>decodeDeviceBuffer(frameWithPayload(b.frame,p));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=4000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Délai de test dépassé');await wait(2);}}
const report={status:'passed',physicalMidiUsed:false};

// 1. Frame classes, before (legacy contiguous DataPart21 span) and after (#67 planner).
const legacy=(b,a)=>{try{return parameterTransfers(b,a).map(op=>`DataPart21 ${op.frame.length} o`).join(' + ');}catch{const s=changedSpan(b.payload,a.payload);return `DataPart21 ${15+2*s.data.length} o`;}};
const captures=[['live-fixture.syx',fixture]];
report.frameClasses=[];
for(const [name,b] of captures){
 const occupied=new Set(b.cells.filter(c=>c.type).map(c=>c.col+','+c.row));let free=null;
 for(let r=0;r<b.rows&&!free;r++)for(let c=0;c<8;c++)if(!occupied.has(c+','+r)){free={col:c,row:r};break;}
 const ops=[...['delay-stereo','panner-simple','gate','chorus-classic'].map(a=>[`ajout ${a}`,()=>g.addDeviceBlock(b,a,free)]),['mute 1er moteur',()=>g.muteDeviceBlock(b,b.nodes[0].id)],['déplacement 1er moteur',()=>g.moveDeviceBlock(b,b.nodes[0].id,free)],['retrait 1er moteur',()=>g.removeDeviceBlock(b,b.nodes[0].id)],...['series','parallel','return'].map(m=>[`ports ${m} 1er→dernier`,()=>g.connectDevicePorts(b,b.nodes[0].id,b.nodes.at(-1).id,m)])];
 const delay=b.nodes.find(n=>n.algorithm==='delay-stereo'),time=delay&&controlsForDevice(b,delay).find(f=>f.fieldName==='st_time');
 if(time)ops.push(['scalaire Delay time',()=>editedPayload(b,new Map([[time.id,readField(b,time)+1]]))]);
 for(const [label,fn] of ops){
  let p;try{p=fn();}catch(e){report.frameClasses.push({capture:name,operation:label,refusedByGraph:e.message});continue;}
  const a=decode(b,p),plan=editorTransfers(b,a);assert.equal(plan.length,1);const [op]=plan;
  if(label.startsWith('scalaire'))assert.equal(op.kind,'scalar');else{assert.equal(op.kind,'full');assert.equal(op.frame.length,2745);assert.equal(op.frame[6],32);}
  report.frameClasses.push({capture:name,operation:label,before:legacy(b,a),after:op.kind==='full'?`Data20 ${op.frame.length} o + GET de contrôle`:`DataPart21 ${op.frame.length} o`,reasons:op.reasons});
 }
}
// Classification of editable field edits on the fixture (documentation of the boundary).
const classification={scalar:0,full:0,fullReasons:{}};
for(const n of fixture.nodes)for(const f of controlsForDevice(fixture,n).filter(f=>f.editable&&f.range)){
 const old=readField(fixture,f),keys=f.values?Object.keys(f.values).map(Number).filter(Number.isInteger):[f.range[0],f.range[1]],v=keys.find(x=>x!==old);if(v===undefined)continue;
 const a=decode(fixture,editedPayload(fixture,new Map([[f.id,v]]))),[op]=editorTransfers(fixture,a);
 if(op.kind==='scalar')classification.scalar++;else{classification.full++;const key=f.fieldName+(f.locallyTrialled?'':' (non éprouvé)');classification.fullReasons[key]=(classification.fullReasons[key]??0)+1;}
}
report.fieldEditClassification=classification;

// 2. Inactive engine records: refused by the planner before any send.
const empty=new Uint8Array(1366);empty[1]=206;empty[172]=4;const blank=decodeDeviceBuffer(frameWithPayload(fixture.frame,empty));
const one=decode(blank,g.addDeviceBlock(blank,'delay-stereo',{col:0,row:0}));
const delay2=engineRecords.find(r=>r.blockTypeId===11&&r.instanceIndex===1),delay1=engineRecords.find(r=>r.blockTypeId===11&&r.instanceIndex===0);
const refuse=(label,before,p,pattern)=>{assert.throws(()=>editorTransfers(before,decode(before,p)),pattern,label);return label;};
const inactiveCases=[];
{const p=one.payload.slice();p[delay2.start+10]^=1;inactiveCases.push(refuse('octet d’un enregistrement absent',one,p,/enregistrement inactif Delay 2.*absent de la matrice/));}
{const p=g.removeDeviceBlock(one,one.nodes[0].id);p[delay1.start+3]^=1;inactiveCases.push(refuse('retrait + octet du moteur retiré',one,p,/moteur retiré/));}
{const p=g.addDeviceBlock(one,'gate',{col:1,row:0}),gate=engineRecords.find(r=>r.blockTypeId===7&&r.instanceIndex===0);const seed=p.slice(gate.start,gate.end);p[gate.start+5]=seed[5]^4;inactiveCases.push(refuse('création avec octet hors graine',one,p,/hors graine/));}
{const p=one.payload.slice();p[171+11]|=2;inactiveCases.push(refuse('mute d’une instance absente',one,p,/mute d’un moteur absent/));}
{const p=one.payload.slice();p[209]^=1;inactiveCases.push(refuse('enregistrement FB Return absent',one,p,/routage absent/));}
// Positive controls: the refusal is not vacuous.
assert.equal(editorTransfers(one,decode(one,g.addDeviceBlock(one,'gate',{col:1,row:0})))[0].kind,'full');
assert.deepEqual(inactiveRecordWrites(one,decode(one,g.addDeviceBlock(one,'gate',{col:1,row:0}))),[]);
report.inactiveRecords={refusedCases:inactiveCases};
// Session level: refusal before any transmission (no compare GET either).
function device(start,{onWrite=()=>{}}={}){
 let current=start,receive=null,closed=false;const sent=[];
 return {sent,get current(){return current;},set current(v){current=v;},get closed(){return closed;},
  raw:{subscribe(fn){receive=fn;return()=>{receive=null;};},send(bytes){if(closed)throw Error('fermé');sent.push({bytes:bytes.slice(),at:clockNow()});
   if(bytes[6]===33){const part=parseBufferPart(bytes,0),p=current.payload.slice();p.set(part.data,part.address);current=decode(current,p);onWrite(bytes);}
   else if(bytes[6]===32){current=decodeDeviceBuffer(bytes);onWrite(bytes);}
   else if(bytes[6]===69){const reply=current.frame.slice();reply[7]=bytes[7];reply[8]=bytes[8];setTimeout(()=>receive?.(reply),5);}},close(){closed=true;}}};
}
let clock=0;const clockNow=()=>clock,jump=()=>{clock+=20000;};
async function connected(start,options={}){const dev=device(start,{onWrite:jump}),transport=createGuardedTransport(dev.raw,{editor:true,now:clockNow}),session=createLiveSession(transport,{transferPlan:editorTransfers,debounce:1,minWriteInterval:1,verifyDelay:1,structuralDelay:1,timeout:2000,...options});await session.load();await session.load();return {dev,transport,session};}
{
 const {dev,session}=await connected(one);const before=dev.sent.length;
 const p=one.payload.slice();p[delay2.start+10]^=1;assert.throws(()=>session.replace(p,{structural:true}),/enregistrement inactif/);
 await wait(30);assert.equal(dev.sent.length,before);assert.equal(session.paused,false);
 // A new engine cannot be edited before its creation image has been sent and read back.
 session.replace(g.addDeviceBlock(session.image,'delay-stereo',{col:1,row:0}),{structural:true});
 const created=session.image.nodes.find(n=>n.instanceIndex===1&&n.blockTypeId===11),fb=controlsForDevice(session.image,created).find(f=>f.fieldName==='st_time');
 assert.throws(()=>session.replace(editedPayload(session.image,new Map([[fb.id,readField(session.image,fb)+7]]))),/pas encore relue.*hors graine/);
 await until(()=>session.diagnostics.phase==='verified'&&session.reference.nodes.length===2);
 session.replace(editedPayload(session.image,new Map([[fb.id,readField(session.image,fb)+7]])));await until(()=>session.diagnostics.phase==='verified'&&readField(session.reference,fb)===readField(session.image,fb));
 report.inactiveRecords.sessionRefusedBeforeSend={transmitted:0,createdEngineEditedAfterReadback:true};session.dispose();
}

// 3. Stale reference: the compare GET differs → nothing sent, nothing adopted.
{
 const {dev,session}=await connected(fixture);const writes=()=>dev.sent.filter(m=>m.bytes[6]===32||m.bytes[6]===33).length;
 const facade=fixture.payload.slice();facade[24]^=1;dev.current=decode(fixture,facade);
 session.replace(g.moveDeviceBlock(session.image,session.image.nodes[0].id,{col:5,row:1}),{structural:true});
 await until(()=>session.paused);assert.match(session.diagnostics.error,/P0 a changé.*aucune écriture envoyée/);assert.equal(writes(),0);assert(dev.closed);
 assert.equal(dev.sent.at(-1).bytes[6],69);assert(samePayload(dev.current.payload,facade),'Device P0 left as the façade set it');assert.equal(session.diagnostics.staleReferences,1);
 const count=dev.sent.length;await wait(40);assert.equal(dev.sent.length,count,'No retry after a stale reference');session.dispose();
 const second=await connected(fixture),target=decode(fixture,editedPayload(fixture,new Map([[controlsForDevice(fixture,fixture.nodes[0]).find(f=>f.fieldName==='st_time').id,333]])));
 second.dev.current=decode(fixture,facade);await assert.rejects(second.session.audition(target.frame),/P0 a changé/);
 assert.equal(second.dev.sent.filter(m=>m.bytes[6]===32).length,0);second.session.dispose();
 report.staleReference={structuralWrites:0,auditionWrites:0,closedWithoutRetry:true,adopted:false};
}

// 4. Simulated clock: nothing at all is transmitted during the structural settle.
{
 mock.timers.enable({apis:['setTimeout']});clock=0;
 const drain=()=>new Promise(r=>setImmediate(r));
 const tick=async ms=>{for(let i=0;i<ms;i+=5){clock+=5;mock.timers.tick(5);await drain();}};
 const dev=device(fixture),transport=createGuardedTransport(dev.raw,{editor:true,now:clockNow});
 const session=createLiveSession(transport,{transferPlan:editorTransfers,debounce:200,minWriteInterval:editorLivePolicy.minWriteInterval,verifyDelay:editorLivePolicy.settle,structuralDelay:editorLivePolicy.structuralSettle,timeout:editorLivePolicy.timeout});
 let loaded=session.load();await tick(20);await loaded;loaded=session.load();await tick(20);await loaded;
 const time=controlsForDevice(fixture,fixture.nodes.find(n=>n.algorithm==='delay-stereo')).find(f=>f.fieldName==='st_time');
 session.replace(g.addDeviceBlock(session.image,'panner-simple',{col:3,row:0}),{structural:true});
 for(let i=0;i<400&&!dev.sent.some(m=>m.bytes[6]===32);i++)await tick(5);
 const index=dev.sent.findIndex(m=>m.bytes[6]===32),t0=dev.sent[index].at,silentUntil=t0+editorLivePolicy.structuralSettle+Math.ceil(2745/3125*1000);
 assert.equal(dev.sent[index-1].bytes[6],69,'Compare GET precedes the Data20');
 let attempts=0,refusedDirect=0,library=null;
 for(let step;(step=Math.min(50,Math.floor((silentUntil-1-clock)/5)*5))>0;){
  await tick(step);attempts++;
  session.replace(editedPayload(session.image,new Map([[time.id,200+attempts%50]])));session.sendControl(Uint8Array.of(176,7,attempts%128));assert.equal(session.sendClock(clock),false);
  if(attempts===3)library=session.readPreset(1);
  for(const bytes of [requestExpanded(0),Uint8Array.of(176,1,2),Uint8Array.of(248)])try{transport.send(bytes,bytes[0]===248?clock:undefined);}catch{refusedDirect++;}
  assert.equal(dev.sent.length,index+1,`Message transmitted during structural settle at +${clock-t0} ms`);
 }
 await tick(30);const after=dev.sent[index+1];
 assert.equal(after.bytes[6],69);assert.equal(after.bytes[8],0);assert(after.at-t0>=editorLivePolicy.structuralSettle+879,'Readback before the settle elapsed');
 await tick(20000);await library;
 assert.equal(session.diagnostics.phase,'verified');assert.equal(readField(session.reference,time),200+attempts%50);assert(dev.sent.some(m=>m.bytes[0]===176));
 report.simulatedSettle={settleMs:editorLivePolicy.structuralSettle,wireMs:879,firstMessageAfterMs:after.at-t0,gestureAttempts:attempts,directTransportAttemptsRefused:refusedDirect,transmittedDuringSettle:0,heldGesturesDeliveredAfter:true};
 session.dispose();mock.timers.reset();clock=0;
}

// 5. Guarded transport alone enforces the Data20 admission (not only the session).
{
 let receive,closed=false;const tx=[];clock=0;
 const raw={subscribe(fn){receive=fn;return()=>{};},send(b){tx.push(b.slice());},close(){closed=true;}};
 for(const settle of [7999,structuralSettleBounds.max+1,NaN])assert.throws(()=>createGuardedTransport(raw,{editor:true,structuralSettle:settle}),/Pause structurelle invalide/);
 assert.equal(editorLivePolicy.structuralSettle,8000);assert.equal(guardedLivePolicy.settle,4500);
 const guard=createGuardedTransport(raw,{editor:true,now:clockNow}),read=frame=>{guard.send(requestExpanded(0));receive(frame);};
 read(fixture.frame);read(fixture.frame);assert.equal(guard.diagnostics.compared,true);
 const moved=decode(fixture,g.moveDeviceBlock(fixture,fixture.nodes[0].id,{col:5,row:1})),[plan]=editorTransfers(fixture,moved);
 guard.send(Uint8Array.of(176,1,2));assert.equal(guard.diagnostics.compared,false);
 const cases={};let sentBefore=tx.length;
 assert.throws(()=>guard.send(plan.frame),/GET de contrôle/);cases.withoutCompare='refusé';assert.equal(tx.length,sentBefore);
 read(fixture.frame);sentBefore=tx.length;
 const tampered=frameWithPayload(fixture.frame,(()=>{const p=moved.payload.slice();p[delay2.start]^=1;return p;})());
 assert.throws(()=>guard.send(tampered),/enregistrement inactif/);cases.inactiveRecordInImage='refusé';
 const foreignHeader=plan.frame.slice();foreignHeader[8]=1;assert.throws(()=>guard.send(foreignHeader));cases.archivePreset='refusé';
 const span=changedSpan(fixture.payload,moved.payload);assert.throws(()=>guard.send(writeBufferPart(0,span.address,span.data)),/hors du buffer|profil/);cases.legacySpanDataPart='refusé';
 const muted=decode(fixture,g.muteDeviceBlock(fixture,fixture.nodes[0].id)),mutePart=changedSpan(fixture.payload,muted.payload);
 assert.throws(()=>guard.send(writeBufferPart(0,mutePart.address,mutePart.data)),/image complète Data20/);cases.structuralShortDataPart='refusé';
 assert.equal(tx.length,sentBefore);
 guard.send(plan.frame);assert.equal(tx.length,sentBefore+1);cases.plannedAfterCompare='admis';
 clock=8878;for(const b of [requestExpanded(0),Uint8Array.of(176,1,3),plan.frame])assert.throws(()=>guard.send(b),/Pause structurelle/);
 assert.throws(()=>guard.send(Uint8Array.of(248),clock),/Pause structurelle/);assert.equal(tx.length,sentBefore+1);
 clock=8879;guard.send(requestExpanded(0));receive(moved.frame);assert.equal(guard.diagnostics.unverified,false);
 const [back]=editorTransfers(moved,fixture);assert.throws(()=>guard.send(back.frame),/GET de contrôle/);cases.secondImageWithoutNewCompare='refusé';
 read(moved.frame);guard.send(back.frame);clock=20000;
 const facade=fixture.payload.slice();facade[24]^=1;guard.send(requestExpanded(0));receive(fixture.frame);
 guard.send(requestExpanded(0));receive(frameWithPayload(fixture.frame,facade));assert.equal(guard.diagnostics.compared,false);
 assert.throws(()=>guard.send(editorTransfers(fixture,moved)[0].frame),/Deux lectures|GET de contrôle/);cases.staleCompare='refusé';
 const time=controlsForDevice(fixture,fixture.nodes[0]).find(f=>f.fieldName==='st_time');read(frameWithPayload(fixture.frame,facade));
 const facadeImage=decode(fixture,facade),scalar=editorTransfers(facadeImage,decode(facadeImage,editedPayload(facadeImage,new Map([[time.id,301]]))))[0];
 assert.equal(scalar.frame.length,19);guard.send(scalar.frame);cases.scalarDataPart='admis (19 o, pause 4500 ms)';
 assert.equal(guard.diagnostics.quietUntil<clock,true);assert.equal(closed,false);
 report.guardedAdmission=cases;
}

// 6. One structural operation per verified cycle, each with its own compare GET.
{
 const {dev,session}=await connected(fixture);const start=dev.sent.length;
 session.replace(g.addDeviceBlock(session.image,'gate',{col:3,row:0}),{structural:true});
 await until(()=>dev.sent.some(m=>m.bytes[6]===32));
 session.replace(g.moveDeviceBlock(session.image,'hw-7-0',{col:4,row:1}),{structural:true});session.replace(g.muteDeviceBlock(session.image,'hw-7-0'),{structural:true});
 await until(()=>session.diagnostics.phase==='verified'&&dev.sent.filter(m=>m.bytes[6]===32).length===2&&samePayload(session.reference.payload,session.image.payload));
 const sequence=dev.sent.slice(start).map(m=>m.bytes[6]===69?'GET':m.bytes[6]===32?'Data20':'DataPart21');
 assert.deepEqual(sequence,['GET','Data20','GET','GET','Data20','GET']);
 report.oneStructuralPerCycle={sequence,gesturesDuringSettleMerged:2};session.dispose();
}

// 7. Undo of a creation behaves like a removal: the dormant record is not rewritten.
{
 const {dev,session}=await connected(fixture);const original=fixture.payload.slice();
 session.replace(g.addDeviceBlock(session.image,'gate',{col:3,row:0}),{structural:true});await until(()=>session.diagnostics.phase==='verified'&&session.reference.nodes.length===4);
 const gate=engineRecords.find(r=>r.blockTypeId===7&&r.instanceIndex===0),seed=session.reference.payload.slice(gate.start,gate.end);
 session.undo();await until(()=>session.diagnostics.phase==='verified'&&session.reference.nodes.length===3);
 assert(samePayload(dev.current.payload.slice(44,172),original.slice(44,172)),'Matrix restored');assert(samePayload(dev.current.payload.slice(gate.start,gate.end),seed),'Dormant record kept, not rewritten');
 session.redo();await until(()=>session.diagnostics.phase==='verified'&&session.reference.nodes.length===4);
 assert.equal(dev.sent.filter(m=>m.bytes[6]===33).length,0);report.undoRedo={undoOfCreation:'retrait sans réécriture de l’enregistrement dormant',redo:'graine identique',dataPart21:0};session.dispose();
}
const mod=decode(fixture,createModulation(fixture,modulationSources[0],modulationDestinations(fixture)[0]));assert.deepEqual(structuralReasons(fixture,mod),['modulation-link']);
console.log(JSON.stringify(report,null,1));
