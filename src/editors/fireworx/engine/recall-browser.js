// Recall navigation is local until ENTER. Missing names use archive GET.
// ENTER invokes the guarded native recall loader; previews never change sound.
import {presetBanks,presetAddress,presetLocation} from './preset-library-model.js';
import {factoryPresetInfo} from './factory-presets.js';
export const recallFields=['preset','bank','filter'];
export function recallInventory(records){
 const result=new Map();
 for(const r of [...records].sort((a,b)=>(a.at??'').localeCompare(b.at??''))){
  if(!presetBanks.some(b=>b.id===r.bank))continue;
  for(let i=0;i<(r.status==='empty'?r.count:1);i++){
   const preset=r.preset+i;let location;try{location=presetLocation(preset);}catch{continue;}
   if(location.bank!==r.bank)break;
   result.set(preset,{...r,...location,preset,count:1,rangePreset:r.status==='empty'?(r.rangePreset??r.preset):undefined});
  }
 }
 return result;
}
export function createRecallBrowser({getCurrent,getInventory,readPreset,loadPreset,families,familyFor,onChange,onNotice,readDelay=500}){
 let active=false,field='preset',bank='factory',slot=1,filter='',records=new Map(),pending=false,loading=false,entering=false,inventoryPromise=null,inventoryEpoch=0,timer=null,reading=false,disposed=false,error='',failedKey=null,allowRead=false;
 const bankInfo=()=>presetBanks.find(b=>b.id===bank),key=()=>presetAddress(bank,slot);
 const matches=r=>r?.status==='decoded'&&(!filter||r.nodes.some(n=>familyFor(n.algorithm).id===filter));
 const slots=()=>filter?[...records.values()].filter(r=>r.bank===bank&&matches(r)).map(r=>r.slot).sort((a,b)=>a-b):Array.from({length:bankInfo().count},(_,i)=>i+1);
 const changed=()=>{if(!disposed)onChange();};
 function schedule(){clearTimeout(timer);timer=null;if(!active||!allowRead||disposed||loading||entering||inventoryPromise||records.has(key())||failedKey===key())return;timer=setTimeout(()=>{timer=null;void read();},readDelay);}
 async function read(options){
  if(reading||!active||loading||disposed)return;
  const requested=key();if(records.has(requested)||failedKey===requested)return;
  reading=true;error='';changed();
  try{const r=await readPreset(bank,slot,options);if(!r){failedKey=requested;if(active&&key()===requested)onNotice('Preset non lu : connectez le FireworX ou ouvrez une copie dans la bibliothèque.');return;}if(r.preset!==requested)throw Error('Réponse à une autre adresse de preset');records=recallInventory([...records.values(),r]);}
  catch(e){failedKey=requested;if(active&&key()===requested){error=e.message;onNotice(e.message);}}
  finally{reading=false;changed();if(active&&key()!==requested)schedule();}
 }
 async function inventory(){
  if(!inventoryPromise){const epoch=++inventoryEpoch;inventoryPromise=Promise.resolve().then(getInventory).then(next=>{if(epoch===inventoryEpoch&&!disposed){records=recallInventory([...records.values(),...next]);changed();}}).catch(e=>{if(!disposed){error=e.message;onNotice(e.message);}}).finally(()=>{inventoryPromise=null;schedule();});}
  return inventoryPromise;
 }
 function start(nextField=field){
  if(loading)return onNotice('Chargement en cours ; attendez la relecture');allowRead=true;
  if(!active){const source=getCurrent()?.source;bank=presetBanks.some(b=>b.id===source?.bank)?source.bank:bank;slot=source?.bank===bank?source.slot:slot;slot=Math.max(1,Math.min(bankInfo().count,slot));active=true;pending=false;error='';void inventory();}
  if(recallFields.includes(nextField))field=nextField;changed();schedule();
 }
 function turn(which,delta){
  if(loading||!Number.isInteger(delta)||!delta)return;
  start();
  if(which==='PARAMETER'){field=recallFields[((recallFields.indexOf(field)+delta)%3+3)%3];changed();return;}
  if(which!=='VALUE')return;
  if(field==='bank'){const i=presetBanks.findIndex(b=>b.id===bank);bank=presetBanks[Math.max(0,Math.min(presetBanks.length-1,i+delta))].id;slot=Math.min(slot,bankInfo().count);}
  else if(field==='filter'){const list=['',...families.map(f=>f.id)];filter=list[Math.max(0,Math.min(list.length-1,list.indexOf(filter)+delta))];const candidates=slots();if(candidates.length&&!candidates.includes(slot))slot=candidates[0];}
  else{const candidates=slots();if(candidates.length){const i=candidates.indexOf(slot);slot=candidates[Math.max(0,Math.min(candidates.length-1,(i<0?(delta>0?-1:0):i)+delta))];}}
  pending=true;error='';failedKey=null;changed();schedule();
 }
 return {
  start,turn,
  selectSlot(value){if(loading||entering)throw Error('Chargement en cours ; attendez la relecture');start('preset');if(!Number.isInteger(value)||value<1||value>bankInfo().count)throw Error(`Numéro de preset : 1 à ${bankInfo().count}`);if(filter&&!slots().includes(value))throw Error('Ce numéro ne correspond pas au filtre actif');slot=value;pending=true;error='';failedKey=null;changed();schedule();},
  preview(record){if(loading||!presetBanks.some(b=>b.id===record?.bank))return;allowRead=false;bank=record.bank;slot=record.slot;active=true;pending=true;field='preset';filter='';error='';if(record.status!=='unread'&&record.status!=='failed')records=recallInventory([...records.values(),record]);changed();void inventory();},
  get snapshot(){const current=getCurrent()??{},r=active?records.get(key()):null,info=active?factoryPresetInfo({bank,slot}):null;return {active,field,bank,slot,filter,filterLabel:families.find(f=>f.id===filter)?.name??'OFF',pending,loading:loading||entering,reading,record:r,error,catalogueName:active&&!r&&!!info,name:active?(filter&&!slots().length?'Aucune copie filtrée':r?.name??info?.name??'Preset non lu'):current.name,alphaText:active?r?.alphaText??'':current.alphaText,source:active?{bank,slot}:current.source,canLoad:active&&!loading&&!entering&&matches(r),parameter:recallFields.indexOf(field),value:field==='bank'?presetBanks.findIndex(b=>b.id===bank):field==='filter'?['',...families.map(f=>f.id)].indexOf(filter):slot,minimum:field==='preset'?1:0,maximum:field==='preset'?bankInfo().count:field==='bank'?2:families.length,valueText:field==='bank'?bankInfo().label:field==='filter'?(families.find(f=>f.id===filter)?.name??'OFF'):`${slot} / ${bankInfo().count}`};},
  async enter(){
   if(loading||entering)return;start();clearTimeout(timer);timer=null;entering=true;changed();
   const requested=key(),selectedFilter=filter,valid=()=>!disposed&&active&&requested===key()&&selectedFilter===filter;
   try{
    await inventoryPromise;if(!valid())return;clearTimeout(timer);timer=null;
    while(reading){await new Promise(r=>setTimeout(r,25));if(!valid())return;}
    let r=records.get(requested);
    if(filter&&!matches(r)){onNotice('Aucune copie lue ne correspond au filtre sélectionné.');return;}
    if(!r){failedKey=null;await read({connect:true});if(!valid())return;r=records.get(requested);}
    if(r?.status!=='decoded'){if(!error)onNotice(r?.status==='empty'?'Emplacement vide ; aucun preset chargé.':'Données du preset indisponibles ; aucun chargement envoyé.');return;}
    loading=true;changed();await loadPreset(r);active=false;pending=false;error='';
   }
   catch(e){error=e.message;onNotice(e.message);}
   finally{loading=false;entering=false;changed();schedule();}
  },
  loaded(){if(entering&&!loading)return;active=false;pending=false;filter='';error='';failedKey=null;clearTimeout(timer);timer=null;changed();},
  cancel(){if(loading)return onNotice('Chargement déjà engagé ; attendez la relecture');active=false;pending=false;error='';clearTimeout(timer);timer=null;changed();},
  refreshInventory(){return inventory();},
  dispose(){disposed=true;inventoryEpoch++;clearTimeout(timer);}
 };
}
