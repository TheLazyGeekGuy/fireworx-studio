import {dspCeilingMargin} from '../engine/dsp-policy.js';
import {localCorpus} from '../engine/local-corpus.js';
import nameWords from '../data/preset-name-words-v1.json';
// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {createPresetNameRegistry,nameRandomizerResult,presetFilename} from '../engine/preset-names.js';
import {compositionNodeStatus} from '../engine/randomizer-composition.js';
import {randomizerSnapshot,randomizerRequest,createFireworxRandomizerAdapter,generateRandomizer,sha256} from '../engine/randomizer.js';
import {decodeDeviceBuffer,fieldById,formatDeviceValue} from '../engine/device-codec.js';
import {archivePreset} from '../engine/preset-json.js';
import {deviceDspEstimate} from '../engine/dsp-model.js';
import {findAlgorithm} from '../engine/catalog.js';
import {randomizerGroups,linkedGroup} from '../engine/randomizer-groups.js';
export function create_randomizer_view(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;
const {dspPreferences}=dependencies.dsp_preferences;



// Modal preview: generation/export are local. Only explicit Apply calls the injected editor.






const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={hardware:'M3 6h18v12H3zM6 10h.01M6 14h.01M10 10h8M10 14h8',local:'M3 4h18v13H3zM8 21h8m-4-4v4',dice:'M4 3h16v18H4zM8 7h.01M16 7h.01M12 12h.01M8 17h.01M16 17h.01',close:'m6 6 12 12M18 6 6 18',save:'M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-8h8v8',apply:'m5 12 4 4 10-10',stop:'M6 6h12v12H6z',replay:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'};
const icon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[k]}"/></svg>`;
const reasons={ 'dsp-budget':'Budget DSP estimé dépassé. Choisissez un preset plus léger ou allégez la chaîne.', 'unknown-cost':'Coût DSP inconnu.', 'no-donor':'Aucun groupe donneur compatible et déverrouillé. Les groupes modulés restent protégés.', 'no-proposal':'Aucun bloc ou raccordement modifiable avec les verrous et le budget actuels.', 'attempt-limit':'Limite de 100 essais atteinte.', 'proposal-limit':'Trop de propositions pour cette version.', 'draw-limit':'Limite des tirages atteinte.', 'invalid-graph':'Raccordement non valide.', 'invalid-codec':'Modification refusée par les règles du preset.', 'stale-base':'La référence a changé.', 'locked':'Réglages verrouillés.', 'empty-diff':'Aucun changement.', 'new-feedback':'Routage feedback / Insert modifié : proposition refusée.', 'opaque-data':'Données protégées.', 'incompatible-version':'Corpus et code incompatibles.' };
const download=(name,value)=>{const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
function thumbnail(b){const cells=b.cells.filter(c=>c.type&&c.row<b.rows),cols=Math.max(3,...cells.map(c=>c.col+1)),rows=Math.max(1,...cells.map(c=>c.row+1));return `<div class="randomizer-mini" data-fw-style="--columns:${cols}" role="img" aria-label="${b.nodes.length} moteurs, ${cols} colonnes">${Array.from({length:rows*cols},(_,i)=>{const c=cells.find(c=>c.col===i%cols&&c.row===Math.floor(i/cols)),n=c&&b.nodes.find(n=>n.id===c.node);return `<span class="${c?'occupied':''}" title="${esc(n?findAlgorithm(n.algorithm).name:c?'Pipeline':'Case vide')}">${esc(n?findAlgorithm(n.algorithm).name:c?'↔':'·')}</span>`;}).join('')}</div>`;}
 function createRandomizerView({getEditor,getKnownNames=async()=>[],getDonorFrames=async()=>[],apply,onNotice=()=>{}}){
 document.body.insertAdjacentHTML('beforeend',`<dialog id="randomizer-dialog" class="randomizer-dialog" aria-labelledby="randomizer-title"><header><div><p class="eyebrow">FIREWORX · VARIATIONS</p><h2 id="randomizer-title">Randomize</h2></div><button id="randomizer-close" aria-label="Fermer">${icon('close')}</button></header><div class="randomizer-options"><label>Source<select id="randomizer-source"></select></label><label>Variation<select id="randomizer-mode"><option value="parameters">Paramètres</option><option value="structure">Structure</option><option value="blocks">Blocs + routage</option></select></label><label>Seed<input id="randomizer-seed" type="number" min="0" max="4294967295" step="1" value="1"></label><button id="randomizer-new-seed" aria-label="Nouvelle seed" data-hint="Nouvelle seed reproductible">${icon('dice')}</button><label>Plafond DSP commun<input id="randomizer-budget" type="number" min="1" max="108" value="${dspPreferences.ceiling}"><small id="randomizer-budget-note">${dspCeilingMargin(dspPreferences.ceiling)}</small></label></div><details class="randomizer-locks"><summary>Verrouiller des blocs</summary><div id="randomizer-locks"></div><p class="randomizer-note">Niveaux, gains de feedback, algorithmes, options de ressources et liens conservés. Les groupes pilotés par modulation ne varient pas.</p></details><p id="randomizer-status" role="status">Preparing local copies…</p><div id="randomizer-preview" hidden></div><footer><label class="randomizer-destination">Destination<select id="randomizer-target"><option value="local">Copie locale</option><option value="hardware">FireworX · P0 temporaire</option></select></label><span id="randomizer-scope">Aperçu local · aucun MIDI</span><div><button id="randomizer-generate" aria-label="Générer un aperçu" data-hint="Générer un aperçu avec cette seed">${icon('dice')}<span>Générer l’aperçu</span></button><button id="randomizer-stop" aria-label="Arrêter la génération" data-hint="Arrêter la génération" hidden>${icon('stop')}</button><button id="randomizer-save" aria-label="Sauvegarder la variation en JSON" data-hint="Sauvegarder la variation complète" disabled>${icon('save')}</button><button id="randomizer-replay" aria-label="Exporter la recette reproductible" data-hint="Exporter seed, contraintes, essais et empreintes" disabled>${icon('replay')}</button><button id="randomizer-apply" aria-label="Appliquer la variation dans le FireworX P0" data-hint="Générez un aperçu pour activer l’envoi" aria-describedby="randomizer-scope" disabled>${icon('hardware')}<span>Appliquer dans P0</span></button></div></footer></dialog>`);
 const $=id=>document.getElementById('randomizer-'+id),dialog=$('dialog');
 let corpus=null,adapter=null,nameRegistry=null,base=null,sourceCurrent=false,result=null,editorVersion=null,controller=null,epoch=0,running=false,applying=false;
 const invalidate=()=>{result=null;$('preview').hidden=true;for(const k of ['apply','save','replay'])$(k).disabled=true;destinationState();};
 const abort=()=>{epoch++;controller?.abort();controller=null;running=false;$('generate').disabled=!base;$('stop').hidden=true;};
 const close=()=>{if(applying)return;abort();dialog.close();};
 function destinationState(){
  const hardware=$('target').value==='hardware',editor=getEditor();
  $('target').querySelector('[value="hardware"]').disabled=!editor.hardwareAvailable&&!editor.live;
  $('scope').textContent=applying?(hardware?'Contrôle → envoi → relecture · aucun STORE':'Ouverture locale…'):result?.status==='accepted'?(hardware?'Aperçu prêt · envoi P0 temporaire · aucun STORE':'Aperçu prêt · copie locale sans MIDI'):(hardware?'Générez l’aperçu, puis envoyez-le. Aucun STORE.':'Générez l’aperçu, puis ouvrez la copie locale.');
  const label=hardware?'Appliquer la variation dans le FireworX P0':'Ouvrir la variation en copie locale';$('apply').setAttribute('aria-label',label);$('apply').dataset.hint=label;$('apply').title=label;$('apply').innerHTML=icon(hardware?'hardware':'local')+`<span>${applying?(hardware?'Envoi en cours…':'Ouverture…'):(hardware?'Appliquer dans P0':'Ouvrir localement')}</span>`;
 }
 $('target').onchange=destinationState;
 async function ensureCorpus(signal){const current=getEditor().frame,frames=[...(current?[current]:[]),...await getDonorFrames()];const next=await localCorpus(frames,signal);if(!next.presets.length)throw Error('Import or read a complete preset before randomizing');corpus=next;adapter=createFireworxRandomizerAdapter(next);nameRegistry=createPresetNameRegistry(nameWords,{storage:localStorage});}

 function lockDescriptions(){if(!base||!corpus)return;const b=decodeDeviceBuffer(base.frame),blocks=[...$('locks').querySelectorAll('input:checked')].map(el=>el.value),request=randomizerRequest(base,corpus,{mode:'blocks',blocks,dspBudgetPoints:$('budget').valueAsNumber}),statuses=compositionNodeStatus(b,request);for(const el of $('locks').querySelectorAll('input')){const n=b.nodes.find(n=>n.id===el.value),small=el.parentElement.querySelector('small'),status=statuses.find(s=>s.id===n.id);if($('mode').value==='blocks')small.textContent=status.protected?'Conservé · verrou ou modulation':status.variants===null?'Algorithme modifiable':`${status.variants} variante(s) · routage conservé`;else{const gs=randomizerGroups(b,n);small.textContent=`${gs.filter(g=>!linkedGroup(b,n,g)).length} / ${gs.length} groupes disponibles`;}}}
 function budgetMode(){const parameters=$('mode').value==='parameters',cost=base?deviceDspEstimate(decodeDeviceBuffer(base.frame)).estimated:null;$('budget').disabled=applying;const frozen=$('mode').value==='blocks'&&base&&decodeDeviceBuffer(base.frame).cells.some(c=>c.type>=3&&c.type<=6);$('budget-note').textContent=parameters?`Paramètres : charge conservée${cost===null?'':` · ≈ ${cost} %`}`:frozen?`Routage conservé · plafond estimé ${Math.max(cost??0,$('budget').valueAsNumber)} % · source ${cost??'?'} %`:`${dspCeilingMargin(dspPreferences.ceiling)} · estimation prudente`;lockDescriptions();}
 function locks(){if(!base)return;const b=decodeDeviceBuffer(base.frame);$('locks').innerHTML=b.nodes.filter(n=>n.row<b.rows).map(n=>{const gs=randomizerGroups(b,n),ready=gs.filter(g=>!linkedGroup(b,n,g)).length;return `<label><input type="checkbox" value="${esc(n.id)}">${esc(findAlgorithm(n.algorithm).name)} ${n.instanceIndex+1}<small>${ready} / ${gs.length} groupes disponibles</small></label>`;}).join('');$('locks').querySelectorAll('input').forEach(el=>el.onchange=()=>{invalidate();lockDescriptions();});}
 async function selectSource(){
  abort();invalidate();base=null;$('generate').disabled=true;const run=++epoch;controller=new AbortController();const signal=controller.signal;
  try{
   const editor=getEditor();editorVersion=editor.token;sourceCurrent=$('source').value==='current';let frame;
   if(sourceCurrent){if(!editor.frame||!editor.ready)throw Error('Attendez la relecture P0 ou ouvrez une copie locale');frame=editor.frame;}
   else{const p=corpus.presets.find(p=>String(p.preset)===$('source').value);if(!p)throw Error('Preset source absent');frame=Uint8Array.from(p.frame);}

   const next=await randomizerSnapshot(frame);if(signal.aborted||run!==epoch)return;base=next;locks();budgetMode();
   const b=decodeDeviceBuffer(base.frame),cost=deviceDspEstimate(b).estimated;$('status').textContent=`${b.name} · ${b.nodes.length} moteurs · DSP estimé ${cost??'?'} %`;$('generate').disabled=false;destinationState();
  }catch(e){if(run===epoch&&!signal.aborted)$('status').textContent=e.message;}
 }
 function showResult(r){
  result=r;$('replay').disabled=false;
  if(r.status!=='accepted'){$('status').textContent=r.status==='cancelled'?'Génération arrêtée.':(r.reasons??[]).map(x=>reasons[x]??x).join(' ');return;}
  const before=decodeDeviceBuffer(base.frame),after=decodeDeviceBuffer(r.candidate.frame),v=r.validation;
  $('status').textContent=`DSP estimé ${v.estimatedDspPoints} %${v.preservedRouting?` (source ${deviceDspEstimate(before).estimated} % · plafond conservé ${v.estimatedCeiling} %)`:''} · ${after.nodes.length} moteurs · ${after.cells.filter(c=>c.type===1&&c.row<after.rows).length} liaison(s) · ${r.replay.request.mode==='parameters'?'charge conservée':v.estimatedDspPoints>100?`dépassement estimé +${v.estimatedDspPoints-100} pts · autorisé dans le plafond choisi`:`réserve ${100-v.estimatedDspPoints} points`} · ${v.preservedRouting?'routage feedback / Insert conservé · ':''}${r.replay.attempts.length} essai(s) · seed ${r.replay.request.seed}`;
  const value=(c,z)=>c.kind==='position'?(z?`C${z[0]+1}:L${z[1]+1}`:'Absent'):c.kind==='block'?(Object.hasOwn(corpus.algorithmNames??{},z)?corpus.algorithmNames[z]:['Absent','Retiré'].includes(z)?z:findAlgorithm(z)?.name??z):fieldById.has(c.target)?formatDeviceValue(fieldById.get(c.target),z):z;
  $('preview').innerHTML=`<p class="randomizer-name">Nouveau preset <strong>${esc(after.name)}</strong></p><div class="randomizer-comparison"><section><h3>Avant</h3>${thumbnail(before)}</section><section><h3>Proposition</h3>${thumbnail(after)}</section></div><ul>${v.changes.map(c=>`<li><strong>${esc(['block','position'].includes(c.kind)?findAlgorithm(c.label)?.name??c.label:c.label??c.target)}</strong><span>${esc(value(c,c.before))} → ${esc(value(c,c.after))}</span></li>`).join('')}</ul><p class="randomizer-note">Budget indicatif ; absence de surcharge et résultat audio non mesurés.</p>`;$('preview').hidden=false;$('apply').disabled=$('save').disabled=false;destinationState();
 }
 async function generate(){
  if(!base||running)return;invalidate();const run=++epoch;controller?.abort();controller=new AbortController();const signal=controller.signal;
  const seed=$('seed').valueAsNumber,budget=$('budget').valueAsNumber,blocked=[...$('locks').querySelectorAll('input:checked')].map(el=>el.value);
  const request=randomizerRequest(base,corpus,{seed,mode:$('mode').value,blocks:blocked,dspBudgetPoints:budget});
  running=true;$('generate').disabled=true;$('stop').hidden=false;$('status').textContent='Génération locale…';
  try{let r=await generateRandomizer(base,request,adapter,signal);if(run!==epoch||signal.aborted)return;if(r.status==='accepted'){const known=[decodeDeviceBuffer(base.frame).name,...corpus.presets.map(p=>p.name),...await getKnownNames()];if(run!==epoch||signal.aborted)return;const reserve=()=>nameRegistry.reserve(known),name=navigator.locks?await navigator.locks.request('fireworx-variation-name',reserve):reserve();r=await nameRandomizerResult(r,name);}if(run===epoch&&!signal.aborted)showResult(r);}catch(e){if(run===epoch)$('status').textContent=e.message;}
  finally{if(run===epoch){running=false;$('generate').disabled=false;$('stop').hidden=true;}}
 }
 $('source').onchange=selectSource;
 for(const k of ['mode','seed'])$(k).onchange=()=>{abort();invalidate();budgetMode();const note=document.querySelector('.randomizer-locks .randomizer-note');if(note)note.textContent=$('mode').value==='blocks'?'Algorithmes et routage variables. Blocs liés/verrouillés conservés. Feedback / Insert existant : variantes de blocs uniquement, matrice et gains conservés.':'Niveaux, gains de feedback, algorithmes, options de ressources et liens conservés. Les groupes pilotés par modulation ne varient pas.';};
 $('budget').onchange=()=>{try{dspPreferences.set($('budget').valueAsNumber);}catch(e){$('budget').value=String(dspPreferences.ceiling);$('status').textContent=e.message;}};
 const unsubscribeBudget=dspPreferences.subscribe(()=>{$('budget').value=String(dspPreferences.ceiling);if(applying)return;abort();invalidate();budgetMode();if(dialog.open)$('status').textContent='Plafond DSP mis à jour · générez un nouvel aperçu.';});
 $('new-seed').onclick=()=>{abort();invalidate();$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];};
 $('stop').onclick=()=>{abort();invalidate();$('status').textContent='Génération arrêtée.';};
 $('close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',abort);
 $('generate').onclick=generate;$('save').onclick=()=>{if(result?.status==='accepted')download(presetFilename(decodeDeviceBuffer(result.candidate.frame).name),archivePreset(result.candidate.frame));};$('replay').onclick=()=>{if(result)download(`fireworx-replay-${result.replay.request.seed}.json`,result.replay);};
 $('apply').onclick=async()=>{
  if(applying||result?.status!=='accepted')return;
  const check=()=>{if(getEditor().token!==editorVersion)throw Error('Le preset a changé depuis l’aperçu ; fermez puis recommencez');};
  const disabled=new Map([...dialog.querySelectorAll('button,input,select')].map(el=>[el,el.disabled]));
  try{
   check();applying=true;destinationState();dialog.setAttribute('aria-busy','true');for(const el of disabled.keys())el.disabled=true;
   $('status').textContent=$('target').value==='hardware'?'Envoi demandé · vérification du preset actuel avant transmission…':'Ouverture de la copie locale…';
   const message=await apply({frame:result.candidate.frame.slice(),baseFrame:base.frame.slice(),sourceCurrent,destination:$('target').value,replay:result.replay,check,onStatus:text=>{$('status').textContent=text;}});
   applying=false;close();onNotice(message);
  }catch(e){$('status').textContent=`Application refusée ou non confirmée : ${e.message}`;onNotice($('status').textContent);}
  finally{applying=false;dialog.removeAttribute('aria-busy');for(const [el,was] of disabled)el.disabled=was;destinationState();if(dialog.open){$('apply').disabled=true;$('scope').textContent='Application non confirmée · générez un nouvel aperçu.';}}
 };
 window.addEventListener('pagehide',()=>{abort();unsubscribeBudget();});
 return {async open(){if(applying)return;const target=getEditor();$('budget').value=String(dspPreferences.ceiling);$('target').value=target.live||target.hardwareAvailable?'hardware':'local';destinationState();abort();invalidate();base=null;$('generate').disabled=true;dialog.showModal();$('status').textContent='Preparing local copies…';controller=new AbortController();const signal=controller.signal,run=++epoch;try{await ensureCorpus(signal);if(run!==epoch||signal.aborted)return;const editor=getEditor();$('source').innerHTML=`<option value="current" ${!editor.frame||!editor.ready?'disabled':''}>Preset courant</option><optgroup label="Copies locales">${corpus.presets.map(p=>`<option value="${p.preset}">${p.preset} · ${esc(p.name)} · ≈ ${p.estimatedDSP??'?'} %</option>`).join('')}</optgroup>`;$('source').value=editor.frame&&editor.ready?'current':String(corpus.presets.find(p=>p.estimatedDSP!==null&&p.estimatedDSP<=dspPreferences.ceiling)?.preset??corpus.presets[0].preset);await selectSource();}catch(e){if(!signal.aborted)$('status').textContent=e.message;}}};
}

return {createRandomizerView};
}
