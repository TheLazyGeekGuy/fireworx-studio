import assert from 'node:assert/strict';
import fs from 'node:fs';
import {presetBanks,presetAddress,presetLocation,inspectPreset,localEditFrame} from '../src/editors/fireworx/engine/preset-library-model.js';
import {requestExpanded} from '../src/editors/fireworx/engine/protocol.js';
import {createRecallBrowser,recallInventory} from '../src/editors/fireworx/engine/recall-browser.js';
import {loadPresetCopy} from '../src/editors/fireworx/engine/preset-load.js';
const base=new Uint8Array(fs.readFileSync(new URL('generated/synthetic-p0.syx',import.meta.url)));
const record=(bank,slot,name)=>{const frame=base.slice(),p=presetAddress(bank,slot);frame[7]=p>>7;frame[8]=p&127;return {...inspectPreset(frame),name,at:'2026-10-17T19:00:00Z'};};
let addresses=0;
for(const b of presetBanks)for(let slot=1;slot<=b.count;slot++){const p=presetAddress(b.id,slot),wire=requestExpanded(0,p);assert.equal(wire[7]*128+wire[8],p);assert.equal(presetLocation(p).slot,slot);assert.equal(presetLocation(p).bank,b.id);addresses++;}
assert.equal(addresses,1400);for(const [bank,slot,hi,lo] of [['factory',127,0,127],['factory',128,1,0],['factory',256,2,0],['factory',384,3,0],['factory',400,3,16],['user',1,16,1],['user',128,17,0],['user',200,17,72],['card',1,32,1],['card',800,38,32]])assert.deepEqual([...requestExpanded(0,presetAddress(bank,slot)).slice(7,9)],[hi,lo]);
assert.throws(()=>presetAddress('user',201));assert.throws(()=>presetAddress('factory',0));
const empty={...record('factory',2,'Vide'),status:'empty',count:4,at:'2026-10-17T18:00:00Z'},newer=record('factory',4,'New Four');
let inventory=recallInventory([newer,empty]);assert.equal(inventory.get(4).name,'New Four');assert.equal(inventory.size,4);inventory=recallInventory([...inventory.values()]);assert.equal(inventory.size,4);assert.equal(inventory.get(4).name,'New Four');
const wait=()=>new Promise(r=>setTimeout(r,5));const until=async fn=>{for(let i=0;i<200;i++){if(fn())return;await wait();}throw Error('deadline');};
let loads=[],reads=[],notices=[],observed=[],current={name:'Current P0',source:{bank:'factory',slot:127}},model;
const cached=[record('factory',127,'Factory 127'),record('factory',128,'Factory 128'),record('user',128,'User 128')];
model=createRecallBrowser({getCurrent:()=>current,getInventory:async()=>cached,readPreset:async(b,s)=>{reads.push(presetAddress(b,s));return null;},loadPreset:async r=>loads.push(r),families:[],familyFor:()=>({id:'delay'}),onChange:()=>observed.push(model.snapshot),onNotice:m=>notices.push(m),readDelay:1});
model.start();await model.refreshInventory();model.turn('VALUE',1);assert.equal(model.snapshot.name,'Factory 128');assert.equal(model.snapshot.slot,128);assert.equal(loads.length,0);assert.equal(reads.length,0);assert.ok(model.snapshot.pending);
model.turn('PARAMETER',1);model.turn('VALUE',1);assert.equal(model.snapshot.bank,'user');assert.equal(model.snapshot.name,'User 128');await model.enter();assert.equal(loads.length,1);assert.equal(loads[0].preset,2176);assert.equal(model.snapshot.active,false);
model.start();model.turn('VALUE',10);model.cancel();await wait();assert.equal(model.snapshot.name,'Current P0');assert.equal(loads.length,1);model.dispose();
// Late archive replies are cached, never adopted as the selection or P0.
let resolveRead,readAddresses=[];const late=createRecallBrowser({getCurrent:()=>({name:'Running'}),getInventory:async()=>[],readPreset:(b,s)=>{readAddresses.push(s);return new Promise(r=>resolveRead=r);},loadPreset:async()=>{throw Error('unexpected load');},families:[],familyFor:()=>({id:'delay'}),onChange:()=>{},onNotice:()=>{},readDelay:1});
late.start();await until(()=>readAddresses.length===1);late.turn('VALUE',1);late.turn('VALUE',1);resolveRead(record('factory',1,'Late One'));await until(()=>readAddresses.length===2);assert.deepEqual(readAddresses,[1,3]);assert.notEqual(late.snapshot.name,'Late One');resolveRead(record('factory',3,'Three'));await until(()=>late.snapshot.name==='Three');late.cancel();late.dispose();
// Selecting an unread library row is entirely silent, even after the debounce.
let selectionReads=0;const select=createRecallBrowser({getCurrent:()=>({}),getInventory:async()=>[],readPreset:async()=>{selectionReads++;},loadPreset:async()=>{},families:[],familyFor:()=>({id:'delay'}),onChange:()=>{},onNotice:()=>{},readDelay:1});select.preview({...record('factory',2,''),status:'unread'});await wait();await wait();assert.equal(selectionReads,0);select.cancel();select.dispose();
const target=record('factory',128,'Target'),original=localEditFrame(base);let writes=0,backups=0,opened=0;
// Slow local enumeration must not cause a speculative archive GET. ENTER waits
// for it, and repeated ENTER while loading cannot start a second transfer.
let resolveInventory,resolveLoad,slowReads=0,slowLoads=0;
const slow=createRecallBrowser({getCurrent:()=>({source:{bank:'factory',slot:128}}),getInventory:()=>new Promise(r=>resolveInventory=r),readPreset:async()=>{slowReads++;},loadPreset:()=>{slowLoads++;return new Promise(r=>resolveLoad=r);},families:[],familyFor:()=>({id:'delay'}),onChange:()=>{},onNotice:()=>{},readDelay:1});
slow.start();await until(()=>resolveInventory);await wait();assert.equal(slowReads,0);const enter1=slow.enter(),enter2=slow.enter();resolveInventory([target]);await until(()=>slowLoads===1);assert.equal(slowReads,0);resolveLoad();await Promise.all([enter1,enter2]);assert.equal(slowLoads,1);slow.dispose();
// A family filter cannot load a nonmatching copy; explicit library selection
// clears that filter instead of leaving an invisible selection restriction.
const filtered=createRecallBrowser({getCurrent:()=>({source:{bank:'factory',slot:128}}),getInventory:async()=>[target],readPreset:async()=>null,loadPreset:async()=>{throw Error('Filtered load');},families:[{id:'delay',name:'Delay'},{id:'pitch',name:'Pitch'}],familyFor:()=>({id:'delay'}),onChange:()=>{},onNotice:()=>{},readDelay:1});
filtered.start('filter');await filtered.refreshInventory();filtered.turn('VALUE',2);assert.equal(filtered.snapshot.canLoad,false);await filtered.enter();filtered.preview(target);assert.equal(filtered.snapshot.filter,'');assert.equal(filtered.snapshot.canLoad,true);filtered.dispose();
// One ENTER fetches and loads; repeated ENTER is single-flight. A P0 adoption
// during reconnect must preserve the pending selection, while EXIT cancels it.
let fetchResolve,fetches=0,fetchLoads=0;const fetching=createRecallBrowser({getCurrent:()=>({}),getInventory:async()=>[],readPreset:(b,s,options)=>{assert.equal(options.connect,true);fetches++;return new Promise(r=>fetchResolve=r);},loadPreset:async()=>{fetchLoads++;},families:[],familyFor:()=>({id:'delay'}),onChange:()=>{},onNotice:()=>{},readDelay:500});
fetching.preview({...target,status:'unread'});const fetchTask=fetching.enter();await until(()=>fetchResolve);await fetching.enter();fetching.loaded();fetchResolve(target);await fetchTask;assert.equal(fetches,1);assert.equal(fetchLoads,1);
fetchResolve=null;fetching.preview({...target,slot:129,preset:129,status:'unread'});const cancelledTask=fetching.enter();await until(()=>fetchResolve);fetching.cancel();fetchResolve(record('factory',129,'Cancelled'));await cancelledTask;assert.equal(fetchLoads,1);fetching.dispose();
const session={deviceId:0,canAudition:true,reference:{frame:original},async audition(f,options){writes++;assert.equal(f[7]*128+f[8],0);assert.deepEqual(options.presetSource,{bank:'factory',slot:128});assert.deepEqual(f,original);}},options={session,getSession:()=>session,getCurrentFrame:()=>original,openLocal:()=>opened++,saveBackup:async f=>{backups++;assert.deepEqual(f,original);}};
await loadPresetCopy(target.frame,options);assert.equal(writes,1);assert.equal(backups,1);assert.equal(opened,0);
await assert.rejects(loadPresetCopy(target.frame,{...options,saveBackup:async()=>{throw Error('disk failure');}}),/disk failure/);assert.equal(writes,1);
let live=session;await assert.rejects(loadPresetCopy(target.frame,{...options,getSession:()=>live,saveBackup:async()=>{live=null;}}),/Connexion remplacée/);assert.equal(writes,1);
await loadPresetCopy(target.frame,{...options,session:null,getSession:()=>null});assert.equal(opened,1);assert.equal(writes,1);
console.log(JSON.stringify({status:'passed',physicalMidiUsed:false,addresses,base128Boundaries:true,bankOffsets:true,emptyRangePrecedence:true,previewWithoutLoad:true,lateReplyIsolation:true,singleFlight:true,selectionSilent:true,backupBeforeLoad:true,backupFailureBlocksLoad:true,staleConnectionBlocksLoad:true,offlineSilent:true}));
