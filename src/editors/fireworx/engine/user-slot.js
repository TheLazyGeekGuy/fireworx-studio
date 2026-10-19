// User destinations are suggested from observed emptiness, never from a name.
import {presetAddress,inspectPreset} from './preset-library-model.js';
export function firstKnownEmptyUser(records){
 const slots=new Map();
 for(const r of records){
  if(!Number.isInteger(r.preset)||r.preset<2049||r.preset>2248)continue;
  const count=r.status==='empty'?Math.min(r.count??1,2249-r.preset):1;
  for(let n=0;n<count;n++){
   const slot=r.preset-2048+n,previous=slots.get(slot);
   if(!previous||String(r.at??'')>String(previous.at??'')||String(r.at??'')===String(previous.at??'')&&r.status!=='empty')slots.set(slot,r);
  }
 }
 return [...slots].filter(([,r])=>r.status==='empty').map(([slot])=>slot).sort((a,b)=>a-b)[0]??null;
}
export async function findFirstEmptyUser({read,onRecord=()=>{},onProgress=()=>{},signal,gapMs=120}){
 for(let slot=1;slot<=200;slot++){
  signal?.throwIfAborted();onProgress(slot);
  const response=await read(presetAddress('user',slot),{signal});signal?.throwIfAborted();
  const record=inspectPreset(response.frame);if(record.preset!==presetAddress('user',slot))throw Error('Réponse à un autre emplacement User');
  await onRecord(record);signal?.throwIfAborted();
  if(record.status==='empty')return slot;
  if(slot<200)await new Promise(resolve=>setTimeout(resolve,gapMs));
 }
 return null;
}
