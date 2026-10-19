import {performTempoTaps,planTempoTaps} from './tempo-taps.js';
// Continuous editor session: one bounded desired image, latest values coalesced,
// one admitted operation at a time, with mandatory readback. Persistent writes
// require the separate per-slot prepareStore / commitStore confirmation path.
// #67: an operation planned as a full image (kind 'full': structure, routing, audition)
// is preceded by a compare GET that must equal the last verified reference, otherwise
// nothing is sent; it is followed by its own structural settle before the readback.
import {requestExpanded,parseExpanded,recallPreset} from './protocol.js';
import {verifyRecalledPreset} from './preset-recall.js';
import {decodeDeviceBuffer,samePayload} from './device-codec.js';
import {frameWithPayload} from './live-protocol.js';
import {parameterTransfers} from './parameter-transfer.js';
import {preserveInactiveRecords} from './editor-transfer.js';
import {preparePresetAudition} from './preset-audition.js';
import {createUserBankAssembler} from './bank-dump.js';
import {archiveStoreFrame,verifyStoredPreset} from './preset-store.js';
import {presetAddress} from './preset-library-model.js';
const derived=i=>i>=1131&&i<=1359&&(i-1131)%12===0;
export function createLiveSession(transport,{deviceId=0,debounce=200,minWriteInterval=200,verifyDelay=2200,structuralDelay=Math.max(8000,verifyDelay),timeout=6000,transferPlan=parameterTransfers,onImage=()=>{},onState=()=>{},onPerformance=()=>{},compareBeforeWrite=false,adoptFacadeChanges=false,syncCC=false,idlePoll=0,facadeDebounce=300,archiveRetries=2}={}){
 requestExpanded(deviceId);
 for(const [key,v,lo,hi] of [['debounce',debounce,0,2000],['minWriteInterval',minWriteInterval,0,10000],['verifyDelay',verifyDelay,0,30000],['structuralDelay',structuralDelay,0,30000],['timeout',timeout,1,60000]])if(!Number.isFinite(v)||v<lo||v>hi)throw new Error(`Temporisation ${key} invalide`);
 let disposed=false,disposal,desired=null,sent=null,confirmed=null,reading=false,paused=false,pending=null,lastWrite=-Infinity,lastHistoryAt=-Infinity,lastHistoryGroup=null;
 if(typeof transferPlan!=='function')throw Error('Plan de transmission requis');
 let writeTimer=null,verifyTimer=null,controlTimer=null,unverified=false,facadeTimer=null,conflictFrame=null,bankCapture=null,storeReview=null,persistentBusy=false,tempoBusy=false,tempoAbort=null,recallBusy=false;
 if(!Number.isInteger(archiveRetries)||archiveRetries<0||archiveRetries>2||idlePoll!==0&&(!Number.isFinite(idlePoll)||idlePoll<5000||idlePoll>60000))throw Error('Politique de lecture invalide');
 const controls=new Map();
 const past=[],future=[],stats={txMessages:0,txBytes:0,rxMessages:0,rxBytes:0,unsolicitedReplies:0,partialWrites:0,fullWrites:0,structuralWrites:0,compareReads:0,staleReferences:0,archiveRetries:0,archiveFailures:0,facadeReads:0,facadeChanges:0,program:null,conflict:false,coalesced:0,phase:'idle',lastRttMs:null};
 const exclusiveBusy=()=>persistentBusy||tempoBusy||recallBusy||reading&&stats.phase==='library-bank';
 const emit=()=>onState({...stats,reading,paused,unverified,persistentBusy,exclusiveBusy:exclusiveBusy(),dirty:!!desired&&!!confirmed&&!samePayload(desired.payload,confirmed.payload),canUndo:past.length>0,canRedo:future.length>0});
 const stopTimers=()=>{clearTimeout(writeTimer);clearTimeout(verifyTimer);clearTimeout(controlTimer);writeTimer=verifyTimer=controlTimer=null;clearTimeout(facadeTimer);facadeTimer=null;controls.clear();};
 const assertOpen=()=>{if(disposed)throw new Error('Session temps réel fermée');};
 function send(bytes,timestamp){assertOpen();transport.send(bytes,timestamp);stats.txMessages++;stats.txBytes+=bytes.length;if(bytes[0]!==248)emit();}
 const unsubscribe=transport.subscribe(bytes=>{
  if(disposed||paused)return;
  if(bankCapture){bankCapture.receive(bytes);return;}
  if(bytes.length===2&&(bytes[0]&240)===192&&bytes[1]<=127){stats.program={channel:(bytes[0]&15)+1,number:bytes[1]+1};scheduleFacade();emit();return;}
  if(!disposed&&bytes.length===3&&(bytes[0]&240)===176&&bytes[1]<=119&&bytes[2]<=127){const control=onPerformance(Uint8Array.from(bytes));if(syncCC&&!control?.continuous)scheduleFacade();return;}
  if(!pending&&sent&&bytes[0]===240&&bytes[1]===0&&bytes[2]===32&&bytes[3]===31&&bytes[4]===deviceId&&bytes[5]===64&&bytes[6]===32&&bytes[7]===0&&bytes[8]===0){
   stats.unsolicitedReplies++;
   try{const incoming=decodeDeviceBuffer(Uint8Array.from(bytes),deviceId);if(incoming.payload.some((v,i)=>v!==sent.payload[i]&&!derived(i))){if(adoptFacadeChanges&&!unverified)scheduleFacade();else throw Error('P0 modifié hors de cette session ; synchronisation suspendue');}emit();}catch(e){fail(e);}return;
  }
  if(disposed||!pending||bytes[0]!==240||bytes[1]!==0||bytes[2]!==32||bytes[3]!==31||bytes[4]!==deviceId||bytes[5]!==64||![32,40].includes(bytes[6])||bytes[7]*128+bytes[8]!==pending.preset)return;
  stats.rxMessages++;stats.rxBytes+=bytes.length;stats.lastRttMs=Math.round(performance.now()-pending.at);
  try{const frame=Uint8Array.from(bytes),parsed=parseExpanded(frame,deviceId);pending.resolve(pending.preset===0?decodeDeviceBuffer(frame,deviceId):{...parsed,frame});}catch(e){pending.reject(e);}
 });
 async function get(preset=0,signal){assertOpen();signal?.throwIfAborted();if(reading)throw new Error('Lecture déjà en cours');reading=true;emit();try{return await new Promise((resolve,reject)=>{
   let cancelled=false;
   // A device reply has no transaction nonce. Drain a cancelled GET before a new
   // operation, so its late response cannot be mistaken for a later request.
   const finish=(fn,v)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);pending=null;fn(v);},abort=()=>{cancelled=true;},timer=setTimeout(()=>finish(reject,new Error('Le FireworX ne répond pas')),timeout);
   pending={preset,at:performance.now(),resolve:v=>cancelled?finish(reject,new DOMException('Lecture annulée','AbortError')):finish(resolve,v),reject:e=>finish(reject,e)};signal?.addEventListener('abort',abort,{once:true});try{signal?.throwIfAborted();send(requestExpanded(deviceId,preset));}catch(e){pending?.reject(e);}
 });}finally{reading=false;emit();}}
 function adoptFacade(fresh){
  if(desired&&!samePayload(desired.payload,confirmed.payload))conflictFrame=desired.frame.slice();
  past.push(confirmed.frame.slice());if(past.length>50)past.shift();future.length=0;
  desired=sent=confirmed=fresh;unverified=false;stats.conflict=!!conflictFrame;stats.facadeChanges++;stats.phase='verified';stats.error=null;
  onImage(fresh,{reason:'facade',conflict:conflictFrame,program:stats.program});emit();
 }
 function scheduleFacade(){if(!adoptFacadeChanges||disposed||paused)return;clearTimeout(facadeTimer);facadeTimer=setTimeout(refreshFacade,facadeDebounce);}
 async function refreshFacade(){
  facadeTimer=null;if(disposed||paused||!confirmed)return;
  if(reading||unverified||!['verified','idle'].includes(stats.phase)){facadeTimer=setTimeout(refreshFacade,300);return;}
  stats.phase='facade-read';emit();try{const fresh=await get();assertOpen();stats.facadeReads++;if(!samePayload(fresh.payload,confirmed.payload))adoptFacade(fresh);else{stats.phase='verified';emit();}}catch(e){if(!disposed)fail(e);}
 }
 const poll=idlePoll?setInterval(scheduleFacade,idlePoll):null;
 function fail(e){paused=true;clearInterval(poll);stopTimers();transport.close?.();stats.phase='error';stats.error=e.message;emit();}
 function flushControl(){
  controlTimer=null;if(disposed||paused||!controls.size)return;
  if(reading||unverified){controlTimer=setTimeout(flushControl,25);return;}
  const [key,bytes]=controls.entries().next().value;controls.delete(key);
  try{send(bytes);}catch(e){fail(e);return;}
  if(controls.size)controlTimer=setTimeout(flushControl,20);
 }
 function queue(){
  if(disposed||paused)return;
  // Never cancel the readback deadline to accommodate another UI gesture.
  if(unverified){stats.phase='awaiting-confirmation';emit();return;}
  stats.phase='queued';
  // Each SysEx write reloads the DSP: send the final value after the gesture
  // settles, not a stream of intermediate values that would repeatedly mute it.
  clearTimeout(writeTimer);writeTimer=setTimeout(flush,Math.max(debounce,minWriteInterval-(performance.now()-lastWrite)));emit();
 }
 async function verify(){
  verifyTimer=null;if(disposed||paused||reading||tempoBusy||!sent)return;
  // Timers may fire marginally early against the transport clock: wait out the guarded
  // settle instead of turning a refused early GET into a session fault.
  const remaining=transport.diagnostics?.settleRemainingMs;if(remaining>0){verifyTimer=setTimeout(verify,Math.ceil(remaining)+5);return;}
  const expected=sent;stats.phase='verify';emit();
  try{
   const received=await get();assertOpen();
   const unexpected=[];received.payload.forEach((v,i)=>{if(v!==expected.payload[i]&&!derived(i))unexpected.push(i);});
   if(unexpected.length)throw new Error('Écart avec le matériel @'+unexpected.slice(0,8).join(',')+' ; synchronisation nécessaire');
   confirmed=received;sent=received;unverified=false;
   const overlay=desired.payload.slice();received.payload.forEach((v,i)=>{if(overlay[i]===expected.payload[i])overlay[i]=v;});desired=decodeDeviceBuffer(frameWithPayload(received.frame,overlay),deviceId);onImage(desired,{reason:samePayload(desired.payload,received.payload)?'verified':'queued'});
   stats.phase='verified';emit();if(!samePayload(desired.payload,sent.payload))queue();
  }catch(e){if(!disposed)fail(e);}
 }
 function flush(){
  writeTimer=null;if(disposed||paused||tempoBusy||!desired||!sent)return;
  if(unverified)return;
  if(reading){writeTimer=setTimeout(flush,50);return;}
  if(samePayload(sent.payload,desired.payload)){stats.phase='verified';emit();return;}
  try{
   // Never send the intervening bytes between separate changed parameters.
   const operation=transferPlan(sent,desired)[0];if(!operation)throw Error('Aucune édition admissible');
   if(operation.kind==='full'){void writeImage();return;}
   if(compareBeforeWrite){void writeScalar();return;}
   const image=operation.image,bytes=operation.frame,wireMs=Math.ceil(bytes.length/3125*1000);
   unverified=true;stats.phase='sending';send(bytes);lastWrite=performance.now()+wireMs;stats.partialWrites++;
   sent=image;stats.phase='sent';emit();
   // This deadline is fixed for the submitted write; later gestures cannot cancel it.
   clearTimeout(verifyTimer);verifyTimer=setTimeout(verify,verifyDelay+wireMs);
  }catch(e){fail(e);}
 }
 // A fresh GET must equal the verified reference before writing. On a difference,
 // opt-in façade sync adopts the hardware image and preserves any pending local copy.
 async function compareReference(){
  stats.phase='compare';emit();
  const fresh=await get();assertOpen();stats.compareReads++;
  if(!samePayload(fresh.payload,confirmed.payload)){stats.staleReferences++;if(adoptFacadeChanges){adoptFacade(fresh);return false;}throw Error('P0 a changé sur le FireworX depuis la dernière relecture : aucune écriture envoyée, rien n’a été adopté. Vérifiez la façade puis reconnectez pour relire P0.');}return true;
 }
 async function writeScalar(){
  unverified=true;try{if(!await compareReference())return;const operation=transferPlan(confirmed,desired)[0];
   if(!operation||operation.kind==='full'){unverified=false;stats.phase=operation?'queued':'verified';emit();if(operation)queue();return;}
   const bytes=operation.frame,wireMs=Math.ceil(bytes.length/3125*1000);stats.phase='sending';send(bytes);lastWrite=performance.now()+wireMs;stats.partialWrites++;sent=operation.image;stats.phase='sent';emit();verifyTimer=setTimeout(verify,verifyDelay+wireMs);
  }catch(e){if(!disposed)fail(e);}
 }
 // One full-image operation per verified cycle: compare GET, Data20 re-planned from the
 // same reference with the latest gestures, then a silent structural settle and readback.
 async function writeImage(){
  unverified=true;
  try{
   if(!await compareReference())return;
   const operation=transferPlan(confirmed,desired)[0];
   if(!operation||operation.kind!=='full'){unverified=false;stats.phase=operation?'queued':'verified';emit();if(operation)queue();return;}
   const bytes=operation.frame,wireMs=Math.ceil(bytes.length/3125*1000);
   stats.phase='sending';send(bytes);lastWrite=performance.now()+wireMs;stats.fullWrites++;stats.structuralWrites++;
   sent=operation.image;stats.phase='structural-settle';emit();
   clearTimeout(verifyTimer);verifyTimer=setTimeout(verify,structuralDelay+wireMs);
  }catch(e){if(!disposed)fail(e);}
 }
 function replace(payload,{structural=false,history=true,reason='parameter',historyGroup=null}={}){
  assertOpen();if(exclusiveBusy())throw Error('Transaction de bibliothèque en cours ; édition suspendue');if(!desired||paused)throw new Error('Lecture du FireworX requise');
  const next=decodeDeviceBuffer(frameWithPayload(desired.frame,payload),deviceId);
  if(samePayload(desired.payload,payload))return;
  // Refuse unsupported changes before mutating desired/history. In particular no
  // matrix edit, dormant output gating or distant-field bulk restoration slips in.
  transferPlan(desired,next);
  // The pending image must stay admissible from the last transmitted image too: e.g.
  // a new engine cannot be edited before its creation has been sent and read back.
  if(sent&&!samePayload(sent.payload,desired.payload)){try{transferPlan(sent,next);}catch(e){throw Error(`Opération précédente pas encore relue : attendez « En direct · relu » (${e.message})`);}}
  if(history){const now=performance.now();if(structural||historyGroup===null||historyGroup!==lastHistoryGroup||now-lastHistoryAt>debounce){past.push(desired.frame.slice());if(past.length>50)past.shift();}lastHistoryAt=now;lastHistoryGroup=historyGroup;future.length=0;}
  desired=next;stats.coalesced++;onImage(desired,{reason});queue();
 }
 // Undo/redo never rewrite records that are inactive in the target (see editor-transfer).
 function travel(from,to){
  if(!from.length||!desired)return;const frame=from.pop();to.push(desired.frame.slice());
  try{replace(preserveInactiveRecords(desired,decodeDeviceBuffer(frame,deviceId)),{structural:true,history:false,reason:'history'});}catch(e){to.pop();from.push(frame);emit();throw e;}
 }
 return {
  get conflictFrame(){return conflictFrame?.slice()??null;},
  clearConflict(){conflictFrame=null;stats.conflict=false;emit();},
  refreshFacade,
  get deviceId(){return deviceId;},
  get canAudition(){return !disposed&&!paused&&!exclusiveBusy()&&!controls.size&&!reading&&!unverified&&!!confirmed&&stats.phase==='verified'&&samePayload(desired.payload,confirmed.payload);},
  get image(){return desired;},get reference(){return confirmed;},get diagnostics(){return {...stats,unverified};},get paused(){return paused;},get reading(){return reading;},
  get persistentBusy(){return persistentBusy;},
  get exclusiveBusy(){return exclusiveBusy();},
  get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
  async load(){assertOpen();if(exclusiveBusy())throw Error('Opération exclusive en cours');if(paused)throw Error('Session arrêtée après erreur ; une nouvelle connexion est requise');if(unverified||reading)throw Error('Transaction précédente non terminée');stopTimers();stats.error=null;stats.phase='loading';emit();try{const image=await get();assertOpen();desired=sent=confirmed=image;past.length=future.length=0;lastHistoryGroup=null;lastHistoryAt=-Infinity;onImage(image,{reason:'load'});stats.phase='verified';emit();return image;}catch(e){if(!disposed)fail(e);throw e;}},
  async readUserBank({signal,onProgress=()=>{},silenceMs=20000,maxMs=600000}={}){
   assertOpen();signal?.throwIfAborted();if(!this.canAudition||typeof transport.beginUserBankRead!=='function')throw Error('Session synchronisée et au repos requise pour le dump User');
   if(!Number.isFinite(silenceMs)||!Number.isFinite(maxMs)||silenceMs<3000||maxMs<silenceMs||maxMs>900000)throw Error('Délais de dump invalides');
   stopTimers();reading=true;stats.phase='library-bank';emit();const start=performance.now(),assembler=createUserBankAssembler({deviceId,startedAt:start,maxPackets:8192});let result,lastBankAt=start;
   try{
    result=await new Promise((resolve,reject)=>{
     let timer;const finish=reason=>{clearInterval(timer);bankCapture=null;resolve(assembler.finish(reason));};
     bankCapture={cancel:()=>{clearInterval(timer);bankCapture=null;reject(Error('Connexion fermée pendant le dump User'));},receive(bytes){const at=performance.now(),r=assembler.accept(bytes,at);if(r.status!=='ignored'){lastBankAt=at;stats.rxMessages++;stats.rxBytes+=bytes.length;onProgress(assembler.state);}if(assembler.done||assembler.failed)finish(assembler.done?'complete':'refused');}};
     timer=setInterval(()=>{const now=performance.now();if(signal?.aborted&&now-lastBankAt>=3000)finish('cancelled');else if(now-lastBankAt>=silenceMs||now-start>=maxMs)finish('timeout');},50);
     try{transport.beginUserBankRead();stats.txMessages++;stats.txBytes+=8;emit();}catch(e){clearInterval(timer);bankCapture=null;reject(e);}
    });
    await transport.endUserBankRead();assertOpen();stats.phase='verified';return result;
   }catch(e){if(!disposed)fail(e);throw e;}finally{reading=false;emit();}
  },
  async prepareStore(bank,slot,{saveBackup}={}){
   storeReview=null;
   assertOpen();if(!this.canAudition||typeof saveBackup!=='function'||typeof transport.prepareArchiveStore!=='function')throw Error('P0 vérifié et conservation des sauvegardes requis');
   const source=confirmed.frame.slice(),address=presetAddress(bank,slot);archiveStoreFrame(source,bank,slot);
   const prior=await this.readPreset(address);assertOpen();
   await saveBackup({kind:'source',bank:'buffer',slot:0,frame:source.slice()});await saveBackup({kind:'destination',bank,slot,frame:prior.frame.slice()});assertOpen();
   if(!this.canAudition||!samePayload(confirmed.frame,source))throw Error('P0 a changé pendant la préparation ; aucune sauvegarde envoyée');
   const publicReview=Object.freeze({bank,slot,address,sourceName:decodeDeviceBuffer(source).name,previousName:prior.type==='empty'?'Emplacement vide':decodeDeviceBuffer(prior.frame).name,occupied:prior.type!=='empty',confirmation:`${bank.toUpperCase()} ${slot}`,backupSaved:true});
   storeReview={publicReview,source,prior:prior.frame.slice(),frame:archiveStoreFrame(source,bank,slot),preparedAt:performance.now()};return publicReview;
  },
  cancelStore(){storeReview=null;},
  async commitStore(review,confirmation){
   assertOpen();const plan=storeReview;
   if(!plan||plan.publicReview!==review||confirmation!==review.confirmation||!this.canAudition||performance.now()-plan.preparedAt>300000||!samePayload(confirmed.frame,plan.source))throw Error('Destination non confirmée, devis périmé ou P0 modifié ; préparez à nouveau');
   storeReview=null;stopTimers();persistentBusy=true;unverified=true;stats.phase='store-compare';emit();let written=false;
   try{
    transport.prepareArchiveStore(plan.frame,plan.prior);
    const destination=await get(review.address);assertOpen();
    if(!samePayload(destination.frame,plan.prior))throw Object.assign(Error('La destination a changé depuis sa sauvegarde ; aucune écriture envoyée'),{code:'STORE_STALE'});
    if(!await compareReference())throw Object.assign(Error('P0 a changé ; aucune sauvegarde envoyée'),{code:'STORE_STALE'});
    stats.phase='store-sending';emit();transport.commitArchiveStore(plan.frame);written=true;stats.txMessages++;stats.txBytes+=plan.frame.length;stats.storeWrites=(stats.storeWrites??0)+1;stats.phase='store-settle';emit();
    await new Promise(r=>setTimeout(r,structuralDelay+Math.ceil(plan.frame.length/3125*1000)+5));assertOpen();
    const remaining=transport.diagnostics?.settleRemainingMs??0;if(remaining>0)await new Promise(r=>setTimeout(r,remaining+5));
    stats.phase='store-verify';emit();const stored=await get(review.address);assertOpen();
    const verification=verifyStoredPreset(plan.source,stored.frame,review.address),current=await get();assertOpen();
    if(!samePayload(current.payload,confirmed.payload))throw Error('Destination écrite et relue, mais P0 a changé ; aucune restauration automatique');
    confirmed=sent=desired=current;unverified=false;stats.phase='verified';onImage(current,{reason:'verified'});return {verification,frame:stored.frame.slice(),written:true};
   }catch(e){if(!written&&e.code==='STORE_STALE'){transport.cancelArchiveStore();unverified=false;stats.phase='verified';}else if(!disposed)fail(e);throw e;}
   finally{persistentBusy=false;emit();}
  },
  async readPreset(preset,{signal}={}){
   requestExpanded(deviceId,preset);if(preset===0)throw Error('Utilisez la lecture du buffer pour P0');assertOpen();
   while(reading||!['verified','idle'].includes(stats.phase)){signal?.throwIfAborted();assertOpen();if(paused)throw Error('Session suspendue ; reconnectez avant lecture');await new Promise(r=>setTimeout(r,25));}
   signal?.throwIfAborted();assertOpen();if(paused||!confirmed)throw Error('Lecture du buffer requise');
   // get() installs pending synchronously, so two callers cannot race a free slot.
   for(let attempt=0;;attempt++){
    try{return await get(preset,signal);}catch(e){
     if(disposed)throw e;
     if(typeof transport.abandonArchiveRead!=='function'||typeof transport.waitForQuiet!=='function'){if(e.name!=='AbortError')fail(e);throw e;}
     try{transport.abandonArchiveRead(preset);reading=true;stats.phase='library-drain';emit();await transport.waitForQuiet();assertOpen();}catch(error){if(!disposed)fail(error);throw error;}finally{reading=false;}
     stats.phase=desired&&confirmed&&!samePayload(desired.payload,confirmed.payload)?'queued':'verified';emit();
     if(signal?.aborted||e.name==='AbortError'){signal?.throwIfAborted();throw e;}
     if(attempt>=archiveRetries){stats.archiveFailures++;emit();throw Object.assign(Error(`Lecture de la mémoire ${preset} échouée après ${attempt+1} tentatives : ${e.message}`),{archiveReadFailure:true,preset});}
     stats.archiveRetries++;emit();
    }
   }
  },
  replace,
  async recall(frame){
   assertOpen();if(!this.canAudition||typeof transport.prepareRecall!=='function')throw Error('Session synchronisée et au repos requise pour rappeler une mémoire');
   const targetFrame=frame.slice();targetFrame[4]=deviceId;const target=decodeDeviceBuffer(targetFrame,deviceId),command=recallPreset(deviceId,target.preset);
   stopTimers();recallBusy=true;let emitted=false;emit();
   try{
    transport.prepareRecall(targetFrame);stats.phase='recall-compare';emit();
    const archive=await get(target.preset);assertOpen();
    if(!samePayload(decodeDeviceBuffer(archive.frame,deviceId).payload,target.payload))throw Error('Mémoire modifiée depuis sa capture ; relisez cet emplacement avant le rappel');
    if(!await compareReference())throw Error('P0 a changé en façade ; aucun rappel envoyé. Vérifiez puis recommencez.');
    unverified=true;stats.phase='recall-sending';emitted=true;send(command);stats.nativeRecalls=(stats.nativeRecalls??0)+1;
    const deadline=performance.now()+structuralDelay+Math.ceil(command.length/3125*1000);stats.phase='recall-settle';emit();
    while(performance.now()<deadline||(transport.diagnostics?.settleRemainingMs??0)>0){await new Promise(r=>setTimeout(r,25));assertOpen();}
    stats.phase='recall-verify';emit();const fresh=await get();assertOpen();
    const verification=verifyRecalledPreset(targetFrame,fresh.frame,target.preset);
    desired=sent=confirmed=fresh;unverified=false;past.length=future.length=0;lastHistoryGroup=null;lastHistoryAt=-Infinity;stats.error=null;stats.phase='verified';
    onImage(fresh,{reason:'recall',presetSource:{bank:verification.bank,slot:verification.slot},verification});emit();return {image:fresh,verification};
   }catch(e){
    if(!emitted&&!disposed&&!paused){transport.cancelRecall();unverified=false;stats.phase='verified';emit();}
    else if(!disposed&&!paused)fail(e);
    throw e;
   }finally{recallBusy=false;emit();}
  },
  async audition(frame,{presetSource=null}={}){
   assertOpen();if(!this.canAudition)throw Error('Attendez la relecture des modifications avant de charger un preset');
   const requested=decodeDeviceBuffer(frame,deviceId);if(requested.preset!==0)throw Error('Buffer temporaire P0 requis');
   if(samePayload(confirmed.payload,requested.payload))return confirmed;
   if(typeof transport.prepareAudition!=='function')throw Error('Ce transport ne prend pas en charge l’écoute temporaire');
   stopTimers();unverified=true;
   try{
    if(!await compareReference())throw Object.assign(Error('P0 a changé en façade : aucun preset envoyé. Vérifiez son état puis recommencez.'),{code:'P0_CHANGED'});
    const next=preparePresetAudition(confirmed,requested);
    if(samePayload(confirmed.payload,next.payload)){unverified=false;stats.phase='verified';emit();return confirmed;}
    transport.prepareAudition(next.frame);
    past.length=future.length=0;desired=sent=next;stats.phase='sending';
    send(next.frame);const wireMs=Math.ceil(next.frame.length/3125*1000);lastWrite=performance.now()+wireMs;stats.fullWrites++;stats.phase='structural-settle';onImage(next,{reason:'audition',presetSource:presetSource?{...presetSource}:null});emit();verifyTimer=setTimeout(verify,structuralDelay+wireMs);
    while(unverified&&!paused){assertOpen();await new Promise(r=>setTimeout(r,20));}
    assertOpen();if(paused)throw Error(stats.error??'Écoute non confirmée');return confirmed;
   }catch(e){if(!disposed&&!paused&&e.code!=='P0_CHANGED')fail(e);throw e;}
  },
  undo(){travel(past,future);},
  redo(){travel(future,past);},
  sync:verify,
  flush,
  async setTempoFromTaps(config,{signal,onProgress=()=>{}}={}){
   assertOpen();planTempoTaps(config);signal?.throwIfAborted();if(!this.canAudition)throw Error('Attendez une référence P0 synchronisée avant de régler le tempo');
   const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});tempoAbort=controller;tempoBusy=true;stopTimers();stats.phase='tempo-taps';emit();
   let receipt=null,sequenceError=null;
   try{
    try{receipt=await performTempoTaps(config,{signal:controller.signal,send:bytes=>{assertOpen();send(bytes);},onProgress});}catch(e){sequenceError=e;if(!disposed)send(Uint8Array.of(175+config.channel,config.cc,0));}
    assertOpen();stats.phase='tempo-read';emit();await new Promise(resolve=>setTimeout(resolve,250));assertOpen();const first=await get();await new Promise(resolve=>setTimeout(resolve,300));assertOpen();const fresh=await get();assertOpen();if(!samePayload(first.payload,fresh.payload))throw Error('P0 instable après Tempo ; aucun ancien réglage envoyé');
    // Global tempo can recalculate time/rate fields. Adopt the returned P0 instead
    // of interpreting these device-side changes as a failed parameter write.
    confirmed=sent=desired=fresh;unverified=false;stats.phase='verified';onImage(fresh,{reason:'tempo'});
    if(sequenceError)throw sequenceError;return receipt;
   }catch(e){if(!disposed&&stats.phase!=='verified')fail(e);throw e;}
   finally{signal?.removeEventListener('abort',abort);if(tempoAbort===controller)tempoAbort=null;tempoBusy=false;clearTimeout(facadeTimer);facadeTimer=null;emit();}
  },
  sendControl(bytes){assertOpen();if(exclusiveBusy())throw Error('Transaction de bibliothèque en cours ; contrôles suspendus');if(!desired||paused)throw new Error('Connexion MIDI non synchronisée');if(!(bytes instanceof Uint8Array)||bytes.length!==3||(bytes[0]&240)!==176||bytes[1]>119||bytes[2]>127)throw new Error('Contrôle MIDI hors profil CC');if(reading||unverified||controls.size){controls.set(bytes[0]+':'+bytes[1],bytes.slice());if(controlTimer===null)controlTimer=setTimeout(flushControl,25);}else send(bytes);},
  sendClock(timestamp){assertOpen();if(exclusiveBusy())return false;if(!desired||paused)throw new Error('Connexion non synchronisée');if(!Number.isFinite(timestamp)||timestamp<0)throw new Error('Horodatage invalide');if(reading||unverified)return false;send(Uint8Array.of(248),timestamp);return true;},
  dispose(){if(disposed)return disposal;disposed=true;tempoAbort?.abort();clearInterval(poll);stopTimers();bankCapture?.cancel();pending?.reject(new Error('Connexion fermée'));unsubscribe();disposal=transport.close?.();stats.phase='disconnected';emit();return disposal;}
 };
}
