import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deviceMap,decodeDeviceBuffer,editedPayload,readField,controlsForDevice} from '../src/editors/fireworx/engine/device-codec.js';
import {frameWithPayload,writeBufferPart,parseBufferPart,requestBufferPart} from '../src/editors/fireworx/engine/live-protocol.js';
import {addDeviceBlock,moveDeviceBlock,removeDeviceBlock,changeDeviceAlgorithm,muteDeviceBlock,layoutDeviceGrid,addDeviceRouting,moveDeviceCell,removeDeviceCell,resizeDeviceGrid} from '../src/editors/fireworx/engine/device-graph.js';
import {createLiveSession} from '../src/editors/fireworx/engine/live-session.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const p=new Uint8Array(1366);p[1]=206;p[172]=4;
const ref=new Uint8Array(2745);ref.set([240,0,32,31,0,64,32,0,0,10,86]);ref[2744]=247;
const frame=frameWithPayload(ref,p),blank=decodeDeviceBuffer(frame);
const decode=p=>decodeDeviceBuffer(frameWithPayload(frame,p));
let count=0;
for(const [algorithm,a] of Object.entries(deviceMap.algorithms)){
 const b=decode(addDeviceBlock(blank,algorithm,{col:0,row:0}));assert.equal(b.nodes[0].algorithm,algorithm);
 const moved=decode(moveDeviceBlock(b,b.nodes[0].id,{col:7,row:1}));assert.equal(moved.nodes[0].col,7);assert.equal(moved.nodes[0].row,1);
 assert.throws(()=>resizeDeviceGrid(moved,1),/Réduction refusée/);const shrunk=decode(resizeDeviceGrid(b,1));assert.equal(shrunk.rows,1);assert.deepEqual(resizeDeviceGrid(shrunk,4),b.payload);assert.throws(()=>addDeviceBlock(shrunk,algorithm,{col:0,row:1}),/Augmentez/);
 assert.equal(decode(muteDeviceBlock(moved,moved.nodes[0].id)).nodes[0].muted,true);
 assert.equal(decode(removeDeviceBlock(moved,moved.nodes[0].id)).nodes.length,0);
 for(const [other,c] of Object.entries(deviceMap.algorithms).filter(([,c])=>c.blockTypeId===a.blockTypeId))assert.equal(decode(changeDeviceAlgorithm(b,b.nodes[0].id,other)).nodes[0].algorithm,other);
 count++;
}
let b=decode(addDeviceBlock(blank,'delay-stereo',{col:0,row:0}));
b=decode(addDeviceBlock(b,'delay-dual',{col:0,row:0}));assert.equal(b.nodes.length,2);assert.equal(b.nodes.find(n=>n.instanceIndex===0).col,1);
assert.throws(()=>addDeviceBlock(b,'delay-stereo',{col:2,row:0}),/Limite/);
b=decode(moveDeviceBlock(b,'hw-11-0',{col:0,row:0},{swap:true}));assert.equal(b.nodes.find(n=>n.instanceIndex===1).col,1);
assert.throws(()=>moveDeviceBlock(b,'hw-11-0',{col:8,row:0}),/matrice/);
const shifted=decode(layoutDeviceGrid(b,'col',0,'insert'));assert.equal(shifted.nodes.find(n=>n.id==='hw-11-0').col,1);
assert.deepEqual(layoutDeviceGrid(shifted,'col',0,'delete'),b.payload);assert.throws(()=>layoutDeviceGrid(b,'col',0,'before'),/Bord/);
for(const type of [1,3,4,5,6]){const r=decode(addDeviceRouting(blank,type,{col:0,row:0}));assert.equal(r.cells[0].type,type);assert.equal(r.cells[0].instance,type===1?255:0);if(type!==1)assert.throws(()=>addDeviceRouting(r,type,{col:1,row:0}),/seul/);const moved=decode(moveDeviceCell(r,{col:0,row:0},{col:2,row:1}));assert.equal(moved.cells.find(c=>c.col===2&&c.row===1).type,type);assert.equal(decode(removeDeviceCell(moved,{col:2,row:1})).cells.filter(c=>c.type).length,0);}assert.throws(()=>addDeviceRouting(blank,2,{col:0,row:0}));
const time=controlsForDevice(b,b.nodes.find(n=>n.id==='hw-11-0')).find(f=>f.fieldName==='st_time');
const raw=writeBufferPart(0,468,Uint8Array.of(1,8));assert.equal(raw.length,19);assert.deepEqual(parseBufferPart(raw,0).data,Uint8Array.of(1,8));assert.equal(requestBufferPart(0,468,2).length,14);
const corrupt=raw.slice();corrupt[corrupt.length-2]^=1;assert.throws(()=>parseBufferPart(corrupt));
assert.throws(()=>requestBufferPart(0,1365,2));
function fake({drop=false,drift=false,delay=0}={}){
 let current=b.frame.slice(),closed=false;const listeners=new Set(),sent=[];
 return{sent,get current(){return decodeDeviceBuffer(current);},get listeners(){return listeners.size;},get closed(){return closed;},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},send(msg){assert(!closed);sent.push(msg.slice());
 if(msg[6]===33){const part=parseBufferPart(msg,0),p=decodeDeviceBuffer(current).payload;p.set(part.data,part.address);current=frameWithPayload(current,p);return;}
 if(msg[6]===32){current=msg.slice();return;}
 assert.equal(msg[6],69);if(drop)return;
 let reply=current.slice();if(drift&&sent.length>1){const p=decodeDeviceBuffer(reply).payload;p[24]=65;reply=frameWithPayload(reply,p);}
 setTimeout(()=>{for(const fn of listeners)fn(reply);},delay);
 },close(){closed=true;}};
}
const t=fake(),s=createLiveSession(t,{debounce:5,minWriteInterval:10,verifyDelay:15,timeout:100});await s.load();
for(let i=0;i<200;i++)s.replace(editedPayload(s.image,new Map([[time.id,100+i]])));
await wait(12);assert.equal(t.sent.filter(x=>x[6]===33).length,1);assert.equal(readField(t.current,time),299);assert(t.sent.find(x=>x[6]===33).length<=19);
await wait(45);assert.equal(s.diagnostics.phase,'verified');assert.equal(t.sent.filter(x=>x[6]===69).length,2);
assert.throws(()=>s.replace(moveDeviceBlock(s.image,'hw-11-0',{col:3,row:0}),{structural:true}),/Écriture refusée/);await wait(18);assert.equal(t.sent.filter(x=>x[6]===33).length,1);assert.equal(t.sent.filter(x=>x[6]===32).length,0);
s.dispose();assert.equal(t.listeners,0);assert(t.closed);const stopped=t.sent.length;await wait(30);assert.equal(t.sent.length,stopped);
const continuous=fake(),settled=createLiveSession(continuous,{debounce:15,minWriteInterval:1,verifyDelay:5,timeout:100});await settled.load();for(let i=0;i<15;i++){settled.replace(editedPayload(settled.image,new Map([[time.id,140+i]])));await wait(3);}assert.equal(continuous.sent.filter(x=>x[6]===33).length,0);await wait(35);assert.equal(continuous.sent.filter(x=>x[6]===33).length,1);assert.equal(readField(continuous.current,time),154);settled.dispose();
const delayed=fake({delay:20}),q=createLiveSession(delayed,{debounce:1,minWriteInterval:1,verifyDelay:10,timeout:100});await q.load();q.replace(editedPayload(q.image,new Map([[time.id,123]])));await wait(24);assert(q.reading);q.replace(editedPayload(q.image,new Map([[time.id,124]])));await wait(90);assert.equal(readField(delayed.current,time),124);assert.equal(q.diagnostics.phase,'verified');q.dispose();
const d=fake({drift:true}),conflict=createLiveSession(d,{debounce:1,minWriteInterval:1,verifyDelay:5,timeout:50});await conflict.load();conflict.replace(editedPayload(conflict.image,new Map([[time.id,132]])));await wait(30);assert(conflict.paused);assert.match(conflict.diagnostics.error,/Écart/);assert.equal(d.sent.filter(x=>x[6]===33).length,1);conflict.dispose();
const dead=fake({drop:true}),gone=createLiveSession(dead,{timeout:100});const loading=gone.load();gone.dispose();await assert.rejects(loading,/fermée/);assert.equal(dead.listeners,0);
for(const config of [{debounce:NaN},{minWriteInterval:-1},{timeout:0},{verifyDelay:Infinity}])assert.throws(()=>createLiveSession(fake(),config));
console.log(`PASS: ${count} graph algorithms/defaults, insert/move/swap/mute/delete, subtype and instance quota; partial envelope and checksum.`);
console.log('PASS: injected session, 200 gestures -> one short write and one confirmation GET; hardware architecture writes refused; edits during GET preserved; conflict pause; disposal; timing validation. Synthetic ports only.');
