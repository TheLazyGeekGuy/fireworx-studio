import {createPanelEntry} from '../engine/panel-entry.js';
// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {alphaDisplay,paintAlphaStrip} from '../engine/alpha-display.js';
import {assertDspTransition} from '../engine/dsp-policy.js';
import {draftDspEstimate} from '../engine/draft-dsp.js';
import {presetFilename} from '../engine/preset-names.js';
import {renderDraftModulations,applyDraftModTarget} from '../engine/draft-modulation-view.js';
import {archivePreset,archiveStudy,restoreJSON} from '../engine/preset-json.js';
import {costBadge} from '../engine/cost-badge.js';
import {decorateToolbar} from '../engine/toolbar-icons.js';
import {matrixViewport} from '../engine/matrix-viewport.js';
import {mountColumnSplit} from './column-split.js';
import {focusMatrix} from '../engine/modulation-matrix.js';
import {bindValueEntry,guardSelectCommits} from '../engine/value-entry.js';
import {families,findAlgorithm,findFamily,modifiers} from '../engine/catalog.js';
import {editableControlsFor as controlsFor,validControlValue} from '../engine/parameters.js';
import {dropBlock,swapBlocks,appendPosition,validateStudy,resizeGrid,layoutGrid,connectStudyBlock,connectStudyPorts,connectStudyDrag} from '../engine/study-model.js';
import {connectDeviceDrag} from '../engine/device-graph.js';
import {decodeDeviceBuffer,samePayload,deviceMap} from '../engine/device-codec.js';
import {frameWithPayload} from '../engine/live-protocol.js';
import {routingItems,matrixTopology,dragConnectionPlan} from '../engine/routing-topology.js';
import {mountConnectionEditor} from '../engine/connection-editor.js';
import {requestExpanded,parseExpanded,hex} from '../engine/protocol.js';
import {familyWorkspaces,familySymbol,parameterGroups,renderSignalSettings} from '../engine/workspaces.js';
import {renderPanel} from '../engine/panel.js';
import {createRecallBrowser} from '../engine/recall-browser.js';
import {renderAlphaLCD,renderPresetLCD} from '../engine/lcd.js';
import {renderModernPanel} from '../engine/modern-panel.js';
import {effectControlAction} from '../engine/effect-control.js';
import {visualFor,expandParameters} from '../engine/visuals.js';
import {summarizeBudget,costKey} from '../engine/budget.js';
export function create_app(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;
const {dspPreferences}=dependencies.dsp_preferences;
const {dspBanner,bindDspCeiling}=dependencies.dsp_banner;
const {settingsNavigation,blockSelector}=dependencies.settings_navigation;
const {createModulationGestures}=dependencies.modulation_gestures;
const {createRandomizerView}=dependencies.randomizer_view;
const {bindRotary,dialAngle}=dependencies.rotary;
const {createScreen}=dependencies.screen;
const {createLibrary}=dependencies.library;
const {createMonobloc}=dependencies.monobloc;
const {createPresetLibrary}=dependencies.preset_library_view;
const {createBufferEditor}=dependencies.device_view;
const {createPortLinks}=dependencies.port_links;
const {createAppearance}=dependencies.appearance;
const {createHints,hintButton}=dependencies.hints;









































const $=id=>document.getElementById(id);guardSelectCommits(document.body);
createHints();
const state={schema:3,nextId:4,rows:4,selected:'filter-1',target:null,rate:44100,costs:{},baselines:{44100:null,48000:null},pitchDetector:false,routes:[],nodes:[
 {id:'filter-1',algorithm:'resonance',col:0,row:0,values:{},muted:false},
 {id:'delay-1',algorithm:'delay-stereo',col:2,row:0,values:{},muted:false},
 {id:'reverb-1',algorithm:'reverb-simple',col:2,row:1,values:{},muted:false}
],links:[]};
const past=[],future=[];
let draftBaseline=draftSignature();let indicatorTargets=[];
let sliderCheckpoint=null;
let editorView='workshop',parameterCursor=0,draftSettingsPage='signal',modulationGestures=null;
let panelScreenMode='preset';
const panelPositions={IN:0,OUT:0,'α MOD':0};
let connectionMode='free';
// Shown by default (owner request 2026-10-21); unchecking it is remembered.
let showPaletteDsp=true;try{showPaletteDsp=localStorage.getItem('fireworx-palette-dsp-v1')!=='false';}catch{}
const connectionChoices=new Map();
const monobloc=createMonobloc({onLayout:()=>requestAnimationFrame(renderWires)});
const screen=createScreen({onMode:()=>{panelScreenMode='routing';recall.cancel();renderRack();},onLayout:()=>requestAnimationFrame(renderWires)});
const snapshot=()=>({kind:'midi-studio-fireworx-offline-study',hardware:false,...structuredClone(state)});
const library=createLibrary({snapshot,restore:next=>{remember();Object.assign(state,next);render();},onNotice:message=>notice(message)});
const paletteOpen=new Set(families.map(f=>f.id));
const bufferEditor=createBufferEditor({onChange:()=>render(),onNotice:message=>notice(message),onPanelChange:()=>syncRackRotaries(),onLibrary:mode=>presetLibrary.open(mode),onLibraryState:()=>presetLibrary.refreshConnection(),onEdit:()=>{if(panelScreenMode!=='routing'){panelScreenMode='routing';recall.cancel();renderRack();}},onPreset:()=>{panelScreenMode='preset';recall.loaded();}});
decorateToolbar(document.querySelector('.chain-toolbar'));
decorateToolbar(document.querySelector('.tabs'));
const presetLibrary=createPresetLibrary({onCopyEffect:(frame,nodeId)=>bufferEditor.copyEffectFrom(frame,nodeId),ensureConnected:()=>bufferEditor.ensureConnected(),ensureReadSession:()=>bufferEditor.ensureReadSession(),getConnection:()=>bufferEditor.libraryConnection,getSession:()=>bufferEditor.librarySession,getCurrentFrame:()=>bufferEditor.captureFrame(),openLocal:frame=>bufferEditor.openLocal(frame),onSelected:record=>{panelScreenMode='preset';recall.preview(record);renderRack();},onOpened:source=>{panelScreenMode='preset';bufferEditor.markPresetSource(source);recall.loaded();renderRack();},onNotice:message=>notice(message)});
const recall=createRecallBrowser({getCurrent:()=>({name:bufferEditor.active?bufferEditor.buffer.name:'Brouillon local',alphaText:bufferEditor.active?bufferEditor.buffer.alphaText:'',source:bufferEditor.active?bufferEditor.presetSource:null}),getInventory:()=>presetLibrary.recallCopies(),readPreset:(bank,slot,options)=>presetLibrary.readRecall(bank,slot,options),loadPreset:record=>presetLibrary.loadRecall(record),families,familyFor:findFamily,onChange:()=>syncRackRotaries(),onNotice:message=>notice(message)});
window.addEventListener('pagehide',()=>recall.dispose());
// ENTER on a focused Recall encoder validates the selected bank and slot.
// Prevent the button's default click (focus only); the facade ENTER button uses
// exactly the same single-flight recall loader.
$('rack').addEventListener('keydown',e=>{
 if(panelScreenMode!=='preset'||e.key!=='Enter'||!e.target.closest('[data-panel-rotary="PARAMETER"],[data-panel-rotary="VALUE"],.lcd-hit'))return;
 e.preventDefault();e.stopPropagation();if(!e.repeat)void recall.enter();
});
const panelEntry=createPanelEntry($('rack'));
window.addEventListener('pagehide',()=>panelEntry.close());
$('rack').addEventListener('dblclick',e=>{
 let kind=null,anchor=e.target.closest('.modern-name-display,[data-panel-name]');
 if(anchor)kind='name';
 else if(panelScreenMode==='preset'&&e.target.closest('.lcd-hit')){
  const lcd=$('rack').querySelector('svg[viewBox="0 0 262 124"]'),rect=lcd.getBoundingClientRect(),x=(e.clientX-rect.left)*262/rect.width,y=(e.clientY-rect.top)*124/rect.height;
  if(x>=146&&y>=26&&y<=74)kind='slot';else if(y>=78&&y<=100)kind='name';
  anchor=lcd;
 }
 if(!kind)return;e.preventDefault();e.stopPropagation();
 try{
  if(kind==='slot'){const r=recall.snapshot;panelEntry.open({anchor,label:'Numéro du preset',value:r.slot,type:'number',min:1,max:r.maximum,commit:value=>{recall.selectSlot(value);notice('Preset sélectionné · ENTER pour charger');}});}
  else{
   if(!bufferEditor.active)throw Error('Ouvrez ou lisez un preset avant de le renommer');
   if(recall.snapshot.loading)throw Error('Chargement en cours ; attendez la relecture');
   if(recall.snapshot.pending)throw Error('Chargez le preset sélectionné avant de le renommer');
   // Rename the loaded buffer, never a catalogue preview left by RECALL.
   const lcdAnchor=anchor.matches('svg[viewBox="0 0 262 124"]');
   recall.cancel();
   if(lcdAnchor)anchor=$('rack').querySelector('svg[viewBox="0 0 262 124"]');
   panelEntry.open({anchor,label:'Nom du preset',value:bufferEditor.buffer.name,maxLength:20,commit:name=>{bufferEditor.renamePreset(name);recall.loaded();renderRack();}});
  }
 }catch(error){notice(error.message);}
});

presetLibrary.setDraftOpener(()=>library.open());
document.querySelector('.tabs').insertAdjacentHTML('beforeend','<button id="open-preset-library">Bibliothèques</button>');
$('open-preset-library').onclick=()=>presetLibrary.open();
$('mono-expand-library').textContent='Blocs';
document.querySelector('.mono-status').insertAdjacentHTML('beforeend','<button id="mono-presets">Presets</button>');$('mono-presets').onclick=()=>presetLibrary.open();
function remember(){past.push(structuredClone(state));if(past.length>50)past.shift();future.length=0;updateHistory();}
function updateHistory(){if(bufferEditor.active){$('undo').disabled=!bufferEditor.canUndo;$('redo').disabled=!bufferEditor.canRedo;return;}if($('undo'))$('undo').disabled=!past.length;if($('redo'))$('redo').disabled=!future.length;}
// Owner request 2026-10-21: the grid grows while DSP is left. A position on the row just below the active rows adds it.
const cheapestBlock=Math.min(...Object.values(deviceMap.algorithms).map(a=>a.dsp).filter(Number.isFinite));
function draftRoom(){const estimated=draftDspEstimate(state);return estimated!==null&&dspPreferences.ceiling-estimated>=cheapestBlock;}
function appendOrGrow(){try{return appendPosition(state,state.selected);}catch(e){if(state.rows<8)return {col:0,row:state.rows};throw e;}}
function growingBase(position){return position&&typeof position==='object'&&position.row===state.rows&&state.rows<8?resizeGrid(state,state.rows+1).state:state;}
function assertDraftBudget(next){return assertDspTransition(draftDspEstimate(state),draftDspEstimate(next),dspPreferences.ceiling);}
function applyPlacement(payload,position,swap=false){if(bufferEditor.active){const target=typeof position==='string'?bufferEditor.buffer.nodes.find(n=>n.id===position):position;const anchor=connectionMode!=='free'&&!swap&&bufferEditor.buffer.nodes.find(n=>n.col===target?.col&&n.row===target?.row);return anchor&&!payload.kind.startsWith('routing-')?bufferEditor.connect(payload,anchor.id,connectionMode):bufferEditor.place(payload,target,swap);}try{const base=growingBase(position),anchor=connectionMode!=='free'&&base.nodes.find(n=>n.col===position.col&&n.row===position.row);const next=swap?swapBlocks(base,payload.id,position):anchor&&!payload.kind.startsWith('routing-')?connectStudyBlock(base,payload,anchor.id,connectionMode):dropBlock(base,payload,position);if(JSON.stringify(next.state)===JSON.stringify(state))return;assertDraftBudget(next.state);remember();Object.assign(state,next.state);render();notice(next.message);}catch(e){notice(e.message);}}

const notice=message=>{$('notice').textContent=message;};
const portLinks=createPortLinks({stage:document.querySelector('.routing-stage'),grid:$('grid'),onNotice:notice,
 getModel:()=>bufferEditor.active?{nodes:bufferEditor.buffer.nodes.filter(n=>n.row<bufferEditor.buffer.rows),disabled:!bufferEditor.canRoute,version:bufferEditor.buffer.payload.join(','),cells:bufferEditor.buffer.cells,rows:bufferEditor.buffer.rows}:{nodes:state.nodes.filter(n=>n.row<state.rows),disabled:false,version:JSON.stringify(state),cells:[...state.nodes,...(state.routes??[])],rows:state.rows},
 label:n=>bufferEditor.active?`${findFamily(n.algorithm).name} ${n.instanceIndex+1}`:findAlgorithm(n.algorithm).name,
 preview:(source,target,mode)=>{if(bufferEditor.active)return bufferEditor.previewPortLink(source,target,mode);const next=connectStudyPorts(state,source,target,mode).state;assertDraftBudget(next);return {...next,cells:[...next.nodes,...(next.routes??[])],changed:JSON.stringify(next)!==JSON.stringify(state)};},
 apply:(source,target,mode)=>{if(bufferEditor.active)return bufferEditor.applyPortLink(source,target,mode);try{const next=connectStudyPorts(state,source,target,mode);assertDraftBudget(next.state);remember();Object.assign(state,next.state);render();notice(next.message);}catch(e){notice(e.message);}},
 // #74 cable drag: same planners for the local draft and the P0 buffer; preview is pure (no MIDI).
 previewDrag:(grabbed,drop,options)=>{
  if(bufferEditor.active){if(!bufferEditor.canRoute)throw Error('Attendez une connexion synchronisée ou ouvrez une copie locale');const b=bufferEditor.buffer,plan=dragConnectionPlan(b.cells,b.nodes,b.rows,grabbed,drop,options),p=connectDeviceDrag(b,grabbed,drop,options),next=decodeDeviceBuffer(frameWithPayload(b.frame,p));return {nodes:next.nodes,cells:next.cells,rows:next.rows,changed:!samePayload(b.payload,p),plan};}
  const next=connectStudyDrag(state,grabbed,drop,options);assertDraftBudget(next.state);return {nodes:next.state.nodes,cells:[...next.state.nodes,...(next.state.routes??[])],rows:next.state.rows,changed:JSON.stringify([next.state.nodes,next.state.routes])!==JSON.stringify([state.nodes,state.routes]),plan:next.plan};
 },
 applyDrag:(grabbed,drop,options)=>{if(bufferEditor.active)return bufferEditor.applyDrag(grabbed,drop,options);try{const next=connectStudyDrag(state,grabbed,drop,options);assertDraftBudget(next.state);remember();Object.assign(state,next.state);render();notice(next.message);}catch(e){notice(e.message);}}
});
const node=()=>state.nodes.find(n=>n.id===state.selected);
const key=(n,c)=>`${n.algorithm}:${c.label}`;
const value=(n,c)=>n.values[key(n,c)]??c.value;
const isLinked=(n,c)=>state.links.some(l=>!l.inactive&&l.node===n.id&&l.algorithm===n.algorithm&&l.parameter===c.label);
const short=f=>({dynamic:'DYN',filter:'FIL',formant:'FOR',distort:'DIS',vocode:'VOC',synth:'SYN',pitch:'PIT',chorus:'CHO',delay:'DLY',reverb:'REV',pan:'PAN',eq:'EQ'}[f]);
function showTab(id){
 if(id==='modulation'){if(bufferEditor.active)return bufferEditor.showUtility('matrix');draftSettingsPage='modulation';renderEditors();syncRackRotaries();return;}
 screen.close();
 monobloc.setActive(id==='monobloc');
 for(const p of document.querySelectorAll('.tab-panel'))p.classList.toggle('hidden',p.id!==id&&!(id==='monobloc'&&p.id==='routing'));
 for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===id));
 document.querySelector('.flow').classList.toggle('mono-flow',id==='monobloc');
 renderEditors();renderBudget();requestAnimationFrame(renderWires);
 if(id==='monobloc')window.scrollTo(0,0);
}

