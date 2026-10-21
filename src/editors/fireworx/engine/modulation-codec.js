// Independent implementation; pinned third-party observations, not a universal CC map.
import {deviceMap} from './device-codec.js';
export const modulationSources=deviceMap.modulation.sources;
export const sourceKey=s=>`${s.cat}:${s.sub}`;
export const destinationKey=d=>`${d.block}:${d.instance}:${d.param}`;
const start=1126,stride=12;
const subtypedDocuments=new Set(deviceMap.fields.filter(f=>f.selector).map(f=>f.documentId));
export function modulationDestinations(buffer){
 const result=[];
 for(const page of deviceMap.modulation.pages){
  // Global analogue-level targets have not been independently established here.
  if(page.modifier==='Global')continue;
  let engines=[];
  if(page.group===0){const block={ADSR:24,LFO:25,Freeform:27,Function:28}[page.modifier];if(!block)continue;
   engines=Array.from({length:page.modifier==='Freeform'?1:2},(_,instance)=>({block,instance,label:`${page.modifier} ${instance+1}`}));
  // A family without a sub-type selector group (Formant, Pitch) owns all its pages whatever its
  // page `subtypes`: the pinned corpus census lists their destinations under subtype None
  // (e.g. Formant 10103 in 47 presets, Pitch 4100 in 36), Factory 7 links 1 and 4 included.
  }else if(page.block>=7){engines=buffer.nodes.filter(n=>n.blockTypeId===page.block&&(!page.subtypes||!subtypedDocuments.has(deviceMap.algorithms[n.algorithm].document)||page.subtypes.includes(deviceMap.algorithms[n.algorithm].variant))).map(n=>({block:page.block,instance:n.instanceIndex,label:`${page.block_name} ${n.instanceIndex+1}`}));
  }else if(buffer.cells.some(c=>c.type===page.block&&c.row<buffer.rows))engines=[{block:page.block,instance:0,label:page.block_name}];
  for(const engine of engines)for(const p of page.params)if(p.valid&&p.label&&p.status!=='unnamed')result.push({...engine,param:p.dest_id,field:p.field,element:p.element,parameter:p.label,label:`${engine.label} · ${p.label}`,modifier:page.modifier??null,provenance:p.status});
 }
 return [...new Map(result.map(d=>[destinationKey(d),d])).values()];
}
/** Parameters of the preset's blocks that the unit does not accept as modulation targets: their derived ids were left at
 * ordinal 0 by the device on upload (third-party live check). Display only: shown greyed in the matrix, never written. */
