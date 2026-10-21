import {isFireworxPortName,fireworxPortPair} from '../engine/port-discovery.js';
// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {alphaDisplay} from '../engine/alpha-display.js';
import {assertDspTransition} from '../engine/dsp-policy.js';
import {deviceDspEstimate} from '../engine/dsp-model.js';
import {presetFilename} from '../engine/preset-names.js';
import {p0ProgressText} from '../engine/transfer-progress.js';
import {applyModulationTarget} from '../engine/modulation-targets.js';
import {familySymbol} from '../engine/workspaces.js';
import {costBadge} from '../engine/cost-badge.js';
import {decodeDeviceBuffer,editDeviceText,controlsForDevice,readField,formatDeviceValue,encodeEditBuffer,editedPayload,deviceMap,samePayload} from '../engine/device-codec.js';

import {addDeviceBlock,moveDeviceBlock,removeDeviceBlock,changeDeviceAlgorithm,muteDeviceBlock,setDeviceBlocksMuted,resizeDeviceGrid,layoutDeviceGrid,addDeviceRouting,moveDeviceCell,removeDeviceCell,connectDeviceBlock,connectDevicePorts,connectDeviceDrag} from '../engine/device-graph.js';
import {frameWithPayload} from '../engine/live-protocol.js';
import {findAlgorithm,findFamily} from '../engine/catalog.js';
import {parameterGroups,renderSignalSettings} from '../engine/workspaces.js';
import {routingForCell} from '../engine/routing-topology.js';
import {focusMatrix} from '../engine/modulation-matrix.js';
import {modulationTransformControls,transformModulation,glideMilliseconds,readModulation,linkLabels} from '../engine/modulation-codec.js';
import {hardwareIncident,editorLivePolicy} from '../engine/hardware-policy.js';
import {editorTransfers} from '../engine/editor-transfer.js';
import {mountConnectionEditor} from '../engine/connection-editor.js';
import {createMidiJournal,indexedDbJournalStorage,journalLimits} from '../engine/midi-journal.js';
import {receivedBytesSection} from '../engine/undecoded-bytes.js';
import {presetAddress} from '../engine/preset-library-model.js';
import {createPanelIndicators,payloadEdited} from '../engine/panel-indicators.js';
import {mountEditorTools} from '../engine/editor-tools-view.js';
import {bindValueEntry,fieldEntryValue,parseFieldEntry,shortChoices} from '../engine/value-entry.js';
export function create_device_view(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;
const {dspPreferences}=dependencies.dsp_preferences;
const {createModulationFeedbackView}=dependencies.modulation_feedback;
const {settingsNavigation,blockSelector}=dependencies.settings_navigation;
const {openWebMidiTransport}=dependencies.device_session;
const {createPerformanceControls}=dependencies.performance_view;
const {bindRotary,fieldAngle,stepField,fieldSteps}=dependencies.rotary;
const {renderModulationEditor}=dependencies.modulation_view;
const {createDspInspector}=dependencies.dsp_view;
const {hintButton}=dependencies.hints;


































const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
 function createBufferEditor({onChange,onNotice,onPanelChange=()=>{},onLibrary=()=>{},onLibraryState=()=>{},onEdit=()=>{},onPreset=()=>{}}){
 const localRandomPast=[],localRandomFuture=[];
 const modPage=u=>!!u&&!(['setup','meters'].includes(u)||u.startsWith('route-'));
 let buffer=null,selected=null,active=false,origin=null,session=null,access=null,busy=false,status='Aucun buffer chargé',parameter=0,generation=0,utility=null,target=null,autoEnabled=environment.autoConnect,alive=true,autoTimer=null,retry=0,releasePortLock=null;
 const changes=new Map(),invalidInputs=new Set();
 const connectionChoices=new Map();
 let modulationUI=null,connecting=false,alphaCursor=0,alphaLinkReturn=false,alphaFocus='overview',presetSource=null,editorTools=null,effectClipboard=null;
 const indicators=createPanelIndicators();let editBaseline=null,editedBuffer=null,editedKey='',editedValue=false;
 function editedSinceLoad(){
  if(!buffer||!editBaseline)return false;const key=JSON.stringify([...changes]);if(editedBuffer===buffer&&editedKey===key)return editedValue;
  editedBuffer=buffer;editedKey=key;const current=changes.size?decodeDeviceBuffer(encodeEditBuffer(buffer,changes)).payload:buffer.payload;
  return editedValue=payloadEdited(editBaseline,current);
 }
 let portLockSettled=Promise.resolve(),releaseSettled=Promise.resolve();
 const dspInspector=createDspInspector({getBuffer:()=>buffer,onNotice});
 // #72 local evidence: every TX/RX frame, phase and error, kept in this origin's IndexedDB.
 let journalStorage=null,journalNote='';try{journalStorage=indexedDbJournalStorage({name:environment.storageName+':journal'});}catch(e){journalNote=e.message;}
 const journal=createMidiJournal({storage:journalStorage,onChange:()=>journalStatus()});journal.mark('page',{path:location.pathname,hash:location.hash});
 let lastPhase=null,lastError=null,clearArmed=null,storeBusy=false;
 let performanceFrame=null;
 const feedbackView=createModulationFeedbackView({getBuffer:()=>active?buffer:null,getObservations:()=>performanceControls.observations});
 function paintPerformance(){if(performanceFrame!==null||!alive)return;performanceFrame=requestAnimationFrame(()=>{performanceFrame=null;if(!alive)return;feedbackView.paint();onPanelChange();});}
 const performanceControls=createPerformanceControls({getSession:()=>origin==='device'&&!connecting&&!session?.paused&&!session?.exclusiveBusy?session:null,getBuffer:()=>active?buffer:null,getAccess:()=>access,getDeviceInputId:()=>$('device-input')?.value,onNotice,onValue:paintPerformance,onAssign:kind=>{api.showUtility('matrix');focusMatrix(document,{source:`21:${Number(kind.slice(3))-1}`});},onOpenLink:slot=>api.openModulationLink(slot),onTempo:settings=>indicators.configure(settings),onActivity:indicators.activity,getTempo:()=>indicators.snapshot});
 document.body.insertAdjacentHTML('beforeend',`<dialog id="device-dialog" class="library-dialog device-dialog" aria-label="Connexion FireworX"><header><h2>Buffer FireworX</h2><button id="device-close">Fermer ×</button></header><p id="device-message" role="status"></p><details><summary>Règles d’échange MIDI</summary><p>${hardwareIncident.message}</p></details><div class="device-port-grid"><label>Entrée MIDI<select id="device-input"><option value="">Choisir les ports…</option></select></label><label>Sortie MIDI<select id="device-output"><option value="">Choisir les ports…</option></select></label><label>Device ID SysEx<input id="device-id" type="number" min="0" max="127" step="1" value="0"></label></div><div class="device-dialog-actions"><button id="device-discover">Choisir les ports MIDI</button><button id="device-read" disabled>Connecter et lire P0</button><button id="device-disconnect" disabled>Déconnecter</button></div><p>Connexion automatique après deux lectures identiques. Paramètres, algorithmes, blocs, routage et modulations actifs. Alpha / Bypass / Clock utilisent leur profil MIDI. L’édition automatique reste dans P0. STORE User / Carte : préparation, sauvegardes puis confirmation explicite dans la bibliothèque.</p><hr><label>Ouvrir une capture .syx locale<input id="device-file" type="file" accept=".syx"></label><p>La capture doit contenir une seule réponse étendue FireworX. Ouvrir un fichier ne transmet rien.</p><a href="../../docs/instruments/fireworx/COMPACT-MIDI-INTEGRATION.md">Couverture, sources et limites</a></dialog>`);
 $('device-dialog').querySelector('.device-port-grid').insertAdjacentHTML('afterend',`<details id="device-timing"><summary>Temporisation et diagnostic MIDI</summary><div class="device-port-grid"><label>Regroupement des gestes (ms)<input id="device-rate" type="number" min="0" max="2000" step="1" value="200"></label><label>Intervalle minimal d’écriture (ms)<input id="device-gap" type="number" min="3000" max="10000" step="1" value="3000"></label><label>Relecture après chaque écriture (ms)<input id="device-settle" type="number" min="4500" max="10000" step="1" value="4500"></label><label>Pause après image complète Data20 (ms)<input id="device-structural-settle" type="number" min="${editorLivePolicy.structuralSettle}" max="30000" step="1" value="${editorLivePolicy.structuralSettle}"></label><label>Attente de réponse (ms)<input id="device-timeout" type="number" min="22000" max="30000" step="1" value="22000"></label></div><p>Les dernières valeurs remplacent celles en attente. Chaque écriture est relue avant la suivante ; les nouveaux gestes ne repoussent pas cette vérification. Les pauses et relectures restent appliquées ; les CC attendent la fin du SysEx. L’horloge est interrompue pendant ces transactions. Blocs, routage et modulations partent en image P0 complète après un GET de contrôle ; aucun message n’est émis pendant la pause qui suit.</p><p id="device-metrics">Aucun échange MIDI.</p></details>`);
 document.querySelector('#device-timing .device-port-grid').insertAdjacentHTML('beforeend','<label>Relire P0 au repos<select id="device-idle-poll"><option value="0">Désactivé</option><option value="10000">Toutes les 10 secondes</option><option value="5000">Toutes les 5 secondes</option></select></label>');
 $('device-dialog').querySelector('hr').insertAdjacentHTML('beforebegin',`<section id="device-journal" aria-label="Journal MIDI de session"><p><strong>Journal MIDI de session</strong> · <span id="device-journal-status" role="status">Chargement…</span></p><div class="device-dialog-actions"><button id="device-journal-export">Exporter le journal MIDI</button><button id="device-journal-clear">Vider</button></div><p>Chaque trame émise ou reçue, les phases, refus et erreurs restent dans ce navigateur (IndexedDB), au plus ${journalLimits.maxEvents} événements ou ${journalLimits.maxBytes/1048576} Mo, y compris après rechargement. Rien n’est envoyé hors du navigateur. L’export produit un fichier .json et un fichier .syx (le navigateur peut demander d’autoriser deux téléchargements).</p></section>`);
 document.body.insertAdjacentHTML('beforeend','<dialog id="device-conflict" class="library-dialog" aria-label="Changement en façade"><h2>Le FireworX a changé en façade</h2><p>L’état relu sur l’appareil est affiché. Aucun réglage en attente n’a été envoyé. Vous pouvez exporter votre copie locale avant de la conserver à part.</p><button id="device-conflict-save">Exporter la copie locale .syx</button><button id="device-conflict-close">Garder l’état du FireworX</button></dialog>');
 $('device-conflict-save').onclick=()=>{const frame=session?.conflictFrame;if(frame)download('fireworx-local-conflict.syx',frame,'application/octet-stream');};
 $('device-conflict-close').onclick=()=>{session?.clearConflict();$('device-conflict').close();};
 document.querySelector('.chain-toolbar').insertAdjacentHTML('beforeend',`<button id="device-tools">MIDI / Buffer</button><div class="device-actions"><span id="device-status" role="status"></span><button id="device-conflict-open" hidden>Copie locale en conflit</button><button id="device-apply" hidden disabled>Envoyer maintenant</button><button id="device-revert" hidden>Écarter les réglages</button><button id="device-export">Exporter .syx</button><button id="device-draft">Revenir au brouillon</button></div>`);
 $('device-conflict-open').onclick=()=>$('device-conflict').showModal();
 const utilities=[
 {id:'matrix',label:'Matrice · 20 liens'},
 {id:'setup',label:'I/O SETUP · preset / CTRL'},
 {id:'meters',label:'Gain Reduction · DYN',scopePrefix:'common.dyn_led_meter'},
 {id:'alpha',label:'α MOD',scopePrefix:'modifiers.alpha_mod[0].'},
 {id:'lfo1',label:'LFO 1',scopePrefix:'modifiers.lfo[0].'}, {id:'lfo2',label:'LFO 2',scopePrefix:'modifiers.lfo[1].'},
 {id:'adsr1',label:'ADSR 1',scopePrefix:'modifiers.adsr[0].'}, {id:'adsr2',label:'ADSR 2',scopePrefix:'modifiers.adsr[1].'},
 {id:'freeform',label:'Freeform',scopePrefix:'modifiers.freeform[0].'},
 {id:'function1',label:'Fonction 1',scopePrefix:'modifiers.function[0].'}, {id:'function2',label:'Fonction 2',scopePrefix:'modifiers.function[1].'},
 {id:'pitch-detect',label:'Pitch Detect',scopePrefix:'modifiers.pitch_detect[0].'},
 {id:'env1',label:'Env Detect 1',scopePrefix:'modifiers.env_detect[0].'}, {id:'env2',label:'Env Detect 2',scopePrefix:'modifiers.env_detect[1].'},
 ...['FB Return','FB Send','Insert Return','Insert Send'].map((label,i)=>({id:'route-'+i,label,scopePrefix:`common.nodes[${i}].`}))];
 const node=()=>utility?utilities.find(x=>x.id===utility):buffer?.nodes.find(n=>n.id===selected);
 const nodeTitle=n=>n?.scopePrefix?n.label:findAlgorithm(n.algorithm).name;
 const familyId=()=>utility?'modifier':findFamily(node().algorithm).id;
 const fields=()=>utility==='matrix'?modulationTransformControls(buffer):node()?.scopePrefix||node()?.algorithm?controlsForDevice(buffer,node()):[];
 const current=f=>changes.get(f.id)??readField(buffer,f);
 const alphaLinks=()=>buffer?readModulation(buffer).filter(r=>r.connected&&r.source.cat===20&&r.source.sub===0).map(r=>({...r,label:linkLabels(buffer,r).destination})):[];
 function openAlphaLink(index=alphaCursor){
  const links=alphaLinks(),r=links[index];if(!r)return message('Aucun lien Alpha dans ce preset');
  alphaCursor=index;alphaLinkReturn=true;utility='matrix';parameter=modulationTransformControls(buffer).findIndex(f=>f.slot===r.slot&&f.linkField==='low');onChange();
  requestAnimationFrame(()=>focusMatrix(document,{link:r.slot}));
 }
 function graphic(){
  const times=fields().filter(f=>f.enc==='ms'&&/time|delay/i.test(f.fieldName));
  if(utility||findFamily(node().algorithm).id!=='delay'||!times.length)return '';
  const max=Math.max(...times.map(f=>f.range?.[1]??1));
  return `<div class="device-timeline" id="device-timeline"><span>Temps de retard · valeurs du buffer</span><svg viewBox="0 0 600 100" role="img" aria-label="Chronologie des délais"><path d="M15 75H585" stroke="currentColor"/>${times.map((f,i)=>{const v=current(f),x=15+570*v/max;return `<g><path d="M${x} ${25+(i%2)*20}V75" stroke="currentColor" stroke-width="2"/><text x="${Math.max(40,Math.min(550,x))}" y="${18+(i%2)*20}" text-anchor="middle">${v} ms</text></g>`;}).join('')}<text x="15" y="96">0</text><text x="585" y="96" text-anchor="end">${max} ms</text></svg></div>`;
 }
 function refresh(){
  if(!alive)return;
  document.body.classList.toggle('buffer-mode',active);
  $('device-status').textContent=status;$('device-message').textContent=status;
  $('device-apply').disabled=busy||origin!=='device'||!session?.reference||!changes.size||invalidInputs.size>0;
  $('device-apply').textContent=`Appliquer${changes.size?' ('+changes.size+')':''} au buffer`;
  for(const id of ['device-revert','device-export','device-draft','device-file','device-input','device-output','device-id','device-discover','device-rate','device-gap','device-settle','device-structural-settle','device-timeout','device-idle-poll'])$(id).disabled=busy;
  $('device-export').disabled=busy||!buffer||buffer.preset!==0;
  const transactionBusy=!!session?.exclusiveBusy||!session?.paused&&!!session?.diagnostics?.unverified;
  for(const id of ['device-input','device-output','device-id','device-file','device-draft','device-discover'])$(id).disabled ||= transactionBusy;
  $('device-read').disabled=!hardwareIncident.automaticConnection||busy||transactionBusy||!access||!$('device-input').value||!$('device-output').value;
  $('device-disconnect').disabled=!session||!!session?.exclusiveBusy||!session?.paused&&!!session?.diagnostics?.unverified;queueMicrotask(onLibraryState);
  $('new-study').disabled=active;
  for(const id of ['open-study','study-file','save-study','export'])$(id).disabled=busy;
  $('rows').disabled=false;$('search').disabled=false;
  document.querySelector('[data-tab="modulation"]').disabled=false;
  document.querySelectorAll('[data-screen-mode="layout"]').forEach(b=>b.disabled=false);
 }
 function message(text){status=text;refresh();onNotice(text);}
 function sourceInfo(info,confirmation='confirmed'){try{presetAddress(info.bank,info.slot);return {bank:info.bank,slot:info.slot,confirmation};}catch{return null;}}
 function adopt(next,source,sourcePreset=null){localRandomPast.length=localRandomFuture.length=0;onPreset();presetSource=sourceInfo(sourcePreset,'pending');alphaCursor=0;alphaLinkReturn=false;buffer=next;editBaseline=next.payload.slice();editedBuffer=null;origin=source;active=true;changes.clear();if(!next.nodes.some(n=>n.id===selected))selected=next.nodes[0]?.id??null;parameter=0;status=`${next.name||'Sans nom'} · ${next.nodes.length} moteurs · ${source==='device'?'reçu du matériel':'capture locale'}${next.preset!==0?' · consultation seule':''}`;refresh();onChange();}
 function assertTransactionIdle(){if(session?.exclusiveBusy||!session?.paused&&session?.diagnostics?.unverified)throw Error('Transaction MIDI en cours ; attendez sa vérification avant toute reconnexion ou ouverture');}
 function disconnect(){clearTimeout(autoTimer);autoTimer=null;performanceControls.stop();indicators.clearActivity();generation++;const old=session;session=null;const closing=old?.dispose();releasePortLock?.();releasePortLock=null;releaseSettled=Promise.allSettled([releaseSettled,portLockSettled,closing]);if(origin==='device')origin='disconnected';refresh();}
 async function claimPorts(key){
  if(!navigator.locks)return;
  const attempt=generation;
  const acquired=await new Promise((resolve,reject)=>{
   portLockSettled=navigator.locks.request('fireworx:'+key,{ifAvailable:true},lock=>{if(!lock){resolve(false);return;}if(!alive||attempt!==generation){resolve(false);return;}return new Promise(release=>{releasePortLock=release;resolve(true);});}).catch(reject);
  });
  if(!acquired)throw new Error('FireworX déjà ouvert dans une autre vue ; connexion automatique en attente');
 }
 async function execute(fn){if(busy||!alive)return;busy=true;refresh();try{await fn();}catch(e){if(alive){journal.mark('error',{where:'connexion',message:e.message});message(e.message);}}finally{busy=false;if(alive){refresh();if(active)onChange();}}}
 function journalStatus(){
  const el=$('device-journal-status');if(!el)return;const s=journal.stats;
  el.textContent=`${s.events} événements (${s.tx} TX / ${s.rx} RX) · ${Math.round(s.bytes/1024)} Ko${s.evicted?` · ${s.evicted} plus anciens écartés`:''} · ${s.persistent?'conservé dans ce navigateur':`non persistant${s.persistError||journalNote?' : '+(s.persistError||journalNote):''}`}`;
 }
 function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 $('device-journal-export').onclick=async()=>{
  const el=$('device-journal-status');
  try{await journal.flush();const out=await journal.exportFiles();download(out.name+'.json',out.json,'application/json');setTimeout(()=>download(out.name+'.syx',out.syx,'application/octet-stream'),400);el.textContent=`Journal exporté : ${out.summary.events} événements, ${out.summary.sysex} trames SysEx · ${out.name}.json + .syx · aucun envoi MIDI`;}
  catch(e){el.textContent='Export du journal impossible : '+e.message;}
 };
 $('device-journal-clear').onclick=async()=>{
  const button=$('device-journal-clear');
  if(!clearArmed){button.textContent='Confirmer : vider le journal';clearArmed=setTimeout(()=>{clearArmed=null;button.textContent='Vider';},5000);return;}
  clearTimeout(clearArmed);clearArmed=null;button.textContent='Vider';
  try{await journal.clear();journalStatus();$('device-journal-status').textContent='Journal vidé · '+$('device-journal-status').textContent;}catch(e){$('device-journal-status').textContent='Vidage impossible : '+e.message;}
 };
 // Opening the dialog lists the ports at once (no connection unless automatic connection is on).
 $('device-tools').onclick=()=>{$('device-dialog').showModal();refresh();journalStatus();if(access)fillPorts();else if(!busy)void execute(discover);};
 $('device-close').onclick=()=>$('device-dialog').close();
 function fillPorts(){
  if(!access)return;
  for(const [id,ports] of [['device-input',access.inputs],['device-output',access.outputs]]){
   const previous=$(id).value,list=[...ports.values()].filter(p=>p.state==='connected');
   $(id).innerHTML=list.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)}</option>`).join('');
   if(list.some(p=>p.id===previous))$(id).value=previous;
   else{const matches=list.filter(p=>isFireworxPortName(p.name));if(matches.length===1)$(id).value=matches[0].id;}
  }
  refresh();
 }
 function exactPair(){return !!access&&fireworxPortPair(access).ready;}
 function scheduleConnect(ms=300){clearTimeout(autoTimer);if(!hardwareIncident.automaticConnection||!autoEnabled||!alive)return;autoTimer=setTimeout(()=>{autoTimer=null;if(!session&&!busy&&exactPair())void connect();},ms);}
 const portChange=()=>{fillPorts();if(!session)scheduleConnect();};
 async function discover(){
  if(!navigator.requestMIDIAccess)throw new Error('Autorisez Web MIDI dans un navigateur compatible pour la connexion automatique.');
  access=await navigator.requestMIDIAccess({sysex:true});if(!alive)return;
  // Ports are listed even without SysEx, so a refusal reads as a refusal, not as « no port » (owner report 2026-10-21).
  access.removeEventListener('statechange',portChange);access.addEventListener('statechange',portChange);fillPorts();
  if(!access.sysexEnabled)throw new Error('Ports MIDI visibles, mais le navigateur refuse le SysEx (indispensable au FireworX) : autorisez « contrôle des appareils MIDI » pour ce site, puis rechargez la page.');
  if(!hardwareIncident.automaticConnection)message(hardwareIncident.message);else if(exactPair())scheduleConnect(0);else message(fireworxPortPair(access).ambiguous?'Plusieurs ports FireworX détectés : choisissez explicitement l’entrée et la sortie.':'En attente de ports dont le nom contient FireworX ; la bibliothèque locale reste disponible.');
 }
 async function connect(){
  if(busy||!alive)return;
  await execute(async()=>{
   assertTransactionIdle();
   disconnect();const id=$('device-id').valueAsNumber,attempt=generation;
   try{
   // Releasing a Web Lock and closing Web MIDI ports are asynchronous. Never
   // race the previous owner (our own session) with an ifAvailable acquisition.
   journal.mark('connection-stage',{stage:'release'});message('Connexion · fermeture de la session précédente');
   await releaseSettled;if(attempt!==generation||!alive)return;
   if(!Number.isInteger(id)||id<0||id>127)throw new Error('Device ID de 0 à 127 requis');
   journal.mark('connection-stage',{stage:'lock'});message('Connexion · réservation des ports');
   await claimPorts($('device-input').value+':'+$('device-output').value+':'+id);
   connecting=true;
   journal.mark('connection-stage',{stage:'open'});message('Connexion · ouverture des ports MIDI');
   const transport=await openWebMidiTransport(access.inputs.get($('device-input').value),access.outputs.get($('device-output').value),()=>{disconnect();message('FireworX déconnecté ; reconnexion automatique en attente');scheduleConnect(1500);},{profile:editorLivePolicy.profile,deviceId:id,journal,onActivity:indicators.activity});
   if(attempt!==generation||!alive){transport.close();return;}
   const timing={debounce:$('device-rate').valueAsNumber,minWriteInterval:Math.max(editorLivePolicy.minWriteInterval,$('device-gap').valueAsNumber),verifyDelay:Math.max(editorLivePolicy.settle,$('device-settle').valueAsNumber),structuralDelay:Math.max(editorLivePolicy.structuralSettle,$('device-structural-settle').valueAsNumber||0),timeout:Math.max(editorLivePolicy.timeout,$('device-timeout').valueAsNumber)};
   journal.mark('profile',{policy:editorLivePolicy,timing,deviceId:id,planner:'editorTransfers'});lastPhase=lastError=null;
   session=environment.startLive(transport,{transferPlan:editorTransfers,deviceId:id,...timing,compareBeforeWrite:true,adoptFacadeChanges:true,syncCC:true,idlePoll:Number($('device-idle-poll').value),onPerformance:bytes=>performanceControls.receive(bytes),onImage:(next,event)=>{
    if(attempt!==generation)return;
    if(event.reason==='facade'){journal.mark('facade-change',{conflict:!!event.conflict,program:event.program});onNotice('Changement en façade relu ; aucun ancien réglage envoyé.');if(event.conflict&&!document.querySelector('dialog[open]'))$('device-conflict').showModal();}
    if(['load','audition','recall','facade'].includes(event.reason)){adopt(next,'device',['audition','recall'].includes(event.reason)?event.presetSource:null);if(event.reason!=='facade')utility=null;retry=0;}
    else{buffer=next;origin='device';if(['verified','tempo'].includes(event.reason))changes.clear();if(!['parameter','queued'].includes(event.reason))onChange();}
    environment.onState?.();
   },onState:s=>{
    const repaintFault=s.phase==='error'&&lastPhase!=='error',repaintStore=storeBusy!==s.exclusiveBusy;storeBusy=s.exclusiveBusy;
    const phases={'recall-compare':'Rappel · contrôle de la mémoire','recall-sending':'Rappel · sélection matérielle','recall-settle':'Rappel · pause DSP sans aucun message','recall-verify':'Rappel · relecture de P0','tempo-taps':'Tempo · taps MIDI ponctuels','tempo-read':'Tempo · relecture du preset','library-bank':'Lecture du dump User','store-compare':'Sauvegarde · contrôle des références','store-sending':'Sauvegarde · envoi','store-settle':'Sauvegarde · pause DSP sans aucun message','store-verify':'Sauvegarde · vérification',loading:'Connexion et lecture',queued:'En direct · dernières valeurs en attente','awaiting-confirmation':'En direct · relecture en attente',compare:'GET de contrôle avant écriture','facade-read':'Lecture du changement en façade','library-drain':'Lecture de banque · attente du silence MIDI',sending:'Envoi',sent:'En direct · envoyé','structural-settle':'Image P0 envoyée · pause sans aucun message MIDI',verify:'Vérification après pause',verified:'En direct · relu',idle:'Prêt',error:'Synchronisation suspendue',disconnected:'Déconnecté'};
    if(s.phase!==lastPhase||(s.error??null)!==lastError){lastPhase=s.phase;lastError=s.error??null;journal.mark(s.phase==='error'?'error':'phase',{phase:s.phase,error:lastError,txMessages:s.txMessages,rxMessages:s.rxMessages,partialWrites:s.partialWrites,fullWrites:s.fullWrites,compareReads:s.compareReads,staleReferences:s.staleReferences});}
    if(s.phase==='error')autoEnabled=false;
    if(presetSource&&['error','verified'].includes(s.phase)){const confirmation=s.phase==='error'?'unverified':'confirmed';if(presetSource.confirmation!==confirmation){presetSource={...presetSource,confirmation};onPanelChange();}}
    status=s.error??(connecting&&s.phase==='verified'?'Vérification de la référence P0':phases[s.phase]??s.phase);
    $('device-metrics').textContent=`${status}${s.program?` · PC reçu ${s.program.number}, canal ${s.program.channel}`:''} · TX ${s.txMessages} messages / ${s.txBytes} octets · RX ${s.rxMessages} réponses / ${s.rxBytes} octets · ${s.partialWrites} écritures courtes · ${s.fullWrites} images P0 complètes (${s.compareReads} GET de contrôle)${s.lastRttMs===null?'':` · aller-retour ${s.lastRttMs} ms`}`;
    $('device-conflict-open').hidden=!s.conflict;$('undo').disabled=!s.canUndo;$('redo').disabled=!s.canRedo;refresh();if(repaintFault||repaintStore)onChange();
   }});
   status='Repos MIDI après ouverture / rechargement';refresh();
   await transport.waitForQuiet();
   if(attempt!==generation||!alive)return;
   const first=await session.load();await new Promise(r=>setTimeout(r,editorLivePolicy.initialReadGap));
   if(attempt!==generation||!alive)return;
   const second=await session.load();if(!samePayload(first.payload,second.payload))throw Error('P0 instable entre les deux lectures ; reprise arrêtée sans écriture');
   if(attempt===generation){status='En direct · relu';onNotice('FireworX connecté · deux lectures P0 identiques');$('device-dialog').close();}
   }catch(e){autoEnabled=false;disconnect();throw e;}finally{connecting=false;}
  });
 }
 $('device-discover').onclick=()=>execute(async()=>{autoEnabled=true;await discover();});
 $('device-read').onclick=()=>{autoEnabled=true;void connect();};
 $('device-disconnect').onclick=()=>{try{assertTransactionIdle();autoEnabled=false;disconnect();message('Connexion automatique arrêtée.');}catch(e){message(e.message);}};
 for(const id of ['device-input','device-output','device-id'])$(id).onchange=()=>{autoEnabled=true;void connect();};
 $('device-file').onchange=()=>execute(async()=>{
  const f=$('device-file').files[0];if(!f)return;
  try{assertTransactionIdle();autoEnabled=false;if(f.size>32782)throw new Error('Capture trop volumineuse');const next=decodeDeviceBuffer(new Uint8Array(await f.arrayBuffer()));disconnect();adopt(next,'file');$('device-dialog').close();}finally{$('device-file').value='';}
 });
 $('device-apply').onclick=()=>session?.flush();
 $('device-revert').onclick=()=>{changes.clear();message('Réglages en attente écartés ; appareil inchangé');onChange();};
 $('device-draft').onclick=()=>{try{assertTransactionIdle();}catch(e){message(e.message);return;}autoEnabled=false;disconnect();active=false;changes.clear();refresh();onChange();onNotice('Brouillon local retrouvé avec ses valeurs et son historique.');};
 $('device-export').onclick=()=>{try{
  const frame=encodeEditBuffer(buffer,changes),url=URL.createObjectURL(new Blob([frame],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=presetFilename(decodeDeviceBuffer(frame).name,'syx');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Copie .syx exportée ; aucun envoi MIDI');
 }catch(e){message(e.message);}};
 const special={0:'',1:'Liaison',2:'Routage 2',3:'FB Return',4:'FB Send',5:'Ins Return',6:'Ins Send'};
 function change(id,v){
  if(connecting||(busy&&!session)||!buffer||buffer.preset!==0)return;const f=fields().find(f=>f.id===id);
  if(origin==='device'&&session?.paused)return message('Édition suspendue : '+(session.diagnostics.error||'relecture nécessaire')+' · reconnectez et relisez P0');
  if(!f?.editable||!f.range||!Number.isInteger(v)||v<f.range[0]||v>f.range[1]||f.values&&!Object.hasOwn(f.values,String(v))||v===current(f))return;if(!utility)onEdit();
  if(utility==='matrix'){try{editMatrix(b=>transformModulation(b,f.slot,f.linkField,v),false,f.id);parameter=fields().findIndex(x=>x.id===id);modulationUI?.sync(f.slot);onPanelChange();}catch(e){message(e.message);}return;}
  if(session&&origin==='device'){try{session.replace(editedPayload(buffer,new Map([[id,v]])),{history:true,historyGroup:id});}catch(e){journal.mark('refused-edit',{where:'parameter',field:id,message:e.message});message(e.message);return;}}
  else if(v===readField(buffer,f))changes.delete(id);else changes.set(id,v);
  parameter=fields().findIndex(x=>x.id===id);
  const input=document.querySelector(`[data-wire-field="${id}"]`),out=document.querySelector(`[data-wire-output="${id}"]`);
  if(input)input.value=String(v);const number=document.querySelector(`[data-wire-number="${id}"]`);if(number)number.value=String(v);if(out)out.textContent=formatDeviceValue(f,v);
  input?.closest('.device-parameter')?.classList.toggle('pending-parameter',changes.has(id));
  const dial=document.querySelector(`[data-wire-dial="${id}"]`);if(dial){dial.style.setProperty('--dial-angle',`${fieldAngle(f,v)}deg`);dial.setAttribute('aria-valuenow',String(v));dial.setAttribute('aria-valuetext',formatDeviceValue(f,v));}
  onPanelChange();
  const timeline=$('device-timeline');if(timeline)timeline.outerHTML=graphic();
  message(session?'Édition en direct · envoi automatique':`${changes.size} réglage(s) dans la capture locale`);
  environment.onState?.();
 }
 function graph(fn){try{if(connecting)throw Error('Attendez les deux lectures initiales');if(buffer.preset!==0)throw new Error('Capture de preset archivé : consultation seule');const base=changes.size?decodeDeviceBuffer(encodeEditBuffer(buffer,changes)):buffer;buffer=base;const p=fn();dspInspector.check(decodeDeviceBuffer(frameWithPayload(buffer.frame,p)),base);if(session&&origin==='device')session.replace(p,{structural:true,reason:'structure'});else{buffer=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));changes.clear();status=buffer.name+' · capture locale';refresh();onChange();}if(!buffer.nodes.some(n=>n.id===selected))selected=buffer.nodes[0]?.id??null;onChange();}catch(e){if(session&&origin==='device')journal.mark('refused-edit',{where:'structure',message:e.message});message(e.message);onChange();}}
 function editMatrix(fn,structural,historyGroup){
  if(connecting)throw Error('Attendez les deux lectures initiales');
  if(buffer.preset!==0)throw Error('Capture archivée : consultation seule');
  const base=changes.size?decodeDeviceBuffer(encodeEditBuffer(buffer,changes)):buffer,p=fn(base);
  if(session&&origin==='device')session.replace(p,{structural,reason:structural?'structure':'parameter',historyGroup:historyGroup??null});
  else{buffer=decodeDeviceBuffer(frameWithPayload(base.frame,p));changes.clear();if(structural)onChange();}
  paintPerformance();
 }
 function routingDescription(n){
  const label=c=>{if(typeof c==='string')return c;const target=buffer.nodes.find(x=>x.col===c.col&&x.row===c.row);return target?`${findFamily(target.algorithm).name} ${target.instanceIndex+1}`:`${special[c.type]??'Bloc'} ${c.col+1}:${c.row+1}`;};
  const r=routingForCell(buffer.cells,buffer.rows,n);
  return `<details class="route-inspector"><summary>Signal : ${esc(r.inputs.map(label).join(" + ")||"∅")} → ${esc(findFamily(n.algorithm).name)} ${n.instanceIndex+1} → ${esc(r.outputs.map(label).join(" + ")||"∅")}</summary><div><strong>Entrées de ${esc(findFamily(n.algorithm).name)} ${n.instanceIndex+1}</strong><span>${esc(r.inputs.map(label).join(' + ')||'Aucune · branche interrompue')}</span></div><div><strong>Destination de la sortie</strong><span>${esc(r.outputs.map(label).join(' + ')||'Aucune · branche interrompue')}</span></div><p>La matrice choisit la destination. Out L/R choisit le signal transmis : Off, Mix, Dry ou Wet. Pour un écho suivi d’un filtre, placez le filtre à droite de l’écho, sans branche de sortie indépendante.</p></details>`;
 }
 function renderSetup(container){
  container.innerHTML=`<article class="device-engine setup-engine"><header><strong>I/O SETUP</strong><span>Preset et affectations CTRL</span></header><p>Les niveaux d’entrée et sortie des blocs appartiennent au preset. Le gain analogique IN/OUT et le setup global restent réglés sur l’appareil : aucune commande distante établie.</p><div class="setup-actions"><button id="setup-ctrl">Profil CTRL / contrôleur MIDI</button><button id="setup-links">Matrice de modulation</button><button id="setup-meter">Gain Reduction · DYN</button><button id="setup-transport">Connexion et temporisations</button></div><h3>Retours et inserts du preset</h3><div class="setup-actions">${utilities.filter(u=>u.id.startsWith('route-')).map(u=>`<button data-setup-route="${u.id}">${u.label}</button>`).join('')}</div><p>Les réglages globaux de fréquence, synchronisation numérique, source audio et mémoire ne sont pas écrits par cette vue.</p></article>`;
  container.querySelector('.device-engine').insertAdjacentHTML('beforeend',receivedBytesSection(buffer,{scope:'global'}));$('setup-meter').onclick=()=>api.showUtility('meters');$('setup-ctrl').onclick=()=>performanceControls.open();$('setup-links').onclick=()=>api.showUtility('matrix');$('setup-transport').onclick=()=>$('device-dialog').showModal();container.querySelectorAll('[data-setup-route]').forEach(el=>el.onclick=()=>api.showUtility(el.dataset.setupRoute));
 }
 function renderEditors(container,tabs){
  paintPerformance();editorTools?.dispose();editorTools=null;
  invalidInputs.clear();
  const setup=utility==='setup';tabs.hidden=setup;tabs.closest('.working-area')?.classList.toggle('settings-setup-active',setup);
  const page=modPage(utility)?'modulation':'signal';
  const utilitySelect=`<select id="device-utility" aria-label="Modulateurs et routage" ${page==='signal'?'hidden':''}>${utilities.map(u=>`<option value="${u.id}" ${utility===u.id?'selected':''}>${u.label}</option>`).join('')}</select>`;
  if(setup){tabs.innerHTML=utilitySelect;container.setAttribute('role','region');container.removeAttribute('aria-labelledby');container.setAttribute('aria-label','I/O SETUP');}
  else settingsNavigation(tabs,{page,items:(page==='signal'?buffer.nodes.map(n=>blockSelector(n,{selected,device:true})).join(''):'')+utilitySelect,onPage:next=>{utility=next==='modulation'?'matrix':null;parameter=0;onChange();}});
  $('device-utility').onchange=()=>{utility=$('device-utility').value||null;parameter=0;onChange();};
  tabs.querySelectorAll('[data-device-node]').forEach(b=>b.onclick=()=>api.select(b.dataset.deviceNode));
  if(utility==='matrix'){parameter=Math.min(parameter,Math.max(0,fields().length-1));modulationUI=renderModulationEditor(container,{getBuffer:()=>buffer,edit:editMatrix,onNotice:message,disabled:connecting||origin==='device'&&(!!session?.paused||!!session?.exclusiveBusy),openPerformance:()=>performanceControls.open(),openModifier:id=>{utility=id;parameter=0;onChange();},onSelect:(slot,field)=>{parameter=fields().findIndex(f=>f.slot===slot&&f.linkField===field);onPanelChange();}});onPanelChange();return;}
  if(utility==='setup'){renderSetup(container);return;}
  const n=node();if(!n){container.innerHTML='<p class="helper">Aucun moteur reconnu dans cette capture. Les octets restent conservés.</p>';return;}
  const controls=fields().map(f=>({...f,label:f.displayLabel,values:f.values??(deviceMap.tables[f.table]?Object.fromEntries(deviceMap.tables[f.table].texts.map((t,i)=>[i+deviceMap.tables[f.table].index_range[0],t])):undefined)})),groups=parameterGroups(familyId(),controls);
  parameter=Math.min(parameter,Math.max(0,controls.length-1));onPanelChange();
  container.innerHTML=`<article class="device-engine" data-settings="single"><header><strong>${esc(nodeTitle(n))} ${utility?'':n.instanceIndex+1} ${!utility?costBadge(n.algorithm):''}</strong><span>${esc(buffer.name)} · ${origin==='device'?'matériel':'capture'} · ${controls.filter(f=>f.editable).length} champs réglables</span>${hintButton('Édition du buffer temporaire : paramètres, structure, routage et modulations. Cartographie expérimentale ; une partie des champs est éprouvée par relecture brute. Affichage et audio non certifiés. Les modulations peuvent modifier le résultat sonore.','Informations sur le buffer')}</header><div class="device-settings" data-fw-style="--settings-columns:${Math.max(1,Math.min(3,groups.filter(g=>g.name!=='Entrée / sortie').length))}">${graphic()}${!utility?routingDescription(n):''}${renderSignalSettings(groups,(g,i)=>`<section class="device-control-group settings-section ${g.side?'settings-io signal-rail signal-'+g.side:''}" aria-labelledby="device-section-${i}"><h3 id="device-section-${i}"><span aria-hidden="true">${g.side?'→':String(i+1).padStart(2,'0')}</span>${esc(g.name)}</h3><div class="device-controls">${g.items.map(({control:f})=>{
   const v=current(f),valid=f.range&&v>=f.range[0]&&v<=f.range[1],disabled=connecting||(busy&&!session)||origin==='device'&&(!!session?.paused||!!session?.exclusiveBusy)||buffer.preset!==0||!f.editable||!valid;
   const options=f.values??(deviceMap.tables[f.table]?Object.fromEntries(deviceMap.tables[f.table].texts.map((t,i)=>[i+deviceMap.tables[f.table].index_range[0],t])):null);
   const choices=shortChoices(options,f.range);
   if(choices)return `<div class="parameter device-parameter parameter-compact parameter-enum ${/^Out [LR](?: routing)?$/i.test(f.displayLabel)?'parameter-output-route':''} ${changes.has(f.id)?'pending-parameter':''}"><div class="parameter-top"><label>${esc(f.displayLabel)}</label>${hintButton(`${f.locallyTrialled?'Relecture brute éprouvée':f.editable?'Cartographie expérimentale':'Lecture seule · écriture non couverte'}\n${f.id}\n@${f.offset} · ${f.type} · domaine ${f.range?.join('…')??'inconnu'}`,`Informations MIDI : ${f.displayLabel}`)}</div><select class="parameter-choice-list" data-choice-list size="${Math.max(2,choices.length)}" id="wire-${esc(f.id)}" data-wire-field="${esc(f.id)}" aria-label="${esc(f.displayLabel)}, choisir la valeur" ${disabled?'disabled':''}>${!choices.some(([k])=>Number(k)===v)?`<option value="${v}" selected disabled>Valeur reçue ${v}</option>`:''}${choices.map(([k,label])=>`<option value="${k}" ${Number(k)===v?'selected':''}>${esc(label)}</option>`).join('')}</select>${!f.editable?'<span class="parameter-state">Lecture seule</span>':''}</div>`;
   const dial=`<button type="button" class="dial-face device-dial" id="dial-${esc(f.id)}" data-wire-dial="${esc(f.id)}" role="slider" aria-label="${esc(f.displayLabel)}, bouton rotatif" aria-valuemin="${f.range?.[0]??v}" aria-valuemax="${f.range?.[1]??v}" aria-valuenow="${v}" aria-valuetext="${esc(formatDeviceValue(f,v))}" data-fw-style="--dial-angle:${f.range?fieldAngle(f,v):0}deg" ${disabled?'disabled':''}><i></i></button>`;
   const entry=options?`<select hidden class="parameter-entry" id="wire-${esc(f.id)}" data-wire-field="${esc(f.id)}" aria-label="${esc(f.displayLabel)}, choisir la valeur" ${disabled?'disabled':''}>${!Object.hasOwn(options,String(v))?`<option value="${v}" selected>Valeur reçue ${v}</option>`:''}${Object.entries(options).filter(([k])=>/^-?\d+$/.test(k)).map(([k,label])=>`<option value="${k}" ${Number(k)===v?'selected':''}>${esc(label)}</option>`).join('')}</select>`:`<input hidden class="parameter-entry" id="wire-${esc(f.id)}" type="text" inputmode="decimal" data-wire-field="${esc(f.id)}" data-wire-number="${esc(f.id)}" aria-label="${esc(f.displayLabel)}, saisir la valeur${f.unit?' en '+esc(f.unit):''}" value="${v}" ${disabled?'disabled':''}>`;
   return `<div class="parameter device-parameter parameter-compact ${changes.has(f.id)?'pending-parameter':''}"><div class="parameter-top"><label>${esc(f.displayLabel)}</label>${hintButton(`${f.locallyTrialled?'Relecture brute éprouvée':f.editable?'Cartographie expérimentale':'Lecture seule · écriture non couverte'}\n${f.id}\n@${f.offset} · ${f.type} · domaine ${f.range?.join('…')??'inconnu'}`,`Informations MIDI : ${f.displayLabel}`)}</div><div class="parameter-knob">${dial}</div><output class="parameter-value" data-wire-output="${esc(f.id)}" role="button" tabindex="${disabled?'-1':'0'}" aria-disabled="${disabled}" aria-expanded="false" aria-controls="wire-${esc(f.id)}" aria-label="${esc(f.displayLabel)}, modifier la valeur" title="Double-clic ou Entrée : saisir · Entrée : valider · Échap : annuler">${esc(formatDeviceValue(f,v))}</output>${entry}${!f.editable?'<span class="parameter-state">Lecture seule</span>':''}</div>`;
  }).join('')}</div></section>`)}</div></article>`;
  container.querySelector('.device-settings').insertAdjacentHTML('beforeend',receivedBytesSection(buffer,n));
  editorTools=mountEditorTools(container.querySelector('.device-settings'),{getBuffer:()=>changes.size?decodeDeviceBuffer(encodeEditBuffer(buffer,changes)):buffer,getSelected:()=>selected,utility,getClipboard:()=>effectClipboard,setClipboard:c=>{effectClipboard=c;},edit:fn=>graph(()=>fn(changes.size?decodeDeviceBuffer(encodeEditBuffer(buffer,changes)):buffer)),getAlpha:()=>performanceControls.alphaValue,onNotice:message,disabled:connecting||buffer.preset!==0||origin==='device'&&(!!session?.paused||!!session?.exclusiveBusy)});
  if(utility==='alpha'){
   const links=alphaLinks();alphaCursor=Math.max(0,Math.min(alphaCursor,links.length-1));
   container.querySelector('.device-settings').insertAdjacentHTML('afterbegin',`<section class="settings-section alpha-overview"><h3>Affectations de la molette · ${links.length} / 20</h3><div class="alpha-link-list">${links.map((r,i)=>`<button data-alpha-link="${i}" aria-pressed="${i===alphaCursor}" title="Ouvrir Low / Mid / High / Slope / Glide du lien ${r.slot+1}"><strong>${esc(r.label)}</strong><span>Low ${r.low} · Mid ${r.mid} · High ${r.high}</span></button>`).join('')||'<p>Aucun lien Alpha dans ce preset.</p>'}</div><label class="alpha-text-label">Fonction Alpha<input id="alpha-text" maxlength="20" aria-label="Description Alpha du preset" value="${esc(/[^\x20-\x7e]/.test(buffer.alphaText)?'':buffer.alphaText)}" placeholder="20 caractères ASCII" ${buffer.preset!==0?'disabled':''}></label><button id="alpha-text-apply" ${buffer.preset!==0?'disabled':''}>Appliquer le texte</button><button id="alpha-assign">Affecter un paramètre</button><button id="alpha-performance">CTRL / contrôleur MIDI</button>${hintButton('La touche α MOD ouvre les paramètres liés ; elle ne désactive pas Alpha. PARAMETER parcourt les affectations, ENTER ouvre le lien, EXIT revient. Mode et Response sont enregistrés avec le preset. Bounce : retour traité par le FireworX ; la position physique et sa courbe de retour ne sont pas relues par P0.','Fonctionnement Alpha Mod')}</section>`);
   container.querySelectorAll('[data-alpha-link]').forEach(el=>el.onclick=()=>openAlphaLink(Number(el.dataset.alphaLink)));
   $('alpha-text-apply').onclick=()=>graph(()=>editDeviceText(buffer,{alphaText:$('alpha-text').value}));
   $('alpha-assign').onclick=()=>api.showUtility('matrix');$('alpha-performance').onclick=()=>performanceControls.open();
  }
  if(!utility)container.querySelector('.device-engine>header').insertAdjacentHTML('afterend',`<div class="device-block-actions"><label>Algorithme<select id="device-algorithm">${findFamily(n.algorithm).algorithms.map(a=>`<option value="${a.id}" ${a.id===n.algorithm?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><button id="device-mute">${n.muted?'Réactiver':'Mute'}</button><button id="device-remove">Retirer le bloc</button></div>`);
  if(!utility){
   const host=document.createElement('div');host.className='connection-host';container.querySelector('.device-settings').append(host);
   mountConnectionEditor(host,{nodes:buffer.nodes,selected:n.id,choices:connectionChoices,label:engine=>`${findFamily(engine.algorithm).name} ${engine.instanceIndex+1}`,
    disabled:connecting||buffer.preset!==0||(origin==='device'&&(!!session?.paused||!!session?.exclusiveBusy)),
    preview:(anchor,mode)=>{const p=connectDeviceBlock(buffer,{kind:'node',id:n.id},anchor,mode),next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p)).nodes.find(engine=>engine.id===n.id);return {...next,changed:!samePayload(buffer.payload,p)};},
    apply:(anchor,mode)=>graph(()=>connectDeviceBlock(buffer,{kind:'node',id:n.id},anchor,mode))});
  }
  if(utility?.startsWith('route-')&&target)container.querySelector('.device-engine>header').insertAdjacentHTML('afterend','<button id="device-route-remove">Retirer ce routage</button>');
  if($('device-route-remove'))$('device-route-remove').onclick=()=>graph(()=>removeDeviceCell(buffer,target));
  if($('device-algorithm'))$('device-algorithm').onchange=()=>graph(()=>changeDeviceAlgorithm(buffer,n.id,$('device-algorithm').value));
  if($('device-mute'))$('device-mute').onclick=()=>graph(()=>muteDeviceBlock(buffer,n.id));
  if($('device-remove'))$('device-remove').onclick=()=>graph(()=>removeDeviceBlock(buffer,n.id));
  if(connecting||origin==='device'&&(session?.paused||session?.exclusiveBusy))container.querySelectorAll('#device-algorithm,#device-mute,#device-remove,#device-route-remove,#alpha-text,#alpha-text-apply').forEach(el=>el.disabled=true);
  container.querySelectorAll('[data-wire-dial]').forEach(d=>{
   const f=controls.find(x=>x.id===d.dataset.wireDial),steps=fieldSteps(f);if(!f.range)return;
   bindRotary(d,{get:()=>steps?steps.indexOf(current(f)):current(f),min:steps?0:f.range[0],max:steps?steps.length-1:f.range[1],set:value=>change(f.id,steps?steps[value]:value)});
  });
  container.querySelectorAll('[data-wire-field]').forEach(editor=>{
   const id=editor.dataset.wireField,f=controls.find(f=>f.id===id),output=container.querySelector(`[data-wire-output="${id}"]`);
   bindValueEntry({value:output,editor,disabled:()=>editor.disabled,get:()=>editor.tagName==='SELECT'?current(f):fieldEntryValue(f,current(f),deviceMap.curves),parse:text=>editor.tagName==='SELECT'?parseFieldEntry({...f,enc:null,curve:null,unit:null},text):parseFieldEntry(f,text,deviceMap.curves),set:v=>change(id,v),onError:message});
  });
  container.querySelectorAll('[data-wire-field],[data-wire-number],[data-wire-dial],[data-wire-output]').forEach(input=>input.onfocus=()=>{alphaFocus='setting';parameter=fields().findIndex(f=>f.id===(input.dataset.wireField??input.dataset.wireNumber??input.dataset.wireDial??input.dataset.wireOutput));onPanelChange();});
 }
 const api={get active(){return active;},get live(){return origin==='device'&&!connecting&&!!session&&!session.paused;},get busy(){return busy;},get buffer(){return buffer;},get selected(){return selected;},get target(){return target;},get canUndo(){return origin==='file'?localRandomPast.length>0:session?.canUndo??false;},get canRedo(){return origin==='file'?localRandomFuture.length>0:session?.canRedo??false;},
  get canRandomize(){return active&&!busy&&!connecting&&buffer?.preset===0&&(origin==='file'||origin==='device'&&session?.canAudition);},
  applyRandomized(frame,expected){
   if(!api.canRandomize)throw Error('Attendez une référence P0 synchronisée ou ouvrez une copie locale');
   const current=api.captureFrame();if(!samePayload(current,expected))throw Error('Le preset a changé depuis l’aperçu ; générez une nouvelle variation');
   const before=decodeDeviceBuffer(current),next=decodeDeviceBuffer(frame);assertDspTransition(deviceDspEstimate(before).estimated,deviceDspEstimate(next).estimated,dspPreferences.ceiling);editorTransfers(before,next);
   if(origin==='device'){session.replace(next.payload,{structural:true,reason:'randomizer'});onEdit();}
   else{localRandomPast.push(current);if(localRandomPast.length>50)localRandomPast.shift();localRandomFuture.length=0;buffer=next;changes.clear();onEdit();onChange();}
  },
  async applyRandomizedAndWait(frame,expected,{onStatus=()=>{}}={}){
   if(!api.live)throw Error('Session matérielle synchronisée requise');const owner=session;
   api.applyRandomized(frame,expected);
   let last=null;
   while(true){
    if(session!==owner)throw Error('Connexion remplacée pendant l’application ; résultat non confirmé');
    const d=owner.diagnostics;if(owner.paused)throw Error(d.error??'Application P0 non confirmée');
    if(d.phase!==last){last=d.phase;onStatus(p0ProgressText(d.phase));}
    if(owner.canAudition)return;await new Promise(resolve=>setTimeout(resolve,40));
   }
  },
  get canRoute(){return !!buffer&&!connecting&&buffer.preset===0&&!(origin==='device'&&(session?.paused||session?.exclusiveBusy));},
  startAutoConnect(){if(!alive)return;autoEnabled=true;void execute(discover);},
  async ensureConnected(){if(origin==='device'&&session&&!session.paused){if(connecting||!session.canAudition)throw Error('Attendez la relecture des modifications avant de charger une copie');return session;}autoEnabled=true;await connect();if(!session?.canAudition)throw Error('Connexion synchronisée requise avant chargement');return session;},
  async ensureReadSession(){
   if(api.librarySession)return session;
   if(connecting||busy)throw Error('Connexion ou opération en cours ; attendez sa fin avant de relancer la lecture');
   if(!access)await execute(discover);
   clearTimeout(autoTimer);autoTimer=null;
   if(!access)throw Error(status||'Autorisation MIDI requise pour lire le FireworX');
   const input=access.inputs.get($('device-input').value),output=access.outputs.get($('device-output').value);
   if(input?.state!=='connected'||output?.state!=='connected')throw Error('Ports MIDI indisponibles ; choisissez une entrée et une sortie actives dans MIDI / Buffer');
   autoEnabled=true;await connect();
   if(!api.librarySession)throw Error(status||'Reconnexion non confirmée ; aucune lecture de banque lancée');
   return session;
  },
  get libraryConnection(){
   const available=!!access&&[access.inputs.get($('device-input').value),access.outputs.get($('device-output').value)].every(p=>p?.state==='connected');
   const connected=!!api.librarySession;
   return {connected,exclusiveBusy:!!session?.exclusiveBusy||!session?.paused&&!!session?.diagnostics?.unverified,connecting:connecting||busy,portsAvailable:available,label:connecting||busy?'Connexion · lecture de P0':connected?'FireworX connecté · buffer temporaire':session?.paused?'Session suspendue · reconnexion nécessaire':origin==='file'?'Éditeur hors ligne · connexion pour lire':available?'Ports MIDI disponibles · session à reconnecter':access?'Ports MIDI indisponibles':'Connexion MIDI à établir'};
  },
  get librarySession(){return origin==='device'&&!connecting&&!session?.paused&&!session?.exclusiveBusy?session:null;},
  captureJSONFrame(){return buffer?(buffer.preset===0?encodeEditBuffer(buffer,changes):buffer.frame.slice()):null;},
  captureFrame(){if(!buffer||buffer.preset!==0)return null;return encodeEditBuffer(buffer,changes);},
  get modulationContext(){return active?{buffer:changes.size?decodeDeviceBuffer(encodeEditBuffer(buffer,changes)):buffer,disabled:connecting||busy||buffer.preset!==0||origin==='device'&&(!!session?.paused||!!session?.exclusiveBusy),selected,utility}:null;},
  assignModulationTarget(descriptor,key){if(api.modulationContext?.disabled)throw Error('Édition de modulation indisponible');editMatrix(b=>applyModulationTarget(b,descriptor,key),true);onChange();},
  showSettingsPage(page){utility=page==='modulation'?'matrix':null;parameter=0;onChange();},
  openModulationTarget(key){api.showUtility('matrix');focusMatrix(document,{column:key});},
  openModulationLink(slot){utility='matrix';parameter=modulationTransformControls(buffer).findIndex(f=>f.slot===slot&&f.linkField==='low');onChange();requestAnimationFrame(()=>focusMatrix(document,{link:slot}));},

  copyEffectFrom(frame,nodeId){const b=decodeDeviceBuffer(frame),n=b.nodes.find(n=>n.id===nodeId);if(!n)throw Error('Effet source introuvable');effectClipboard={buffer:b,node:{...n},name:`${b.name} · ${n.algorithm}`};onNotice('Effet copié depuis la bibliothèque ; choisissez sa destination dans l’éditeur.');if(active)onChange();},
  openLocal(frame){assertTransactionIdle();const next=decodeDeviceBuffer(frame);if(next.preset!==0)throw Error('Copie P0 locale requise');autoEnabled=false;disconnect();adopt(next,'file');},
  renamePreset(name){if(!active||!buffer)throw Error('Ouvrez ou lisez un preset avant de le renommer');assertTransactionIdle();editMatrix(b=>editDeviceText(b,{name}),true);onChange();},
  openRandomized(frame,source){const prior=decodeDeviceBuffer(source);if(prior.preset!==0)throw Error('Source P0 locale requise');api.openLocal(frame);editBaseline=prior.payload.slice();localRandomPast.push(source.slice());onEdit();onChange();},
  get panelState(){const list=fields(),f=list[parameter],links=alphaLinks();const alpha=alphaDisplay(performanceControls.alphaValue,buffer?readField(buffer,deviceMap.fields.find(f=>f.id==='modifiers.alpha_mod[0].mode_response.mode')):1,performanceControls.alphaState.origin);return {menu:utility==='setup'?'I/O SETUP':modPage(utility)?'MOD':'EFFECTS',alphaDisplay:alpha,parameter:utility==='alpha'&&alphaFocus==='overview'&&links.length?alphaCursor:parameter,parameterLabel:utility==='alpha'&&alphaFocus==='overview'&&links.length?links[alphaCursor]?.label:f?.displayLabel??'Aucun paramètre',value:f?.range?fieldAngle(f,current(f)):0,valueText:utility==='alpha'&&alphaFocus==='overview'&&links.length?'ENTER → Link':f?(f.linkField==='glide'?`${Math.round(glideMilliseconds(current(f)))} ms ≈`:formatDeviceValue(f,current(f))):'—',alpha:performanceControls.alphaValue,alphaOrigin:performanceControls.alphaState.origin,alphaOverview:{alphaText:buffer?.alphaText,links,cursor:alphaCursor,value:performanceControls.alphaValue}};},
  get indicators(){return {...indicators.snapshot,edited:active&&editedSinceLoad()};},
  get presetSource(){return presetSource;},
  markPresetSource(info){presetSource=sourceInfo(info);onPanelChange();},
  get utilityItems(){return utilities.filter(u=>!u.id.startsWith('route-'));},
  get rackState(){return buffer?{nodes:buffer.nodes,rows:buffer.rows,selected,cells:buffer.cells}:null;},
  selectParameter(id){if(!buffer)return;const n=buffer.nodes.find(n=>controlsForDevice(buffer,n).some(f=>f.id===id));if(!n)return;selected=n.id;utility=null;target=null;parameter=fields().findIndex(f=>f.id===id);onEdit();onChange();document.querySelector(`[data-wire-dial="${id}"],[data-wire-field="${id}"]`)?.focus();},
  select(id){if(!buffer.nodes.some(n=>n.id===id))return;selected=id;utility=null;target=null;parameter=0;onEdit();onChange();},
  showUtility(id='alpha'){if(!active)return;utility=id;alphaFocus='overview';alphaLinkReturn=false;parameter=0;onChange();},
  openAlphaLink,
  panelAction(action){if(action==='ENTER'&&utility==='alpha'){openAlphaLink();return true;}if(action==='EXIT'&&alphaLinkReturn){alphaLinkReturn=false;alphaFocus='overview';utility='alpha';onChange();return true;}if(action==='BYPASS'){performanceControls.bypass();return true;}if(action==='TEMPO'){performanceControls.open('tempo');return true;}if(action==='α MOD'){api.showUtility('alpha');return true;}if(action==='I/O SETUP'){api.showUtility('setup');return true;}if(action==='MOD'){api.showUtility('matrix');return true;}if(['RECALL','STORE'].includes(action)){onLibrary(action==='STORE'?'store':'recall');return true;}if(action==='UTILITY'){$('device-dialog').showModal();message(action==='STORE'?'Aucun STORE matériel. Exportez le buffer .syx pour conserver une copie locale.':action==='RECALL'?'Une capture locale peut être ouverte sans envoi MIDI. Le preset matériel est conservé.':'Connexion, temporisations et diagnostics. Les réglages globaux persistants restent sur le matériel.');return true;}return false;},
  turnAlpha(delta){performanceControls.turnAlpha(delta);},
  toggleMute(id){graph(()=>muteDeviceBlock(buffer,id));},
  setMuted(ids,muted){graph(()=>setDeviceBlocksMuted(buffer,ids,muted));},
  openPerformance(section){performanceControls.open(section);},
  get bypassState(){return performanceControls.bypassState;},
  undo(){try{if(origin==='file'&&localRandomPast.length){localRandomFuture.push(api.captureFrame());buffer=decodeDeviceBuffer(localRandomPast.pop());changes.clear();onChange();}else session?.undo();}catch(e){journal.mark('refused-edit',{where:'undo',message:e.message});message(e.message);}},redo(){try{if(origin==='file'&&localRandomFuture.length){localRandomPast.push(api.captureFrame());buffer=decodeDeviceBuffer(localRandomFuture.pop());changes.clear();onChange();}else session?.redo();}catch(e){journal.mark('refused-edit',{where:'redo',message:e.message});message(e.message);}},
  place(payload,to,swap=false){graph(()=>payload.kind==='routing-library'?addDeviceRouting(buffer,payload.type,to):payload.kind==='routing-node'?moveDeviceCell(buffer,payload.from,to,{swap}):payload.kind==='library'?addDeviceBlock(buffer,payload.algorithm,to):moveDeviceBlock(buffer,payload.id,to,{swap}));},
  connect(payload,anchorId,mode){graph(()=>connectDeviceBlock(buffer,payload,anchorId,mode));},
  previewPortLink(sourceId,targetId,mode){
   if(connecting||buffer.preset!==0||origin==='device'&&session?.paused)throw Error('Attendez une connexion synchronisée ou ouvrez une copie locale');
   const p=connectDevicePorts(buffer,sourceId,targetId,mode),next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));
   return {nodes:next.nodes,cells:next.cells,rows:next.rows,changed:!samePayload(buffer.payload,p)};
  },
  applyPortLink(sourceId,targetId,mode){graph(()=>{const p=connectDevicePorts(buffer,sourceId,targetId,mode);selected=targetId;utility=null;return p;});},
  applyDrag(grabbed,drop,options){graph(()=>{const p=connectDeviceDrag(buffer,grabbed,drop,options);selected=grabbed.id;utility=null;return p;});},
  addRouting(type){if(!target)return message('Choisissez une case vide de la matrice pour ce routage');graph(()=>addDeviceRouting(buffer,type,target));},
  removeCell(pos){graph(()=>removeDeviceCell(buffer,pos));},
  add(algorithm){const n=buffer.nodes.find(n=>n.id===selected);const pos=target??{col:Math.min(7,(n?.col??-1)+1),row:n?.row??0};graph(()=>addDeviceBlock(buffer,algorithm,pos));},
  resize(rows){graph(()=>resizeDeviceGrid(buffer,rows));},
  layout(axis,index,action){graph(()=>layoutDeviceGrid(buffer,axis,index,action));},
  renderEditors,
  renderGrid(container){container.innerHTML=buffer.cells.filter(c=>c.row<buffer.rows).sort((a,b)=>a.row-b.row||a.col-b.col).map(c=>{
   const n=buffer.nodes.find(n=>n.id===c.node);return `<button class="cell ${c.type?'':'empty'} ${c.node===selected&&!utility?'selected':''} ${n?.muted?'muted':''}" data-device-cell="${c.node??''}" data-cell-type="${c.type}" ${c.node?`data-node="${c.node}" draggable="true"`:c.type?`data-routing-node="${c.type}" draggable="true"`:''} data-col="${c.col}" data-row="${c.row}" aria-label="Colonne ${c.col+1}, ligne ${c.row+1}, ${esc(n?findAlgorithm(n.algorithm).name:special[c.type]??'Type '+c.type)}">${n?`<span class="cell-label">${esc(findFamily(n.algorithm).name)} ${c.instance+1} ${costBadge(n.algorithm)}</span><small>${esc(findAlgorithm(n.algorithm).name)}</small>`:esc(special[c.type]??'Type '+c.type)}</button>`;
  }).join('');container.querySelectorAll('[data-device-cell]').forEach(b=>{b.onclick=()=>{if(b.dataset.deviceCell)api.select(b.dataset.deviceCell);else{target={col:Number(b.dataset.col),row:Number(b.dataset.row)};const type=Number(b.dataset.cellType);if(type>=3&&type<=6){utility='route-'+(type-3);parameter=0;onChange();}else onNotice('Case choisie ; ajoutez un bloc depuis la bibliothèque.');}};});},
  renderBudget(container){dspInspector.render(container);},
  turn(label,delta){if(utility==='alpha'&&alphaFocus==='overview'&&label==='VALUE'&&alphaLinks().length){openAlphaLink();return;}if(utility==='alpha'&&alphaFocus==='overview'&&label==='PARAMETER'&&alphaLinks().length){const count=alphaLinks().length;alphaCursor=(alphaCursor+delta+count)%count;onPanelChange();return;}const list=fields();if(!list.length)return;if(label==='PARAMETER'){parameter=((parameter+delta)%list.length+list.length)%list.length;const f=list[parameter];if(utility==='matrix'){document.querySelector(`[data-mod-dial="${f.slot}:${f.linkField}"]`)?.focus();onPanelChange();return;}(document.querySelector(`[data-wire-dial="${f.id}"]`)??document.querySelector(`[data-wire-field="${f.id}"]`))?.focus();onPanelChange();}else if(label==='VALUE'){const f=list[parameter];change(f.id,stepField(f,current(f),delta));}},
  refresh,
  dispose(){journal.dispose();journalStorage?.close();autoEnabled=false;alive=false;cancelAnimationFrame(performanceFrame);performanceFrame=null;editorTools?.dispose();dspInspector.dispose();clearTimeout(autoTimer);access?.removeEventListener('statechange',portChange);disconnect();}
 };
 window.addEventListener('pagehide',()=>{void journal.flush();alive=false;clearTimeout(autoTimer);access?.removeEventListener('statechange',portChange);disconnect();});window.addEventListener('pageshow',e=>{if(e.persisted){alive=true;access?.addEventListener('statechange',portChange);scheduleConnect();}});refresh();setTimeout(()=>{if(alive&&autoEnabled)void execute(discover);},0);return api;
}

return {createBufferEditor};
}