function select(id){draftSettingsPage='signal';panelScreenMode='routing';recall.cancel();if(bufferEditor.active)return bufferEditor.select(id);parameterCursor=0;state.selected=id;state.target=null;render();}
function renderLCDZoom(){
 if(bufferEditor.active){$('lcd-window-label').textContent=`8 colonnes × ${bufferEditor.buffer.rows} lignes · ${bufferEditor.live?'édition en direct':'capture locale'}`;if(screen.open)renderScreenControls(screen.mode);return;}
 $('lcd-window-label').textContent=`8 colonnes × ${state.rows} lignes · ${state.nodes.filter(n=>n.row<state.rows).length} blocs actifs · fenêtre physique 4 × 3`;
 if(screen.open)renderScreenControls(screen.mode);
}
function commitGrid(operation){if(bufferEditor.active)return notice('Utilisez le déplacement direct des blocs et le réglage de grille pour le buffer matériel.');try{const next=operation();assertDraftBudget(next.state);remember();Object.assign(state,next.state);render();notice(next.message);}catch(e){notice(e.message);if(screen.open)$('screen-action-status').textContent=e.message;}}
function renderScreenControls(mode){
 document.querySelector('#lcd-enlarged .screen-note').textContent=`Vue étendue de la grille · 8 × 8 maximum, manuel p. 22 · ${bufferEditor.live?'édition MIDI en direct du buffer P0':'édition locale sans envoi MIDI'}`;
 if(bufferEditor.active){
  $('screen-controls').innerHTML=mode==='layout'?`<div class="layout-controls"><strong>LAYOUT · EN DIRECT</strong><label>Axe<select id="layout-axis"><option value="col">Colonne</option><option value="row">Ligne</option></select></label><label>Position<select id="layout-index">${Array.from({length:8},(_,i)=>`<option value="${i}">${i+1}</option>`).join('')}</select></label><button data-layout-action="before">Déplacer avant</button><button data-layout-action="after">Déplacer après</button><button data-layout-action="insert">Insérer</button><button data-layout-action="delete">Supprimer</button></div>`:mode==='tool'?'<p class="screen-instruction">TOOL · sélectionnez un moteur pour Mute, son algorithme ou son retrait. Le budget DSP est estimé ci-dessous.</p>':'<p class="screen-instruction">Édition en direct. Glissez les blocs depuis la bibliothèque ou entre les cases ; cliquez pour régler le moteur.</p>';
  if(mode==='layout'){$('layout-axis').onchange=()=>{$('layout-index').innerHTML=Array.from({length:$('layout-axis').value==='row'?bufferEditor.buffer.rows:8},(_,i)=>`<option value="${i}">${i+1}</option>`).join('');};document.querySelectorAll('[data-layout-action]').forEach(b=>b.onclick=()=>bufferEditor.layout($('layout-axis').value,Number($('layout-index').value),b.dataset.layoutAction));}return;
 }
 const n=node(),position=state.target??n??{col:0,row:0};
 $('screen-controls').innerHTML=mode==='layout'?`<div class="layout-controls"><strong>LAYOUT</strong><label>Axe<select id="layout-axis"><option value="col">Colonne</option><option value="row">Ligne</option></select></label><label>Position<select id="layout-index">${Array.from({length:8},(_,i)=>`<option value="${i}" ${i===position.col?'selected':''}>${i+1}</option>`).join('')}</select></label><button data-layout-action="before">Déplacer avant</button><button data-layout-action="after">Déplacer après</button><button data-layout-action="insert">Insérer</button><button data-layout-action="delete">Supprimer</button><small>Actions locales annulables. Les blocs hors grille sont conservés.</small></div><p id="screen-action-status" role="status"></p>`:mode==='tool'?'<div class="tool-controls"><strong>TOOL · DSP LOAD</strong><span>Budget indicatif et coûts observés ci-dessous. Les niveaux audio ne sont pas mesurés.</span><button id="tool-detail">Afficher les coûts</button></div><p id="screen-action-status" role="status"></p>':'<p id="screen-action-status" class="screen-instruction">Glissez un algorithme depuis la bibliothèque. Déplacez un bloc entre les cases ; cliquez pour régler ses paramètres à droite.</p>';
 if(mode==='layout'){
  $('layout-axis').onchange=()=>{$('layout-index').innerHTML=Array.from({length:$('layout-axis').value==='row'?state.rows:8},(_,i)=>`<option value="${i}">${i+1}</option>`).join('');};
  document.querySelectorAll('[data-layout-action]').forEach(b=>b.onclick=()=>commitGrid(()=>layoutGrid(state,$('layout-axis').value,Number($('layout-index').value),b.dataset.layoutAction)));
 }
 if(mode==='tool')$('tool-detail').onclick=()=>{const detail=$('dsp-budget').querySelector('details');detail.open=!detail.open;};
}
function panelInfo(label){
 const info={'POWER':'Alimentation physique du FireworX, manuel p. 6 et 76. Aucun interrupteur distant documenté ; cette commande ne coupe ni le prototype ni l’appareil.','IN':'Niveau analogique d’entrée, manuel p. 6 et 44. La position est une prévisualisation locale ; aucune commande MIDI de ce gain n’est établie.','OUT':'Niveau analogique de sortie, manuel p. 6 et 44. La position est une prévisualisation locale ; aucune commande MIDI de ce gain n’est établie.','α MOD':'Contrôleur Alpha et réponse de preset, manuel p. 39 ; son édition et ses liaisons restent partielles.','α MOD key':'Ouvre les affectations Alpha du preset, manuel p. 39. La molette se contrôle via son affectation CTRL ; pas de commutation matérielle distante documentée.','TEMPO':'MIDI Clock reçue et aperçu BPM local, manuel p. 40. Pas de génération de Clock ; BPM global matériel non relu.','BYPASS':'Bypass global via le CC déjà affecté dans CTRL, manuel pp. 44–46 ; profil confirmé requis. État physique non acquitté.','UTILITY':'Config, Secure/Free, Card, copie et Bulk Dump, manuel p. 48–49. Documentation disponible ; éditeur local à compléter.'};
 $('panel-info-title').textContent=label;$('panel-info-text').textContent=info[label]??'Fonction recensée dans la documentation, comportement matériel non reproduit.';$('panel-info').showModal();
}
function focusParameter(delta=0){
 const n=node();if(!n)return;const controls=controlsFor(n.algorithm);parameterCursor=(parameterCursor+delta+controls.length)%controls.length;
 syncRackRotaries();
 const input=$(`${n.id}-p${parameterCursor}`);input?.focus();notice(`PARAMETER · ${controls[parameterCursor].label} · édition locale`);
}
function turnPanel(label,delta){
 if(panelScreenMode==='preset'&&['PARAMETER','VALUE'].includes(label))return recall.turn(label,delta);
 if(bufferEditor.active&&label==='α MOD')return bufferEditor.turnAlpha(delta);
 if(bufferEditor.active&&['PARAMETER','VALUE'].includes(label))return bufferEditor.turn(label,delta);
 if(label==='PARAMETER')return focusParameter(delta);
 if(label!=='VALUE'){panelPositions[label]=Math.max(-135,Math.min(135,(panelPositions[label]??0)+delta*3));syncRackRotaries();return notice(`${label} · position de façade locale ; ${label==='α MOD'?'aucune affectation MIDI active':'gain analogique sans commande MIDI établie'}`);}
 const n=node();if(!n)return;const c=controlsFor(n.algorithm)[parameterCursor];if(!c)return;
 sliderCheckpoint=null;setControl(n.id,parameterCursor,c.kind==='choice'?c.options[Math.max(0,Math.min(c.options.length-1,c.options.indexOf(value(n,c))+delta))]:value(n,c)+c.step*delta);sliderCheckpoint=null;
}
function syncRackRotaries(){
 const p=bufferEditor.active?bufferEditor.panelState:null,r=panelScreenMode==='preset'?recall.snapshot:null,n=node(),c=n&&controlsFor(n.algorithm)[parameterCursor];
 const localValue=c?(c.kind==='choice'?dialAngle(c.options.indexOf(value(n,c)),0,c.options.length-1):dialAngle(value(n,c),c.min,c.max)):0;
 if(panelScreenMode==='alpha'&&p){document.querySelectorAll('[data-alpha-link]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.alphaLink)===p.alphaOverview.cursor)));const lcd=$('rack').querySelector('svg[viewBox="0 0 262 124"]');if(lcd){const modern=appearance.current.surface==='modern',attrs=modern?'':' x="482" y="26" width="262" height="124"';lcd.outerHTML=renderAlphaLCD(p.alphaOverview,modern?{ink:'var(--accent)',paper:'var(--bg)'}:undefined).replace('<svg ','<svg '+attrs+' ');}}
 if(r){const small=$('rack').querySelector('.modern-display>small');if(small)small.textContent=r.loading?'Chargement et relecture…':r.source?.confirmation==='unverified'?'Chargement non confirmé':r.error?'Lecture indisponible':r.pending?'ENTER pour charger · EXIT pour annuler':'VALUE : preset · PARAMETER : champ';const lcd=$('rack').querySelector('svg[viewBox="0 0 262 124"]');if(lcd){const modern=appearance.current.surface==='modern',attrs=modern?'':' x="482" y="26" width="262" height="124"';lcd.outerHTML=renderPresetLCD({presetName:r.name,alphaText:r.alphaText,presetSource:r.source,recall:r},modern?{ink:'var(--accent)',paper:'var(--bg)'}:undefined).replace('<svg ','<svg '+attrs+' ');}const enter=$('rack').querySelector('[data-panel-action="ENTER"]');if(enter){enter.dataset.recallPending=String(r.active&&r.pending);enter.title=r.loading?'Chargement et relecture en cours':r.active?'Charger le preset sélectionné ; aucun STORE':'Valider le preset sélectionné';}}
 const menu=p?.menu??(draftSettingsPage==='modulation'?'MOD':panelScreenMode==='routing'?'EFFECTS':null);
 for(const led of $('rack').querySelectorAll('[data-panel-menu-led]')){const on=led.dataset.panelMenuLed===menu;led.dataset.ledOn=String(on);if(led.tagName.toLowerCase()==='rect')led.setAttribute('fill',on?'#d7ed8b':'#56604d');}
 for(const key of $('rack').querySelectorAll('[data-panel-action]'))if(['EFFECTS','MOD','I/O SETUP'].includes(key.dataset.panelAction))key.setAttribute('aria-pressed',String(key.dataset.panelAction===menu));
 const angles={...panelPositions,PARAMETER:(r?.parameter??p?.parameter??parameterCursor)*15,VALUE:r?dialAngle(r.value,r.minimum,r.maximum):p?.value??localValue,'α MOD':p&&p.alpha!==null?dialAngle(p.alpha,0,127):panelPositions['α MOD']};
 for(const rotor of $('rack').querySelectorAll('[data-panel-rotor]')){if(['PARAMETER','VALUE','α MOD'].includes(rotor.dataset.panelRotor)){rotor.removeAttribute('transform');rotor.style.removeProperty('transform');continue;}const angle=angles[rotor.dataset.panelRotor]??0;if(rotor.dataset.center)rotor.setAttribute('transform',`rotate(${angle} ${rotor.dataset.center})`);else rotor.style.transform=`rotate(${angle}deg)`;}
 const alpha=p?.alphaDisplay??alphaDisplay();paintAlphaStrip($('rack'),alpha);
 for(const hit of $('rack').querySelectorAll('[data-panel-rotary]')){const label=hit.dataset.panelRotary,text=label==='VALUE'?(r?.valueText??p?.valueText??(c?`${value(n,c)} ${c.unit}`:'—')):label==='PARAMETER'?(r?`Recall · ${r.field}`:p?.parameterLabel??c?.label??'—'):label==='α MOD'?alpha.description:'position locale · sans lecture matérielle';hit.title=`${label} · ${text} · glisser / molette / flèches`;hit.setAttribute('aria-label',`${label}, ${text}`);const output=hit.querySelector('output');if(output)output.textContent=label==='α MOD'?alpha.text:['IN','OUT'].includes(label)?'—':text;}

}
function renderRack(){
 panelEntry?.close();
 const display=bufferEditor.active?bufferEditor.rackState:state;
 $('rack').innerHTML=(appearance.current.surface==='modern'?renderModernPanel:renderPanel)({nodes:display.nodes.filter(n=>n.row<display.rows),rows:display.rows,selected:display.selected,cells:display.cells,routes:display.routes,presetName:bufferEditor.active?bufferEditor.buffer.name:'',alphaText:bufferEditor.active?bufferEditor.buffer.alphaText:'',presetStatus:bufferEditor.active?(bufferEditor.live?'P0 · connecté':'Copie locale'):'Brouillon local',presetSource:bufferEditor.active?bufferEditor.presetSource:null,alphaOverview:bufferEditor.active?bufferEditor.panelState.alphaOverview:{},recall:recall.snapshot,screenMode:panelScreenMode,familyFor:findFamily,algorithmFor:findAlgorithm});
 $('rack').dataset.screenMode=panelScreenMode;
 $('rack').querySelector('.lcd-hit').onclick=e=>{
  if(panelScreenMode==='alpha')return bufferEditor.showUtility('alpha');
  if(panelScreenMode!=='preset')return screen.show('routing');
  const rect=$('rack').querySelector('svg[viewBox="0 0 262 124"]').getBoundingClientRect(),x=(e.clientX-rect.left)*262/rect.width,y=(e.clientY-rect.top)*124/rect.height;
  if(x>=223&&y<24)return presetLibrary.open('recall');
  // The name line belongs to double-click rename, not Recall navigation.
  if(y>=78&&y<=100)return;
  recall.start(x<146&&y>=42&&y<58?'bank':x<146&&y>=58&&y<76?'filter':'preset');
 };renderLCDZoom();
 $('rack').querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{
  const action=effectControlAction(display,b.dataset.family,findFamily);
  if(action.kind==='toggle'){if(bufferEditor.active)bufferEditor.setMuted(action.ids,action.muted);else{remember();for(const id of action.ids)state.nodes.find(n=>n.id===id).muted=action.muted;render();}}
  else{if(monobloc.active){$('monobloc').classList.remove('library-collapsed');if(matchMedia('(max-width:650px)').matches)$('monobloc').classList.add('mobile-library-open');syncLibraryButton();requestAnimationFrame(renderWires);}const d=$('families').querySelector(`[data-palette="${b.dataset.family}"]`);if(d){d.open=true;d.scrollIntoView({block:'nearest'});}notice('Aucun effet de cette famille dans la chaîne ; choisissez un algorithme dans la bibliothèque.');}
 });
 $('rack').querySelectorAll('[data-panel-action]').forEach(b=>b.onclick=()=>{
  const action=b.dataset.panelAction;
  if(['TEMPO','BYPASS'].includes(action))return bufferEditor.panelAction(action);
  if(action==='α MOD'&&!bufferEditor.active)return bufferEditor.openPerformance('alpha');
  if(action==='RECALL'){panelScreenMode='preset';recall.start('preset');renderRack();return;}
  if(action==='ENTER'&&panelScreenMode==='preset')return void recall.enter();
  if(action==='EXIT'&&panelScreenMode==='preset'){recall.cancel();return;}
  if(action==='α MOD'&&bufferEditor.active){panelScreenMode='alpha';recall.cancel();bufferEditor.panelAction(action);return;}
  if(bufferEditor.active&&bufferEditor.panelAction?.(action))return;
  if(['RECALL','STORE'].includes(action))return presetLibrary.open(action==='STORE'?'store':'recall');
  if(action==='EFFECTS'){panelScreenMode='routing';recall.cancel();if(bufferEditor.active)bufferEditor.showSettingsPage('signal');renderRack();return;}
  if(action==='MOD')return showTab('modulation');
  if(action==='I/O SETUP')return showTab('protocol');
  if(action==='EXIT'){if(screen.open)return screen.close();panelScreenMode='preset';return renderRack();}
  if(action==='ENTER')return panelScreenMode==='preset'?presetLibrary.open('recall'):screen.show('edit');
  if(['◀','▶'].includes(action)){const modes=['tool','edit','routing','layout'];return screen.show(modes[(modes.indexOf(screen.mode)+(action==='▶'?1:3))%4]);}
  panelInfo(action==='α MOD'?'α MOD key':action);
 });
 $('rack').querySelectorAll('[data-panel-rotary]').forEach(b=>bindRotary(b,{turn:delta=>turnPanel(b.dataset.panelRotary,delta)}));
 syncRackRotaries();indicatorTargets=[...$('rack').querySelectorAll('[data-panel-indicator]')];paintPanelIndicators();
}
function draftSignature(){return JSON.stringify({nodes:state.nodes,rows:state.rows,routes:state.routes,links:state.links});}
function paintPanelIndicators(){
 const s=bufferEditor.indicators,edited=bufferEditor.active?s.edited:draftSignature()!==draftBaseline;
 const titles={Edited:edited?'Edited · patch modifié depuis son chargement':'Edited · patch inchangé depuis son chargement',MIDI:'MIDI · activité réelle des ports sélectionnés (réception et émission)',Tempo:({'midi-rx':'Tempo · MIDI Clock reçu','midi-tx':'Tempo · MIDI Clock émis',internal:'Tempo saisi · BPM matériel non relu',waiting:'Tempo · en attente de MIDI Clock'}[s.tempoSource])+(s.bpm?' · '+s.bpm+' BPM':'')};
 for(const el of indicatorTargets){const name=el.dataset.panelIndicator;if(!['Edited','MIDI','Tempo'].includes(name))continue;const on=!!({Edited:edited,MIDI:s.midi,Tempo:s.tempo}[name]);
  if(el.dataset.ledOn!==String(on))el.dataset.ledOn=String(on);
  if(el.getAttribute('aria-label')!==titles[name]){el.setAttribute('aria-label',titles[name]);el.setAttribute('title',titles[name]);}
  const out=el.querySelector('output');if(out&&out.textContent)out.textContent='';
  if(name==='Tempo'){el.dataset.tempoSource=s.tempoSource;el.dataset.tempoBpm=s.bpm??'';}
 }
 const bypass=$('rack').querySelector('[data-panel-action="BYPASS"]'),bs=bufferEditor.bypassState;if(bypass){bypass.setAttribute('aria-pressed',bs.value===null?'mixed':String(bs.value));bypass.title=bs.value===null?'Bypass · état inconnu ; affectation CTRL nécessaire':`Bypass · ${bs.value?'actif':'inactif'} · ${bs.origin??'CC'} · état physique non acquitté`;}
 const button=$('rack').querySelector('[data-panel-action="TEMPO"]');if(button&&button.title!==titles.Tempo)button.title=titles.Tempo;
}
function syncPaletteCosts(){
 for(const badge of document.querySelectorAll('[data-cost-algorithm]')){
  const a=badge.dataset.costAlgorithm,observed=bufferEditor.active?null:state.costs[costKey(a,state.rate)],cost=observed??deviceMap.algorithms[a]?.dsp;
  const known=Number.isFinite(cost)&&cost>=0;badge.hidden=!showPaletteDsp||!known;
  if(known){badge.textContent=`[${cost}]`;badge.title=observed!=null?`Coût DSP saisi : ${cost} % par instance à ${state.rate===44100?'44,1':'48'} kHz. Relevé local.`:`Coût DSP estimé : ${cost} % par instance. Modèle indicatif, non mesuré ; les options du bloc peuvent modifier la charge.`;badge.setAttribute('aria-label',badge.title);}
 }
}

function renderPalette(){
  const q=$('search').value.trim().toLowerCase();
 $('families').innerHTML=families.map(f=>{
  const count=(bufferEditor.active?bufferEditor.buffer.nodes:state.nodes).filter(n=>findFamily(n.algorithm).id===f.id).length;
  const algos=f.algorithms.filter(a=>(a.name+' '+f.name+' '+a.description).toLowerCase().includes(q));
  return algos.length?`<details class="family-list" data-palette="${f.id}" ${q||paletteOpen.has(f.id)?'open':''}><summary>${f.name}<small>${count} / ${f.max}</small></summary>${algos.map(a=>`<button draggable="true" data-add="${a.id}" title="Glisser sur une case ; cliquer pour ajouter en série"><span class="grip">⠿</span>${familySymbol(f.id)}<span class="algorithm-name">${a.name} ${costBadge(a.id).replace('class="dsp-cost"','class="dsp-cost algorithm-cost" data-palette-cost')}</span><small>${count>=f.max?'limite atteinte':'+'}</small></button>`).join('')}</details>`:'';
 }).join('')||'<p>Aucun algorithme trouvé.</p>';
 $('families').insertAdjacentHTML('beforeend',`<details class="family-list" open><summary>Routage</summary>${routingItems.filter(x=>(x.label+' routage pipeline liaison').toLowerCase().includes(q)).map(({type,label,max})=>{const count=(bufferEditor.active?bufferEditor.buffer.cells:state.routes??[]).filter(c=>c.type===type).length;return `<button draggable="true" data-routing-add="${type}" title="${max===null?'Pas de quota propre ; limité aux cases disponibles de la grille':'Un seul élément de ce type par preset'}"><span class="grip">⠿</span><span class="routing-label">${label}</span><small class="routing-quota" aria-label="${count} utilisé(s), ${max===null?'pas de quota propre':'maximum '+max}">${count} / ${max??'∞'}</small><small>+</small></button>`;}).join('')}</details>`);
 const total=families.reduce((sum,f)=>sum+f.algorithms.length,0),shown=$('families').querySelectorAll('[data-add]').length;
 $('families').insertAdjacentHTML('afterbegin',`<div class="library-summary"><span class="library-count">${shown} / ${total} algorithmes</span>${hintButton('12 familles et 5 éléments de routage. Glissez un algorithme vers la matrice. Le mode choisi détermine le raccordement lors d’un clic ou d’un dépôt sur un bloc de référence.','Aide : ajouter et raccorder un bloc')}</div><label class="palette-cost-toggle" title="Afficher entre crochets le coût DSP par instance, en %. Estimation indicative, pas une mesure matérielle."><input id="palette-dsp" type="checkbox" ${showPaletteDsp?'checked':''}>Coût DSP estimé</label><label class="placement-controls"><select id="connection-mode" aria-label="Mode de raccordement des nouveaux blocs"><option value="free">Placement libre</option><option value="series">Série après</option><option value="parallel">Parallèle jusqu’à OUT</option><option value="return">Parallèle puis retour en série</option></select></label>`);
 $('palette-dsp').onchange=e=>{showPaletteDsp=e.target.checked;try{localStorage.setItem('fireworx-palette-dsp-v1',String(showPaletteDsp));}catch{}syncPaletteCosts();};syncPaletteCosts();
 $('connection-mode').value=connectionMode;$('connection-mode').onchange=e=>{connectionMode=e.target.value;notice(connectionMode==='free'?'Déposez sur une case ; un bloc occupé est décalé à droite.':'Choisissez le bloc de référence, puis cliquez un algorithme ; ou déposez directement sur le bloc de référence.');};
 if(bufferEditor.active){const utilities=bufferEditor.utilityItems.filter(u=>(u.label+' modulateur').toLowerCase().includes(q));if(utilities.length)$('families').insertAdjacentHTML('beforeend',`<details class="family-list" open><summary>Modulateurs · édition</summary>${utilities.map(u=>`<button data-utility-add="${u.id}">${u.label}<small>éditer</small></button>`).join('')}</details>`);$('families').querySelectorAll('[data-utility-add]').forEach(b=>b.onclick=()=>bufferEditor.showUtility(b.dataset.utilityAdd));}
 $('families').querySelectorAll('[data-routing-add]').forEach(b=>{const type=Number(b.dataset.routingAdd);b.onclick=()=>bufferEditor.active?bufferEditor.addRouting(type):state.target?applyPlacement({kind:'routing-library',type},state.target):notice('Choisissez une case vide pour ce routage');bindDragSource(b,{kind:'routing-library',type});});
 $('families').querySelectorAll('[data-add]').forEach(b=>{b.onclick=()=>{if(performance.now()>=ignoreClickUntil)add(b.dataset.add);};bindDragSource(b,{kind:'library',algorithm:b.dataset.add});});
 $('families').querySelectorAll('[data-palette]').forEach(d=>d.ontoggle=()=>{if(!d.isConnected)return;if(d.open)paletteOpen.add(d.dataset.palette);else paletteOpen.delete(d.dataset.palette);});
}
function add(id){if(bufferEditor.active)return connectionMode==='free'?bufferEditor.add(id):bufferEditor.connect({kind:'library',algorithm:id},bufferEditor.selected,connectionMode);try{if(connectionMode!=='free'){const next=connectStudyBlock(state,{kind:'library',algorithm:id},state.selected,connectionMode);assertDraftBudget(next.state);remember();Object.assign(state,next.state);render();return notice(next.message);}applyPlacement({kind:'library',algorithm:id},state.target??appendOrGrow());}catch(e){notice(e.message);}}
let nativeDrag=null,ignoreClickUntil=0;
const dragType='application/x-midi-studio-fireworx';
function clearDropMarks(){document.querySelectorAll('.drop-ready,.drag-origin').forEach(el=>el.classList.remove('drop-ready','drag-origin'));document.body.classList.remove('dragging-block');}
function readDrag(event){try{const text=event.dataTransfer?.getData(dragType);return text?JSON.parse(text):nativeDrag;}catch{return null;}}
function bindDragSource(el,payload){
 el.ondragstart=e=>{nativeDrag=payload;e.dataTransfer.setData(dragType,JSON.stringify(payload));e.dataTransfer.effectAllowed=payload.kind.endsWith('library')?'copy':'move';el.classList.add('drag-origin');document.body.classList.add('dragging-block');};
 el.ondragend=()=>{nativeDrag=null;ignoreClickUntil=performance.now()+200;clearDropMarks();};
 el.onpointerdown=e=>{
  if(e.pointerType!=='touch'||!e.target.closest('.grip,.cell'))return;
  const start={x:e.clientX,y:e.clientY};let dragging=false,ghost=null;
  const move=event=>{
   if(!dragging&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<9)return;
   if(!dragging){dragging=true;document.body.classList.add('dragging-block');ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=payload.kind.startsWith('routing')?'Routage':payload.kind==='library'?findAlgorithm(payload.algorithm).name:findAlgorithm((bufferEditor.active?bufferEditor.buffer.nodes:state.nodes).find(n=>n.id===payload.id).algorithm).name;document.body.append(ghost);}
   event.preventDefault();ghost.style.left=`${event.clientX+12}px`;ghost.style.top=`${event.clientY+12}px`;clearDropMarks();document.body.classList.add('dragging-block');
   document.elementFromPoint(event.clientX,event.clientY)?.closest('#grid .cell')?.classList.add('drop-ready');
   if(event.clientY>innerHeight-55)scrollBy(0,18);if(event.clientY<55)scrollBy(0,-18);
  };
  const end=event=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);ghost?.remove();clearDropMarks();if(!dragging)return;ignoreClickUntil=performance.now()+300;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('#grid .cell');if(target)applyPlacement(payload,{col:Number(target.dataset.col),row:Number(target.dataset.row)});else notice('Déplacement annulé : déposez le bloc sur la matrice.');};
  const cancel=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);ghost?.remove();clearDropMarks();};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
 };
}
function bindDropTargets(){
 $('grid').querySelectorAll('.cell').forEach(el=>{
  el.ondragover=e=>{if(!nativeDrag&&!Array.from(e.dataTransfer?.types??[]).includes(dragType))return;e.preventDefault();clearDropMarks();el.classList.add('drop-ready');e.dataTransfer.dropEffect=nativeDrag?.kind.endsWith('library')?'copy':'move';};
  el.ondragleave=()=>el.classList.remove('drop-ready');
  el.ondrop=e=>{e.preventDefault();const payload=readDrag(e);clearDropMarks();if(!payload)return notice('Objet non reconnu : utilisez un bloc de la bibliothèque.');if(e.shiftKey&&payload.kind==='node'&&el.dataset.node)applyPlacement(payload,el.dataset.node,true);else applyPlacement(payload,{col:Number(el.dataset.col),row:Number(el.dataset.row)});nativeDrag=null;ignoreClickUntil=performance.now()+250;};
  el.onkeydown=e=>{if(el.dataset.routingNode&&['Delete','Backspace'].includes(e.key)){e.preventDefault();const pos={col:Number(el.dataset.col),row:Number(el.dataset.row)};if(bufferEditor.active)bufferEditor.removeCell(pos);else{remember();state.routes=state.routes.filter(r=>r.col!==pos.col||r.row!==pos.row);render();}return;}if(!e.altKey||!el.dataset.node||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const pos={col:Number(el.dataset.col)+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0),row:Number(el.dataset.row)+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)};const id=el.dataset.node;applyPlacement({kind:'node',id},pos);$('grid').querySelector(`[data-node="${id}"]`)?.focus();};
 });
}
function syncMatrixViewport(){
 const rows=bufferEditor.active?bufferEditor.buffer.rows:state.rows,cells=bufferEditor.active?bufferEditor.buffer.cells:[...state.nodes,...(state.routes??[])];
 const view=matrixViewport({rows,cells,target:bufferEditor.active?null:state.target,room:bufferEditor.active||draftRoom(),growRows:!bufferEditor.active},$('matrix-density').value),flow=document.querySelector('.flow'),routing=$('routing');
 flow.classList.add('matrix-adaptive');flow.classList.toggle('overview',view.full);flow.dataset.viewColumns=String(view.columns);flow.dataset.viewRows=String(view.rows);
 for(const el of [flow,routing]){el.style.setProperty('--matrix-view-columns',view.columns);el.style.setProperty('--matrix-view-rows',view.rows);el.style.setProperty('--matrix-height-rows',view.heightRows);}
 $('grid').setAttribute('aria-label',`Matrice audio : ${view.columns} colonnes affichées, ${view.rows} lignes sur ${rows} actives`);
 $('matrix-density').querySelector('[value="readable"]').textContent=`Auto · ${view.full?Math.max(6,view.usedColumns):view.columns} × ${view.full?Math.max(Math.min(4,rows),view.usedRows):view.rows}`;
 $('matrix-density').title='Auto : jusqu’à 6 × 4, étendue si un bloc ou un routage utilise davantage de cases. Grille complète : accès aux huit colonnes et à toutes les lignes actives. Sans modification MIDI.';
 for(const cell of $('grid').children){const col=Number(cell.dataset.col),row=Number(cell.dataset.row);cell.hidden=col>=view.columns||row>=view.rows;cell.style.gridColumn=String(col+1);cell.style.gridRow=String(row+1);}
 return view;
}
function renderGrid(){
 if(bufferEditor.active){bufferEditor.renderGrid($('grid'));$('grid').querySelectorAll('[data-node]').forEach(b=>bindDragSource(b,{kind:'node',id:b.dataset.node}));$('grid').querySelectorAll('[data-routing-node]').forEach(b=>bindDragSource(b,{kind:'routing-node',from:{col:Number(b.dataset.col),row:Number(b.dataset.row)}}));bindDropTargets();$('grid-status').textContent=`${bufferEditor.buffer.nodes.length} moteurs · ${bufferEditor.buffer.rows} lignes · édition en direct`;$('routing-kind').textContent='Glisser pour déplacer · Maj pour échanger';syncMatrixViewport();syncPaletteCosts();requestAnimationFrame(renderWires);return;}
 $('grid').innerHTML=Array.from({length:Math.min(8,state.rows+1)*8},(_,i)=>{const col=i%8,row=Math.floor(i/8),ghost=row===state.rows;if(ghost)return `<button class="cell empty ghost-row" data-col="${col}" data-row="${row}" data-grow-row="true" aria-label="Colonne ${col+1}, ligne ${row+1} (nouvelle ligne)" title="Nouvelle ligne : y placer un bloc ajoute la ligne ${row+1}">+</button>`;const n=state.nodes.find(n=>n.col===col&&n.row===row),a=n&&findAlgorithm(n.algorithm),f=n&&findFamily(n.algorithm),route=state.routes?.find(r=>r.col===col&&r.row===row);return `<button class="cell ${n||route?'':'empty'} ${route?'route-cell':''} ${n?.id===state.selected?'selected':''} ${state.target?.col===col&&state.target?.row===row?'target':''} ${n?.muted?'muted':''}" data-col="${col}" data-row="${row}" ${n?`draggable="true" data-node="${n.id}"`:route?`draggable="true" data-routing-node="${route.type}"`:''} aria-label="Colonne ${col+1}, ligne ${row+1}${n?', '+f.name+' '+a.name:', vide'}" ${n?`aria-pressed="${n.id===state.selected}"`:''}>${n?'<span class="cell-label">'+short(f.id)+' '+costBadge(a.id)+'</span><small>'+a.name+'</small>':route?routingItems.find(x=>x.type===route.type).label:'+'}</button>`;}).join('');
 $('grid').querySelectorAll('.cell').forEach(b=>b.onclick=()=>{if(performance.now()<ignoreClickUntil)return;if(b.dataset.node)select(b.dataset.node);else if(b.dataset.growRow){try{const next=resizeGrid(state,state.rows+1);remember();Object.assign(state,next.state);state.target={col:Number(b.dataset.col),row:Number(b.dataset.row)};render();notice(`Ligne ${state.rows} ajoutée ; case ${state.target.col+1}:${state.target.row+1} choisie. Ajoutez un algorithme à gauche.`);}catch(e){notice(e.message);}}else{state.target={col:Number(b.dataset.col),row:Number(b.dataset.row)};renderGrid();notice(`Case ${state.target.col+1}:${state.target.row+1} choisie. Ajoutez un algorithme à gauche.`);}});
 $('grid').querySelectorAll('[data-node]').forEach(b=>bindDragSource(b,{kind:'node',id:b.dataset.node}));
 $('grid').querySelectorAll('[data-routing-node]').forEach(b=>bindDragSource(b,{kind:'routing-node',from:{col:Number(b.dataset.col),row:Number(b.dataset.row)}}));
 bindDropTargets();
 $('grid-status').textContent=`${state.nodes.filter(n=>n.row<state.rows).length} blocs actifs · ${state.nodes.filter(n=>n.row>=state.rows).length} hors cadre conservés · ${state.rows} lignes`;
 syncMatrixViewport();syncPaletteCosts();requestAnimationFrame(renderWires);
}
function renderWires(){
 const stage=document.querySelector('.routing-stage'),svg=$('wires');if(!stage||!svg||stage.getBoundingClientRect().width===0)return;
 const rect=stage.getBoundingClientRect(),rows=bufferEditor.active?bufferEditor.buffer.rows:state.rows,cells=bufferEditor.active?bufferEditor.buffer.cells:[...state.nodes,...(state.routes??[])];
 const topology=matrixTopology(cells,rows),box=c=>{const el=$('grid').querySelector(`[data-col="${c.col}"][data-row="${c.row}"]`);if(!el)return null;const b=el.getBoundingClientRect();return {x:b.x-rect.x,y:b.y-rect.y+b.height/2,w:b.width};};
 svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
 const selected=bufferEditor.active?bufferEditor.selected:state.selected;
 svg.innerHTML=topology.edges.map(e=>{const a=typeof e.from==='string'?null:box(e.from),b=typeof e.to==='string'?null:box(e.to);if(!a&&!b)return '';const x1=a?(e.kind==='split'?a.x-7:a.x+a.w):0,y1=a?.y??b.y,x2=b?b.x-7:rect.width,y2=b?.y??a.y,join=['split','merge'].includes(e.kind),focused=[e.from?.node,e.to?.node,e.from?.id,e.to?.id].includes(selected);return `<path class="flow-wire ${focused?'selected-wire':''}" data-link-kind="${e.kind}" d="M${x1} ${y1}H${x2}V${y2}${b?'H'+b.x:''}"/>${join?`<circle class="flow-junction" data-junction="${e.kind}" cx="${e.kind==='split'?x1:x2}" cy="${e.kind==='split'?y1:y2}" r="3.5"/>`:''}`;}).join('');
 for(const seg of topology.segments){const el=$('grid').querySelector(`[data-col="${seg.start.col}"][data-row="${seg.start.row}"]`);if(el){el.classList.toggle('routing-unconnected',!seg.fed||!seg.output);if(!seg.fed||!seg.output)el.title=(!seg.fed?'Branche sans entrée alimentée':'Branche sans sortie')+' · ajoutez un pipeline ou rapprochez les blocs';}}
 $('routing-kind').classList.toggle('routing-warning',topology.warnings.length>0);$('routing-kind').textContent=topology.warnings.length?topology.warnings.join(' · '):`${topology.segments.length} branche(s) · série / parallèle selon les positions`;
 portLinks.render();
}