export function lockedModulationDestinations(buffer){
 const open=new Set(modulationDestinations(buffer).map(destinationKey)),result=[];
 for(const page of deviceMap.modulation.pages){
  if(page.modifier==='Global'||page.group===0)continue;
  let engines=[];
  if(page.block>=7)engines=buffer.nodes.filter(n=>n.blockTypeId===page.block&&(!page.subtypes||!subtypedDocuments.has(deviceMap.algorithms[n.algorithm].document)||page.subtypes.includes(deviceMap.algorithms[n.algorithm].variant))).map(n=>({block:page.block,instance:n.instanceIndex,label:`${page.block_name} ${n.instanceIndex+1}`}));
  for(const engine of engines)for(const p of page.params)if(!p.valid&&p.label){const d={...engine,param:p.dest_id,parameter:p.label,label:`${engine.label} · ${p.label}`};if(!open.has(destinationKey(d)))result.push(d);}
 }
 return [...new Map(result.map(d=>[destinationKey(d),d])).values()];
}
export function readModulation(buffer){
 const p=buffer.payload??buffer,destinations=buffer.payload?modulationDestinations(buffer):[];
 return Array.from({length:20},(_,slot)=>{const o=start+slot*stride,cat=p[o+6],sub=p[o+7],dest={block:p[o+8],instance:p[o+9],param:p[o+10]*256+p[o+11]};
  const connected=cat>=20&&cat<=28&&dest.param!==0;
  return {slot,connected,source:{cat,sub},destination:dest,sourceInfo:modulationSources.find(s=>s.cat===cat&&s.sub===sub)??null,destinationInfo:destinations.find(d=>destinationKey(d)===destinationKey(dest)||dest.param<1000&&d.param===dest.param&&d.instance===dest.instance)??null,
   low:p[o],mid:p[o+1],high:p[o+2],slope:p[o+3]>127?p[o+3]-256:p[o+3],glide:p[o+4],ordinal:p[o+5]};
 });
}
// Labels for every connected link, decoded or not: a link is never hidden (#71).
export function linkLabels(buffer,record){
 const {source:s,destination:d}=record;
 const known=deviceMap.modulation.pages.flatMap(p=>p.params.filter(x=>x.dest_id===d.param&&(p.block===d.block||p.group===0&&{ADSR:24,LFO:25,Freeform:27,Function:28}[p.modifier]===d.block)).map(x=>({page:p,param:x})))[0];
 const source=record.sourceInfo?.label??`Source non décodée (catégorie ${s.cat}, ${s.sub})`;
 const global=!known&&deviceMap.modulation.pages.find(p=>p.modifier==='Global')?.params.find(x=>x.dest_id===d.param);
 const destination=record.destinationInfo?.label??(known&&known.param.label?`${known.page.block_name??known.page.modifier} ${d.instance+1} · ${known.param.label} — moteur ou variante absent de la matrice`:global?`Global · ${global.label} — cible globale non établie dans l’éditeur (bloc ${d.block}, param ${d.param})`:`Destination non décodée (bloc ${d.block}, instance ${d.instance}, param ${d.param})`);
 return {source,destination,sourceDecoded:!!record.sourceInfo,destinationDecoded:!!record.destinationInfo};
}
function slotOffset(slot){if(!Number.isInteger(slot)||slot<0||slot>=20)throw Error('Lien hors des 20 emplacements');return start+slot*stride;}
function sourceDestination(buffer,source,dest,slot){
 if(!source||!dest)throw Error('Choisissez une source et une destination établies');
 if(!modulationSources.some(s=>sourceKey(s)===sourceKey(source)))throw Error('Source inconnue');
 const d=modulationDestinations(buffer).find(d=>destinationKey(d)===destinationKey(dest));if(!d)throw Error('Destination absente ou non établie');
 const sameModifier=source.cat===d.block||(source.cat===26&&d.block===25);
 if(d.modifier&&sameModifier&&source.sub===d.instance)throw Error('Un modulateur ne peut se moduler lui-même');
 if(readModulation(buffer).some(r=>r.connected&&r.slot!==slot&&(destinationKey(r.destination)===destinationKey(d)||d.param<1000&&r.destination.param===d.param&&r.destination.instance===d.instance)))throw Error('Cette destination possède déjà une source');
 return d;
}
export function createModulation(buffer,source,dest){
 const free=readModulation(buffer).find(r=>!r.connected);if(!free)throw Error('Les 20 liens sont occupés');
 const d=sourceDestination(buffer,source,dest,free.slot),p=buffer.payload.slice(),o=slotOffset(free.slot);
 p.set([0,50,100,0,10,0,source.cat,source.sub,d.block,d.instance,d.param>>8,d.param&255],o);return p;
}
export function assignModulation(buffer,slot,source,dest){
 if(!readModulation(buffer)[slot]?.connected)throw Error('Lien inactif');const d=sourceDestination(buffer,source,dest,slot),p=buffer.payload.slice(),o=slotOffset(slot);
 p.set([0,source.cat,source.sub,d.block,d.instance,d.param>>8,d.param&255],o+5);return p;
}
export function deleteModulation(buffer,slot){const p=buffer.payload.slice(),o=slotOffset(slot);p.set([0,20,0,0,0,0,0],o+5);return p;}
export function clearModulations(buffer){let p=buffer.payload.slice();for(const r of readModulation(buffer))if(r.connected)p=deleteModulation({...buffer,payload:p},r.slot);return p;}
export function transformModulation(buffer,slot,field,value){
 const rules={low:[0,0,100],mid:[1,0,100],high:[2,0,100],slope:[3,-90,90],glide:[4,0,30]},rule=rules[field],o=slotOffset(slot);
 if(!readModulation(buffer)[slot].connected||!rule||!Number.isInteger(value)||value<rule[1]||value>rule[2])throw Error('Transformation hors domaine');
 const p=buffer.payload.slice();p[o+rule[0]]=value&255;return p;
}
export const glideMilliseconds=raw=>10**(raw/10);
export function modulationTransformControls(buffer){
 return readModulation(buffer).filter(r=>r.connected).flatMap(r=>[['low','Low',0,100],['mid','Mid',0,100],['high','High',0,100],['slope','Slope',-90,90],['glide','Glide',0,30]].map(([field,label,min,max],index)=>({id:`modulation.${r.slot}.${field}`,slot:r.slot,linkField:field,displayLabel:`Lien ${r.slot+1} · ${label}`,fieldName:field,offset:1126+r.slot*12+index,width:1,type:field==='slope'?'i8':'u8',range:[min,max],editable:true,enc:field==='slope'?'tenths':field==='glide'?'logtime':'pct',unit:field==='glide'?'ms':'%'})));
}
