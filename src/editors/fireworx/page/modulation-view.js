// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {lockedModulationDestinations,modulationSources,sourceKey,destinationKey,modulationDestinations,readModulation,createModulation,assignModulation,deleteModulation,clearModulations,transformModulation,glideMilliseconds,linkLabels} from '../engine/modulation-codec.js';
import {bindValueEntry} from '../engine/value-entry.js';
import {renderModulationMatrix} from '../engine/modulation-matrix.js';
export function create_modulation_view(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;
const {bindRotary,dialAngle}=dependencies.rotary;




const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function renderModulationEditor(container,{getBuffer,edit,onNotice,openPerformance,openModifier,disabled=false,onSelect=()=>{}}){
 const buffer=getBuffer(),records=readModulation(buffer),destinations=modulationDestinations(buffer),used=records.filter(r=>r.connected),readonly=disabled||buffer.preset!==0;
 const sources=selected=>modulationSources.map(s=>`<option value="${sourceKey(s)}" ${sourceKey(s)===selected?'selected':''}>${s.label}</option>`).join('');
 const dests=selected=>destinations.map(d=>`<option value="${destinationKey(d)}" ${destinationKey(d)===selected?'selected':''}>${esc(d.label)}</option>`).join('');
 const source=v=>modulationSources.find(s=>sourceKey(s)===v),destination=v=>destinations.find(d=>destinationKey(d)===v);
 // Design decision 2026-10-21: the matrix alone (source focus, link detail with Low/Mid/High/Slope/Glide, new link,
 // links table); the sources shelf, the separate « Ajouter un lien » form and the per-link cards are gone.
 container.innerHTML=`<article class="device-engine modulation-engine"><header><strong>Matrice de modulation</strong><span>${used.length} / 20 liens</span><button id="mod-performance">Alpha / Ext / CTRL</button></header><div class="mod-matrix-host"></div></article>`;
 const safely=fn=>{try{fn();}catch(e){onNotice(e.message);}};
 container.querySelector('.modulation-engine>header').insertAdjacentHTML('beforeend',`<button id="mod-clear-all" ${readonly||!used.length?'disabled':''}>Effacer tous les liens</button><label id="mod-clear-confirm" hidden><input type="checkbox"> Confirmer la suppression des ${used.length} liens du preset</label><button id="mod-clear-apply" hidden disabled>Confirmer l’effacement</button>`);
 container.querySelector('#mod-clear-all').onclick=()=>{container.querySelector('#mod-clear-confirm').hidden=false;container.querySelector('#mod-clear-apply').hidden=false;};
 container.querySelector('#mod-clear-confirm input').onchange=e=>{container.querySelector('#mod-clear-apply').disabled=readonly||!e.target.checked;};
 container.querySelector('#mod-clear-apply').onclick=()=>safely(()=>{if(!container.querySelector('#mod-clear-confirm input').checked)throw Error('Confirmez l’effacement des liens');edit(clearModulations,true);});
 container.querySelector('#mod-performance').onclick=openPerformance;
 container.querySelectorAll('[data-mod-delete]').forEach(el=>el.onclick=()=>safely(()=>edit(b=>deleteModulation(b,Number(el.dataset.modDelete)),true)));
 container.querySelectorAll('[data-mod-assign]').forEach(el=>el.onclick=()=>safely(()=>{const slot=Number(el.dataset.modAssign);edit(b=>assignModulation(b,slot,source(container.querySelector(`[data-mod-source="${slot}"]`).value),destination(container.querySelector(`[data-mod-destination="${slot}"]`).value)),true);}));
 function sync(slot){const r=readModulation(getBuffer())[slot];for(const field of ['low','mid','high','slope','glide']){const key=`${slot}:${field}`,dial=container.querySelector(`[data-mod-dial="${key}"]`),input=container.querySelector(`[data-mod-value="${key}"]`),output=container.querySelector(`[data-mod-output="${key}"]`);if(!input)continue;input.value=r[field];dial.style.setProperty('--dial-angle',`${dialAngle(r[field],field==='slope'?-90:0,field==='glide'?30:field==='slope'?90:100)}deg`);dial.setAttribute('aria-valuenow',r[field]);output.textContent=field==='slope'?(r[field]/10).toFixed(1):field==='glide'?`${Math.round(glideMilliseconds(r[field]))} ms ≈`:`${r[field]} %`;}
  container.querySelector(`[data-mod-curve="${slot}"] polyline`)?.setAttribute('points',`10,${110-r.low} 110,${110-r.mid} 210,${110-r.high}`);
 }
 let redrawMatrix=()=>{};
 function update(key,value){safely(()=>{const [slot,field]=key.split(':');edit(b=>transformModulation(b,Number(slot),field,value),false,key);sync(Number(slot));redrawMatrix();});}
 const ranges={low:[0,100],mid:[0,100],high:[0,100],slope:[-90,90],glide:[0,30]};
 container.querySelectorAll('[data-mod-value]').forEach(editor=>{
  const key=editor.dataset.modValue,[slot,field]=key.split(':'),output=container.querySelector(`[data-mod-output="${key}"]`),[min,max]=ranges[field];
  bindValueEntry({value:output,editor,disabled:()=>editor.disabled,get:()=>{const raw=readModulation(getBuffer())[Number(slot)][field];return field==='glide'?Number(glideMilliseconds(raw).toPrecision(4)):field==='slope'?raw/10:raw;},parse:text=>{const s=text.trim().replace(',','.').replace(/\s*(ms|%)$/i,''),v=s===''?NaN:Number(s),raw=field==='glide'?Math.round(10*Math.log10(v)):field==='slope'?Math.round(v*10):v;if(!Number.isFinite(v)||!Number.isInteger(raw)||raw<min||raw>max)throw Error('Valeur du lien hors domaine');return raw;},set:v=>update(key,v),onError:onNotice});
 });
 container.querySelectorAll('[data-mod-dial]').forEach(el=>{const key=el.dataset.modDial,[slot,field]=key.split(':'),[min,max]=ranges[field];bindRotary(el,{get:()=>readModulation(getBuffer())[Number(slot)][field],min,max,set:v=>update(key,v)});});
 container.querySelectorAll('[data-mod-dial],[data-mod-value],[data-mod-output]').forEach(el=>el.onfocus=()=>{const [slot,field]=(el.dataset.modDial??el.dataset.modValue??el.dataset.modOutput).split(':');onSelect(Number(slot),field);});
 used.forEach(r=>sync(r.slot));
 // Matrix view of the same 20 links (sources × destinations of the preset's blocks), with the link transforms.
 // Codec block ids read as names: "chorus_flanger 1" → "Chorus / Flanger 1" (display only).
 const pretty=text=>String(text).replace(/^([a-z][a-z_]*)(?= \d)/,m=>m.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' / '));
 const drawMatrix=()=>{const current=getBuffer(),linksNow=readModulation(current).filter(r=>r.connected);renderModulationMatrix(container.querySelector('.mod-matrix-host'),{memoryKey:container,readonly,localStorage,
  sources:modulationSources.map(s=>({key:sourceKey(s),label:s.label})),
  columns:[...destinations.map(d=>({key:destinationKey(d),group:pretty(d.label.split(' · ')[0]),label:d.parameter})),
   ...lockedModulationDestinations(current).map(d=>({key:`locked:${destinationKey(d)}`,group:pretty(d.label.split(' · ')[0]),label:d.parameter,locked:true,reason:'refusé par l’appareil comme cible de modulation (identifiant non reconnu au chargement)'}))]
   .map((c,i,all)=>({c,i,g:all.findIndex(x=>x.group===c.group)})).sort((a,b)=>a.g-b.g||Number(!!a.c.locked)-Number(!!b.c.locked)||a.i-b.i).map(x=>x.c),
  links:linksNow.map(r=>{const names=linkLabels(current,r);return {id:r.slot,source:sourceKey(r.source),column:r.destinationInfo?destinationKey(r.destinationInfo):null,sourceLabel:names.source,columnLabel:pretty(names.destination),transform:{low:r.low,mid:r.mid,high:r.high,slope:r.slope,glide:r.glide}};}),
  onCreate:(sk,ck)=>safely(()=>edit(b=>createModulation(b,source(sk),destination(ck)),true)),
  onAssign:(slot,sk)=>safely(()=>{const r=readModulation(getBuffer())[slot];edit(b=>assignModulation(b,slot,source(sk),r.destinationInfo??destination(destinationKey(r.destination))),true);}),
  onDelete:slot=>safely(()=>edit(b=>deleteModulation(b,slot),true)),
  onTransform:(slot,field,value)=>{update(`${slot}:${field}`,value);},
  // Row label → that modifier's own parameters (manual: Modifiers page); Ext 1–8 are set up on the I/O SETUP CTRL page.
  onOpenSource:openModifier?key=>{const [cat,sub]=key.split(':').map(Number),id=cat===20?'alpha':cat===21?'setup':cat===22?'pitch-detect':cat===23?`env${sub+1}`:cat===24?`adsr${sub+1}`:cat===25||cat===26?`lfo${sub+1}`:cat===27?'freeform':cat===28?`function${sub+1}`:null;if(id)openModifier(id);}:undefined});};
 // Knob drags on the link cards redraw the matrix once per frame at most.
 let pendingDraw=false;redrawMatrix=()=>{if(pendingDraw)return;pendingDraw=true;requestAnimationFrame(()=>{pendingDraw=false;if(container.isConnected)drawMatrix();});};drawMatrix();
 return {sync};
}

return {renderModulationEditor};
}