function setControl(id,index,next){
 const n=state.nodes.find(n=>n.id===id),c=controlsFor(n.algorithm)[index];if(!c||isLinked(n,c)||c.manualStatus==='unconfirmed')return;
 const snapped=c.kind==='choice'?next:Math.max(c.min,Math.min(c.max,Math.round(next/c.step)*c.step));
 if(!validControlValue(c,snapped))return notice('Valeur hors du domaine de cette maquette.');
 if(Object.is(value(n,c),snapped))return;
 if(sliderCheckpoint!==`${id}:${index}`){remember();sliderCheckpoint=`${id}:${index}`;}
 n.values[key(n,c)]=c.kind==='choice'?snapped:Number(snapped.toFixed(4));
 const input=$(`${id}-p${index}`);if(input){input.value=String(n.values[key(n,c)]);input.parentElement.style.setProperty('--dial-angle',`${c.kind==='choice'?dialAngle(c.options.indexOf(n.values[key(n,c)]),0,c.options.length-1):dialAngle(n.values[key(n,c)],c.min,c.max)}deg`);}
 if($(`${id}-o${index}`))$(`${id}-o${index}`).textContent=`${n.values[key(n,c)]} ${c.unit}`;
 const dial=document.querySelector(`[data-dial="${index}"][data-id="${id}"]`);if(dial){dial.setAttribute('aria-valuenow',String(c.kind==='choice'?c.options.indexOf(n.values[key(n,c)]):n.values[key(n,c)]));dial.setAttribute('aria-valuetext',`${n.values[key(n,c)]} ${c.unit}`);}
 parameterCursor=index;syncRackRotaries();
 const visual=document.querySelector(`[data-visual="${id}"]`);if(visual)visual.outerHTML=visualFor(n,value);
 bindVisuals(id);
 notice(`${c.label} = ${n.values[key(n,c)]} ${c.unit} · édition locale, aucun envoi.`);
}
function bindVisuals(onlyId){
 const roots=onlyId?[document.querySelector(`[data-visual="${onlyId}"]`)]:document.querySelectorAll('[data-visual]');
 for(const root of roots){if(!root)continue;
  root.onpointerdown=e=>{
   const target=e.target.closest('[data-vcontrol]');if(!target)return;
   const id=target.dataset.id,index=Number(target.dataset.vcontrol),n=state.nodes.find(n=>n.id===id),c=controlsFor(n.algorithm)[index];if(isLinked(n,c))return notice('Paramètre piloté par un modulateur. Retirez son lien pour éditer sa valeur locale.');
   e.preventDefault();sliderCheckpoint=null;const svg=root.querySelector('svg'),matrix=svg.getScreenCTM()?.inverse();if(!matrix)return;
   const change=event=>{const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix);let t=target.dataset.axis==='y'?(205-point.y)/180:(point.x-45)/650;t=Math.max(0,Math.min(1,t));const plotMin=n.algorithm==='resonance'?20:c.min,plotMax=n.algorithm==='resonance'?16000:c.max;setControl(id,index,target.dataset.log==='true'?plotMin*Math.pow(plotMax/plotMin,t):c.min+(c.max-c.min)*t);};
   const end=()=>{sliderCheckpoint=null;window.removeEventListener('pointermove',change);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};
   window.addEventListener('pointermove',change);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});change(e);
  };
  root.onkeydown=e=>{const target=e.target.closest('[data-vcontrol]');if(!target||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const id=target.dataset.id,index=Number(target.dataset.vcontrol),n=state.nodes.find(n=>n.id===id),c=controlsFor(n.algorithm)[index];setControl(id,index,value(n,c)+(['ArrowUp','ArrowRight'].includes(e.key)?c.step:-c.step));document.querySelector(`[data-visual="${id}"] [data-vcontrol="${index}"]`)?.focus();};
 }
}
function bindParameterMap(){
 $('editors').querySelectorAll('[data-param]').forEach(b=>b.onclick=()=>{
  const n=state.nodes.find(n=>n.id===b.dataset.id),c=controlsFor(n.algorithm).find(c=>c.label===b.dataset.param);
  const area=$(`explain-${n.id}`);area.textContent=c?`${c.label} : ${c.comment} ${c.kind==='choice'?'Choix : '+c.options.join(', '):'Domaine local '+c.min+' à '+c.max+' '+c.unit}. Manuel p. ${c.page}.`:`${b.dataset.param} : paramètre recensé, manuel p. ${findAlgorithm(n.algorithm).page}. Réglage local de démonstration ; domaine matériel encore à confirmer.`;
  area.classList.add('highlight');setTimeout(()=>area.classList.remove('highlight'),450);
  if(c){ // descriptors are freshly allocated; resolve by label
   const index=controlsFor(n.algorithm).findIndex(x=>x.label===c.label);$(`${n.id}-p${index}`)?.focus();}
 });
}
function renderBudget(){
 syncPaletteCosts();
 if(bufferEditor.active)return bufferEditor.renderBudget($('dsp-budget'));
 const wasOpen=$('dsp-budget').querySelector('.budget-detail')?.open??false;const estimated=draftDspEstimate(state);
 const b=summarizeBudget(state.nodes.filter(n=>n.row<state.rows),findFamily,state.costs,state.rate,state.baselines[state.rate],state.pitchDetector);
 const total=b.predicted!==null?`${b.predicted} %`:`${b.envelope[0]}–${b.envelope[1]} %`;
 const severity=b.status.includes('overload')?'warning':b.status==='unverified'?'unknown':'estimated';
 const status=b.status==='predicted-overload'?'DÉPASSEMENT PRÉVU':b.status==='family-envelope-overload'?'ENVELOPPE DE FAMILLE > 100 %':b.status==='uncertain-overload'?'DÉPASSEMENT POSSIBLE':b.status==='predicted-within'?'ESTIMATION ≤ 100 %':'CHARGE NON VALIDÉE';
 $('dsp-budget').innerHTML=dspBanner(estimated)+`<p>${b.predicted===null?'Fourchettes de familles cumulées : borne haute indicative, aucun budget matériel certifié.':'Somme des coûts saisis + charge de base + modulateurs connus : modèle additif à vérifier sur l’appareil.'} ${b.known}/${b.count} coûts d’algorithmes renseignés à ${state.rate===44100?'44,1':'48'} kHz.</p><details class="budget-detail" ${wasOpen?'open':''}><summary>Détail des coûts et dépassement</summary><table><thead><tr><th>Instance</th><th>Algorithme</th><th>Famille (indicatif)</th><th>Saisie opérateur</th></tr></thead><tbody>${b.items.map(item=>`<tr><td>${item.node}</td><td>${findAlgorithm(item.algorithm).name}</td><td>${item.envelope.join('–')} %</td><td>${item.observed??'—'} ${item.observed===null?'':'%'}</td></tr>`).join('')}</tbody></table><div class="budget-options"><label>Fréquence<select id="dsp-rate"><option value="44100" ${state.rate===44100?'selected':''}>44,1 kHz</option><option value="48000" ${state.rate===48000?'selected':''}>48 kHz</option></select></label><label>Charge de base observée (%)<input id="dsp-baseline" type="number" min="0" max="100" step="0.1" placeholder="Inconnue" value="${state.baselines[state.rate]??''}"></label><label class="check"><input id="pitch-detector" type="checkbox" ${state.pitchDetector?'checked':''}> Pitch Detector actif (+4 %, manuel p. 34)</label></div><p>La charge s’additionne aussi en parallèle. Un Mute n’est pas une preuve de libération du DSP. Mode Secure : sorties coupées en surcharge ; mode Free : signal potentiellement dégradé (manuel p. 48). Aucun de ces modes matériels n’est changé ici.</p></details>`;
 bindDspCeiling($('dsp-budget'),notice);$('dsp-open').onclick=()=>{const detail=$('dsp-budget').querySelector('.budget-detail');detail.open=!detail.open;$('dsp-budget').classList.toggle('details-open',detail.open);};
 $('dsp-rate').onchange=e=>{state.rate=Number(e.target.value);renderBudget();};
 $('dsp-baseline').oninput=e=>{const v=e.target.value===''?null:e.target.valueAsNumber;if(v===null||(Number.isFinite(v)&&v>=0&&v<=100))state.baselines[state.rate]=v;};
 $('dsp-baseline').onchange=e=>{const v=e.target.value===''?null:e.target.valueAsNumber;if(v!==null&&(!Number.isFinite(v)||v<0||v>100))return notice('Charge de base : valeur de 0 à 100 % requise.');state.baselines[state.rate]=v;renderBudget();};
 $('pitch-detector').onchange=e=>{state.pitchDetector=e.target.checked;renderBudget();};
 for(const n of state.nodes){const el=document.querySelector(`[data-cost-block="${n.id}"]`);if(!el)continue;const observed=state.costs[costKey(n.algorithm,state.rate)];el.innerHTML=`<label>Coût DSP observé de cet algorithme à ${state.rate===44100?'44,1':'48'} kHz (%)<input data-observation="${n.id}" type="number" min="0" max="100" step="0.1" placeholder="Non mesuré" value="${observed??''}"></label><small>Saisie locale depuis Effects → Tool → DSP Load. Réutilisée pour les instances du même algorithme à cette fréquence ; validation multi-instance requise.</small>`;el.querySelector('input').oninput=e=>{const k=costKey(n.algorithm,state.rate),v=e.target.valueAsNumber;if(e.target.value==='')delete state.costs[k];else if(Number.isFinite(v)&&v>=0&&v<=100)state.costs[k]=v;};el.querySelector('input').onchange=e=>{const v=e.target.valueAsNumber,k=costKey(n.algorithm,state.rate);if(e.target.value==='')delete state.costs[k];else if(Number.isFinite(v)&&v>=0&&v<=100)state.costs[k]=v;else return notice('Coût DSP : valeur de 0 à 100 % requise.');renderBudget();};}
}
function bindDials(){
 $('editors').querySelectorAll('[data-dial]').forEach(d=>{
  const id=d.dataset.id,index=Number(d.dataset.dial),n=state.nodes.find(n=>n.id===id),c=controlsFor(n.algorithm)[index],choice=c.kind==='choice';
  bindRotary(d,{get:()=>choice?c.options.indexOf(value(n,c)):value(n,c),min:choice?0:c.min,max:choice?c.options.length-1:c.max,step:choice?1:c.step,set:v=>setControl(id,index,choice?c.options[v]:v),onStart:()=>{sliderCheckpoint=null;parameterCursor=index;},onEnd:()=>{sliderCheckpoint=null;}});
 });
}

