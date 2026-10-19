// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {fieldTargets,modulationDescriptor,modulationBasis} from '../engine/modulation-targets.js';
import {draftModTargets,draftModDescriptor,draftModBasis,draftSourceName} from '../engine/draft-modulation-view.js';
import {modulationSources,sourceKey,destinationKey,readModulation,linkLabels} from '../engine/modulation-codec.js';
import {findAlgorithm} from '../engine/catalog.js';
export function create_modulation_gestures(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// One delegated pointer/keyboard/HTML5 drag controller; no MIDI ownership.




 const modulationDragType='application/x-midi-studio-fireworx-modulation';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function createModulationGestures({getContext,activateSignals,selectBlock,apply,openLink,openDestination,onNotice}){
 let pending=null,dragging=null,hoverTimer=null,hoverKey=null;
 const lifecycle=new AbortController(),listen=(type,fn,extra={})=>document.addEventListener(type,fn,{signal:lifecycle.signal,...extra});
 document.body.insertAdjacentHTML('beforeend','<dialog id="mod-target-dialog" class="mod-target-dialog" aria-labelledby="mod-target-title"><header><h2 id="mod-target-title">Choisir le paramètre</h2><button id="mod-target-close" aria-label="Annuler l’affectation">×</button></header><p id="mod-target-source"></p><div id="mod-target-options"></div></dialog>');
 const chooser=document.getElementById('mod-target-dialog');
 const signature=c=>c.kind==='preset'?modulationBasis(c.buffer):draftModBasis(c.state);
 const descriptor=(c,selection)=>({...c.kind==='preset'?modulationDescriptor(c.buffer,selection):draftModDescriptor(c.state,selection),mode:c.kind});
 const nodes=c=>c.kind==='preset'?c.buffer.nodes.filter(n=>n.row<c.buffer.rows):c.state.nodes.filter(n=>n.row<c.state.rows);
 function targets(c,id){
  const n=nodes(c).find(n=>n.id===id);if(!n)return [];
  if(c.kind==='preset')return fieldTargets(c.buffer,n).map(({field,destination})=>{const link=readModulation(c.buffer).find(r=>r.connected&&destinationKey(r.destinationInfo??r.destination)===destinationKey(destination));return {key:destinationKey(destination),label:field.displayLabel,selector:`[data-wire-field="${CSS.escape(field.id)}"]`,link:link?{slot:link.slot,label:link.sourceInfo?.short??'?',description:linkLabels(c.buffer,link).source}:null};});
  return draftModTargets(c.state,n).map(t=>{const slot=c.state.links.findIndex(l=>!l.inactive&&l.node===n.id&&l.parameter===t.label),link=c.state.links[slot];return {...t,selector:`[data-id="${CSS.escape(n.id)}"][data-control="${t.index}"],[data-id="${CSS.escape(n.id)}"][data-choice="${t.index}"]`,link:link?{slot,label:link.source,description:link.source}:null};});
 }
 function name(d,c=getContext()){
  if(!d)return '';if(d.kind==='source')return modulationSources.find(s=>sourceKey(s)===d.source)?.label??'';
  return c.kind==='preset'?`Lien ${d.slot+1} · ${linkLabels(c.buffer,readModulation(c.buffer)[d.slot]).source}`:`Lien ${d.slot+1} · ${c.state.links[d.slot]?.source??''}`;
 }
 function paint(){
  document.body.classList.toggle('modulation-assigning',!!pending||!!dragging);
  const label=document.getElementById('mod-assignment-state'),cancel=document.getElementById('mod-assignment-cancel');
  if(label){label.hidden=!pending;label.textContent=pending?`${name(pending)} → choisir une cible`:'';}
  if(cancel){cancel.hidden=!pending;cancel.onclick=()=>cancelAssignment();}
 }
 function cancelAssignment(){pending=dragging=null;clearTimeout(hoverTimer);hoverKey=null;document.querySelectorAll('.mod-drop-hover').forEach(el=>el.classList.remove('mod-drop-hover'));if(chooser.open)chooser.close();paint();}
 function valid(d,c){return !!d&&d.mode===c.kind&&d.basis===signature(c)&&!c.disabled;}
 function decorate(){
  const c=getContext();if(pending&&!valid(pending,c))cancelAssignment();
  document.querySelectorAll('#editors [data-mod-target]').forEach(el=>{delete el.dataset.modTarget;el.classList.remove('mod-assignable');el.querySelector('.parameter-modulation')?.remove();});
  if(!c.disabled&&!c.utility)for(const t of targets(c,c.selected)){
   const field=document.querySelector('#editors')?.querySelector(t.selector),wrap=field?.closest('.parameter');if(!wrap)continue;
   wrap.dataset.modTarget=t.key;wrap.classList.add('mod-assignable');const b=document.createElement('button');b.type='button';b.className='parameter-modulation';b.dataset.modTargetButton=t.key;
   if(t.link){b.dataset.parameterModLink=String(t.link.slot);b.textContent=t.link.label;b.setAttribute('aria-label',`${t.label} · ${t.link.description} · ouvrir le lien ${t.link.slot+1}`);b.dataset.hint=`${t.link.description} → ${t.label} · cliquer pour modifier le lien`;}else{b.textContent='↗';b.setAttribute('aria-label',`Affecter une modulation à ${t.label}`);b.dataset.hint=`${t.label} · déposer une source ou cliquer pour affecter`;}
   wrap.append(b);
  }
  paint();
 }
 function pick(selection,drag=false){const c=getContext();if(c.disabled)throw Error('Modulation en lecture seule ou connexion occupée');const d=descriptor(c,selection);pending=d;if(drag)dragging=d;else{activateSignals();requestAnimationFrame(()=>document.querySelector('#editors .parameter-modulation')?.focus());onNotice(`${name(d,c)} : cliquez sur un paramètre assignable ou sur un bloc.`);}paint();return d;}
 function commit(key,d=pending){
  try{const c=getContext();if(!valid(d,c))throw Error('Le preset a changé ou l’édition est indisponible ; recommencez');apply(d,key);cancelAssignment();onNotice('Affectation de modulation appliquée · les autres liens sont conservés.');}
  catch(e){onNotice(e.message);if(!valid(d,getContext()))cancelAssignment();}
 }
 function chooseBlock(id,d=pending){
  const c=getContext();if(!valid(d,c)){cancelAssignment();return onNotice('Référence modifiée : recommencez l’affectation');}
  pending=d;dragging=null;activateSignals();selectBlock(id);const current=getContext(),list=targets(current,id),n=nodes(current).find(n=>n.id===id);
  document.getElementById('mod-target-source').textContent=`${name(d,current)} → ${n?findAlgorithm(n.algorithm).name:''}`;
  const options=document.getElementById('mod-target-options');options.innerHTML=list.map(t=>`<button type="button" data-mod-choose="${esc(t.key)}">${esc(t.label)}${t.link?`<small>${esc(t.link.description)} · remplacer la source</small>`:''}</button>`).join('')||'<p>Aucune destination établie pour cet algorithme.</p>';
  options.querySelectorAll('[data-mod-choose]').forEach(b=>b.onclick=()=>commit(b.dataset.modChoose));if(!chooser.open)chooser.showModal();paint();
 }
 const blockAt=target=>target?.closest?.('[data-device-node],[data-edit-node],.cell[data-node]');
 const blockId=el=>el?.dataset.deviceNode??el?.dataset.editNode??el?.dataset.node;
 function scheduleHover(key,fn){if(hoverKey===key)return;clearTimeout(hoverTimer);hoverKey=key;hoverTimer=setTimeout(fn,180);}
 listen('dragstart',e=>{const source=e.target.closest?.('[data-mod-source-pick]'),link=e.target.closest?.('[data-mod-link-drag]');if(!source&&!link)return;try{const d=pick(source?{source:source.dataset.modSourcePick}:{slot:Number(link.dataset.modLinkDrag)},true);e.dataTransfer.setData(modulationDragType,JSON.stringify(d));e.dataTransfer.effectAllowed='all';}catch(err){e.preventDefault();onNotice(err.message);}}, {capture:true});
 const isModDrag=e=>!!dragging||[...(e.dataTransfer?.types??[])].includes(modulationDragType);
 const hover=e=>{
  if(!isModDrag(e))return;const target=e.target.closest?.('[data-mod-target]'),block=blockAt(e.target),tab=e.target.closest?.('[data-settings-page="signal"]');
  if(!target&&!block&&!tab){clearTimeout(hoverTimer);hoverKey=null;document.querySelectorAll('.mod-drop-hover').forEach(el=>el.classList.remove('mod-drop-hover'));return;}e.preventDefault();e.stopImmediatePropagation();e.dataTransfer.dropEffect='link';
  document.querySelectorAll('.mod-drop-hover').forEach(el=>el.classList.toggle('mod-drop-hover',el===target||el===block));(target??block)?.classList.add('mod-drop-hover');
  if(tab)scheduleHover('signal',activateSignals);else if(block){const id=blockId(block);scheduleHover(id,()=>{activateSignals();selectBlock(id);});}else{clearTimeout(hoverTimer);hoverKey=null;}
 };
 listen('dragenter',hover,{capture:true});listen('dragover',hover,{capture:true});
 listen('drop',e=>{
  if(!isModDrag(e))return;e.preventDefault();e.stopImmediatePropagation();clearTimeout(hoverTimer);hoverKey=null;
  try{const d=dragging??JSON.parse(e.dataTransfer.getData(modulationDragType)),target=e.target.closest?.('[data-mod-target]'),block=blockAt(e.target);dragging=null;pending=d;if(target)commit(target.dataset.modTarget,d);else if(block)chooseBlock(blockId(block),d);else cancelAssignment();}catch(err){cancelAssignment();onNotice(err.message);}
 },{capture:true});
 listen('dragend',()=>{if(dragging)cancelAssignment();},{capture:true});
 listen('pointerdown',e=>{if(pending&&e.target.closest?.('[data-mod-target]')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 listen('click',e=>{
  const source=e.target.closest?.('[data-mod-source-pick]'),link=e.target.closest?.('[data-mod-link-drag]');
  if(source||link){e.preventDefault();e.stopImmediatePropagation();try{pick(source?{source:source.dataset.modSourcePick}:{slot:Number(link.dataset.modLinkDrag)});}catch(err){onNotice(err.message);}return;}
  const target=e.target.closest?.('[data-mod-target]'),badge=e.target.closest?.('[data-mod-target-button]'),block=blockAt(e.target);
  if(pending&&(target||block)){e.preventDefault();e.stopImmediatePropagation();if(target)commit(target.dataset.modTarget);else chooseBlock(blockId(block));return;}
  if(badge){e.preventDefault();e.stopImmediatePropagation();if(badge.dataset.parameterModLink!==undefined)openLink(Number(badge.dataset.parameterModLink));else openDestination(badge.dataset.modTargetButton);}
 },{capture:true});
 listen('keydown',e=>{if(e.key==='Escape'&&(pending||dragging)){e.preventDefault();cancelAssignment();}},{capture:true});
 document.getElementById('mod-target-close').onclick=cancelAssignment;chooser.addEventListener('cancel',e=>{e.preventDefault();cancelAssignment();});window.addEventListener('pagehide',cancelAssignment);
 return {decorate,cancel:cancelAssignment,dispose(){cancelAssignment();lifecycle.abort();chooser.remove();}};
}

return {modulationDragType,createModulationGestures};
}
