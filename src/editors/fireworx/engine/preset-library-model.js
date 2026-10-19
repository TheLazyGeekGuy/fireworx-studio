import {parseExpanded,requestExpanded} from './protocol.js';
import {decodeDeviceBuffer} from './device-codec.js';
export const presetBanks=Object.freeze([{id:'factory',label:'Factory',first:1,count:400,readOnly:true},{id:'user',label:'User',first:2049,count:200,readOnly:false},{id:'card',label:'Carte',first:4097,count:800,readOnly:false}]);
export function presetAddress(bankId,slot){const bank=presetBanks.find(b=>b.id===bankId);if(!bank||!Number.isInteger(slot)||slot<1||slot>bank.count)throw Error('Emplacement de preset hors banque');return bank.first+slot-1;}
export function presetLocation(preset){const bank=presetBanks.find(b=>preset>=b.first&&preset<b.first+b.count);return preset===0?{bank:'buffer',slot:0,label:'Buffer temporaire'}:bank?{bank:bank.id,slot:preset-bank.first+1,label:`${bank.label} ${preset-bank.first+1}`}:(()=>{throw Error('Adresse de preset invalide');})();}
export function inspectPreset(frame){
 const parsed=parseExpanded(frame),location=presetLocation(parsed.preset);
 if(parsed.type==='empty')return {...location,preset:parsed.preset,status:'empty',count:Math.max(1,parsed.count),frame:frame.slice(),name:'Emplacement vide',nodes:[]};
 let decoded;try{decoded=decodeDeviceBuffer(frame);}catch{}
 return {...location,preset:parsed.preset,status:decoded?'decoded':'opaque',count:1,frame:frame.slice(),name:decoded?.name||'Preset FireworX',alphaText:decoded?.alphaText??'',nodes:decoded?.nodes??[],bytes:frame.length};
}
// A downloaded archived frame is preserved. A separate local copy can become P0.
export function localEditFrame(frame){const p=inspectPreset(frame);if(p.status!=='decoded')throw Error('Ce preset ne possède pas de décodeur éditable');const next=frame.slice();next[7]=next[8]=0;decodeDeviceBuffer(next);return next;}
export function joinPresetFrames(frames){const n=frames.reduce((n,f)=>n+f.length,0);if(!n||n>32*1024*1024)throw Error('Export vide ou supérieur à 32 Mio');const bytes=new Uint8Array(n);let at=0;for(const f of frames){inspectPreset(f);bytes.set(f,at);at+=f.length;}return bytes;}
// Archive failures are isolated by the session after a quiet drain. They do not
// imply P0 verification failure; continue the inventory and retain retry addresses.
export function createPresetReader({getSession,onRecord=()=>{},onFailure=()=>{},onProgress=()=>{},gap=120}){
 let controller=null;
 return {get busy(){return !!controller;},cancel(){controller?.abort();},async read(bankId,start=1,count=1,{skipPresets=[]}={}){
  if(controller)throw Error('Une lecture de bibliothèque est déjà en cours');
  const bank=presetBanks.find(b=>b.id===bankId);if(!bank||!Number.isInteger(start)||!Number.isInteger(count)||start<1||count<1||start+count-1>bank.count)throw Error('Plage de banque invalide');
  const session=getSession();if(!session?.readPreset)throw Error('Connectez le FireworX pour lire ses mémoires');
  const local=new AbortController(),known=new Set(skipPresets),failed=[],began=performance.now();controller=local;let done=0,read=0,skipped=0;
  const progress=(preset,status)=>onProgress({bank:bankId,done,count,preset,status,read,skipped,failed:[...failed],etaMs:read?Math.round((performance.now()-began)/read*(count-done)):null});
  const active=()=>{local.signal.throwIfAborted();if(getSession()!==session)throw Error('Connexion remplacée ; lecture arrêtée');};
  try{while(done<count){active();const preset=bank.first+start-1+done;requestExpanded(0,preset);
    if(known.has(preset)){done++;skipped++;progress(preset,'skipped');continue;}
    let result;try{result=await session.readPreset(preset,{signal:local.signal});}catch(e){active();if(!e.archiveReadFailure)throw e;failed.push(preset);await onFailure({bank:bankId,preset,error:e.message,at:new Date().toISOString()});done++;read++;progress(preset,'failed');continue;}
    active();const record=inspectPreset(result.frame),skip=record.status==='empty'?Math.min(count-done,record.count):1;
    await onRecord(record);done+=skip;read++;progress(preset,record.status);
    if(done<count)await new Promise((resolve,reject)=>{const end=()=>{clearTimeout(timer);local.signal.removeEventListener('abort',abort);resolve();},abort=()=>{clearTimeout(timer);local.signal.removeEventListener('abort',abort);reject(new DOMException('Lecture annulée','AbortError'));},timer=setTimeout(end,gap);local.signal.addEventListener('abort',abort,{once:true});});
   }return {done,count,read,skipped,failed};
  }finally{if(controller===local)controller=null;}
 }};
}