function renderControl(n,c,i){
 const linked=isLinked(n,c)||c.manualStatus==='unconfirmed',demo=c.rangeKind==='normalized-demo',proposed=['study-options','study-bounded'].includes(c.rangeKind),v=value(n,c);
 const status=c.manualStatus==='unconfirmed'?'Non confirmé · inactif':linked?'Lié':demo?'Démo 0–100':proposed?'À valider':'Documenté';
 if(c.kind==='choice'&&c.options.length>0&&c.options.length<=5)return `<div class="parameter parameter-compact parameter-enum ${/^Out [LR](?: routing)?$/i.test(c.label)?'parameter-output-route':''} ${linked?'disabled-control':''}" data-domain="${c.rangeKind}"><div class="parameter-top"><label>${c.label}</label>${hintButton(`${c.comment}\n${status}`,`Informations : ${c.label}`)}</div><select class="parameter-choice-list" data-choice-list size="${Math.max(2,c.options.length)}" id="${n.id}-p${i}" data-choice="${i}" data-id="${n.id}" aria-label="${c.label}, choisir la valeur" ${linked?'disabled':''}>${c.options.map(option=>`<option ${v===option?'selected':''}>${option}</option>`).join('')}</select>${linked?`<span class="parameter-state">${status}</span>`:''}</div>`;
 const angle=c.kind==='choice'?dialAngle(c.options.indexOf(v),0,c.options.length-1):dialAngle(v,c.min,c.max);
 return `<div class="parameter parameter-compact ${linked?'disabled-control':''} ${c.kind==='choice'?'choice-control':'dial-control'}" data-domain="${c.rangeKind}" data-fw-style="--dial-angle:${angle}deg"><div class="parameter-top"><label>${c.label}</label>${hintButton(`${c.comment}\n${status}`,`Informations : ${c.label}`)}</div><div class="parameter-knob"><button class="dial-face" type="button" role="slider" aria-label="${c.label}, bouton rotatif" aria-valuemin="${c.kind==='choice'?0:c.min}" aria-valuemax="${c.kind==='choice'?c.options.length-1:c.max}" aria-valuenow="${c.kind==='choice'?c.options.indexOf(v):v}" aria-valuetext="${v} ${c.unit}" data-dial="${i}" data-id="${n.id}" ${linked?'disabled':''}><i></i></button></div><output class="parameter-value" id="${n.id}-o${i}" data-draft-value="${i}" data-id="${n.id}" role="button" tabindex="${linked?'-1':'0'}" aria-disabled="${linked}" aria-controls="${n.id}-p${i}" aria-expanded="false" title="Double-clic ou Entrée : saisir · Entrée : valider · Échap : annuler">${v} ${c.unit}</output>${c.kind==='choice'?`<select hidden class="parameter-entry" id="${n.id}-p${i}" data-choice="${i}" data-id="${n.id}" aria-label="${c.label}, choisir la valeur" ${linked?'disabled':''}>${c.options.map(option=>`<option ${v===option?'selected':''}>${option}</option>`).join('')}</select>`:`<input hidden class="parameter-entry" id="${n.id}-p${i}" data-control="${i}" data-id="${n.id}" type="text" inputmode="decimal" value="${v}" aria-label="${c.label}, saisir la valeur" ${linked?'disabled':''}>`}${linked?`<span class="parameter-state">${status}</span>`:''}</div>`;
}
function renderEditors(){
 if(!bufferEditor.active){$('block-tabs').hidden=false;$('block-tabs').closest('.working-area')?.classList.remove('settings-setup-active');}
 if(bufferEditor.active){bufferEditor.renderEditors($('editors'),$('block-tabs'));syncPaletteCosts();modulationGestures?.decorate();return;}
 const nodes=state.nodes.filter(n=>n.row<state.rows).sort((a,b)=>a.row-b.row||a.col-b.col);
 settingsNavigation($('block-tabs'),{page:draftSettingsPage,items:draftSettingsPage==='signal'?nodes.map(n=>blockSelector(n,{selected:state.selected,nodes:state.nodes})).join(''):'<span class="settings-local-state">Brouillon local · liens sémantiques</span>',onPage:page=>{draftSettingsPage=page;renderEditors();syncRackRotaries();}});
 $('block-tabs').querySelectorAll('[data-edit-node]').forEach(b=>b.onclick=()=>select(b.dataset.editNode));
 if(draftSettingsPage==='modulation'){renderDraftModulations($('editors'),{state,commit:next=>{remember();Object.assign(state,next);render();notice('Modulation locale mise à jour.');},onNotice:notice});modulationGestures?.decorate();return;}
 $('editors').dataset.view=editorView;
 $('editors').innerHTML=state.nodes.filter(n=>n.id===state.selected).map(n=>{
  const a=findAlgorithm(n.algorithm),f=findFamily(n.algorithm),controls=controlsFor(n.algorithm),workspace=familyWorkspaces[f.id];
  const groups=parameterGroups(f.id,controls);
  const grouped=renderSignalSettings(groups,(g,j)=>`<section class="control-group settings-section ${g.side?'settings-io signal-rail signal-'+g.side:''}" data-group-index="${j}" aria-labelledby="${n.id}-section-${j}"><h3 id="${n.id}-section-${j}"><span aria-hidden="true">${g.side?'→':String(j+1).padStart(2,'0')}</span>${g.name}</h3><div class="controls">${g.items.map(({control,index})=>renderControl(n,control,index)).join('')}</div></section>`);
  return `<article class="engine" data-settings="single" data-engine="${n.id}"><header class="engine-summary"><span class="ordinal">${short(f.id)}</span><strong>${a.name} ${costBadge(a.id)}</strong><small>${n.col+1}:${n.row+1} · ${f.name} · Manuel p. ${a.page}</small></header><div class="engine-content" data-family-workspace="${f.id}"><div class="workspace-caption">${familySymbol(f.id)}<div><p class="eyebrow">${workspace.name.toUpperCase()}</p><p>${workspace.hint}</p></div></div><p class="algorithm-description">${a.description}</p><div class="engine-toolbar"><label>Algorithme<select data-algorithm="${n.id}">${f.algorithms.map(x=>`<option value="${x.id}" ${x.id===a.id?'selected':''}>${x.name}</option>`).join('')}</select></label><label>Colonne<select data-position="col" data-id="${n.id}">${Array.from({length:8},(_,i)=>`<option value="${i}" ${i===n.col?'selected':''}>${i+1}</option>`).join('')}</select></label><label>Ligne<select data-position="row" data-id="${n.id}">${Array.from({length:state.rows},(_,i)=>`<option value="${i}" ${i===n.row?'selected':''}>${i+1}</option>`).join('')}</select></label><button data-mute="${n.id}" aria-pressed="${n.muted}">${n.muted?'Réactiver':'Mute local'}</button><button data-remove="${n.id}" class="remove">Retirer ×</button></div>${visualFor(n,value)}<div class="grouped-controls" data-fw-style="--settings-columns:${Math.max(1,Math.min(3,groups.filter(g=>g.name!=='Entrée / sortie').length))}">${grouped}</div><div class="parameter-map" aria-label="Paramètres de ${a.name}">${expandParameters(a.parameters).map(p=>`<button data-param="${p.replace(/\*$/,'')}" data-id="${n.id}">${p}</button>`).join('')}</div><p class="parameter-explanation" id="explain-${n.id}">Sélectionnez un paramètre : les poignées graphiques et les commandes partagent la même valeur locale.</p><div class="block-cost" data-cost-block="${n.id}"></div><div class="inventory"><b>Provenance des paramètres</b><br><em>* : accessible à la matrice dans le manuel.</em><br><span class="todo">480 champs sémantiques réglables ; deux champs Advanced non confirmés restent désactivés. les échelles de démonstration restent distinctes des domaines documentés. Adresses MIDI inconnues pour tous les paramètres. DSP ${f.dsp} % : plage indicative de famille à 44,1/48 kHz, pas une mesure de cet algorithme.</span></div></div></article>`;
 }).join('')||'<p class="helper">Ajoutez un premier bloc depuis la bibliothèque.</p>';
 const selected=state.nodes.find(n=>n.id===state.selected),toolbar=$('editors').querySelector('.engine-toolbar');
 if(selected&&toolbar){
  const host=document.createElement('div');host.className='connection-host';$('editors').querySelector('.grouped-controls').append(host);
  mountConnectionEditor(host,{nodes:state.nodes.filter(n=>n.row<state.rows),selected:selected.id,choices:connectionChoices,label:n=>findAlgorithm(n.algorithm).name,
   preview:(anchor,mode)=>{const next=connectStudyBlock(state,{kind:'node',id:selected.id},anchor,mode).state;return {...next.nodes.find(n=>n.id===selected.id),changed:JSON.stringify(next)!==JSON.stringify(state)};},
   apply:(anchor,mode)=>{try{const next=connectStudyBlock(state,{kind:'node',id:selected.id},anchor,mode);assertDraftBudget(next.state);remember();Object.assign(state,next.state);render();notice(next.message);}catch(e){notice(e.message);}}});
 }
 $('editors').querySelectorAll('[data-algorithm]').forEach(s=>s.onchange=()=>{const n=state.nodes.find(n=>n.id===s.dataset.algorithm),next=structuredClone(state);next.nodes.find(z=>z.id===n.id).algorithm=s.value;try{assertDraftBudget(next);}catch(e){s.value=n.algorithm;return notice(e.message);}remember();state.links=state.links.filter(l=>l.node!==n.id);n.algorithm=s.value;parameterCursor=0;state.selected=n.id;render();notice('Algorithme changé localement ; liens de cette instance retirés. Les anciennes valeurs restent dans le brouillon.');});
 $('editors').querySelectorAll('[data-position]').forEach(s=>s.onchange=()=>{const n=state.nodes.find(n=>n.id===s.dataset.id),v=Number(s.value),p={col:n.col,row:n.row,[s.dataset.position]:v};if(state.nodes.some(x=>x!==n&&x.col===p.col&&x.row===p.row)){s.value=n[s.dataset.position];return notice('Case occupée : déplacement refusé.');}applyPlacement({kind:'node',id:n.id},p);});
 $('editors').querySelectorAll('[data-control],[data-choice]').forEach(editor=>{
  const id=editor.dataset.id,index=Number(editor.dataset.control??editor.dataset.choice),n=state.nodes.find(n=>n.id===id),c=controlsFor(n.algorithm)[index];
  bindValueEntry({value:$(`${id}-o${index}`),editor,get:()=>value(n,c),disabled:()=>editor.disabled,parse:text=>{const v=c.kind==='choice'?text:Number(text.trim().replace(',','.'));if(!text.trim()||!validControlValue(c,v))throw Error('Valeur hors du domaine du paramètre');return v;},set:v=>{sliderCheckpoint=null;setControl(id,index,v);sliderCheckpoint=null;},onError:notice});
 });
 syncPaletteCosts();bindVisuals();
 bindDials();
 bindParameterMap();
 $('editors').querySelectorAll('[data-mute]').forEach(b=>b.onclick=()=>{const n=state.nodes.find(n=>n.id===b.dataset.mute);remember();n.muted=!n.muted;render();notice('Mute local uniquement. Les cinq modes de Mute matériels restent à intégrer.');});
 $('editors').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{remember();state.nodes=state.nodes.filter(n=>n.id!==b.dataset.remove);state.links=state.links.filter(l=>l.node!==b.dataset.remove);if(state.selected===b.dataset.remove)state.selected=state.nodes[0]?.id??null;render();});
 modulationGestures?.decorate();
}
function renderModulation(){
 const old=$('destination').value;
 $('destination').innerHTML=state.nodes.filter(n=>n.row<state.rows).flatMap(n=>expandParameters(findAlgorithm(n.algorithm).parameters).filter(p=>p.endsWith('*')).map(p=>{const label=p.slice(0,-1);return `<option value="${n.id}|${label}">${short(findFamily(n.algorithm).id)} ${n.col+1}:${n.row+1} / ${label}</option>`;})).join('');
 if(Array.from($('destination').options).some(o=>o.value===old))$('destination').value=old;
 $('add-link').disabled=!$('destination').options.length||state.links.length>=20;
 $('link-count').textContent=`${state.links.length} / 20 LIENS`;
 $('links').innerHTML=state.links.map((l,i)=>`<div class="link-row"><div>${l.source} → ${l.node} / ${l.parameter}<small>${l.inactive?'Lien ancien inactif : Out Level Classic Chorus non étoilé dans le manuel.':'Low / Mid / High / Slope / Glide : édition à venir'}</small></div><button data-unlink="${i}" aria-label="Supprimer le lien ${i+1}">Retirer</button></div>`).join('')||'<p class="helper">Aucun lien. Les blocs audio restent indépendants de ce réseau de contrôle.</p>';
 $('links').querySelectorAll('[data-unlink]').forEach(b=>b.onclick=()=>{remember();state.links.splice(Number(b.dataset.unlink),1);renderModulation();renderEditors();renderBudget();});
}
function render(){sliderCheckpoint=null;renderRack();renderPalette();renderGrid();renderEditors();renderModulation();renderBudget();updateHistory();$('rows').value=String(bufferEditor.active?bufferEditor.buffer.rows:state.rows);bufferEditor.refresh();environment.onState?.();}
document.querySelectorAll('[data-editor-view]').forEach(b=>b.onclick=()=>{editorView=b.dataset.editorView;document.querySelectorAll('[data-editor-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderEditors();renderBudget();});
const mobileLayout=matchMedia('(max-width:650px)');
function syncLibraryButton(){$('mono-expand-library').setAttribute('aria-pressed',String(mobileLayout.matches?$('monobloc').classList.contains('mobile-library-open'):!$('monobloc').classList.contains('library-collapsed')));}
$('mono-expand-library').onclick=()=>{$('monobloc').classList.toggle(mobileLayout.matches?'mobile-library-open':'library-collapsed');syncLibraryButton();requestAnimationFrame(renderWires);};
mobileLayout.addEventListener('change',syncLibraryButton);syncLibraryButton();

$('open-screen').onclick=()=>screen.show('routing');
$('undo').onclick=()=>{if(environment.undo)return environment.undo();if(bufferEditor.active)return bufferEditor.undo();if(!past.length)return;future.push(structuredClone(state));Object.assign(state,past.pop());render();notice('Modification annulée.');};
$('redo').onclick=()=>{if(environment.redo)return environment.redo();if(bufferEditor.active)return bufferEditor.redo();if(!future.length)return;past.push(structuredClone(state));Object.assign(state,future.pop());render();notice('Modification rétablie.');};
$('new-study').onclick=()=>{remember();state.nodes=[];state.routes=[];state.links=[];state.selected=null;state.target=null;render();notice('Patch vide. Annuler permet de retrouver l’assemblage précédent.');};
$('open-study').onclick=()=>$('study-file').click();
$('study-file').onchange=async()=>{const file=$('study-file').files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('JSON trop volumineux (1 Mio maximum)');const restored=restoreJSON(JSON.parse(await file.text()));if(restored.kind==='preset'){bufferEditor.openLocal(restored.frame);notice('Preset JSON ouvert en copie locale : image complète, aucune écriture MIDI.');}else{if(bufferEditor.active)$('device-draft').click();remember();Object.assign(state,restored.state);render();notice('Brouillon JSON restauré : blocs, positions, réglages, routage et liens.');}}catch(e){notice(`Ouverture refusée : ${e.message}`);}finally{$('study-file').value='';}};
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]:not(#lcd-enlarged)'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input,select,textarea')){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}});
$('source').innerHTML=modifiers.map(m=>`<option>${m}</option>`).join('');
$('add-link').onclick=()=>{const [id,parameter]=$('destination').value.split('|'),n=state.nodes.find(n=>n.id===id);if(!n||state.links.length>=20)return;if(state.links.some(l=>l.node===id&&l.algorithm===n.algorithm&&l.parameter===parameter))return notice('Cette destination a déjà une source. Retirez son lien avant de la réaffecter.');remember();state.links.push({source:$('source').value,node:id,algorithm:n.algorithm,parameter});renderModulation();renderEditors();renderBudget();notice('Lien local créé. Aucun routage MIDI activé.');};
$('search').oninput=renderPalette;
$('matrix-density').onchange=()=>{syncMatrixViewport();syncPaletteCosts();requestAnimationFrame(renderWires);};
$('rows').onchange=()=>{if(bufferEditor.active)return bufferEditor.resize(Number($('rows').value));commitGrid(()=>resizeGrid(state,Number($('rows').value)));$('rows').value=String(state.rows);};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('query').onclick=()=>{try{$('query-bytes').textContent=hex(requestExpanded($('device').valueAsNumber,0));notice('Requête préparée. Aucun port MIDI ouvert.');}catch(e){$('query-bytes').textContent=e.message;}};
$('syx').onchange=async()=>{const file=$('syx').files[0];if(!file)return;try{if(file.size>32782)throw new Error('Trame trop volumineuse');const result=parseExpanded(new Uint8Array(await file.arrayBuffer()),$('device').valueAsNumber);$('inspection').textContent=JSON.stringify({...result,payload:result.payload?`${result.size} octets opaques conservés dans le fichier source`:undefined},null,2);}catch(e){$('inspection').textContent=e.message;}};
function saveJSON(){try{const frame=bufferEditor.active?bufferEditor.captureJSONFrame():null,data=frame?archivePreset(frame):archiveStudy(state),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=frame?presetFilename(decodeDeviceBuffer(frame).name):'fireworx-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(frame?'Preset JSON sauvegardé : image complète et réglages, sans envoi MIDI.':'Brouillon JSON sauvegardé : blocs, positions, valeurs locales, routage et liens.');}catch(e){notice(`Sauvegarde refusée : ${e.message}`);}}
$('export').onclick=saveJSON;$('save-study').onclick=saveJSON;

const randomizer=createRandomizerView({
 getKnownNames:()=>presetLibrary.knownPresetNames(),
 getDonorFrames:async()=> (await presetLibrary.recallCopies()).filter(r=>r.frame).map(r=>r.frame),
 getEditor:()=>{const frame=bufferEditor.active?bufferEditor.captureFrame():null;return {frame,ready:bufferEditor.canRandomize,live:bufferEditor.live,hardwareAvailable:bufferEditor.libraryConnection.portsAvailable,token:bufferEditor.active?'preset:'+(frame?Array.from(frame).join(','):'unavailable'):'study:'+JSON.stringify(state)};},
 apply:async({frame,baseFrame,sourceCurrent,destination,onStatus,check})=>{
  if(destination==='hardware'){
   if(sourceCurrent&&bufferEditor.live)await bufferEditor.applyRandomizedAndWait(frame,baseFrame,{onStatus});
   else await presetLibrary.loadEditableFrame(frame,{onStatus,check});
   panelScreenMode='routing';recall.cancel();renderRack();
   return 'Variation chargée et relue dans le FireworX P0 · aucun STORE.';
  }
  if(sourceCurrent&&!bufferEditor.live){bufferEditor.applyRandomized(frame,baseFrame);return 'Variation appliquée localement · Annuler disponible.';}
  bufferEditor.openRandomized(frame,baseFrame);return 'Variation ouverte en copie locale · aucun envoi MIDI, Annuler disponible.';
 },onNotice:notice
});
$('randomize').onclick=()=>randomizer.open();
const unsubscribeDspBudget=dspPreferences.subscribe(()=>renderBudget());window.addEventListener('pagehide',unsubscribeDspBudget);

// Browser form restoration is not study persistence: align restored form chrome
// with the freshly allocated in-memory model after normal navigation/reload.
window.addEventListener('pageshow',()=>{$('rows').value=String(state.rows);$('search').value='';$('device').value='0';$('matrix-density').value='readable';syncMatrixViewport();syncPaletteCosts();requestAnimationFrame(renderWires);renderPalette();});
modulationGestures=createModulationGestures({
 getContext:()=>{const live=bufferEditor.modulationContext;return live?{kind:'preset',...live}:{kind:'study',state,selected:state.selected,utility:draftSettingsPage==='modulation'?'matrix':null,disabled:false};},
 activateSignals:()=>{if(bufferEditor.active)bufferEditor.showSettingsPage('signal');else{draftSettingsPage='signal';renderEditors();}},
 selectBlock:select,
 apply:(descriptor,key)=>{if(bufferEditor.active)return bufferEditor.assignModulationTarget(descriptor,key);const next=applyDraftModTarget(state,descriptor,key);remember();Object.assign(state,next);render();},
 openLink:slot=>{if(bufferEditor.active)return bufferEditor.openModulationLink(slot);draftSettingsPage='modulation';renderEditors();focusMatrix(document,{link:slot});},
 openDestination:key=>{if(bufferEditor.active)return bufferEditor.openModulationTarget(key);draftSettingsPage='modulation';renderEditors();focusMatrix(document,{column:key});},
 onNotice:notice
});
const appearance=createAppearance({onChange:()=>{renderRack();requestAnimationFrame(renderWires);}});
render();
showTab('monobloc');

new ResizeObserver(()=>requestAnimationFrame(renderWires)).observe(document.querySelector('.routing-stage'));
const columnSplit=mountColumnSplit({area:document.querySelector('.working-area'),left:document.querySelector('.flow'),right:$('editors'),window,localStorage,ResizeObserver});window.addEventListener('pagehide',()=>columnSplit.dispose());
// Paint only the three LEDs. Clock traffic never rebuilds the LCD or knobs.
let indicatorFrame=null,indicatorAlive=true,lastIndicatorPaint=-Infinity;
function animateIndicators(time){if(!indicatorAlive)return;if(time-lastIndicatorPaint>=25){paintPanelIndicators();lastIndicatorPaint=time;}indicatorFrame=requestAnimationFrame(animateIndicators);}
indicatorFrame=requestAnimationFrame(animateIndicators);
window.addEventListener('pagehide',()=>{indicatorAlive=false;cancelAnimationFrame(indicatorFrame);});
window.addEventListener('pageshow',e=>{if(e.persisted&&!indicatorAlive){indicatorAlive=true;indicatorFrame=requestAnimationFrame(animateIndicators);}});

return {startAutoConnect:()=>bufferEditor.startAutoConnect(),selectParameter:id=>bufferEditor.selectParameter(id), capture:()=>bufferEditor.active?archivePreset(bufferEditor.captureJSONFrame()):archiveStudy(state), load(value){const next=restoreJSON(value);if(next.kind==='preset')bufferEditor.openLocal(next.frame);else{if(bufferEditor.active)$('device-draft').click();Object.assign(state,next.state);draftBaseline=draftSignature();render();}}, undo:()=>bufferEditor.undo(), redo:()=>bufferEditor.redo(), stop:()=>$('device-disconnect').click(), dispose:()=>{portLinks.dispose();modulationGestures?.dispose();bufferEditor.dispose();}, get sending(){return bufferEditor.live;}, get history(){return {undo:bufferEditor.active?Number(bufferEditor.canUndo):past.length,redo:bufferEditor.active?Number(bufferEditor.canRedo):future.length};}, appearance, render};
}
