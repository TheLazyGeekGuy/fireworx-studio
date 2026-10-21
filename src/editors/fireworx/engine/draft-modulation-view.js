// Semantic draft modulation: local intentions only, no invented MIDI addresses/transforms.
import {modifiers,findAlgorithm} from './catalog.js';
import {editableControlsFor} from './parameters.js';
import {validateStudy} from './study-model.js';
import {modulationSources,sourceKey} from './modulation-codec.js';
import {renderModulationMatrix} from './modulation-matrix.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const draftSourceName=key=>{const s=modulationSources.find(s=>sourceKey(s)===key),name=s?.label.replace('Pitch detect','Pitch Detector').replace('Env detect','Envelope').replace('Line','Out');return modifiers.includes(name)?name:null;};
export const draftModBasis=s=>JSON.stringify({nodes:s.nodes,links:s.links,routes:s.routes,rows:s.rows});
export const draftModTargets=(state,node)=>editableControlsFor(node.algorithm).flatMap((c,index)=>c.modulatable&&c.manualStatus!=='unconfirmed'?[{key:JSON.stringify([node.id,c.label]),label:c.label,index,node:node.id}]:[]);
export function draftModDescriptor(state,{source,slot}={}){
 if(slot!==undefined){if(!state.links[slot]||state.links[slot].inactive)throw Error('Lien local inactif');return {schema:1,kind:'link',slot,basis:draftModBasis(state)};}
 if(!draftSourceName(source))throw Error('Source inconnue');return {schema:1,kind:'source',source,basis:draftModBasis(state)};
}
export function applyDraftModTarget(state,d,key){
 if(d?.schema!==1||d.basis!==draftModBasis(state))throw Error('Le brouillon a changé ; recommencez l’affectation');
 const target=state.nodes.filter(n=>n.row<state.rows).flatMap(n=>draftModTargets(state,n)).find(t=>t.key===key);if(!target)throw Error('Paramètre local non assignable');
 const n=state.nodes.find(n=>n.id===target.node),next=structuredClone(state),prior=next.links.findIndex(l=>l.node===n.id&&l.parameter===target.label);
 if(d.kind==='link'){if(!next.links[d.slot]||next.links[d.slot].inactive||prior!==-1&&prior!==d.slot)throw Error('La destination possède déjà une source');Object.assign(next.links[d.slot],{node:n.id,algorithm:n.algorithm,parameter:target.label});}
 else if(d.kind==='source'){const source=draftSourceName(d.source);if(!source)throw Error('Source inconnue');if(prior>=0)next.links[prior].source=source;else{if(next.links.length>=20)throw Error('Les 20 liens sont occupés');next.links.push({source,node:n.id,algorithm:n.algorithm,parameter:target.label});}}
 else throw Error('Affectation invalide');
 return validateStudy({kind:'midi-studio-fireworx-offline-study',hardware:false,...next});
}
export function renderDraftModulations(container,{state,commit,onNotice}){
 const targets=state.nodes.filter(n=>n.row<state.rows).flatMap(n=>draftModTargets(state,n)),used=state.links.map(l=>({source:modulationSources.find(s=>draftSourceName(sourceKey(s))===l.source)??{}}));
 const sources=selected=>modifiers.map(s=>`<option ${s===selected?'selected':''}>${esc(s)}</option>`).join('');
 const destinations=selected=>targets.map(t=>`<option value="${esc(t.key)}" ${t.key===selected?'selected':''}>${esc(findAlgorithm(state.nodes.find(n=>n.id===t.node).algorithm).name)} · ${esc(t.label)}</option>`).join('');
 // Design decision 2026-10-21: the matrix alone (no sources shelf, separate form or per-link cards).
 container.innerHTML=`<article class="device-engine modulation-engine draft-modulation"><header><strong>Modulations</strong><span>${state.links.length} / 20 liens locaux</span></header><div class="mod-matrix-host"></div><p class="mod-help">Brouillon local : destinations sémantiques ; réglages de transformation matériels disponibles sur une copie de preset.</p></article>`;
 const safe=fn=>{try{fn();}catch(e){onNotice(e.message);}};
 // Matrix view of the same local links: rows = sources, columns = assignable parameters of the chain's blocks.
 const keyOf=name=>{const s=modulationSources.find(s=>draftSourceName(sourceKey(s))===name);return s?sourceKey(s):`draft:${name}`};
 const nodeName=new Map(),seen=new Map();for(const n of state.nodes.filter(n=>n.row<state.rows)){const name=findAlgorithm(n.algorithm).name,k=(seen.get(name)??0)+1;seen.set(name,k);nodeName.set(n.id,`${name} ${k}`);}
 // Parameters the FireworX does not modulate stay visible, greyed, with the reason (manual TC, modulation column).
 const locked=state.nodes.filter(n=>n.row<state.rows).flatMap(n=>editableControlsFor(n.algorithm).filter(c=>!(c.modulatable&&c.manualStatus!=='unconfirmed')).map(c=>({key:`locked:${JSON.stringify([n.id,c.label])}`,group:nodeName.get(n.id)??'',label:c.label,locked:true,reason:c.modulatable?'modulation non confirmée par le manuel':'non modulable sur le FireworX (manuel)'})));
 const order=new Map(state.nodes.map((n,i)=>[nodeName.get(n.id),i]));
 const columns=[...targets.map(t=>({key:t.key,group:nodeName.get(t.node)??'',label:t.label})),...locked].sort((a,b)=>(order.get(a.group)??0)-(order.get(b.group)??0)||Number(!!a.locked)-Number(!!b.locked)),known=new Set(columns.filter(c=>!c.locked).map(c=>c.key));
 renderModulationMatrix(container.querySelector('.mod-matrix-host'),{memoryKey:container,
  sources:modulationSources.map(s=>({key:sourceKey(s),label:draftSourceName(sourceKey(s))??s.label})),columns,
  links:state.links.map((l,i)=>{const column=JSON.stringify([l.node,l.parameter]);return {id:i,source:keyOf(l.source),column:known.has(column)?column:null,transform:l.transform??{low:0,mid:50,high:100,slope:0,glide:10},sourceLabel:l.source,columnLabel:`${nodeName.get(l.node)??findAlgorithm(l.algorithm)?.name??'Bloc absent'} · ${l.parameter}`};}),
  onCreate:(source,column)=>safe(()=>commit(applyDraftModTarget(state,draftModDescriptor(state,{source}),column))),
  onAssign:(id,source)=>safe(()=>{const name=draftSourceName(source);if(!name)throw Error('Source inconnue');const next=structuredClone(state);next.links[id].source=name;commit(validateStudy({kind:'midi-studio-fireworx-offline-study',hardware:false,...next}));}),
  onDelete:id=>{const next=structuredClone(state);next.links.splice(id,1);commit(next);},
  // Link page (manual p.32): Low / Mid / High = parameter value at the source's minimum, middle and maximum; Slope, Glide.
  onTransform:(id,field,value)=>safe(()=>{const next=structuredClone(state),link=next.links[id];link.transform={...(link.transform??{low:0,mid:50,high:100,slope:0,glide:10}),[field]:value};commit(validateStudy({kind:'midi-studio-fireworx-offline-study',hardware:false,...next}));})});
 container.querySelectorAll('[data-draft-mod-delete]').forEach(b=>b.onclick=()=>{const next=structuredClone(state);next.links.splice(Number(b.dataset.draftModDelete),1);commit(next);});
 container.querySelectorAll('[data-draft-mod-apply]').forEach(b=>b.onclick=()=>safe(()=>{const slot=Number(b.dataset.draftModApply),key=container.querySelector(`[data-draft-mod-destination="${slot}"]`).value,next=applyDraftModTarget(state,draftModDescriptor(state,{slot}),key);next.links[slot].source=container.querySelector(`[data-draft-mod-source="${slot}"]`).value;commit(next);}));
}
