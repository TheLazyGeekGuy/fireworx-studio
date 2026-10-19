// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {validateStudy} from '../engine/study-model.js';
export function create_library(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;


 const libraryKind='midi-studio-fireworx-offline-library';
 function validateLibrary(input){
 if(input?.kind!==libraryKind||input.schema!==1||!Array.isArray(input.entries)||input.entries.length>64)throw new Error('Bibliothèque locale invalide (64 études maximum).');
 return input.entries.map(e=>{
  if(typeof e?.name!=='string'||!e.name.trim()||e.name.length>80)throw new Error('Nom d’étude invalide.');
  return {name:e.name,study:{kind:'midi-studio-fireworx-offline-study',hardware:false,...validateStudy(e.study)}};
 });
}
 function createLibrary({snapshot,restore,onNotice}){
 const dialog=document.getElementById('library-dialog'),list=document.getElementById('library-items'),message=document.getElementById('library-message');
 const storageKey='midi-studio-fireworx-offline-library-v1';let entries=[],storageReadFailed=false;
 const envelope=items=>({kind:libraryKind,schema:1,entries:items});
 try{const raw=localStorage.getItem(storageKey);if(raw){if(raw.length>8*1024*1024)throw new Error('Bibliothèque enregistrée trop volumineuse.');entries=validateLibrary(JSON.parse(raw));}}catch(e){storageReadFailed=true;message.textContent=`Lecture locale refusée : ${e.message} La source enregistrée est conservée.`;}
 function persist(next){if(storageReadFailed)throw new Error('Stockage existant illisible : aucune réécriture. Exportez le brouillon JSON pour le conserver.');const raw=JSON.stringify(envelope(next));if(raw.length>8*1024*1024)throw new Error('Bibliothèque trop volumineuse (8 Mio).');localStorage.setItem(storageKey,raw);entries=next;render();}
 function render(){list.replaceChildren();for(const [i,e] of entries.entries()){
  const row=document.createElement('div');row.className='library-row';const title=document.createElement('span');title.textContent=`${e.name} · ${e.study.nodes.length} blocs`;
  const load=document.createElement('button');load.textContent='Charger la copie';load.onclick=()=>{restore(validateStudy(e.study));dialog.close();onNotice('Étude chargée depuis la bibliothèque locale ; Annuler restaure le patch précédent.');};
  const remove=document.createElement('button');remove.textContent='Retirer de la bibliothèque';remove.onclick=()=>{try{persist(entries.filter((_,j)=>j!==i));message.textContent='Copie retirée de la bibliothèque locale.';}catch(err){message.textContent=err.message;}};
  row.append(title,load,remove);list.append(row);
 }if(!entries.length)list.textContent='La bibliothèque est vide.';}
 document.getElementById('library-close').onclick=()=>dialog.close();
 document.getElementById('library-save').onclick=()=>{try{const name=document.getElementById('library-name').value.trim();const next=validateLibrary(envelope([...entries,{name,study:snapshot()}]));persist(next);message.textContent='Copie sauvegardée dans ce navigateur. Exportez la bibliothèque pour la conserver dans un fichier.';}catch(e){message.textContent=e.message;}};
 document.getElementById('library-download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(envelope(entries),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fireworx-offline-library.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.getElementById('library-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024)throw new Error('Fichier trop volumineux (8 Mio).');const incoming=validateLibrary(JSON.parse(await file.text()));const next=validateLibrary(envelope([...entries,...incoming]));persist(next);message.textContent=`${incoming.length} copies ajoutées ; les copies existantes sont conservées.`;}catch(err){message.textContent=`Import refusé : ${err.message}`;}finally{e.target.value='';}};
 return {open(mode='recall'){render();if(!dialog.open)dialog.showModal();document.getElementById(mode==='store'?'library-name':'library-close').focus();}};
}

return {libraryKind,validateLibrary,createLibrary};
}
