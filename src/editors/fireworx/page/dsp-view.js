// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {dspBudgetState,assertDspTransition,dspCeilingMargin} from '../engine/dsp-policy.js';
import {deviceDspEstimate,compareDspObservation,estimateAlgorithmCost} from '../engine/dsp-model.js';
import {findAlgorithm} from '../engine/catalog.js';
export function create_dsp_view(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;
const {dspPreferences}=dependencies.dsp_preferences;
const {dspBanner,bindDspCeiling}=dependencies.dsp_banner;





const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function createDspInspector({getBuffer,onNotice}){
 let container=null;const estimate=buffer=>{const m=deviceDspEstimate(buffer);return {...m,...dspBudgetState(m.estimated,dspPreferences.ceiling)};};
 const $=id=>document.getElementById(id),reference=compareDspObservation(79,72),labels={ok:'RÉSERVE DISPONIBLE',high:'RÉSERVE FAIBLE',limit:'CAPACITÉ ESTIMÉE ATTEINTE',reserve:'MARGE DÉPASSÉE',overload:'SURCHARGE ESTIMÉE',unknown:'CHARGE INCOMPLÈTE'};
 document.body.insertAdjacentHTML('beforeend',`<dialog id="dsp-inspector" class="library-dialog dsp-inspector" aria-label="Charge DSP FireworX"><header><h2>Charge DSP</h2><button id="dsp-close">Fermer ×</button></header><div id="dsp-summary"></div><label>Réserve choisie (points sur 100)<input id="dsp-reserve" type="number" min="-8" max="99" step="1" value="${100-dspPreferences.ceiling}"></label><p>Réglage commun à la chaîne et au randomiseur. Plafond = 100 − réserve ; une réserve négative autorise jusqu’à 108 % estimés. Aucune correction du modèle ni du mode DSP matériel.</p><table><thead><tr><th>Bloc / instance</th><th>Estimation</th></tr></thead><tbody id="dsp-entries"></tbody></table><details><summary>Estimation et mesure</summary><p>Comparaison communiquée : 79 % estimés, 72 % sur TOOL → DSP LOAD. Écart de +${reference.differencePoints} points, soit +${reference.relativeErrorPercent.toFixed(1)} %. Autre relevé communiqué : User 1, 86 % estimés pour 78 % affichés (+8 points). Ces repères ne sont pas une calibration des autres patches.</p><p>Pour relever un coût : conserver fréquence et configuration, noter TOOL → DSP LOAD sans le bloc, puis avec une instance. Répéter et comparer les deux valeurs ; tester les options qui changent la charge.</p><p>Le modèle additionne les instances, y compris les blocs muets et parallèles. Les coûts sont indicatifs et sensibles au contexte. Aucun compteur DSP matériel reçu. L’Overflow audio est distinct.</p></details></dialog>`);
 const storageKey='fireworx-dsp-observations-v1';let observations=[];
 try{const saved=JSON.parse(localStorage.getItem(storageKey)??'[]');if(Array.isArray(saved))observations=saved.filter(r=>r&&['patch','algorithm'].includes(r.kind)&&/^[0-9a-f]{64}$/.test(r.payloadSha256)&&Number.isFinite(Date.parse(r.at))).slice(-100);}catch{}
 $('dsp-inspector').insertAdjacentHTML('beforeend',`<details id="dsp-manual"><summary>Consigner des relevés TOOL → DSP LOAD</summary><p>Relevés saisis manuellement et associés à la capture ouverte. Aucun appel MIDI. Le modèle global reste inchangé.</p><label>Fréquence du relevé<select id="dsp-sample-rate"><option value="48000">48 kHz</option><option value="44100">44,1 kHz</option></select></label><div class="dsp-record-row"><label>Charge totale affichée (%)<input id="dsp-observed" type="number" min="0" max="100" step="0.1" placeholder="72"></label><button id="dsp-record-patch">Associer le relevé à la capture</button></div><hr><p>Coût par algorithme : même fréquence, routage et options. Relever la charge sans le bloc, puis avec N instances. Trois paires au minimum donnent un repère plus utile.</p><div class="dsp-record-grid"><label>Algorithme présent<select id="dsp-algorithm"></select></label><label>Instances ajoutées<input id="dsp-instances" type="number" min="1" max="8" step="1" value="1"></label><label>Charges sans bloc<input id="dsp-before" placeholder="12;12;12"></label><label>Charges avec bloc<input id="dsp-after" placeholder="35;35;35"></label></div><p>Valeurs séparées par « ; ». Le coût retenu est la médiane des différences divisées par N.</p><label>Options / contexte du relevé<input id="dsp-context" maxlength="240" placeholder="Options, qualité, configuration identique…"></label><button id="dsp-record-cost">Calculer et conserver le coût observé</button><p id="dsp-record-status" role="status"></p></details><section class="dsp-observations"><div><h3>Relevés locaux</h3><button id="dsp-export">Exporter les relevés JSON</button></div><div id="dsp-observations"></div></section>`);
 const readings=s=>s.trim().split(/[;\s]+/).filter(Boolean).map(v=>Number(v.replace(',','.')));
 function renderObservations(){
  $('dsp-export').disabled=!observations.length;
  $('dsp-observations').innerHTML=observations.slice(-5).reverse().map(r=>`<article><strong>${esc(r.kind==='patch'?`${r.name} · ${r.observed} % saisis`:`${findAlgorithm(r.algorithm)?.name??r.algorithm} · ≈ ${Number(r.estimatedUnitCost).toFixed(1)} % / instance`)}</strong><small>${esc(new Date(r.at).toLocaleString('fr-FR'))} · ${r.sampleRate/1000} kHz · ${r.kind==='patch'?`estimation ${r.estimated??'?'} %`:`${r.samples} paire(s), dispersion ${r.spreadPoints} pts`}</small><small>Capture ${r.payloadSha256.slice(0,16)}… · relevé manuel, non reçu par MIDI</small></article>`).join('')||'<p>Aucun relevé enregistré.</p>';
 }
 async function record(kind){
  try{
   const buffer=getBuffer();if(!buffer)throw Error('Ouvrez une capture avant de consigner un relevé');const snapshot=buffer.payload.slice(),name=buffer.name,sampleRate=Number($('dsp-sample-rate').value);let value;if(![44100,48000].includes(sampleRate))throw Error('Fréquence du relevé invalide');
   if(kind==='patch'){const observed=$('dsp-observed').valueAsNumber;if(!Number.isFinite(observed)||observed<0||observed>100)throw Error('Charge affichée de 0 à 100 % requise');const estimated=deviceDspEstimate(buffer).estimated;value={observed,estimated,comparison:estimated===null?null:compareDspObservation(estimated,observed),provenance:'user-entered TOOL DSP LOAD; not MIDI telemetry'};}
   else value=estimateAlgorithmCost({before:readings($('dsp-before').value),after:readings($('dsp-after').value),instances:$('dsp-instances').valueAsNumber,sampleRate,algorithm:$('dsp-algorithm').value,context:$('dsp-context').value.trim()});
   const payloadSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',snapshot)),b=>b.toString(16).padStart(2,'0')).join('');const next=[...observations,{kind,at:new Date().toISOString(),name,payloadSha256,sampleRate,...value}].slice(-100);
   localStorage.setItem(storageKey,JSON.stringify(next));observations=next;renderObservations();$('dsp-record-status').textContent=kind==='patch'?'Relevé manuel associé à cette capture ; modèle inchangé.':`Coût observé ≈ ${value.estimatedUnitCost.toFixed(1)} % par instance ; modèle inchangé.`;
  }catch(e){$('dsp-record-status').textContent=e.message;}
 }
 $('dsp-record-patch').onclick=()=>void record('patch');$('dsp-record-cost').onclick=()=>void record('algorithm');
 $('dsp-export').onclick=()=>{const data={schema:1,scope:'Manual local observations; no MIDI telemetry or automatic calibration',observations},url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fireworx-dsp-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function render(target=container){container=target;if(!container||!getBuffer())return;const m=estimate(getBuffer());
  container.innerHTML=dspBanner(m.estimated);bindDspCeiling(container,onNotice);
  $('dsp-open').onclick=()=>{detail();$('dsp-inspector').showModal();};if($('dsp-inspector').open)detail();
 }
 function detail(){const m=estimate(getBuffer());$('dsp-reserve').value=String(100-dspPreferences.ceiling);$('dsp-summary').innerHTML=`<div class="dsp-number dsp-${m.state}"><strong>≈ ${m.estimated??'?'} %</strong><span>${labels[m.state]}</span></div><meter min="0" max="${Math.max(100,m.ceiling)}" value="${Math.min(Math.max(100,m.ceiling),m.estimated??0)}"></meter><p>${m.estimated===null?'Certains blocs ne disposent pas de coût établi.':`${m.headroom<0?'Dépassement estimé de '+(-m.headroom):m.headroom+' points de réserve estimée'} · plafond ${m.ceiling} %, ${dspCeilingMargin(m.ceiling)}.`} Valeur non mesurée.</p>`;
  $('dsp-entries').innerHTML=m.entries.map(e=>`<tr><td>${esc(e.algorithm?findAlgorithm(e.algorithm).name+' '+(e.instance+1):({1:'Pipeline',3:'Feedback Return',4:'Feedback Send',5:'Insert Return',6:'Insert Send'}[e.type]??'Routage'))}${e.muted?' · muet, alloué':''}</td><td>${e.cost??'?'} %</td></tr>`).join('');
  const algorithm=$('dsp-algorithm').value;$('dsp-algorithm').innerHTML=[...new Set(getBuffer().nodes.map(n=>n.algorithm))].map(id=>`<option value="${esc(id)}">${esc(findAlgorithm(id).name)}</option>`).join('');if(getBuffer().nodes.some(n=>n.algorithm===algorithm))$('dsp-algorithm').value=algorithm;renderObservations();
 }
 $('dsp-reserve').onchange=()=>{try{dspPreferences.set(100-$('dsp-reserve').valueAsNumber);}catch(e){$('dsp-reserve').value=String(100-dspPreferences.ceiling);onNotice(e.message);}};$('dsp-close').onclick=()=>$('dsp-inspector').close();
 const unsubscribe=dspPreferences.subscribe(()=>{render();if($('dsp-inspector').open&&getBuffer())detail();});
 return {render,dispose:unsubscribe,check(buffer,before){const m=estimate(buffer);if(before)assertDspTransition(deviceDspEstimate(before).estimated,m.estimated,dspPreferences.ceiling);if(m.state!=='ok')onNotice(m.state==='overload'?`Surcharge estimée : ${m.estimated} %. Le matériel n’a pas confirmé cette charge.`:m.state==='reserve'?`Plafond ${m.ceiling} % dépassé ; charge existante conservée ou réduite.`:m.state==='unknown'?'Estimation DSP incomplète.':`Charge estimée ${m.estimated} % : ${labels[m.state].toLowerCase()}.`);return m;}};
}

return {createDspInspector};
}
