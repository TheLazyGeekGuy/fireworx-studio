// Model of what the P0 editor view shows for a decoded buffer, and of every received byte it
// does not show. Pure, no MIDI or DOM. Shared by verify-ui-coverage.mjs, the inert audit
// docs/audits/fireworx-2026-10-17/factory-ui-coverage.mjs and the DOM scenario's expectations.
import {deviceMap,controlsForDevice,readField,formatDeviceValue,representableValue} from './device-codec.js';
import {readModulation,linkLabels} from './modulation-codec.js';
import {undecodedBytes,undecodedEntries} from './undecoded-bytes.js';
// Same utility scopes as device-view.js (modulators and routing nodes).
export const utilityScopes=[['meters','common.dyn_led_meter'],['alpha','modifiers.alpha_mod[0].'],['lfo1','modifiers.lfo[0].'],['lfo2','modifiers.lfo[1].'],['adsr1','modifiers.adsr[0].'],['adsr2','modifiers.adsr[1].'],['freeform','modifiers.freeform[0].'],['function1','modifiers.function[0].'],['function2','modifiers.function[1].'],['pitch-detect','modifiers.pitch_detect[0].'],['env1','modifiers.env_detect[0].'],['env2','modifiers.env_detect[1].'],...[0,1,2,3].map(i=>[`route-${i}`,`common.nodes[${i}].`])];
const span=f=>Array.from({length:f.width||1},(_,i)=>f.offset+i);
const records=Object.entries(deviceMap.defaults).flatMap(([doc,d])=>Array.from({length:d.count},(_,instance)=>({doc,instance,start:d.base+instance*d.stride,end:d.base+(instance+1)*d.stride})));
const recordAt=o=>records.find(r=>o>=r.start&&o<r.end);
const fieldsAt=new Map();for(const f of deviceMap.fields)for(const o of span(f))(fieldsAt.get(o)??fieldsAt.set(o,[]).get(o)).push(f);
const holesAt=new Map();for(const e of undecodedEntries)(holesAt.get(e.offset)??holesAt.set(e.offset,[]).get(e.offset)).push(e);
const control=(b,f)=>{const v=readField(b,f);return {id:f.id,label:f.displayLabel??f.label,value:v,text:formatDeviceValue(f,v),editable:!!f.editable,representable:representableValue(f,v)};};
export function uiCoverage(b){
 const p=b.payload,shown=new Set(),notRepresentable=[],activeRecords=new Set();
 for(let o=0;o<173;o++)shown.add(o); // header, name, Alpha text, matrix and grid size are displayed
 for(let t=7;t<=18;t++)shown.add(171+t); // per-family instance mute bits
 const engines=b.nodes.map(node=>{
  const a=deviceMap.algorithms[node.algorithm];activeRecords.add(records.find(r=>r.doc===a.document&&r.instance===node.instanceIndex));
  const controls=controlsForDevice(b,node).map(f=>{span(f).forEach(o=>shown.add(o));return control(b,f);});
  const sel=a.selector&&deviceMap.fields.find(f=>f.id===a.selector.replace('.inst[0]',`.inst[${node.instanceIndex}]`));if(sel)span(sel).forEach(o=>shown.add(o));
  const undecoded=undecodedBytes(b,node);undecoded.forEach(e=>shown.add(e.offset));
  notRepresentable.push(...controls.filter(c=>!c.representable).map(c=>`${c.id}=${c.value}`));
  return {id:node.id,algorithm:node.algorithm,instance:node.instanceIndex,col:node.col,row:node.row,muted:node.muted,controls,undecoded:undecoded.map(({offset,value,label})=>({offset,value,label}))};
 });
 const utilities=utilityScopes.map(([id,scopePrefix])=>{
  const controls=controlsForDevice(b,{scopePrefix}).map(f=>{span(f).forEach(o=>shown.add(o));return control(b,f);}),undecoded=undecodedBytes(b,{scopePrefix});
  undecoded.forEach(e=>shown.add(e.offset));notRepresentable.push(...controls.filter(c=>!c.representable).map(c=>`${c.id}=${c.value}`));
  return {id,scopePrefix,controls,undecoded:undecoded.map(({offset,value,label})=>({offset,value,label}))};
 });
 const globalUndecoded=undecodedBytes(b,{scope:'global'});globalUndecoded.forEach(e=>shown.add(e.offset));
 const links=readModulation(b).filter(l=>l.connected).map(l=>{for(let o=1126+l.slot*12;o<1138+l.slot*12;o++)shown.add(o);return {slot:l.slot,...linkLabels(b,l)};});
 const gaps={activeUnmapped:[],activeHiddenField:[],activeOtherVariant:0,dormantRecord:0,unusedLinkSlot:0,derivedPresence:0,globalHiddenField:[],unmappedOutside:[]};
 for(let o=0;o<1366;o++){
  if(shown.has(o)||!p[o])continue;
  const rec=recordAt(o),fs=fieldsAt.get(o)??[],hs=holesAt.get(o)??[];
  const inactive=x=>x.condition&&p[x.condition.offset]!==x.condition.value;
  if(rec&&activeRecords.has(rec)){
   if(!fs.length&&!hs.length)gaps.activeUnmapped.push(`${o}=${p[o]}`);
   else if([...fs,...hs].every(inactive))gaps.activeOtherVariant++;
   else gaps.activeHiddenField.push([...new Set([...fs.map(f=>f.id),...hs.map(h=>h.label)])].join('|')+`=${p[o]}`);
  }else if(rec)gaps.dormantRecord++;
  else if(o>=1126)gaps.unusedLinkSlot++;
  else if(o>=190&&o<206)gaps.derivedPresence++; // presence masks derived from the matrix (finish/derive)
  else if(fs.length||hs.length)gaps.globalHiddenField.push([...new Set([...fs.map(f=>f.id),...hs.map(h=>h.label)])].join('|')+`@${o}=${p[o]}`);
  else gaps.unmappedOutside.push(`${o}=${p[o]}`);
 }
 const speeds=['modifiers.lfo[0].speed','modifiers.lfo[1].speed','modifiers.freeform[0].speed'].map(id=>utilities.flatMap(u=>u.controls).find(c=>c.id===id)??{id,missing:true});
 return {preset:b.preset,name:b.name,alphaText:b.alphaText,rows:b.rows,unknownCells:b.unknown.length,engines,utilities,globalUndecoded:globalUndecoded.map(({offset,value,label})=>({offset,value,label})),links,speeds,notRepresentable,gaps,
  undecodedLinks:links.filter(l=>!l.sourceDecoded||!l.destinationDecoded).length,
  undecodedShownNonZero:[...engines,...utilities].reduce((n,x)=>n+x.undecoded.filter(e=>e.value).length,0)+globalUndecoded.filter(e=>e.value).length};
}
export function coverageSummary(reports){
 const sum=f=>reports.reduce((n,r)=>n+f(r),0),gap=k=>sum(r=>Array.isArray(r.gaps[k])?r.gaps[k].length:r.gaps[k]);
 return {presets:reports.length,engines:sum(r=>r.engines.length),controls:sum(r=>r.engines.reduce((m,e)=>m+e.controls.length,0)),utilityControls:sum(r=>r.utilities.reduce((m,u)=>m+u.controls.length,0)),unknownCells:sum(r=>r.unknownCells),notRepresentable:sum(r=>r.notRepresentable.length),
  links:sum(r=>r.links.length),undecodedLinks:sum(r=>r.undecodedLinks),speedsMissing:sum(r=>r.speeds.filter(s=>s.missing).length),undecodedShownNonZero:sum(r=>r.undecodedShownNonZero),
  nonZeroNotShown:Object.fromEntries(['activeUnmapped','activeHiddenField','activeOtherVariant','globalHiddenField','unmappedOutside','derivedPresence','dormantRecord','unusedLinkSlot'].map(k=>[k,gap(k)]))};
}
