// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {factoryPresets} from '../engine/factory-presets.generated.js';
import {firstKnownEmptyUser,findFirstEmptyUser} from '../engine/user-slot.js';
import {watchP0Progress} from '../engine/transfer-progress.js';
import {openLibraryStorage,importLibraryFile,libraryLimits,createFileAdapters,entryMessage,exportLibraryArchive,restoreLibraryArchive,annotate} from '../library-services';
import {presetBanks,presetAddress,presetLocation,inspectPreset,localEditFrame,joinPresetFrames,createPresetReader} from '../engine/preset-library-model.js';
import {loadPresetCopy} from '../engine/preset-load.js';
import {recallInventory} from '../engine/recall-browser.js';
import {describeFactoryPreset} from '../engine/factory-presets.js';
import {browsePresetRows,libraryRef,libraryDragType,parseLibraryDrag,reorderLibraryBank} from '../engine/library-browser-model.js';
import {findAlgorithm} from '../engine/catalog.js';
import {decodeUserBankFrames,userBankInventory} from '../engine/bank-dump.js';
export function create_preset_library_view(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;












const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const download=(bytes,name,type='application/octet-stream')=>{const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const isFireworx=m=>m?.[0]===240&&m[1]===0&&m[2]===32&&m[3]===31&&m[5]===64&&[32,40].includes(m[6]);
 function createPresetLibrary({getSession,getCurrentFrame,openLocal,ensureConnected,ensureReadSession,getConnection,onCopyEffect,onOpened=()=>{},onSelected=()=>{},onNotice,storageFactory=()=>openLibraryStorage(globalThis.indexedDB,environment.storageName+':library')}){
 const closeKey='fireworx-library-close-after-load';let closeAfterLoad=true;try{closeAfterLoad=localStorage.getItem(closeKey)!=='false';}catch{}
 const failureKey='midi-studio:fireworx:library-failures:v1';let failures={};try{const saved=JSON.parse(localStorage.getItem(failureKey)||'{}');for(const [key,value] of Object.entries(saved))if(/^\d+$/.test(key)&&typeof value?.error==='string'&&value.error.length<=1000)failures[key]=value;}catch{}
 const saveFailures=()=>{try{localStorage.setItem(failureKey,JSON.stringify(failures));}catch{onNotice('Échecs de lecture conservés pour cette session seulement : stockage local indisponible.');}};
 const $=id=>document.getElementById(id);let storeMode=false,db=null,generation=0,bank='factory',page=0,selected=null,rows=[],sources=[],metadata=null,job=false,ready=false,detailKey=null,localBank='',readGeneration=0,filterSource='',filterTag='',filterAlgorithm='',layout='list',dragging=null,bankAbort=null;const inventoryCache=new Map(),rowsByRef=new Map(),annotations=new Map(),dumpCache=new Map();let packedHeaders=new Map(),latestUserDump=null;
 document.body.insertAdjacentHTML('beforeend',`<dialog id="preset-library" class="preset-library" aria-label="Bibliothèques FireworX"><header><div><p class="eyebrow">FIREWORX · LIBRARIAN</p><h2>Bibliothèques de presets</h2></div><button id="presets-close">Fermer ×</button></header><div class="preset-library-body"><aside><nav aria-label="Banques de presets">${[...presetBanks,{id:'local',label:'Fichiers locaux'}].map(b=>`<button data-preset-bank="${b.id}" aria-pressed="${bank===b.id}">${b.label}<small>${b.count?b.count+' adresses maximum':'MIDI Studio'}</small></button>`).join('')}</nav><label class="preset-import">Importer .syx / archive<input id="presets-import" type="file" accept=".syx,.json" multiple></label><button id="presets-archive">Exporter l’archive MIDI Studio</button><label>Nouvelle banque locale<input id="presets-bank-name" maxlength="80" placeholder="Set concert…"></label><button id="presets-bank-create">Créer la banque locale</button><button id="presets-drafts">Brouillons JSON historiques</button><p>Les lectures ne rappellent aucun preset. Factory, User et Carte affichent les copies lues, avec leur date.</p></aside><section class="preset-browser"><div class="preset-library-toolbar"><label>Recherche<input id="presets-search" type="search" placeholder="Nom, numéro, algorithme…"></label><label><input id="presets-favorites" type="checkbox"> Favoris</label><button id="presets-read-page">Lire cette page</button><button id="presets-read-bank">Lire la banque</button><button id="presets-cancel" disabled>Arrêter</button></div><label id="presets-local-bank-label">Banque locale<select id="presets-local-bank"><option value="">Tous les fichiers et captures</option></select></label><p id="presets-scope"></p><div class="preset-table-scroll"><table class="preset-table"><thead><tr><th>Emplacement</th><th>Preset / copie locale</th><th>État</th></tr></thead><tbody id="presets-list"></tbody></table></div><div class="preset-pagination"><button id="presets-prev">← Page</button><span id="presets-page"></span><button id="presets-next">Page →</button><button id="presets-export-bank">Exporter les copies lues .syx</button></div></section><aside class="preset-inspector"><div id="presets-detail"></div><label>Nom local<input id="presets-name" maxlength="80"></label><label>Étiquettes (virgules)<input id="presets-tags" maxlength="500"></label><label><input id="presets-favorite" type="checkbox"> Favori</label><button id="presets-annotate">Enregistrer les informations locales</button><label>Copier dans une banque locale<select id="presets-bank-target"></select></label><button id="presets-bank-add">Ajouter cette copie à la banque</button><div id="presets-bank-order"><button id="presets-bank-up">Monter</button><button id="presets-bank-down">Descendre</button><button id="presets-bank-remove">Retirer de cette banque</button></div><button id="presets-read-one">Lire cet emplacement</button><button id="presets-open">Ouvrir une copie éditable locale</button><button id="presets-export-one">Exporter l’original .syx</button><hr><strong>Buffer de l’éditeur</strong><button id="presets-capture">Conserver une copie dans la bibliothèque</button><p>L’ouverture hors ligne sauvegarde l’édition précédente puis coupe l’édition MIDI. STORE User / Carte : action distincte, expérimentale, avec confirmation.</p></aside></div><footer><p id="presets-status" role="status"></p><progress id="presets-progress" value="0" max="1"></progress></footer></dialog>`);
 // Native browser implementation inspired by the TUS source/tag/list/inspector layout.
 $('preset-library').classList.add('tus-library');
 document.querySelector('#preset-library>header').insertAdjacentHTML('afterend',`<div class="preset-current"><span>BUFFER DE L’ÉDITEUR</span><strong id="presets-current-name">Aucun buffer</strong><button id="presets-current-capture">Conserver le buffer</button><span class="preset-hardware-state">Connexion en attente</span></div>`);
 const navigation=document.querySelector('.preset-library-body>aside:first-child');
 navigation.insertAdjacentHTML('afterbegin','<p class="preset-tree-title">SOURCES</p>');
 navigation.querySelector('nav').insertAdjacentHTML('afterend',`<label class="preset-tree-search">Filtrer les sources<input id="presets-tree-search" type="search" placeholder="Fichier, banque, étiquette…"></label><details open><summary>Banques locales <small id="presets-bank-count"></small></summary><div id="presets-bank-tree"></div></details><details open><summary>Fichiers et captures <small id="presets-source-count"></small></summary><div id="presets-source-tree"></div></details>`);
 document.querySelector('.preset-browser').insertAdjacentHTML('beforebegin',`<aside class="preset-classification" aria-label="Classement des presets"><p class="preset-tree-title">CLASSEMENT</p><button id="presets-favorites-tree" aria-pressed="false">★ Favoris <small id="presets-favorite-count"></small></button><details open><summary>Effets</summary><div id="presets-algorithm-tree"></div></details><details open><summary>Étiquettes</summary><div id="presets-tag-tree"></div></details><div class="preset-tag-create"><label>Nouvelle étiquette<input id="presets-new-tag" maxlength="32" placeholder="Ambiances…"></label><button id="presets-tag-create">Ajouter au preset</button></div><p>Glissez un preset sur une banque, une étiquette ou les favoris. Modifiez ou retirez les étiquettes dans le panneau de détails.</p></aside>`);
 document.querySelector('.preset-library-toolbar').insertAdjacentHTML('afterend',`<div class="preset-view-options"><label>Trier<select id="presets-sort"><option value="original">Ordre d’origine</option><option value="name">Nom</option><option value="source">Source</option><option value="recent">Date récente</option></select></label><label>Doublons<select id="presets-duplicates"><option value="show">Tout afficher</option><option value="content">Masquer par contenu</option><option value="name">Masquer par nom</option></select></label><div class="preset-layout-switch" aria-label="Présentation"><button id="presets-view-list" aria-pressed="true">Liste</button><button id="presets-view-grid" aria-pressed="false">Grille</button></div><button id="presets-filter-reset">Effacer les filtres</button></div><p id="presets-active-filter" role="status"></p>`);
 $('presets-list').setAttribute('aria-label','Presets : flèches pour sélectionner, Entrée pour ouvrir');
 $('presets-read-bank').insertAdjacentHTML('afterend','<button id="presets-resume">Reprendre les emplacements non lus</button>');
 $('presets-read-bank').insertAdjacentHTML('afterend','<button id="presets-export-dump" hidden>Exporter le dump User brut</button><button id="presets-read-dump" hidden title="Une requête User groupée ; noms et emplacements, puis paramètres lus à la demande">Lire le dump User</button>');
 $('presets-scope').insertAdjacentHTML('afterend','<output id="presets-inventory" aria-label="Couverture de l’inventaire matériel"></output>');
 document.querySelector('.preset-inspector').insertAdjacentHTML('beforeend',`<details id="presets-hardware-store"><summary>Sauvegarder P0 dans User / Carte</summary><p id="store-source" class="store-source"></p><p class="store-steps">Double-cliquez une destination pour sauvegarder le patch courant. Les originaux sont conservés automatiquement.</p><label>Banque de destination<select id="store-bank"><option value="user">User</option><option value="card">Carte</option></select></label><label>Emplacement<input id="store-slot" type="number" min="1" max="200" value="1"></label><button id="store-find-free">Chercher le premier User libre</button><p id="store-suggestion" role="status"></p><button id="store-prepare">Préparer et sauvegarder les originaux</button><div id="store-review"></div><label id="store-card-label"><input id="store-card-present" type="checkbox"> Pour Carte : carte présente et accessible en écriture sur l’appareil</label><label>Recopier la destination affichée<input id="store-confirm" placeholder="USER 1" autocomplete="off"></label><button id="store-commit" disabled>Écrire cette destination</button><button id="store-cancel">Annuler la préparation</button><p>Sauvegarde matérielle expérimentale, à valider sur l’appareil. Écriture persistante d’un seul emplacement. Source et destination conservées avant confirmation. Après l’envoi, la vérification continue même si cette fenêtre est fermée. Les paramètres non utilisés peuvent être supprimés par le stockage du FireworX.</p></details>`);
 document.querySelector('.preset-current').insertAdjacentHTML('afterend','<div id="store-mode-heading" class="store-mode-heading" hidden><strong>STORE · choisir une destination User / Carte</strong><span>Simple clic : choisir. Double-clic : sauvegarder le patch courant.</span><button id="store-browse">Revenir à la bibliothèque</button></div>');
 const advanced=document.createElement('details');advanced.id='store-advanced';advanced.innerHTML='<summary>Détails et confirmation manuelle</summary>';
 const storePanel=$('presets-hardware-store'),warning=storePanel.lastElementChild;
 for(const node of [$('store-prepare'),$('store-review'),$('store-confirm').closest('label'),$('store-commit'),$('store-cancel'),warning])advanced.append(node);
 storePanel.append(advanced);advanced.insertAdjacentHTML('beforebegin','<button id="store-quick" class="primary" disabled>Sauvegarder</button>');
 let storePlan=null;
 function chooseStoreDestination(bankId,slot){
  if(job||!['user','card'].includes(bankId))return false;
  const address=presetAddress(bankId,slot);
  if($('store-bank').value!==bankId||Number($('store-slot').value)!==slot)cancelStore();
  $('store-bank').value=bankId;$('store-slot').max=bankId==='card'?'800':'200';$('store-slot').value=String(slot);selected=`slot:${address}`;
  $('store-suggestion').textContent=`${bankId==='card'?'Carte':'User'} ${slot} : destination choisie. Double-cliquez pour sauvegarder le patch courant.`;return true;
 }
 function storePresentation(){
  dialog.dataset.libraryMode=storeMode?'store':'browse';$('store-mode-heading').hidden=!storeMode;
  document.querySelector('.preset-tree-title').textContent=storeMode?'DESTINATIONS':'SOURCES';
  $('presets-list').closest('table').querySelectorAll('th')[1].textContent=storeMode?'Destination / contenu connu':'Preset / copie locale';
  $('store-confirm').placeholder=`${$('store-bank').value.toUpperCase()} ${$('store-slot').value}`;
  document.querySelector('#preset-library>header h2').textContent=storeMode?'Sauvegarder le preset':'Bibliothèques de presets';
  $('presets-list').setAttribute('aria-label',storeMode?'Destinations : flèches pour sélectionner, Entrée pour sauvegarder':'Presets : flèches pour sélectionner, Entrée pour ouvrir');
  const current=getCurrentFrame();$('store-source').innerHTML=current?`Source P0 : <strong class="preset-name">${esc(inspectPreset(current).name)}</strong>`:'Aucun buffer chargé';
  $('store-card-label').hidden=$('store-bank').value!=='card';
  $('store-quick').textContent=job?'Sauvegarde en cours…':`Sauvegarder → ${$('store-bank').value.toUpperCase()} ${$('store-slot').value}`;
  $('store-quick').disabled=job||!ready||!getSession()?.canAudition;
  $('store-browse').disabled=job;
  document.querySelectorAll('[data-preset-bank]').forEach(b=>b.disabled=job||storeMode&&!['user','card'].includes(b.dataset.presetBank));
 }
 function beginStore(){
  storeMode=true;cancelStore();clearFilters();$('presets-sort').value='original';$('presets-duplicates').value='show';bank='user';localBank='';suggestUserSlot();
  chooseStoreDestination('user',Number($('store-slot').value));page=Math.floor((Number($('store-slot').value)-1)/25);$('presets-hardware-store').open=true;render();
  say('Double-cliquez une destination pour sauvegarder le patch courant. Sauvegardes et vérification sont automatiques.');
 }
 $('store-browse').onclick=()=>{if(job)return;cancelStore();storeMode=false;render();say('Bibliothèque : simple clic pour sélectionner, double-clic pour charger.');};
 function suggestUserSlot(){
  const records=[...rows,...[...packedHeaders].map(([preset,h])=>({...h,preset,status:'packed-header'}))],slot=firstKnownEmptyUser(records);
  $('store-bank').value='user';$('store-slot').max='200';$('store-slot').value=String(slot??1);
  $('store-suggestion').textContent=slot?`User ${slot} : premier emplacement vide connu dans les captures. Relu avant toute écriture.`:'Aucun emplacement libre encore confirmé. Cherchez le premier User libre avant de sauvegarder.';
 }
 $('store-find-free').onclick=()=>void run(async()=>{
  cancelStore();const attempt=generation,local=db,session=await prepareRead(),controller=new AbortController();bankAbort=controller;controls();
  try{const slot=await findFirstEmptyUser({signal:controller.signal,
   read:async(address,options)=>{if(attempt!==generation||session!==getSession())throw Error('Connexion remplacée ; recherche arrêtée');return session.readPreset(address,options);},
   onProgress:slot=>say(`Recherche User libre · lecture ${slot} / 200 · aucun STORE`),
   onRecord:async record=>{if(attempt!==generation||local!==db)throw new DOMException('Bibliothèque fermée','AbortError');await storeFile(local,`FireworX-user-${record.slot}.syx`,record.frame);}
  });if(attempt!==generation)return;await refresh();if(slot===null){$('store-suggestion').textContent='Les 200 emplacements User sont occupés. Aucune destination remplacée.';say('Banque User pleine · aucune écriture.');return;}
   $('store-bank').value='user';$('store-slot').max='200';$('store-slot').value=String(slot);$('store-suggestion').textContent=`User ${slot} : premier emplacement libre, confirmé à l’instant. Aucune écriture.`;say(`User ${slot} proposé · sélectionnez puis sauvegardez si vous souhaitez utiliser cet emplacement.`);
  }finally{if(bankAbort===controller)bankAbort=null;if(dialog.open)controls();}
 });
 async function assertStorageRoom(local,reserve=1){const list=await local.list();if(list.length+reserve>libraryLimits.sources||list.reduce((n,s)=>n+s.size,0)+reserve*2745>libraryLimits.bytes||list.reduce((n,s)=>n+s.inventory.entries.length,0)+reserve>libraryLimits.entries)throw Error('Bibliothèque presque pleine : exportez une archive puis supprimez des fichiers locaux avant de reprendre. Aucun échange MIDI lancé.');}
 const cancelStore=()=>{storePlan?.session.cancelStore();storePlan=null;$('store-review').textContent='';$('store-confirm').value='';$('store-commit').disabled=true;};
 $('store-bank').onchange=()=>{cancelStore();$('store-slot').max=$('store-bank').value==='card'?800:200;$('store-slot').value='1';if(storeMode){bank=$('store-bank').value;clearFilters();chooseStoreDestination(bank,1);render();}else controls();$('store-suggestion').textContent='Destination choisie manuellement · elle sera relue avant toute écriture.';};$('store-slot').oninput=()=>{cancelStore();if(storeMode&&Number.isInteger($('store-slot').valueAsNumber)&&$('store-slot').valueAsNumber>=1&&$('store-slot').valueAsNumber<=Number($('store-slot').max)){bank=$('store-bank').value;selected=`slot:${presetAddress(bank,$('store-slot').valueAsNumber)}`;page=Math.floor(($('store-slot').valueAsNumber-1)/25);render();}$('store-suggestion').textContent='Destination choisie manuellement · elle sera relue avant toute écriture.';};$('store-cancel').onclick=cancelStore;
 $('store-confirm').oninput=()=>{$('store-commit').disabled=job||!storePlan||$('store-confirm').value!==storePlan.review.confirmation;};
 async function prepareStoreReview(){
  cancelStore();const session=getSession(),attempt=generation,local=db;if(!session?.canAudition)throw Error('Connectez et relisez le P0 à sauvegarder avant la préparation');
  await assertStorageRoom(local,3);
  const review=await session.prepareStore($('store-bank').value,$('store-slot').valueAsNumber,{saveBackup:async backup=>{if(attempt!==generation||local!==db)throw Error('Préparation annulée ; aucun STORE');await storeFile(local,`FireworX-before-store-${backup.kind}-${backup.bank}-${backup.slot}-${Date.now()}.syx`,backup.frame);}});
  if(attempt!==generation||session!==getSession()||!dialog.open){session.cancelStore();throw new DOMException('Préparation annulée','AbortError');}storePlan={session,review};$('store-review').innerHTML=`<p><strong>${esc(review.sourceName)} → ${esc(review.confirmation)}</strong></p><p>${review.occupied?'Remplace « '+esc(review.previousName)+' »':'Destination actuellement vide'}. Les deux originaux sont conservés dans la bibliothèque.</p><p>Recopiez <strong>${esc(review.confirmation)}</strong> pour autoriser cet emplacement uniquement.</p>`;$('store-confirm').placeholder=review.confirmation;await refresh();say('Préparation terminée ; aucune écriture envoyée. Confirmez la destination pour sauvegarder.');
  if(attempt!==generation||session!==getSession()||!dialog.open){session.cancelStore();storePlan=null;throw new DOMException('Préparation annulée','AbortError');}
  return storePlan;
 }
 $('store-prepare').onclick=()=>void run(prepareStoreReview);
 async function writeStoreReview(plan,confirmation){
  const attempt=generation;if(!plan||plan!==storePlan||plan.session!==getSession())throw Error('Préparez à nouveau la destination');
  if(plan.review.bank==='card'&&!$('store-card-present').checked)throw Error('Confirmez la présence d’une carte accessible en écriture');
  storePlan=null;$('store-commit').disabled=true;
  say('Sauvegarde persistante en cours · ne pas interrompre la liaison MIDI…');let result;try{result=await plan.session.commitStore(plan.review,confirmation);}catch(e){onNotice('Sauvegarde non vérifiée : '+e.message);throw e;}
  const local=attempt===generation&&db?db:await storageFactory();try{await storeFile(local,`FireworX-stored-${plan.review.bank}-${plan.review.slot}-${Date.now()}.syx`,result.frame);}finally{if(local!==db)local.close();}
  onNotice(`${plan.review.confirmation} écrit et relu sur les champs actifs ; persistance après redémarrage non testée.`);if(dialog.open&&attempt!==generation)await refresh();
  if(attempt===generation){await refresh();$('store-review').textContent=`${plan.review.confirmation} écrit et relu · ${result.verification.checked} contrôles actifs ; P0 conservé. Persistance après redémarrage non testée.`;say('Sauvegarde vérifiée sur les champs actifs décodés ; original de destination conservé.');}
 }
 $('store-commit').onclick=()=>void run(()=>writeStoreReview(storePlan,$('store-confirm').value));
 function saveStoreChoice(){
  return run(async()=>{
   if($('store-bank').value==='card'&&!$('store-card-present').checked)throw Error('Confirmez la présence d’une carte accessible en écriture');
   $('presets-progress').removeAttribute('value');
   try{
    say('Sauvegarde des originaux puis écriture de la destination choisie…');
    const plan=await prepareStoreReview();
    // The explicit STORE double-click/button is the user's confirmation of this
    // one destination. The backend still validates the same freshly prepared review.
    await writeStoreReview(plan,plan.review.confirmation);
   }finally{const progress=$('presets-progress');if(progress)progress.value=1;}
  });
 }
 $('store-quick').onclick=()=>void saveStoreChoice();
 $('presets-open').insertAdjacentHTML('afterend','<button id="presets-open-offline">Ouvrir explicitement hors ligne</button><button id="presets-delete-source">Supprimer ce fichier local…</button>');
 $('presets-delete-source').onclick=()=>void run(async()=>{const r=record();if(!r?.sourceId||!db.removeSource)throw Error('Sélectionnez un fichier local conservé');const source=sources.find(s=>s.id===r.sourceId);if(!source)return;if(!window.confirm(`Supprimer le fichier local « ${source.name} » et ses références de banques ? Exportez son original ou une archive avant de confirmer. Aucun effet sur le FireworX.`))return;await db.removeSource(source.id);selected=null;await refresh();say('Fichier local supprimé ; espace libéré. Aucun envoi MIDI.');});
 $('presets-capture').insertAdjacentHTML('afterend','<button id="presets-send-copy">Charger la copie de l’éditeur sur le FireworX</button>');
 document.querySelector('.preset-hardware-state').insertAdjacentHTML('afterend','<button id="presets-connect" title="Relire P0 deux fois, sans charger ni sauvegarder de preset">Reconnecter pour lire</button>');
 document.querySelector('.preset-inspector>p').textContent='Charger conserve le buffer précédent puis édite P0. Pour sauvegarder durablement : STORE, puis double-clic sur une destination User / Carte.';
 $('presets-open').insertAdjacentHTML('beforebegin','<button id="presets-audition" disabled title="Charger dans le buffer temporaire, puis relire ; aucun STORE">Écouter sur le FireworX</button>');
 document.querySelector('.preset-library-toolbar').insertAdjacentHTML('beforeend',`<label class="preset-close-option" title="Simple clic : sélectionner. Double-clic ou Entrée : charger, puis fermer si activé."><input id="presets-close-after-load" type="checkbox" ${closeAfterLoad?'checked':''}> Fermer après chargement</label>`);
 $('presets-close-after-load').onchange=()=>{closeAfterLoad=$('presets-close-after-load').checked;try{localStorage.setItem(closeKey,String(closeAfterLoad));}catch{onNotice('Préférence conservée pour cette session seulement.');}};
 async function storeFile(local,filename,bytes){
  const inventory=createFileAdapters().read(bytes),defaults=[];
  for(const entry of inventory.entries){const packet=entryMessage(inventory,entry.index);if(isFireworx(packet))defaults.push({index:entry.index,info:inspectPreset(Uint8Array.from(packet))});}
  const dump=inventory.entries.some(entry=>{const m=entryMessage(inventory,entry.index);return m[0]===240&&m[1]===0&&m[2]===32&&m[3]===31&&m[5]===64&&[16,17].includes(m[6]);});
  if(!defaults.length&&!dump)throw Error('Aucun preset ou dump User FireworX reconnu dans ce fichier');
  const result=await importLibraryFile(local,filename,bytes),latest=await local.metadata();const known=new Set(latest.annotations.map(a=>`${a.ref.sourceId}:${a.ref.index}`));
  for(const d of defaults){const ref={sourceId:result.source.id,index:d.index};if(!known.has(`${ref.sourceId}:${ref.index}`))latest.annotations.push({ref,revisions:[{at:new Date().toISOString(),name:d.info.name,tags:['FireworX',d.info.bank],favorite:false}]});}
  // setMetadata validates source references and budgets using the existing service.
  if(defaults.some(d=>!known.has(`${result.source.id}:${d.index}`)))await local.setMetadata(latest);
  return result;
 }
 const dialog=$('preset-library'),reader=createPresetReader({getSession,onRecord:async record=>{const local=db,attempt=readGeneration;if(!local||attempt!==generation)throw new DOMException('Bibliothèque fermée','AbortError');await storeFile(local,`FireworX-${record.bank}-${record.slot}.syx`,record.frame);for(let i=0;i<record.count;i++)delete failures[record.preset+i];saveFailures();if(attempt===generation&&db===local)await refresh();},onFailure:async failure=>{if(readGeneration!==generation)return;failures[failure.preset]=failure;saveFailures();render();},onProgress:p=>{if(readGeneration!==generation||!dialog.open)return;say(`${p.done} / ${p.count} emplacements traités · ${presetLocation(p.preset).label} · ${p.failed.length} échec(s)${p.etaMs===null?'':` · reste ≈ ${Math.ceil(p.etaMs/1000)} s`}`);$('presets-progress').value=p.done;$('presets-progress').max=p.count;}});
 const say=text=>{$('presets-status').textContent=text;};
 const notes=r=>annotations.get(`${r?.sourceId}:${r?.index}`);
 const name=r=>notes(r)?.name||r?.name||'Non lu';
 const key=r=>bank==='local'&&r?.sourceId?`${r.sourceId}:${r.index}${r.bankIndex===undefined?'':':'+r.bankIndex}`:`slot:${r?.preset}`;
 const record=()=>displayRows().find(r=>key(r)===selected);
 function clearFilters(){filterSource=filterTag=filterAlgorithm='';$('presets-search').value='';$('presets-favorites').checked=false;page=0;selected=null;}
 function selectRow(value,focus=false){if(storeMode&&job)return;selected=value;if(storeMode){const r=record();if(r&&['user','card'].includes(r.bank))chooseStoreDestination(r.bank,r.slot);}document.querySelectorAll('[data-preset-key]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.presetKey===selected));if(focus&&b.dataset.presetKey===selected)b.focus();});detail();controls();if(!storeMode)onSelected(record());}
 function dropTarget(element,action){
  element.ondragover=e=>{if(!job&&e.dataTransfer.types.includes(libraryDragType)){e.preventDefault();element.classList.add('preset-drop-target');e.dataTransfer.dropEffect='copy';}};
  element.ondragleave=()=>element.classList.remove('preset-drop-target');
  element.ondrop=e=>{e.preventDefault();e.stopPropagation();element.classList.remove('preset-drop-target');if(job)return;try{const ref=parseLibraryDrag(e.dataTransfer.getData(libraryDragType));if(!rowsByRef.has(libraryRef(ref)))throw Error('Preset absent de cette bibliothèque');void run(()=>action(ref,e.shiftKey));}catch(error){say(error.message);}};
 }
 async function addToBank(ref,id){const next=await db.metadata(),target=next.banks.find(b=>b.id===id);if(!target)throw Error('Banque locale introuvable');target.entries.push({sourceId:ref.sourceId,index:ref.index});await db.setMetadata(next);await refresh();say('Copie référencée dans la banque locale ; original conservé.');}
 async function mark(ref,{tag,favorite,remove=false}){
  const r=rowsByRef.get(libraryRef(ref));if(!r)throw Error('Preset introuvable');const previous=notes(r),tags=new Set(previous?.tags??[]);
  if(tag!==undefined){if(tag.length>32||!tag.trim()||/[\u0000-\u001f\u007f]/.test(tag))throw Error('Étiquette invalide');remove?tags.delete(tag):tags.add(tag);}
  const latest=await db.metadata(),list=await db.list(),next=annotate(latest,list,ref,{name:previous?.name||r.name,tags:[...tags],favorite:favorite===undefined?!!previous?.favorite:favorite});
  await db.setMetadata(next);await refresh();say(remove?'Classement retiré localement ; original conservé.':'Classement enregistré localement ; original conservé.');
 }
 function renderTree(){
  const q=$('presets-tree-search').value.toLowerCase(),match=s=>s.toLowerCase().includes(q),banks=metadata.banks.filter(b=>b.id.startsWith('fireworx-')||b.entries.some(ref=>rowsByRef.has(libraryRef(ref))));
  $('presets-bank-count').textContent=banks.length;
  $('presets-bank-tree').innerHTML=banks.filter(b=>match(b.name)).slice(0,50).map(b=>`<button data-library-bank="${esc(b.id)}" aria-pressed="${bank==='local'&&localBank===b.id}">${esc(b.name)} <small>${b.entries.length}</small></button>`).join('')||'<p>Créez une banque pour votre sélection.</p>';
  for(const button of $('presets-bank-tree').querySelectorAll('button')){button.onclick=()=>{if(job)return;clearFilters();bank='local';localBank=button.dataset.libraryBank;render();};dropTarget(button,ref=>addToBank(ref,button.dataset.libraryBank));}
  const localSources=sources.filter(s=>inventoryCache.get(s.id)?.length);$('presets-source-count').textContent=localSources.length;
  $('presets-source-tree').innerHTML=localSources.filter(s=>match(s.name)).slice(0,50).map(s=>`<button data-library-source="${esc(s.id)}" aria-pressed="${filterSource===s.id}" title="${esc(s.name)}">${esc(s.name)} <small>${inventoryCache.get(s.id).length}</small></button>`).join('')||'<p>Importez un fichier .syx.</p>';
  if(localSources.filter(s=>match(s.name)).length>50)$('presets-source-tree').insertAdjacentHTML('beforeend','<p>50 sources affichées. Affinez le filtre.</p>');
  $('presets-source-tree').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(job)return;clearFilters();bank='local';localBank='';filterSource=b.dataset.librarySource;render();});
  const tagCounts=new Map(),algorithmCounts=new Map();let favorites=0;for(const r of rows){const n=notes(r);if(n?.favorite)favorites++;for(const tag of n?.tags??[])tagCounts.set(tag,(tagCounts.get(tag)??0)+1);for(const algorithm of new Set(r.nodes.map(n=>n.algorithm)))algorithmCounts.set(algorithm,(algorithmCounts.get(algorithm)??0)+1);}
  $('presets-favorite-count').textContent=favorites;$('presets-favorites-tree').setAttribute('aria-pressed',String($('presets-favorites').checked));
  $('presets-tag-tree').innerHTML=[...tagCounts].filter(([tag])=>match(tag)).sort(([a],[b])=>a.localeCompare(b)).slice(0,100).map(([tag,count])=>`<button data-library-tag="${esc(tag)}" aria-pressed="${tag===filterTag}">${esc(tag)} <small>${count}</small></button>`).join('')||'<p>Aucune étiquette.</p>';
  for(const button of $('presets-tag-tree').querySelectorAll('button')){button.onclick=()=>{if(job)return;clearFilters();bank='local';localBank='';filterTag=button.dataset.libraryTag;render();};dropTarget(button,(ref,remove)=>mark(ref,{tag:button.dataset.libraryTag,remove}));}
  $('presets-algorithm-tree').innerHTML=[...algorithmCounts].sort(([a],[b])=>findAlgorithm(a).name.localeCompare(findAlgorithm(b).name)).map(([id,count])=>`<button data-library-algorithm="${id}" aria-pressed="${id===filterAlgorithm}">${esc(findAlgorithm(id).name)} <small>${count}</small></button>`).join('')||'<p>Les effets des copies décodées apparaîtront ici.</p>';
  $('presets-algorithm-tree').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(job)return;clearFilters();bank='local';localBank='';filterAlgorithm=b.dataset.libraryAlgorithm;render();});
 }
 function bindRows(){
  for(const button of $('presets-list').querySelectorAll('[data-preset-key]')){
   const row=button.closest('tr');
   // The full row is a preset target, not only its name button. Keep the button
   // for keyboard focus; its pointer events bubble to this single action path.
   row.onclick=()=>selectRow(button.dataset.presetKey);
   row.ondblclick=()=>activateRow(button.dataset.presetKey);
   row.ondragstart=e=>{const r=displayRows().find(r=>key(r)===button.dataset.presetKey);if(!r?.sourceId||job){e.preventDefault();return;}selectRow(key(r));dragging={sourceId:r.sourceId,index:r.index,...(bank==='local'&&localBank&&r.bankIndex!==undefined?{bankId:localBank,bankIndex:r.bankIndex}:{})};e.dataTransfer.setData(libraryDragType,JSON.stringify(dragging));e.dataTransfer.effectAllowed='copyMove';};
   row.ondragend=()=>{dragging=null;document.querySelectorAll('.preset-drop-target').forEach(e=>e.classList.remove('preset-drop-target'));};
   if(bank==='local'&&localBank)dropTarget(row,async ref=>{if($('presets-sort').value!=='original'||$('presets-search').value||filterSource||filterTag||filterAlgorithm||$('presets-favorites').checked||$('presets-duplicates').value!=='show')throw Error('Rétablissez l’ordre d’origine sans filtre pour déplacer une entrée');const target=displayRows().find(r=>key(r)===button.dataset.presetKey),next=await db.metadata(),targetBank=next.banks.find(b=>b.id===localBank);if(!target||!targetBank)throw Error('Banque locale introuvable');if(ref.bankId===localBank){targetBank.entries=reorderLibraryBank(targetBank,ref.bankIndex,target.bankIndex,ref);}else targetBank.entries.splice(target.bankIndex,0,{sourceId:ref.sourceId,index:ref.index});await db.setMetadata(next);await refresh();say('Ordre de la banque locale enregistré. Aucun transfert matériel.');});
  }
 }
 function activateRow(value){
  selectRow(value);
  if(storeMode){if(!job)void saveStoreChoice();return;}
  if(job){say(reader.busy?'Arrêtez la lecture et attendez sa fin avant d’ouvrir un preset.':'Opération en cours ; attendez sa fin avant d’ouvrir un preset.');return;}
  $('presets-open').click();
 }
 function displayRows({unfiltered=false}={}){
  const q=$('presets-search').value.trim().toLowerCase(),favorite=$('presets-favorites').checked,b=presetBanks.find(b=>b.id===bank);
  let list;
  if(!b){const custom=metadata?.banks.find(b=>b.id===localBank);list=custom?custom.entries.flatMap((ref,bankIndex)=>{const r=rowsByRef.get(`${ref.sourceId}:${ref.index}`);return r?[{...r,bankIndex}]:[];}):rows;}
  else{list=Array.from({length:b.count},(_,i)=>{const preset=b.first+i,exact=rows.filter(r=>r.preset===preset).sort((a,b)=>b.at.localeCompare(a.at))[0],header=packedHeaders.get(preset);if(exact&&(!header||exact.at>=header.at))return exact;if(header)return {...presetLocation(preset),...header,status:'packed-header',preset,nodes:[]};const range=rows.filter(r=>r.status==='empty'&&r.preset<=preset&&r.preset+r.count>preset).sort((a,b)=>b.at.localeCompare(a.at))[0];return range?{...range,...presetLocation(preset),preset,rangePreset:range.preset}:{...presetLocation(preset),preset,status:failures[preset]?'failed':'unread',name:failures[preset]?'Lecture à reprendre':'Non lu',error:failures[preset]?.error};});}
  if(unfiltered)return list;
  return browsePresetRows(list.map(describeFactoryPreset),{query:q,favorite,source:filterSource,tag:filterTag,algorithm:filterAlgorithm,sort:$('presets-sort').value,duplicates:$('presets-duplicates').value,note:notes});
 }
 function render(){
  if(!ready)return;if(localBank&&!metadata.banks.some(b=>b.id===localBank))localBank='';const all=displayRows(),pages=Math.max(1,Math.ceil(all.length/25));page=Math.min(page,pages-1);const visible=all.slice(page*25,page*25+25);
  if(!all.some(r=>key(r)===selected))selected=key(visible[0]);
  document.querySelectorAll('[data-preset-bank]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.presetBank===bank)));
  const labels={decoded:'Copie décodée',opaque:'Données conservées',empty:'Vide confirmé',unread:'Non lu',failed:'Échec · à reprendre','packed-header':'Nom du dump · paramètres à lire'};
  $('presets-list').innerHTML=visible.map(r=>`<tr draggable="${!!r.sourceId}" data-preset-row="${esc(key(r))}" data-bank-index="${r.bankIndex??''}"><td>${esc(r.label)}</td><td><button title="${esc(r.description||r.factoryName||name(r))}${r.catalogueName?' · Nom du catalogue, données non lues':''}" data-preset-key="${esc(key(r))}" aria-pressed="${key(r)===selected}">${notes(r)?.favorite?'★ ':''}${esc(name(r))}</button><small class="preset-row-tags">${esc(notes(r)?.tags?.join(' · ')??'')}</small></td><td>${labels[r.status]}${failures[r.preset]?'<small>Dernière lecture échouée · à reprendre</small>':''}${r.at?`<small>${esc(new Date(r.at).toLocaleString('fr-FR'))}</small>`:''}</td></tr>`).join('')||'<tr><td colspan="3">Aucune copie dans cette vue. Importez un fichier ou lisez les emplacements du matériel.</td></tr>';
  bindRows();renderTree();$('presets-list').closest('.preset-table-scroll').dataset.layout=layout;
  $('presets-active-filter').textContent=[filterSource?sources.find(s=>s.id===filterSource)?.name:'',filterTag?'Étiquette : '+filterTag:'',filterAlgorithm?'Effet : '+findAlgorithm(filterAlgorithm).name:''].filter(Boolean).join(' / ');
  const current=getCurrentFrame();$('presets-current-name').textContent=current?inspectPreset(current).name:'Aucun buffer';$('presets-current-capture').disabled=!current||job;
  $('presets-page').textContent=`${page+1} / ${pages} · ${all.length} entrées`;$('presets-prev').disabled=page===0;$('presets-next').disabled=page===pages-1;
  $('presets-scope').textContent=bank==='factory'?'Factory : jusqu’à 400 adresses selon la spécification OS 2. La lecture établit les emplacements présents.':bank==='user'?'User : 200 adresses. Dump groupé : en-têtes reconnus, paramètres complétés par lecture individuelle. Sauvegarde uniquement après confirmation explicite.':bank==='card'?'Carte : 800 adresses MIDI documentées. Présence, capacité et protection physiques non interrogées ; une réponse vide ne les établit pas.':'Fichiers et captures conservés dans la bibliothèque commune MIDI Studio.';
  const inventory=displayRows({unfiltered:true}),counts=status=>inventory.filter(r=>r.status===status).length,last=inventory.flatMap(r=>r.at?[r.at]:[]).sort().at(-1);
  $('presets-inventory').hidden=bank==='local';$('presets-inventory').textContent=`${counts('decoded')} presets décodés · ${counts('empty')} adresses vides confirmées · ${counts('packed-header')} noms seuls · ${inventory.filter(r=>failures[r.preset]).length} échecs à reprendre · ${counts('unread')} non lues${last?' · dernière capture '+new Date(last).toLocaleString('fr-FR'):''}`;
  $('presets-local-bank-label').hidden=bank!=='local';const banks=metadata.banks.filter(b=>b.id.startsWith('fireworx-')||b.entries.some(ref=>rowsByRef.has(`${ref.sourceId}:${ref.index}`)));const options=banks.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join(''),target=$('presets-bank-target').value;$('presets-local-bank').innerHTML='<option value="">Tous les fichiers et captures</option>'+options;$('presets-local-bank').value=localBank;$('presets-bank-target').innerHTML=options;if(banks.some(b=>b.id===target))$('presets-bank-target').value=target;
  $('presets-scope').textContent+=` · stockage : ${sources.length} / ${libraryLimits.sources} fichiers`;
  detail();controls();
 }
 function detail(){const r=record(),note=notes(r);if(detailKey!==key(r)){document.querySelector('.preset-inspector').scrollTop=0;detailKey=key(r);}$('presets-detail').innerHTML=r?`<p class="eyebrow">${esc(r.label)}</p><h3>${esc(name(r))}</h3><p>${r.status==='packed-header'?'En-tête du dump User : nom et emplacement reconnus ; paramètres à lire.':r.status==='unread'?'Aucune lecture effectuée pour cet emplacement.':r.status==='failed'?esc(r.error):r.status==='empty'?'Réponse FireworX : emplacement ou plage vide.':`${r.frame.length} octets d’origine conservés · ${r.nodes.length} moteurs reconnus`}</p>${r.description?`<p class="preset-description">${esc(r.description)}<small>Catalogue Factory · PDF p.${r.descriptionPage} · description documentaire</small></p>`:''}${r.catalogueName?'<small>Nom du catalogue ; aucune copie MIDI reçue.</small>':''}${r.alphaText?.replace(/�/g,'').trim()?`<p>Alpha : ${esc(r.alphaText)}</p>`:''}<p>${esc(r.nodes?.map(n=>n.algorithm).join(' · '))}</p>${r.sourceId?`<small>Copie ${esc(r.sourceName)}<br>SHA256 ${r.sourceId}</small>`:''}`:'<p>Sélectionnez un preset.</p>';$('presets-name').value=note?.name||r?.name||'';$('presets-tags').value=note?.tags.join(', ')||'';$('presets-favorite').checked=!!note?.favorite;
  if(r?.status==='decoded'&&r.nodes.length&&onCopyEffect){$('presets-detail').insertAdjacentHTML('beforeend',`<label>Effet à copier<select id="presets-effect-source">${r.nodes.map(n=>`<option value="${n.id}">${esc(findAlgorithm(n.algorithm).name)} · moteur ${n.instanceIndex+1}</option>`).join('')}</select></label><button id="presets-effect-copy">Copier cet effet pour l’éditeur</button>`);$('presets-effect-copy').onclick=()=>{onCopyEffect(r.frame.slice(),$('presets-effect-source').value);say('Effet copié ; choisissez un moteur compatible dans l’éditeur puis Coller.');};}
 }
 function controls(){storePresentation();$('presets-delete-source').disabled=job||!ready||!record()?.sourceId||!db?.removeSource;const exclusive=!!getConnection?.()?.exclusiveBusy||!!getSession()?.exclusiveBusy;$('store-find-free').disabled=!ready||job||!getSession()?.canAudition;for(const id of ['store-bank','store-slot','store-card-present','store-confirm','store-cancel'])$(id).disabled=job;$('store-prepare').disabled=job||!getSession()?.canAudition;$('store-commit').disabled=job||!storePlan||$('store-confirm').value!==storePlan.review.confirmation;$('presets-close-after-load').disabled=job;const r=record(),connected=!!getSession(),connection=getConnection?.(),canRead=!exclusive&&(connected||!!ensureReadSession&&!connection?.connecting),local=bank==='local';$('presets-connect').hidden=connected||!ensureReadSession;$('presets-connect').disabled=!ready||job||exclusive||!!connection?.connecting;$('presets-open').textContent=r&&['unread','failed','packed-header'].includes(r.status)?'Lire et charger le preset':connected||connection?.portsAvailable?'Charger et éditer sur le FireworX':'Ouvrir une copie éditable locale';$('presets-open-offline').disabled=job||exclusive||r?.status!=='decoded';$('presets-send-copy').disabled=!ready||job||!getCurrentFrame()||!ensureConnected; $('presets-audition').disabled=!ready||job||r?.status!=='decoded'||!getSession()?.canAudition;document.querySelector('.preset-hardware-state').textContent=connection?.label??(connected?'FireworX connecté · buffer temporaire':'Session MIDI non établie');for(const id of ['presets-read-page','presets-read-bank','presets-resume'])$(id).disabled=!ready||job||local||!canRead;$('presets-read-one').disabled=!ready||job||!r||local||!canRead;$('presets-read-page').disabled ||= !!$('presets-search').value.trim()||$('presets-favorites').checked||!!filterSource||!!filterTag||!!filterAlgorithm||$('presets-sort').value!=='original'||$('presets-duplicates').value!=='show';$('presets-cancel').disabled=!reader.busy&&!bankAbort;$('presets-export-dump').hidden=bank!=='user';$('presets-export-dump').disabled=job||!latestUserDump;$('presets-read-dump').hidden=bank!=='user';$('presets-read-dump').disabled=!ready||job||!canRead;$('presets-open').disabled=!ready||job||exclusive||!(r?.status==='decoded'||!local&&['unread','failed','packed-header'].includes(r?.status)&&canRead);$('presets-export-one').disabled=!r?.frame;$('presets-export-bank').disabled=!rows.some(r=>bank==='local'||r.bank===bank);$('presets-annotate').disabled=!ready||job||!r?.sourceId;$('presets-capture').disabled=!ready||job||!getCurrentFrame();$('presets-import').disabled=!ready||job;$('presets-archive').disabled=!ready||job;$('presets-bank-create').disabled=!ready||job;$('presets-bank-add').disabled=!ready||job||!r?.sourceId||!$('presets-bank-target').value;$('presets-bank-order').hidden=bank!=='local'||!localBank||r?.bankIndex===undefined;if(storeMode)for(const id of ['presets-open','presets-open-offline','presets-send-copy','presets-audition','presets-drafts'])$(id).disabled=true;}
 async function refresh(){const attempt=generation,local=db;const [nextSources,nextMetadata]=await Promise.all([local.list(),local.metadata()]);if(attempt!==generation)return;
  const next=[];for(const source of nextSources){let decoded=inventoryCache.get(source.id);if(!decoded){decoded=[];for(const entry of source.inventory.entries){const message=entryMessage(source.inventory,entry.index);if(!isFireworx(message))continue;try{const frame=Uint8Array.from(message),info=inspectPreset(frame),contentHash=info.status==='decoded'?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',frame.slice(11,-2))),b=>b.toString(16).padStart(2,'0')).join(''):null;decoded.push({...info,contentHash,sourceId:source.id,index:entry.index,sourceName:source.name,at:source.importedAt});}catch{}}inventoryCache.set(source.id,decoded);}next.push(...decoded);}const known=new Set(nextSources.map(s=>s.id));for(const key of inventoryCache.keys())if(!known.has(key))inventoryCache.delete(key);
  packedHeaders=new Map();
  for(const source of nextSources){
   if(!dumpCache.has(source.id)){const frames=source.inventory.entries.map(e=>Uint8Array.from(entryMessage(source.inventory,e.index)));if(frames.some(f=>f[0]===240&&f[5]===64&&f[6]===16)){try{dumpCache.set(source.id,{...decodeUserBankFrames(frames,frames.find(f=>f[6]===16)[4]).inventory,isDump:true});}catch(e){dumpCache.set(source.id,{records:[],error:e.message,isDump:true});}}else dumpCache.set(source.id,{records:[]});}
   for(const h of dumpCache.get(source.id).records){const previous=packedHeaders.get(h.preset);if(!previous||previous.at<source.importedAt)packedHeaders.set(h.preset,{name:h.name,alphaText:h.alpha,at:source.importedAt,packedSourceId:source.id});}
  }
  latestUserDump=nextSources.filter(s=>dumpCache.get(s.id)?.isDump).sort((a,b)=>b.importedAt.localeCompare(a.importedAt))[0]??null;
  sources=nextSources;metadata=nextMetadata;rows=next;rowsByRef.clear();for(const r of rows)rowsByRef.set(`${r.sourceId}:${r.index}`,r);annotations.clear();for(const a of metadata.annotations)annotations.set(`${a.ref.sourceId}:${a.ref.index}`,a.revisions.at(-1));render();
 }
 function assertAvailable(){if(getConnection?.()?.exclusiveBusy||getSession()?.exclusiveBusy)throw Error('Transaction MIDI en cours ; attendez sa vérification avant de lire ou charger un preset');}
 async function run(fn){if(job)return;const attempt=generation;job=true;controls();try{assertAvailable();await fn();}catch(e){if(attempt===generation)say(e.name==='AbortError'?'Lecture arrêtée ; les copies déjà reçues sont conservées.':e.message);}finally{if(attempt===generation)job=false;if(dialog.open)controls();}}
 async function prepareRead(){
  assertAvailable();
  if(db)await assertStorageRoom(db,3);
  if(getSession())return getSession();
  if(!ensureReadSession)throw Error('Connexion MIDI non établie');
  const attempt=generation,local=db;
  const check=()=>{if(attempt!==generation||db!==local||!dialog.open)throw new DOMException('Lecture annulée','AbortError');};
  const frame=getCurrentFrame()?.slice();
  say('Reconnexion en lecture seule · conservation du buffer local…');
  if(frame)await storeFile(local,`FireworX-before-read-reconnect-${Date.now()}.syx`,frame);check();
  const session=await ensureReadSession();check();
  if(!session||session!==getSession())throw Error('Session de lecture non confirmée ; recommencez après reconnexion');
  await refresh();check();return session;
 }
 $('presets-connect').onclick=()=>void run(async()=>{await prepareRead();say('Connexion relue ; les copies reçues sont conservées. Vous pouvez reprendre les emplacements non lus.');});
 const read=(start,count,resume=false)=>run(async()=>{await prepareRead();say('Lecture MIDI en cours…');$('presets-progress').value=0;$('presets-progress').max=count;readGeneration=generation;const skipPresets=resume?displayRows().filter(r=>['decoded','opaque','empty'].includes(r.status)&&!failures[r.preset]).map(r=>r.preset):[];const task=reader.read(bank,start,count,{skipPresets});controls();const result=await task;say(`Lecture terminée · ${result.failed.length} échec(s) à reprendre. Copies conservées ; aucun preset rappelé.`);});
 $('presets-read-page').onclick=()=>{const first=displayRows()[page*25];if(first)void read(first.slot,Math.min(25,presetBanks.find(b=>b.id===bank).count-first.slot+1));};
 $('presets-read-bank').onclick=()=>void read(1,presetBanks.find(b=>b.id===bank).count);
 $('presets-resume').onclick=()=>void read(1,presetBanks.find(b=>b.id===bank).count,true);
 $('presets-read-dump').onclick=()=>void run(async()=>{
  const attempt=generation,session=await prepareRead();bankAbort=new AbortController();controls();say('Dump User : une requête, aucun autre message pendant le transfert…');
  try{const result=await session.readUserBank({signal:bankAbort.signal,onProgress:s=>{if(attempt===generation){$('presets-progress').max=s.expected||1;$('presets-progress').value=s.received;say(`Dump User · ${s.received} / ${s.expected??'?'} paquets`);}}});
   const local=attempt===generation&&db?db:await storageFactory();try{if(result.bankSyx.length)await storeFile(local,`FireworX-User-dump-${Date.now()}.syx`,result.bankSyx);}finally{if(local!==db)local.close();}
   if(attempt!==generation)return;await refresh();let description;try{const inventory=userBankInventory(result);description=`${inventory.records.length} en-têtes User reconnus ; paramètres lus à l’ouverture par GET individuel.`;}catch(e){description=e.message;}say(`${result.bankSyx.length?'Dump brut conservé':'Aucun octet de banque reçu'} · ${result.reason}. ${description}`);
  }finally{bankAbort=null;if(dialog.open)controls();}
 });
 $('presets-read-one').onclick=()=>{const r=record();if(r)void read(r.slot,1);};
 $('presets-current-capture').onclick=()=>$('presets-capture').click();
 $('presets-favorites-tree').onclick=()=>{if(job)return;const next=!$('presets-favorites').checked;clearFilters();bank='local';localBank='';$('presets-favorites').checked=next;render();};
 dropTarget($('presets-favorites-tree'),(ref,remove)=>mark(ref,{favorite:!remove,remove}));
 $('presets-tag-create').onclick=()=>void run(async()=>{const r=record(),tag=$('presets-new-tag').value.trim();if(!r?.sourceId)throw Error('Sélectionnez une copie reçue ou importée');await mark({sourceId:r.sourceId,index:r.index},{tag});$('presets-new-tag').value='';});
 $('presets-tree-search').oninput=()=>renderTree();
 for(const id of ['presets-sort','presets-duplicates'])$(id).onchange=()=>{page=0;render();};
 $('presets-filter-reset').onclick=()=>{clearFilters();$('presets-duplicates').value='show';$('presets-sort').value='original';render();};
 for(const mode of ['list','grid'])$('presets-view-'+mode).onclick=()=>{layout=mode;for(const m of ['list','grid'])$('presets-view-'+m).setAttribute('aria-pressed',String(mode===m));render();};
 $('presets-list').addEventListener('keydown',e=>{if(storeMode&&job){e.preventDefault();return;}if(!e.target.matches('[data-preset-key]')||!['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Enter'].includes(e.key))return;e.preventDefault();if(e.key==='Enter'){activateRow(e.target.dataset.presetKey);return;}const all=displayRows(),at=all.findIndex(r=>key(r)===selected),to=Math.max(0,Math.min(all.length-1,e.key==='Home'?0:e.key==='End'?all.length-1:at+({ArrowDown:1,ArrowUp:-1,PageDown:25,PageUp:-25}[e.key])));if(!all[to])return;const nextPage=Math.floor(to/25);selected=key(all[to]);if(nextPage!==page){page=nextPage;render();}selectRow(selected,true);});
 $('presets-cancel').onclick=()=>{reader.cancel();if(bankAbort){bankAbort.abort();say('Arrêt demandé · attente de la fin du flux SysEx et de son silence ; aucun autre message émis.');}};
 document.querySelectorAll('[data-preset-bank]').forEach(b=>b.onclick=()=>{if(job||storeMode&&!['user','card'].includes(b.dataset.presetBank))return;bank=b.dataset.presetBank;localBank='';filterSource=filterTag=filterAlgorithm='';page=0;selected=null;if(storeMode)chooseStoreDestination(bank,1);render();});
 for(const id of ['presets-search','presets-favorites'])$(id).oninput=()=>{page=0;render();};
 $('presets-prev').onclick=()=>{page--;render();};$('presets-next').onclick=()=>{page++;render();};
 $('presets-local-bank').onchange=()=>{localBank=$('presets-local-bank').value;filterSource=filterTag=filterAlgorithm='';selected=null;page=0;render();};
 $('presets-bank-create').onclick=()=>void run(async()=>{const name=$('presets-bank-name').value.trim();if(!name)throw Error('Nommez cette banque locale');const next=await db.metadata(),id='fireworx-'+crypto.randomUUID();next.banks.push({id,name,entries:[]});await db.setMetadata(next);bank='local';localBank=id;selected=null;await refresh();$('presets-bank-name').value='';say('Banque locale créée dans MIDI Studio.');});
 $('presets-bank-add').onclick=()=>void run(async()=>{const r=record(),id=$('presets-bank-target').value,next=await db.metadata(),target=next.banks.find(b=>b.id===id);if(!r?.sourceId||!target)throw Error('Choisissez une copie et une banque locale');target.entries.push({sourceId:r.sourceId,index:r.index});await db.setMetadata(next);await refresh();say('Copie référencée dans la banque locale ; original conservé.');});
 for(const [id,delta]of [['presets-bank-up',-1],['presets-bank-down',1],['presets-bank-remove',0]])$(id).onclick=()=>void run(async()=>{const r=record(),next=await db.metadata(),target=next.banks.find(b=>b.id===localBank),index=r?.bankIndex;if(!target||index===undefined)throw Error('Aucune entrée de banque sélectionnée');const ref=target.entries[index];if(ref?.sourceId!==r.sourceId||ref.index!==r.index)throw Error('La banque a changé ; rouvrez-la avant modification');if(delta){const to=index+delta;if(to<0||to>=target.entries.length)return;[target.entries[index],target.entries[to]]=[target.entries[to],target.entries[index]];}else target.entries.splice(index,1);await db.setMetadata(next);await refresh();say('Ordre de la banque locale enregistré. Aucun transfert matériel.');});
 $('presets-annotate').onclick=()=>void run(async()=>{const r=record(),latest=await db.metadata(),list=await db.list();const next=annotate(latest,list,{sourceId:r.sourceId,index:r.index},{name:$('presets-name').value.trim(),tags:[...new Set($('presets-tags').value.split(',').map(t=>t.trim()).filter(Boolean))],favorite:$('presets-favorite').checked});await db.setMetadata(next);await refresh();say('Nom, étiquettes et favori enregistrés localement. Le preset original est inchangé.');});
 $('presets-capture').onclick=()=>void run(async()=>{const frame=getCurrentFrame();if(!frame)throw Error('Aucun buffer disponible');const info=inspectPreset(frame);const result=await storeFile(db,`${info.name.replace(/[^a-z0-9_-]/gi,'_')||'FireworX-buffer'}.syx`,frame);bank='local';localBank='';await refresh();selected=`${result.source.id}:0`;render();say(result.inserted?'Copie du buffer conservée dans MIDI Studio. Aucun STORE.':'Cette copie exacte est déjà conservée.');});
 // One action for connected editing, one explicit offline action. Backups must
 // finish before any P0 write; a closing dialog or replaced connection cancels it.
 const openOffline=()=>run(async()=>{const r=record();if(r?.status!=='decoded')return;const frame=r.frame.slice(),attempt=generation,local=db;
  const check=()=>{assertAvailable();if(attempt!==generation||db!==local||!dialog.open)throw Error('Ouverture annulée ; copie éditée conservée');};
  const original=getCurrentFrame()?.slice();if(original)await storeFile(local,`FireworX-before-offline-${Date.now()}.syx`,original);check();
  const source=inspectPreset(frame);openLocal(localEditFrame(frame));if(closeAfterLoad)close();else await refresh();onOpened(source);onNotice('Copie ouverte hors ligne ; édition précédente sauvegardée dans la bibliothèque.');});
 async function loadConnected(frame,{closeAfter=false,connect=false}={}){
  const attempt=generation,local=db;const check=()=>{if(attempt!==generation||!dialog.open||db!==local)throw new DOMException('Chargement annulé','AbortError');};
  const session=connect?await prepareRead():getSession();check();
  if(!session)throw Error('Connexion synchronisée requise avant chargement');
  const source=await loadPresetCopy(frame,{session,getSession,getCurrentFrame,openLocal,check,onStatus:say,saveBackup:original=>storeFile(local,`FireworX-before-load-${Date.now()}.syx`,original)});
  if(closeAfter)close();else await refresh();onOpened(source);onNotice('Preset chargé et relu ; édition connectée active. Buffer précédent conservé, aucun STORE.');
  if(!closeAfter)say('Preset chargé et relu dans P0. Buffer précédent conservé ; aucun STORE.');
 }
 $('presets-open-offline').onclick=openOffline;
 const wantsHardware=()=>!!getSession()||!!getConnection?.()?.portsAvailable||!!getConnection?.()?.connecting;
 $('presets-open').onclick=()=>{
  const r=record();if(!r)return;
  if(r.status==='decoded'){
   if(!wantsHardware())return openOffline();
   const frame=r.frame.slice();return void run(()=>loadConnected(frame,{closeAfter:closeAfterLoad,connect:!getSession()}));
  }
  if(!['unread','failed','packed-header'].includes(r.status)||!presetBanks.some(b=>b.id===r.bank))return;
  const location={bank:r.bank,slot:r.slot,preset:r.preset},attempt=generation,local=db;
  const check=()=>{if(attempt!==generation||!dialog.open||db!==local)throw new DOMException('Chargement annulé','AbortError');};
  void run(async()=>{
   const session=await prepareRead();check();say(`Lecture de ${location.bank} ${location.slot} avant chargement…`);
   const received=await session.readPreset(location.preset);check();
   if(session!==getSession())throw Error('Connexion remplacée ; aucun chargement envoyé');
   const source=inspectPreset(received.frame);
   if(source.preset!==location.preset)throw Error('Réponse à une autre adresse de preset ; aucun chargement envoyé');
   await storeFile(local,`FireworX-${location.bank}-${location.slot}.syx`,source.frame);check();await refresh();check();
   if(source.status!=='decoded')throw Error(source.status==='empty'?'Emplacement vide ; aucun preset chargé.':'Données conservées mais non éditables ; aucun preset chargé.');
   await loadConnected(source.frame,{closeAfter:closeAfterLoad});
  });
 };
 $('presets-audition').onclick=()=>{const r=record();if(r?.status==='decoded'){const frame=r.frame.slice();void run(()=>loadConnected(frame,{closeAfter:closeAfterLoad}));}};
 $('presets-send-copy').onclick=()=>void run(async()=>{
  // Capture before connecting: the GETs will replace the offline editor image.
  const frame=getCurrentFrame()?.slice();if(!frame)throw Error('Aucune copie éditable disponible');
  const attempt=generation;await storeFile(db,'FireworX-offline-copy-before-connect.syx',frame);if(attempt!==generation||!dialog.open)throw new DOMException('Chargement annulé','AbortError');
  await loadConnected(frame,{closeAfter:closeAfterLoad,connect:true});
 });
 $('presets-export-one').onclick=()=>{const r=record();if(r?.frame){const original=inspectPreset(r.frame);download(r.frame,`FireworX-${original.bank}-${original.slot}.syx`);};};
 $('presets-export-dump').onclick=()=>void run(async()=>{if(!latestUserDump)throw Error('Aucun dump User conservé');download(await db.original(latestUserDump.id),latestUserDump.name);say('Dump original exporté sans transformation ; incomplet si la lecture avait été interrompue.');});
 $('presets-export-bank').onclick=()=>{try{const seen=new Set(),data=displayRows().filter(r=>{if(!r.frame)return false;if(bank==='local')return true;const k=libraryRef(r);if(seen.has(k))return false;seen.add(k);return true;});download(joinPresetFrames(data.map(r=>r.frame)),`FireworX-${bank}-copies.syx`);}catch(e){say(e.message);}};
 $('presets-archive').onclick=()=>void run(async()=>{download(await exportLibraryArchive(db),'midi-studio-library.json','application/json');say('Archive commune exportée avec les fichiers originaux et leurs annotations.');});
 $('presets-import').onchange=()=>void run(async()=>{try{const files=[...$('presets-import').files];if(files.length>64)throw Error('64 fichiers maximum');for(const file of files){if(file.size>(file.name.toLowerCase().endsWith('.json')?180:32)*1024*1024)throw Error('Fichier trop volumineux');if(file.name.toLowerCase().endsWith('.json'))await restoreLibraryArchive(db,await file.text());else{await storeFile(db,file.name,new Uint8Array(await file.arrayBuffer()));}}bank='local';localBank='';await refresh();say('Import terminé ; fichiers originaux conservés dans MIDI Studio. Aucun envoi MIDI.');}finally{$('presets-import').value='';}});
 function close(){cancelStore();reader.cancel();bankAbort?.abort();generation++;ready=false;job=false;db?.close();db=null;inventoryCache.clear();dumpCache.clear();packedHeaders.clear();latestUserDump=null;rowsByRef.clear();annotations.clear();rows=[];sources=[];metadata=null;dialog.close();}
 $('presets-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 window.addEventListener('pagehide',close);
 async function recallCopies(){
  const local=await storageFactory();try{
   const list=await local.list(),found=[];
   for(const source of list)for(const entry of source.inventory.entries){const bytes=entryMessage(source.inventory,entry.index);if(!isFireworx(bytes))continue;try{const r=inspectPreset(Uint8Array.from(bytes));if(r.bank!=='buffer')found.push({...r,at:source.importedAt});}catch{}}
   return [...recallInventory(found).values()];
  }finally{local.close();}
 }
 async function recallSession(connect=false){
  assertAvailable();
  if(getSession())return getSession();
  if(!connect||!getConnection?.()?.portsAvailable)return null;
  const frame=getCurrentFrame()?.slice(),local=await storageFactory();
  try{if(frame)await storeFile(local,`FireworX-before-recall-connect-${Date.now()}.syx`,frame);}finally{local.close();}
  const session=await ensureReadSession();
  if(!session||session!==getSession())throw Error('Reconnexion non confirmée ; aucun chargement envoyé');
  return session;
 }
 async function readRecall(bankId,slot,{connect=false}={}){
  const session=await recallSession(connect);if(!session)return null;
  const capacity=await storageFactory();try{await assertStorageRoom(capacity,3);}finally{capacity.close();}
  const address=presetAddress(bankId,slot),received=await session.readPreset(address),r=inspectPreset(received.frame);
  if(session!==getSession())throw Error('Connexion remplacée ; aucun chargement envoyé');
  if(r.preset!==address)throw Error('Réponse à une autre adresse de preset');
  const local=await storageFactory();try{await storeFile(local,`FireworX-${bankId}-${slot}.syx`,r.frame);}finally{local.close();}
  return {...r,at:new Date().toISOString()};
 }
 async function loadRecall(record){
  const frame=record.frame.slice(),connect=wantsHardware(),session=await recallSession(connect);
  if(connect&&!session)throw Error('Connexion synchronisée requise avant chargement');
  const local=await storageFactory();
  try{const source=await loadPresetCopy(frame,{session,getSession,getCurrentFrame,openLocal,nativeRecall:true,saveBackup:original=>storeFile(local,`FireworX-before-recall-${Date.now()}.syx`,original),onStatus:onNotice});onOpened(source);onNotice(session?'Mémoire rappelée sur le FireworX et P0 relu ; aucun STORE.':'Copie ouverte hors ligne ; aucun envoi MIDI.');return source;}finally{local.close();}
 }
 async function loadEditableFrame(frame,{check=()=>{},onStatus=onNotice}={}){
  const next=localEditFrame(frame);check();const local=await storageFactory();
  try{
   await storeFile(local,`FireworX-variation-before-send-${Date.now()}.syx`,next);check();
   onStatus('Connexion et lectures de référence P0…');const session=await recallSession(true);
   if(!session)throw Error('Ports FireworX indisponibles : connectez les ports MIDI avant l’envoi P0');
   const stopProgress=watchP0Progress(session,onStatus);try{return await loadPresetCopy(next,{session,getSession,getCurrentFrame,openLocal,saveBackup:original=>storeFile(local,`FireworX-before-variation-${Date.now()}.syx`,original)});}finally{stopProgress();}
  }finally{local.close();}
 }
 async function knownPresetNames(){
  const local=await storageFactory();
  try{const [list,meta]=await Promise.all([local.list(),local.metadata()]),names=[...factoryPresets.map(p=>p.name),...meta.annotations.flatMap(a=>a.revisions.map(r=>r.name))];
   for(const source of list){for(const entry of source.inventory.entries){const message=entryMessage(source.inventory,entry.index);if(isFireworx(message)){try{const info=inspectPreset(Uint8Array.from(message));if(info.status!=='empty')names.push(info.name);}catch{}}}
    const frames=source.inventory.entries.map(e=>Uint8Array.from(entryMessage(source.inventory,e.index))),header=frames.find(f=>f[0]===240&&f[5]===64&&f[6]===16);if(header){try{names.push(...decodeUserBankFrames(frames,header[4]).inventory.records.map(r=>r.name));}catch{}}
   }return names;
  }finally{local.close();}
 }
 return {recallCopies,readRecall,loadRecall,loadEditableFrame,knownPresetNames,async open(mode){if(dialog.open){if(mode==='store'&&!job)beginStore();controls();return;}storeMode=mode==='store';dialog.showModal();say('Ouverture de la bibliothèque locale…');const attempt=++generation;ready=false;controls();try{const local=await storageFactory();if(attempt!==generation){local.close();return;}db=local;ready=true;if(mode==='store')bank='user';localBank='';await refresh();if(mode==='store'){beginStore();$('presets-hardware-store').scrollIntoView({block:'nearest'});}else say('Choisissez une banque, une lecture ou un fichier. Toute sauvegarde User / Carte exige une confirmation de destination.');}catch(e){if(attempt===generation){ready=false;controls();say(e.message);}}},refreshConnection(){if(dialog.open)controls();},setDraftOpener(fn){$('presets-drafts').onclick=()=>{close();fn();};},close};
}

return {createPresetLibrary};
}
