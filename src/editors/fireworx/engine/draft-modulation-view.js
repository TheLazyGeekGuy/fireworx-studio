// Semantic draft modulation: local intentions only, no invented MIDI addresses/transforms.
import {modifiers,findAlgorithm} from './catalog.js';
import {editableControlsFor} from './parameters.js';
import {validateStudy} from './study-model.js';
import {modulationSources,sourceKey} from './modulation-codec.js';
import {modulationSourcesShelf} from './modulation-sources.js';
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
 container.innerHTML=`<article class="device-engine modulation-engine draft-modulation"><header><strong>Modulations</strong><span>${state.links.length} / 20 liens locaux</span></header>${modulationSourcesShelf({used})}<p class="mod-help">Brouillon local : destinations sémantiques ; réglages de transformation matériels disponibles sur une copie de preset.</p><details class="mod-new" open><summary>Ajouter un lien</summary><div class="mod-create"><label>Source<select id="draft-mod-source">${sources('Alpha Mod')}</select></label><label>Destination<select id="draft-mod-destination">${destinations('')}</select></label><button id="draft-mod-create" ${state.links.length>=20||!targets.length?'disabled':''}>Créer le lien</button></div></details><div id="draft-mod-records">${state.links.map((l,slot)=>`<section class="mod-record" data-draft-mod-slot="${slot}"><header><button class="mod-link-handle" data-mod-link-drag="${slot}" draggable="${!l.inactive}" ${l.inactive?'disabled':''} aria-label="Déplacer le lien ${slot+1}">⠿</button><strong>Lien ${slot+1}</strong><span>${esc(l.source)} → ${esc(findAlgorithm(l.algorithm).name)} · ${esc(l.parameter)} ${l.inactive?'(inactif)':''}</span><button data-draft-mod-delete="${slot}">Retirer</button></header><details><summary>Source et destination</summary><div class="mod-create"><label>Source<select data-draft-mod-source="${slot}">${sources(l.source)}</select></label><label>Destination<select data-draft-mod-destination="${slot}">${destinations(JSON.stringify([l.node,l.parameter]))}</select></label><button data-draft-mod-apply="${slot}">Réaffecter</button></div></details></section>`).join('')||'<p class="helper">Aucun lien dans ce brouillon.</p>'}</div></article>`;
 const safe=fn=>{try{fn();}catch(e){onNotice(e.message);}};
 container.querySelector('#draft-mod-create').onclick=()=>safe(()=>{const source=modulationSources.find(s=>draftSourceName(sourceKey(s))===container.querySelector('#draft-mod-source').value);commit(applyDraftModTarget(state,draftModDescriptor(state,{source:sourceKey(source)}),container.querySelector('#draft-mod-destination').value));});
 container.querySelectorAll('[data-draft-mod-delete]').forEach(b=>b.onclick=()=>{const next=structuredClone(state);next.links.splice(Number(b.dataset.draftModDelete),1);commit(next);});
 container.querySelectorAll('[data-draft-mod-apply]').forEach(b=>b.onclick=()=>safe(()=>{const slot=Number(b.dataset.draftModApply),key=container.querySelector(`[data-draft-mod-destination="${slot}"]`).value,next=applyDraftModTarget(state,draftModDescriptor(state,{slot}),key);next.links[slot].source=container.querySelector(`[data-draft-mod-source="${slot}"]`).value;commit(next);}));
}
