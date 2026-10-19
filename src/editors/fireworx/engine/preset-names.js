// Local naming only. No MIDI, device storage, downloads or automatic STORE.
import {decodeDeviceBuffer,editDeviceText} from './device-codec.js';
import {frameWithPayload} from './live-protocol.js';

const keyOf=name=>String(name??'').trim().replace(/\s+/g,' ').toLowerCase();
const digest=async frame=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',frame))].map(v=>v.toString(16).padStart(2,'0')).join('');
export function validateNameCatalog(catalog){
 if(catalog?.kind!=='fireworx-preset-name-words'||catalog.schema!==1)throw Error('Catalogue de noms incompatible');
 for(const words of [catalog.prefixes,catalog.suffixes])if(!Array.isArray(words)||words.length!==200||new Set(words.map(keyOf)).size!==200||words.some(w=>typeof w!=='string'||!/^[A-Za-z]{1,9}$/.test(w)))throw Error('Catalogue : 200 mots ASCII distincts par liste requis');
 return catalog;
}
export function createPresetNameRegistry(catalog,{storage,key='midi-studio:fireworx:variation-names:v1',randomInteger=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n}={}){
 validateNameCatalog(catalog);
 return {reserve(knownNames=[]){
  // Reload for each allocation; callers serialize cross-tab allocation with Web Locks.
  let used;try{used=JSON.parse(storage.getItem(key)||'[]');}catch{throw Error('Registre des noms indisponible ; aucun nom réservé');}
  if(!Array.isArray(used)||used.length>40000||used.some(n=>typeof n!=='string'))throw Error('Registre des noms invalide');
  const blocked=new Set([...used,...knownNames].map(keyOf)),start=randomInteger(40000);
  if(!Number.isInteger(start)||start<0||start>=40000)throw Error('Tirage de nom invalide');
  for(let i=0;i<40000;i++){
   // 7919 is coprime to 40000: every pair is visited once, with bounded work.
   const index=(start+i*7919)%40000,name=catalog.prefixes[Math.floor(index/200)]+' '+catalog.suffixes[index%200];
   if(blocked.has(keyOf(name)))continue;
   try{storage.setItem(key,JSON.stringify([...used,name]));}catch{throw Error('Impossible de réserver le nom ; stockage local saturé ou refusé');}
   return name;
  }
  throw Error('Les 40 000 noms sont déjà utilisés ; aucun nom réutilisé');
 }};
}
export async function nameRandomizerResult(result,name){
 if(result?.status!=='accepted')throw Error('Aperçu accepté requis avant le nommage');
 const source=decodeDeviceBuffer(result.candidate.frame),frame=frameWithPayload(source.frame,editDeviceText(source,{name})),sha256=await digest(frame);
 return {...result,candidate:{...result.candidate,frame,sha256},replay:{...result.replay,
  soundFrameSha256:result.candidate.sha256,acceptedFrameSha256:sha256,
  naming:{schema:1,catalog:'preset-name-words-v1',name,scope:'Apply name after deterministic sound generation; payload bytes 4..23 only'}}};
}
export function presetFilename(name,extension='json'){
 if(!['json','syx'].includes(extension))throw Error('Extension de preset invalide');
 const stem=String(name??'').trim().replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'preset';
 return 'FireworX-'+stem+'.'+extension;
}
