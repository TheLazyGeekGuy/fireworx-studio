// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {readModulation,sourceKey,destinationKey} from '../engine/modulation-codec.js';
import {performanceKind} from '../engine/performance-bindings.js';
export function create_modulation_feedback(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// Presentation only: input telemetry is separate from preset bytes and DSP state.



 function modulationFeedback(buffer,observations={}){
 return readModulation(buffer).filter(r=>r.connected).map(r=>{
  const kind=performanceKind(r.source),observation=kind?observations[kind]:null;
  const known=!!observation&&Number.isInteger(observation.value)&&observation.value>=0&&observation.value<=127;
  const input=known?observation.value/127:null;
  // Anchor interpolation is a visual reference, NOT TC's undocumented Slope,
  // Glide, Alpha Response/Bounce, parameter law or actual instantaneous DSP output.
  const reference=input===null?null:input<=.5?r.low+(r.mid-r.low)*input*2:r.mid+(r.high-r.mid)*(input-.5)*2;
  return {slot:r.slot,source:sourceKey(r.source),short:r.sourceInfo?.short??'?',destination:destinationKey(r.destinationInfo??r.destination),known,input,reference,observation:known?{...observation}:null,internal:!kind};
 });
}

const explanation='Repère linéaire Low/Mid/High, sans simulation de Slope, Glide ni de la réponse Alpha. Ce pourcentage n’est pas une valeur effective relue du DSP. La valeur de base du paramètre reste inchangée.';
const originText=o=>o?.direction==='rx'?'MIDI reçu':o?.direction==='tx'?'Ordre MIDI':'Valeur inconnue';
const referenceText=r=>r.known?`${r.short} ${r.observation.value}/127 · repère ≈ ${Math.round(r.reference)} %`:r.internal?'Source interne · valeur non transmise':'En attente de MIDI';
 function createModulationFeedbackView({getBuffer,getObservations,root=document}){
 // MIDI activity in the matrix (owner request 2026-10-21): a new value from a source flashes its row, and the cell and
 // column of every parameter it modulates; the block parameter it drives flashes too.
 const seen=new Map();
 function flash(el){if(!el)return;el.classList.remove('mm-live');void el.offsetWidth;el.classList.add('mm-live');clearTimeout(el.__mmLive);el.__mmLive=setTimeout(()=>el.classList.remove('mm-live'),350);}
 function flashActivity(rows,observations){
  for(const [kind,o] of Object.entries(observations??{})){
   if(!o||!Number.isInteger(o.value))continue;const stamp=`${o.value}:${o.at??''}:${o.direction??''}`;if(seen.get(kind)===stamp)continue;const first=!seen.has(kind);seen.set(kind,stamp);if(first&&o.at===undefined)continue;
   const key=kind==='alpha'?'20:0':/^ext[1-8]$/.test(kind)?`21:${Number(kind.slice(3))-1}`:null;if(!key)continue;
   flash(root.querySelector(`.mod-matrix tr[data-mm-row="${key}"]>th`));
   for(const r of rows.filter(r=>r.source===key)){
    const cell=root.querySelector(`.mod-matrix .mm-grid [data-mm-link="${r.slot}"]`)?.closest('td');flash(cell);
    if(cell){const head=cell.closest('table')?.tHead?.rows[1]?.cells[cell.cellIndex-1];flash(head);}
    for(const el of root.querySelectorAll('[data-mod-target]'))if(el.dataset.modTarget===r.destination)flash(el);
   }
  }
 }
 function paint(){
  const buffer=getBuffer();if(!buffer)return;
  const observations=getObservations(),rows=modulationFeedback(buffer,observations);
  flashActivity(rows,observations);
  for(const el of root.querySelectorAll('[data-mod-source-pick]')){
   const key=el.dataset.modSourcePick,sourceRows=rows.filter(r=>r.source===key),kind=key==='20:0'?'alpha':/^21:[0-7]$/.test(key)?`ext${Number(key.split(':')[1])+1}`:null,o=kind?observations[kind]:null;
   let meter=el.querySelector('.mod-source-live');if(!meter){meter=document.createElement('output');meter.className='mod-source-live';meter.setAttribute('aria-live','off');el.append(meter);}
   meter.textContent=o?`${o.value}/127`:kind?'—':'';meter.title=o?`${originText(o)} · ${o.origin}`:kind?'Aucune valeur reçue pour cette source':'Valeur interne non transmise';el.classList.toggle('mod-source-observed',!!o);el.style.setProperty('--mod-source-position',`${o?o.value/127*100:0}%`);
   // An unlinked source still shows its latest CC, independent of selection.
   meter.hidden=!kind;el.dataset.modLinkedCount=String(sourceRows.length);
  }
  for(const r of rows){
   const record=root.querySelector(`[data-mod-slot="${r.slot}"]`);
   if(record){
    let status=record.querySelector('.mod-live-status');if(!status){status=document.createElement('output');status.className='mod-live-status';status.setAttribute('aria-live','off');const head=record.querySelector('header');head.insertBefore(status,head.querySelector('[data-mod-delete]'));}
    status.textContent=`${referenceText(r)}${r.known?` · ${originText(r.observation)}`:''}`;status.title=explanation;status.dataset.modLive=String(r.slot);status.dataset.known=String(r.known);
    const svg=record.querySelector('[data-mod-curve]');if(svg){
     let marker=svg.querySelector('.mod-live-marker');if(!marker){marker=document.createElementNS('http://www.w3.org/2000/svg','g');marker.classList.add('mod-live-marker');const line=document.createElementNS(marker.namespaceURI,'line'),dot=document.createElementNS(marker.namespaceURI,'circle');line.setAttribute('y1','5');line.setAttribute('y2','110');dot.setAttribute('r','4');marker.append(line,dot);svg.append(marker);}
     marker.style.display=r.known?'':'none';if(r.known){const x=10+r.input*200,y=110-r.reference;marker.querySelector('line').setAttribute('x1',x);marker.querySelector('line').setAttribute('x2',x);marker.querySelector('circle').setAttribute('cx',x);marker.querySelector('circle').setAttribute('cy',y);}
    }
   }
   // The gesture controller owns assignment badges. This view only adds telemetry.
   for(const el of root.querySelectorAll('[data-mod-target]'))if(el.dataset.modTarget===r.destination){
    el.classList.toggle('mod-value-observed',r.known);el.style.setProperty('--mod-input-position',`${r.known?r.input*100:0}%`);
    let out=el.querySelector('.parameter-mod-live');if(!out){out=document.createElement('output');out.className='parameter-mod-live';out.setAttribute('aria-live','off');el.append(out);}
    out.textContent=referenceText(r);out.title=`${r.known?originText(r.observation)+'. ':''}${explanation}`;out.dataset.modLive=String(r.slot);out.dataset.known=String(r.known);
   }
  }
  const alpha=rows.filter(r=>r.source==='20:0');
  for(const el of root.querySelectorAll('[data-alpha-link]')){
   const r=alpha[Number(el.dataset.alphaLink)];if(!r)continue;
   let out=el.querySelector('.alpha-link-live');if(!out){out=document.createElement('output');out.className='alpha-link-live';out.setAttribute('aria-live','off');el.append(out);}
   out.textContent=referenceText(r);out.title=explanation;
  }
  for(const el of root.querySelectorAll('.parameter-mod-live'))if(!rows.some(r=>String(r.slot)===el.dataset.modLive&&r.destination===el.parentElement.dataset.modTarget)){el.parentElement.classList.remove('mod-value-observed');el.remove();}
 }
 return {paint};
}

return {modulationFeedback,createModulationFeedbackView};
}
