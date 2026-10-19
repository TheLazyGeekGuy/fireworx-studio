import {validatePresetValues} from './preset-validation.js';
// Verified P0 wire admission. The default scalar bench remains narrow; the UI
// explicitly selects the user-authorized full-editor operation planner.
// #67: in editor mode, DataPart21 is limited to the 17/19-byte scalar frames of the
// trialled planner. A full Data20 image of P0 is admitted only when it equals the
// planner image built from the verified reference (or the staged audition) AND a
// compare GET of P0 matched that reference in the same cycle. Nothing at all is
// transmitted during the structural settle that follows a Data20.
import {requestExpanded,parseExpanded,recallPreset} from './protocol.js';
import {verifyRecalledPreset} from './preset-recall.js';
import {decodeDeviceBuffer,samePayload} from './device-codec.js';
import {frameWithPayload,parseBufferPart} from './live-protocol.js';
import {parameterTransfers} from './parameter-transfer.js';
import {editorTransfers} from './editor-transfer.js';
import {validateDeviceMatrix} from './device-graph.js';
import {requestUserBank} from './bank-dump.js';
import {presetLocation} from './preset-library-model.js';
const derived=i=>i>=1131&&i<=1359&&(i-1131)%12===0;
const wire=n=>Math.ceil(n/3125*1000);
export function createGuardedTransport(raw,{deviceId=0,settle=4500,structuralSettle=8000,now=()=>performance.now(),editor=false,silence={until:-Infinity}}={}){
 requestExpanded(deviceId,0);
 if(!Number.isFinite(settle)||settle<4500||settle>30000||typeof now!=='function')throw Error('Temporisation de reprise prudente invalide');
 if(!Number.isFinite(structuralSettle)||structuralSettle<8000||structuralSettle>30000||structuralSettle<settle)throw Error('Pause structurelle invalide : 8000 à 30000 ms requis');
 // compared: a GET of P0, sent after the last write and with nothing transmitted since,
 // returned exactly the verified reference. Consumed by the next Data20.
 let closed=false,closing,reference=null,stableReads=0,pending=null,expected=null,readyAt=0,audition=null,compared=false,quietUntil=-Infinity,fullWrites=0,bankReading=false,archiveStore=null,nativeRecall=null;
 const listeners=new Set(),quietWaiters=new Set();
 const quietDeadline=()=>Math.max(quietUntil,silence.until);
 const settleStructure=length=>{readyAt=quietUntil=now()+structuralSettle+wire(length);silence.until=quietUntil;};
 let lastReplyAt=now();
 const close=()=>{if(closed)return closing;closed=true;reference=null;stableReads=0;pending=null;expected=null;audition=null;archiveStore=null;nativeRecall=null;compared=false;for(const waiter of [...quietWaiters])waiter.cancel();unsubscribe();listeners.clear();closing=raw.close?.();return closing;};
 const unsubscribe=raw.subscribe(bytes=>{
  if(closed)return;
  // Reloading cannot recall an already transmitted GET. Drain late device replies
  // before the new page starts its reference reads; P0 replies carry no nonce.
  const fireworx=bytes[0]===240&&bytes[1]===0&&bytes[2]===32&&bytes[3]===31&&bytes[4]===deviceId&&bytes[5]===64;
  if(fireworx){lastReplyAt=now();for(const waiter of quietWaiters)waiter.arm();}
  let fault=null;const recipients=[...listeners],awaited=pending!==null&&fireworx&&[32,40].includes(bytes[6])&&bytes[7]*128+bytes[8]===pending;
  // Any other FireworX reply (unsolicited P0, stray archive) voids a compare GET.
  if(fireworx&&!awaited)compared=false;
  if(awaited){
   try{
    const parsed=parseExpanded(bytes,deviceId);
    if(pending===0){
     const next=decodeDeviceBuffer(bytes,deviceId);
     if(expected){
      if(nativeRecall?.sent)verifyRecalledPreset(nativeRecall.frame,next.frame,nativeRecall.address);
      else if(next.payload.some((v,i)=>v!==expected.payload[i]&&!derived(i)))throw Error('Relecture différente après écriture');
      stableReads=Math.max(stableReads,2);compared=false;
     }else{
      const same=!!reference&&samePayload(reference.payload,next.payload);
      stableReads=same?stableReads+1:1;compared=same&&stableReads>=2;
     }
     reference=next;expected=null;if(nativeRecall?.sent)nativeRecall=null;
    }else if(parsed.preset!==pending)throw Error('Réponse de preset différente');
    if(archiveStore&&pending===archiveStore.address){if(archiveStore.sent)archiveStore=null;else archiveStore.destinationMatched=samePayload(bytes,archiveStore.backup);}
    if(nativeRecall&&pending===nativeRecall.address)nativeRecall.destinationMatched=samePayload(bytes,nativeRecall.frame);
    pending=null;
   }catch(e){if(pending!==0){pending=null;compared=false;}else fault=e;}
  }
  if(fault)close();
  // Deliver a malformed/mismatched reply to the session too, so its pending GET
  // rejects promptly and marks the UI paused instead of waiting for timeout.
  for(const fn of recipients)fn(bytes);
 });
 const transmit=bytes=>{try{raw.send(bytes);}catch(e){close();throw e;}};
 return {
  get diagnostics(){return{closed,stableReads,pending,unverified:!!expected,compared,fullWrites,settle,structuralSettle,quietUntil:quietDeadline(),settleRemainingMs:Math.max(0,quietDeadline()-now(),expected?readyAt-now():0)};},
  prepareAudition(frame){
   if(!editor||closed||pending!==null||expected||archiveStore||nativeRecall||bankReading||stableReads<2)throw Error('Écoute temporaire indisponible pendant cette transaction');
   const next=decodeDeviceBuffer(frame,deviceId);if(next.preset!==0)throw Error('Écoute limitée au buffer temporaire P0');validatePresetValues(next,{reference});audition=next;
  },
  prepareRecall(frame){
   if(!editor||closed||pending!==null||expected||archiveStore||nativeRecall||bankReading||stableReads<2||quietWaiters.size||now()<quietDeadline())throw Error('Rappel indisponible pendant cette transaction');
   const target=decodeDeviceBuffer(frame,deviceId);recallPreset(deviceId,target.preset);validatePresetValues(target,{reference});
   nativeRecall={address:target.preset,frame:frame.slice(),target,destinationMatched:false,sent:false};audition=null;compared=false;
  },
  cancelRecall(){if(nativeRecall?.sent)throw Error('Rappel déjà émis : relecture obligatoire');nativeRecall=null;},
  prepareArchiveStore(frame,backup){
   if(!editor||closed||bankReading||archiveStore||nativeRecall||pending!==null||expected||stableReads<2||quietWaiters.size||now()<quietDeadline())throw Error('Sauvegarde indisponible pendant cette transaction');
   const next=decodeDeviceBuffer(frame,deviceId),location=presetLocation(next.preset),prior=parseExpanded(backup,deviceId);
   if(!['user','card'].includes(location.bank)||prior.preset!==next.preset)throw Error('Destination User/Carte et sauvegarde correspondante requises');
   if(!samePayload(next.payload,reference.payload))throw Error('La source à sauvegarder doit être le P0 vérifié');
   validatePresetValues(next,{reference});archiveStore={address:next.preset,frame:frame.slice(),backup:backup.slice(),source:reference.frame.slice(),destinationMatched:false,sent:false};
  },
  commitArchiveStore(frame){
   const review=archiveStore;
   if(closed||!review||review.sent||!review.destinationMatched||!compared||pending!==null||expected||bankReading||quietWaiters.size||now()<quietDeadline()||!samePayload(frame,review.frame)||!samePayload(reference.frame,review.source))throw Error('Sauvegarde refusée : destination et P0 doivent être relus identiques au devis');
   review.sent=true;compared=false;settleStructure(frame.length);transmit(frame);
  },
  cancelArchiveStore(){if(archiveStore?.sent)throw Error('Écriture déjà émise : aucune restauration automatique');archiveStore=null;},
  waitForQuiet({quiet=3000,timeout=22000}={}){
   if(closed)return Promise.reject(Error('Transport fermé'));
   if(pending!==null||expected)return Promise.reject(Error('Repos initial requis avant toute transaction'));
   if(!Number.isFinite(quiet)||quiet<3000||!Number.isFinite(timeout)||timeout<quiet)return Promise.reject(Error('Repos initial invalide'));
   return new Promise((resolve,reject)=>{
    let timer,deadline;
    const finish=error=>{clearTimeout(timer);clearTimeout(deadline);quietWaiters.delete(waiter);error?reject(error):resolve();};
    const waiter={cancel:()=>finish(Error('Transport fermé pendant le repos initial')),arm:()=>{clearTimeout(timer);timer=setTimeout(()=>finish(),Math.max(0,quiet-(now()-lastReplyAt),quietDeadline()-now()));}};
    quietWaiters.add(waiter);deadline=setTimeout(()=>finish(Error('Trafic FireworX persistant ; connexion arrêtée sans envoi')),timeout);waiter.arm();
   });
  },
  subscribe(fn){if(closed)throw Error('Transport fermé');listeners.add(fn);return()=>listeners.delete(fn);},
  beginUserBankRead(){if(!editor||closed||bankReading||archiveStore||nativeRecall||pending!==null||expected||stableReads<2||quietWaiters.size||now()<quietDeadline())throw Error('Lecture groupée indisponible pendant cette transaction');bankReading=true;compared=false;transmit(requestUserBank(deviceId));},
  async endUserBankRead(){if(!bankReading)throw Error('Aucune lecture groupée en cours');bankReading=false;await this.waitForQuiet();},
  abandonArchiveRead(preset){
   if(closed||expected||preset===0||!Number.isInteger(preset)||pending!==null&&pending!==preset)throw Error('Seule une lecture de mémoire archivée peut être abandonnée');
   pending=null;compared=false;
  },
  send(bytes,timestamp){
   if(closed)throw Error('Transport fermé');
   if(bankReading)throw Error('Dump User en cours : aucun autre message MIDI');
   if(quietWaiters.size)throw Error('Attendre le repos initial MIDI');
   if(!(bytes instanceof Uint8Array))throw Error('Trame MIDI valide requise');
   // Structural settle: no GET, CC, Clock or SysEx of any kind until it has elapsed.
   if(now()<quietDeadline())throw Error('Pause structurelle après image complète : aucun message MIDI pendant la stabilisation');
   if(archiveStore){
    const get=bytes.length===10&&bytes[6]===69&&samePayload(bytes,requestExpanded(deviceId,bytes[7]*128+bytes[8]));
    const address=get?bytes[7]*128+bytes[8]:null;
    if(!get||archiveStore.sent&&address!==archiveStore.address||!archiveStore.sent&&address!==archiveStore.address&&address!==0)throw Error('Transaction de sauvegarde : seuls les GET de destination et de P0 sont admis');
   }
   if(nativeRecall){
    const get=bytes.length===10&&bytes[6]===69&&samePayload(bytes,requestExpanded(deviceId,bytes[7]*128+bytes[8])),p=get?bytes[7]*128+bytes[8]:null;
    const recall=!nativeRecall.sent&&samePayload(bytes,recallPreset(deviceId,nativeRecall.address));
    if(!recall&&(!get||nativeRecall.sent&&p!==0||!nativeRecall.sent&&p!==0&&p!==nativeRecall.address))throw Error('Rappel : seuls les contrôles de la mémoire choisie et de P0 sont admis');
   }
   const cc=bytes.length===3&&(bytes[0]&240)===176&&bytes[1]<=119&&bytes[2]<=127;
   const clock=bytes.length===1&&bytes[0]===248;
   if(editor&&(cc||clock)){
    if(stableReads<2||pending!==null||expected)throw Error('Attendre la fin de la transaction SysEx avant performance');
    if(clock&&(!Number.isFinite(timestamp)||timestamp<0)||cc&&timestamp!==undefined)throw Error('Horodatage MIDI invalide');
    compared=false;transmit(bytes);return;
   }
   if(timestamp!==undefined)throw Error('Horodatage/Clock indisponible pendant la reprise prudente');
   if(pending!==null)throw Error('Une lecture MIDI est déjà en cours');
   if(bytes.length===10&&bytes[6]===69){
    const preset=bytes[7]*128+bytes[8];if(!samePayload(bytes,requestExpanded(deviceId,preset)))throw Error('GET FireworX invalide');
    if(expected&&(preset!==0||now()<readyAt))throw Error('Attendre le DSP puis relire P0 avant toute autre opération');
    compared=false;pending=preset;transmit(bytes);return;
   }
   if(expected)throw Error('Relecture P0 obligatoire avant une autre écriture');
   if(!reference||stableReads<2)throw Error('Deux lectures P0 identiques requises avant édition');
   if(bytes[6]===68){
    if(!nativeRecall||nativeRecall.sent||!nativeRecall.destinationMatched||!compared||!samePayload(bytes,recallPreset(deviceId,nativeRecall.address)))throw Error('Mémoire choisie et P0 doivent être relus identiques avant rappel');
    nativeRecall.sent=true;expected=nativeRecall.target;compared=false;settleStructure(bytes.length);transmit(bytes);return;
   }
   if(bytes[6]===32){
    if(!editor||bytes.length!==2745)throw Error('Commande hors du buffer temporaire ou du profil autorisé');
    if(!compared)throw Error('GET de contrôle de P0 égal à la référence requis juste avant une image complète');
    let image;
    if(audition&&samePayload(audition.frame,bytes))image=audition;
    else{
     const next=decodeDeviceBuffer(bytes,deviceId);if(next.preset!==0)throw Error('Image complète limitée au buffer temporaire P0');
     const operations=editorTransfers(reference,next);
     if(operations.length!==1||operations[0].kind!=='full'||!samePayload(operations[0].frame,bytes))throw Error('Image complète différente du plan vérifié de l’éditeur');
     image=operations[0].image;
    }
    validatePresetValues(image,{reference});
    audition=null;compared=false;expected=image;fullWrites++;settleStructure(bytes.length);
    transmit(bytes);return;
   }
   if(![17,19].includes(bytes.length)||bytes[6]!==33)throw Error('Commande hors du buffer temporaire ou du profil autorisé');
   const part=parseBufferPart(bytes,deviceId),payload=reference.payload.slice();payload.set(part.data,part.address);
   const next=decodeDeviceBuffer(frameWithPayload(reference.frame,payload),deviceId),operations=(editor?editorTransfers:parameterTransfers)(reference,next);
   if(operations[0]?.kind==='full')throw Error('Écriture structurelle : image complète Data20 vérifiée requise, DataPart refusé');
   if(operations.length!==1||!samePayload(operations[0].frame,bytes))throw Error(editor?'Une seule opération valide et complète de l’éditeur est requise':'Une seule valeur active et éprouvée, avec sa largeur complète, est requise');
   compared=false;expected=operations[0].image;readyAt=now()+settle+wire(bytes.length);
   transmit(bytes);
  },close
 };
}
