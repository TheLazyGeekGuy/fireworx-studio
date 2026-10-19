// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {requestExpanded} from '../engine/protocol.js';
import {assertHardwareSessionAvailable,editorLivePolicy,guardedLivePolicy} from '../engine/hardware-policy.js';
import {createGuardedTransport} from '../engine/guarded-transport.js';
import {decodeDeviceBuffer,encodeEditBuffer,samePayload,verifyEditReadback} from '../engine/device-codec.js';
export function create_device_session(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// Explicit, single-flight P0 transactions over an injected transport.
// Intentionally no STORE, recall, bank/global write or generic send API.




 function createDeviceSession(transport,{deviceId=0,timeout=6000,settle=1200,bytesPerSecond=3125,minGap=100,onState=()=>{}}={}){
 requestExpanded(deviceId,0);
 for(const [key,v,lo,hi] of [['timeout',timeout,1,60000],['settle',settle,0,10000],['bytesPerSecond',bytesPerSecond,1,1e9],['minGap',minGap,0,10000]])if(!Number.isFinite(v)||v<lo||v>hi)throw new Error(`Temporisation ${key} invalide`);
 let disposed=false,busy=false,reference=null,pending=null;
 let readyAt=0,lastRequestAt=null;
 const stats={txMessages:0,txBytes:0,rxMessages:0,rxBytes:0,lastRttMs:null,phase:'idle'};
 const changed=()=>onState({busy,connected:!disposed,reference,stats:{...stats}});
 const wireTime=bytes=>Math.ceil(bytes*1000/bytesPerSecond);
 const assertOpen=()=>{if(disposed)throw new Error('Connexion MIDI fermée');};
 const unsubscribe=transport.subscribe(bytes=>{
  if(!pending||disposed)return;
  // Ignore unrelated models, IDs, preset replies and non-data messages.
  if(bytes[0]!==240||bytes[1]!==0||bytes[2]!==32||bytes[3]!==31||bytes[4]!==deviceId||bytes[5]!==64||bytes[6]!==32||bytes[7]!==0||bytes[8]!==0)return;
  stats.rxMessages++;stats.rxBytes+=bytes.length;stats.lastRttMs=lastRequestAt===null?null:Math.round(performance.now()-lastRequestAt);
  try{pending.resolve(decodeDeviceBuffer(Uint8Array.from(bytes),deviceId));}catch(e){pending.reject(e);}
 });
 let settleTimer=null,settleReject=null;
 const wait=ms=>ms<=0?Promise.resolve():new Promise((resolve,reject)=>{settleReject=reject;settleTimer=setTimeout(()=>{settleTimer=null;settleReject=null;resolve();},ms);});
 async function pace(){assertOpen();await wait(Math.max(0,Math.ceil(readyAt-performance.now())));assertOpen();}
 function sendNow(bytes){
  assertOpen();if(bytes[6]===69)lastRequestAt=performance.now();
  transport.send(bytes);stats.txMessages++;stats.txBytes+=bytes.length;
  readyAt=performance.now()+wireTime(bytes.length)+minGap;changed();
 }
 async function receiveAfter(send,phase='read'){
  stats.phase=phase;changed();await pace();
  assertOpen();if(pending)throw new Error('Lecture déjà en cours');
  return new Promise((resolve,reject)=>{
   const finish=(fn,v)=>{clearTimeout(timer);pending=null;fn(v);};
   const timer=setTimeout(()=>finish(reject,new Error('Délai de réponse FireworX dépassé ; relisez le buffer')),timeout);
   pending={resolve:v=>finish(resolve,v),reject:e=>finish(reject,e)};
   try{sendNow(send);}catch(e){pending?.reject(e);}
  });
 }
 async function run(fn){assertOpen();if(busy)throw new Error('Une transaction MIDI est déjà en cours');busy=true;changed();try{return await fn();}catch(e){reference=null;stats.phase='error';throw e;}finally{busy=false;if(stats.phase!=='error')stats.phase='idle';changed();}}
 return {
  get reference(){return reference;},get busy(){return busy;},
  get diagnostics(){return {...stats,bytesPerSecond,minGap,settle,timeout};},
  read:()=>run(async()=>{reference=null;const next=await receiveAfter(requestExpanded(deviceId,0));assertOpen();reference=next;return next;}),
  apply:changes=>run(async()=>{
   if(!reference||!changes.size)throw new Error('Lecture matérielle puis modifications requises');
   const original=reference,copy=new Map(changes),next=encodeEditBuffer(original,copy);
   // A fresh GET detects other editors/front-panel edits before transmitting.
   const fresh=await receiveAfter(requestExpanded(deviceId,0),'freshness-read');assertOpen();
   if(!samePayload(fresh.payload,original.payload)){reference=null;throw new Error('Le buffer a changé sur l’appareil ; relisez avant d’appliquer');}
   await pace();stats.phase='write';sendNow(next);reference=null;
   // send() enqueues bytes; account for wire serialization before DSP settling.
   stats.phase='settle';changed();await wait(wireTime(next.length)+settle);assertOpen();
   const received=await receiveAfter(requestExpanded(deviceId,0),'verify-read');assertOpen();
   verifyEditReadback(original,copy,received);reference=received;return received;
  }),
  dispose(){if(disposed)return;disposed=true;reference=null;pending?.reject(new Error('Connexion MIDI fermée'));if(settleTimer){clearTimeout(settleTimer);settleTimer=null;settleReject?.(new Error('Connexion MIDI fermée'));settleReject=null;}unsubscribe();transport.close?.();changed();}
 };
}
// Browser adapter for a validated input/output pair, automatic or manually selected.
// An optional journal (midi-journal.js) records every frame at this boundary: RX as
// delivered by the port, TX only after the port accepted it, admission refusals apart.
 async function openWebMidiTransport(input,output,onDisconnect,options){return environment.openTransport(input,output,onDisconnect,options);}

return {createDeviceSession,openWebMidiTransport};
}
