import {families,findAlgorithm,findFamily,modifiers} from './catalog.js';
import {connectionPlan,portConnectionPlan,routingItems,dragConnectionPlan} from './routing-topology.js';
import {editableControlsFor,validControlValue} from './parameters.js';
const clone=s=>structuredClone(s);
const cell=(state,p)=>p&&Number.isInteger(p.col)&&p.col>=0&&p.col<8&&Number.isInteger(p.row)&&p.row>=0&&p.row<state.rows;
// Manual p.22 forbids more than two empty rows before a lower occupied row.
// Interpret this as consecutive blank rows; this reading still needs hardware confirmation.
export function assertRowGaps(nodes,rows){
 let blanks=0;
 for(let row=0;row<rows;row++){
  if(nodes.some(n=>n.row===row)){if(blanks>2)throw new Error('Placement refusé : plus de deux lignes vides avant un bloc (manuel p. 22).');blanks=0;}
  else blanks++;
 }
}
export function resizeGrid(source,rows){
 if(!Number.isInteger(rows)||rows<1||rows>8)throw new Error('La grille comporte de 1 à 8 lignes.');
 const state=clone(source);assertRowGaps([...state.nodes,...(state.routes??[])],rows);state.rows=rows;state.target=null;
 if(!state.nodes.some(n=>n.id===state.selected&&n.row<rows))state.selected=state.nodes.find(n=>n.row<rows)?.id??null;
 return result(state,'Grille redimensionnée ; blocs hors cadre conservés et inactifs (manuel p. 28).');
}
export function layoutGrid(source,axis,index,action){
 const state=clone(source),limit=axis==='col'?8:state.rows;
 if(!['col','row'].includes(axis)||!Number.isInteger(index)||index<0||index>=limit)throw new Error('Ligne ou colonne invalide');
 if(action==='before'||action==='after'){
  const other=index+(action==='before'?-1:1);if(other<0||other>=limit)throw new Error('Bord de la grille atteint.');
  for(const n of [...state.nodes,...(state.routes??[])]){if(n.row>=state.rows)continue;if(n[axis]===index)n[axis]=other;else if(n[axis]===other)n[axis]=index;}
 }else if(action==='insert'){
  if([...state.nodes,...(state.routes??[])].some(n=>n.row<state.rows&&n[axis]===limit-1))throw new Error('Insertion refusée : le bord de la grille est occupé. Déplacez les blocs avant insertion.');
  for(const n of [...state.nodes,...(state.routes??[])])if(n.row<state.rows&&n[axis]>=index)n[axis]++;
 }else if(action==='delete'){
  const removed=new Set(state.nodes.filter(n=>n.row<state.rows&&n[axis]===index).map(n=>n.id));
  state.nodes=state.nodes.filter(n=>!removed.has(n.id));state.links=state.links.filter(l=>!removed.has(l.node));
  state.routes=(state.routes??[]).filter(n=>!(n.row<state.rows&&n[axis]===index));
  for(const n of [...state.nodes,...(state.routes??[])])if(n.row<state.rows&&n[axis]>index)n[axis]--;
 }else throw new Error('Action Layout inconnue');
 assertRowGaps([...state.nodes,...(state.routes??[])],state.rows);
 if(!state.nodes.some(n=>n.id===state.selected))state.selected=state.nodes.find(n=>n.row<state.rows)?.id??null;
 state.target=null;return result(state,'Layout modifié localement ; Annuler restaure les positions et réglages.');
}
const result=(state,message)=>({state,message});
export function dropBlock(source,payload,position){
 const state=clone(source);if(!cell(state,position))throw new Error('Case hors de la matrice');
 if(payload?.kind?.startsWith('routing-'))return dropRouting(source,payload,position);
 if(!payload||!['library','node'].includes(payload.kind))throw new Error('Objet déplacé inconnu');
 const existing=payload.kind==='node'?state.nodes.find(n=>n.id===payload.id):null;
 if(payload.kind==='node'&&!existing)throw new Error('Bloc déplacé introuvable');
 const algorithm=existing?.algorithm??payload.algorithm,family=findFamily(algorithm);
 if(!family||!findAlgorithm(algorithm))throw new Error('Algorithme inconnu');
 if(!existing&&state.nodes.filter(n=>findFamily(n.algorithm).id===family.id).length>=family.max)throw new Error(`Limite FireworX : ${family.max} instance(s) de ${family.name}. Changez l’algorithme d’une instance existante.`);
 if(existing&&existing.col===position.col&&existing.row===position.row)return result(state,'Bloc déjà à cette position.');
 if(existing)state.nodes=state.nodes.filter(n=>n.id!==existing.id);
 // Occupied target: insert before it, shifting right to the nearest empty cell.
 if(state.routes?.some(n=>n.col===position.col&&n.row===position.row))throw new Error('Retirez ou déplacez le routage qui occupe cette case');
 if(state.nodes.some(n=>n.col===position.col&&n.row===position.row)){
  let free=position.col;
  while(free<8&&state.nodes.some(n=>n.col===free&&n.row===position.row))free++;
  if(state.routes?.some(n=>n.row===position.row&&n.col>=position.col&&n.col<=free))throw new Error('Routage sur le trajet de l’insertion ; déplacez-le d’abord');
  if(free===8){
   // A move within a full row can reuse the vacated slot on the left.
   let left=position.col-1;while(left>=0&&state.nodes.some(n=>n.col===left&&n.row===position.row))left--;
   if(state.routes?.some(n=>n.row===position.row&&n.col>=left&&n.col<position.col))throw new Error('Routage sur le trajet du déplacement ; déplacez-le d’abord');
   if(left<0)throw new Error('Cette branche est pleine. Choisissez une case vide ou échangez deux blocs avec Maj + dépôt.');
   for(let col=left+1;col<position.col;col++){const n=state.nodes.find(n=>n.col===col&&n.row===position.row);if(n)n.col--;}
   position={col:position.col-1,row:position.row};
  }else for(let col=free-1;col>=position.col;col--){const n=state.nodes.find(n=>n.col===col&&n.row===position.row);if(n)n.col++;}
 }
 let n=existing;
 if(!n){let serial=state.nextId??4;while(state.nodes.some(n=>n.id===`${family.id}-${serial}`))serial++;state.nextId=serial+1;n={id:`${family.id}-${serial}`,algorithm,col:position.col,row:position.row,values:{},muted:false};}
 n.col=position.col;n.row=position.row;state.nodes.push(n);state.selected=n.id;state.target=null;
 assertRowGaps([...state.nodes,...(state.routes??[])],state.rows);
 return result(state,existing?'Bloc déplacé ; chaîne mise à jour.':'Bloc ajouté ; chaîne mise à jour.');
}
export function swapBlocks(source,id,targetId){
 const state=clone(source),a=state.nodes.find(n=>n.id===id),b=state.nodes.find(n=>n.id===targetId);
 if(!a||!b)throw new Error('Bloc introuvable');
 [a.col,b.col]=[b.col,a.col];[a.row,b.row]=[b.row,a.row];state.selected=id;state.target=null;
 assertRowGaps([...state.nodes,...(state.routes??[])],state.rows);
 return result(state,'Positions échangées ; réglages et liens conservés.');
}
export function appendPosition(state,selectedId){
 const selected=state.nodes.find(n=>n.id===selectedId),row=selected?.row??0;
 const last=Math.max(-1,...state.nodes.filter(n=>n.row===row).map(n=>n.col));
 if(last<7)return {col:last+1,row};
 for(let r=0;r<state.rows;r++)if(!state.nodes.some(n=>n.row===r))return {col:0,row:r};
 throw new Error('Cette chaîne est pleine. Choisissez une case vide ou passez à 8 lignes.');
}
export function validateStudy(input){
 if(!input||typeof input!=='object'||input.kind!=='midi-studio-fireworx-offline-study'||input.hardware!==false)throw new Error('Fichier d’étude hors ligne attendu');
 if(![1,2,3].includes(input.schema))throw new Error('Version d’étude non prise en charge');
 const s=clone(input);s.schema=3;
 if(s.nextId!==undefined&&(!Number.isSafeInteger(s.nextId)||s.nextId<4||s.nextId>1000000))throw new Error('Compteur de blocs invalide');
 s.nextId=s.nextId??4;
 if(!Number.isInteger(s.rows)||s.rows<1||s.rows>8||!Array.isArray(s.nodes)||s.nodes.length>18)throw new Error('Grille ou nombre de blocs invalide');
 const ids=new Set(),cells=new Set();
 for(const n of s.nodes){
  if(!n||typeof n.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(n.id)||ids.has(n.id)||!findAlgorithm(n.algorithm)||!cell({rows:8},n)||typeof n.muted!=='boolean')throw new Error('Bloc ou position invalide');
  const c=`${n.col}:${n.row}`;if(cells.has(c))throw new Error('Deux blocs occupent la même case');ids.add(n.id);cells.add(c);
  if(!n.values||typeof n.values!=='object'||Array.isArray(n.values)||Object.keys(n.values).length>1200)throw new Error('Réglages invalides');
  const migrated={};
  for(const [rawKey,v] of Object.entries(n.values)){
   let k=rawKey;
   if(input.schema<3){const [algorithm,label]=k.split(':');if(algorithm==='delay-six')k=`${algorithm}:${label.replace(/^Time (\d)$/,'Tap $1')}`;if(algorithm==='delay-dual-three')k=`${algorithm}:${label.replace(/^Time (\d)$/,(_,x)=>`Line ${Math.floor((Number(x)-1)/3)+1} / Time ${(Number(x)-1)%3+1}`)}`;}
   const split=k.indexOf(':'),algorithm=k.slice(0,split),label=k.slice(split+1),control=findAlgorithm(algorithm)&&editableControlsFor(algorithm).find(c=>c.label===label);
   if(split<1||!control||!validControlValue(control,v))throw new Error(`Valeur de paramètre invalide : ${rawKey}`);
   if(findFamily(algorithm).id!==findFamily(n.algorithm).id)throw new Error('Réglages d’une autre famille');
   migrated[k]=v;
  }
  n.values=migrated;

 }
 s.routes=s.routes??[];if(!Array.isArray(s.routes)||s.routes.length>64)throw new Error('Routages invalides');
 const specialTypes=new Set();
 for(const r of s.routes){const k=`${r.col}:${r.row}`;if(!cell({rows:8},r)||!routingItems.some(x=>x.type===r.type)||cells.has(k)||r.type!==1&&specialTypes.has(r.type))throw new Error('Case de routage invalide');cells.add(k);specialTypes.add(r.type);}
 for(const f of families)if(s.nodes.filter(n=>findFamily(n.algorithm).id===f.id).length>f.max)throw new Error('Limite d’instances dépassée');
 s.rate=s.rate??44100;if(![44100,48000].includes(s.rate))throw new Error('Fréquence invalide');
 s.costs=s.costs??{};if(typeof s.costs!=='object'||Array.isArray(s.costs))throw new Error('Coûts invalides');
 for(const [k,v] of Object.entries(s.costs)){const [id,rate]=k.split('@');if(k!==`${id}@${rate}`||!findAlgorithm(id)||!['44100','48000'].includes(rate)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw new Error('Coût invalide');}
 s.baselines=s.baselines??{44100:null,48000:null};for(const r of [44100,48000]){const v=s.baselines[r];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100))throw new Error('Charge de base invalide');}
 s.pitchDetector=s.pitchDetector??false;if(typeof s.pitchDetector!=='boolean')throw new Error('État du détecteur invalide');
 s.links=s.links??[];if(!Array.isArray(s.links)||s.links.length>20)throw new Error('Matrice de modulation invalide');const destinations=new Set();
 for(const l of s.links){const n=s.nodes.find(n=>n.id===l.node),c=n&&editableControlsFor(n.algorithm).find(c=>c.label===l.parameter),legacy=n?.algorithm==='chorus-classic'&&l.parameter==='Out Level';const k=`${l.node}:${l.parameter}`;if(!n||l.algorithm!==n.algorithm||!modifiers.includes(l.source)||(!c?.modulatable&&!legacy)||destinations.has(k))throw new Error('Lien de modulation invalide');if(legacy)l.inactive=true;if(l.transform!==undefined){const t=l.transform,r={low:[0,100],mid:[0,100],high:[0,100],slope:[-90,90],glide:[0,30]};if(!t||typeof t!=='object'||Object.keys(t).length!==5||Object.entries(r).some(([k,[a,b]])=>!Number.isInteger(t[k])||t[k]<a||t[k]>b))throw new Error('Transformation de lien invalide');}destinations.add(k);}
 s.selected=s.nodes.some(n=>n.id===s.selected&&n.row<s.rows)?s.selected:s.nodes.find(n=>n.row<s.rows)?.id??null;s.target=null;
 return {schema:3,nextId:s.nextId,rows:s.rows,selected:s.selected,target:null,rate:s.rate,costs:s.costs,baselines:s.baselines,pitchDetector:s.pitchDetector,routes:s.routes.map(r=>({col:r.col,row:r.row,type:r.type})),nodes:s.nodes.map(n=>({id:n.id,algorithm:n.algorithm,col:n.col,row:n.row,values:n.values,muted:n.muted})),links:s.links.map(l=>({source:l.source,node:l.node,algorithm:l.algorithm,parameter:l.parameter,...(l.transform?{transform:{low:l.transform.low,mid:l.transform.mid,high:l.transform.high,slope:l.transform.slope,glide:l.transform.glide}}:{}),...(l.inactive?{inactive:true}:{})}))};
}

export function dropRouting(source,payload,position){
 const state=clone(source);if(!cell(state,position))throw new Error('Case hors matrice');state.routes??=[];
 const existing=payload.kind==='routing-node'?state.routes.find(r=>r.col===payload.from.col&&r.row===payload.from.row):null;
 if(payload.kind==='routing-node'&&!existing)throw new Error('Routage introuvable');
 const type=existing?.type??payload.type;if(!routingItems.some(x=>x.type===type))throw new Error('Type de routage invalide');
 if(existing)state.routes=state.routes.filter(r=>r!==existing);
 if(state.nodes.some(r=>r.col===position.col&&r.row===position.row)||state.routes.some(r=>r.col===position.col&&r.row===position.row))throw new Error('Choisissez une case vide');
 if(type!==1&&state.routes.some(r=>r.type===type))throw new Error('Un seul élément de ce routage par preset');
 state.routes.push({...position,type});assertRowGaps([...state.nodes,...state.routes],state.rows);state.target=null;return result(state,'Routage placé localement');
}
export function connectStudyBlock(source,payload,anchorId,mode){
 const moving=source.nodes.find(n=>n.id===payload.id);if(moving?.id===anchorId)throw new Error('Choisissez un autre bloc de référence');
 const cells=[...source.nodes.filter(n=>n.id!==moving?.id),...(source.routes??[])],anchor=source.nodes.find(n=>n.id===anchorId),plan=connectionPlan(cells,anchor,mode,source.rows);
 let next=dropBlock(source,payload,plan.to);for(const pos of plan.pipelines)next=dropRouting(next.state,{kind:'routing-library',type:1},pos);
 return result(next.state,'Branche créée ; paramètres conservés');
}
export function connectStudyPorts(source,sourceId,targetId,mode){
 const plan=portConnectionPlan([...source.nodes,...(source.routes??[])],source.nodes.find(n=>n.id===sourceId),source.nodes.find(n=>n.id===targetId),mode,source.rows);
 let next=dropBlock(source,{kind:'node',id:targetId},plan.to);
 for(const pos of plan.pipelines)next=dropRouting(next.state,{kind:'routing-library',type:1},pos);
 return result(next.state,'Liaison appliquée dans la matrice ; réglages conservés');
}
// #74 cable drag on the local draft: same plan as P0; settings, mutes and links are kept.
export function connectStudyDrag(source,grabbed,drop,options={}){
 const plan=dragConnectionPlan([...source.nodes,...(source.routes??[])],source.nodes,source.rows,grabbed,drop,options);
 if(plan.op==='series')return {...connectStudyPorts(source,plan.source,plan.target,'series'),plan};
 if(plan.op==='parallel'||plan.op==='return')return {...connectStudyBlock(source,{kind:'node',id:plan.moving},plan.anchor,plan.mode),plan};
 let next=plan.moving?dropBlock(source,{kind:'node',id:plan.moving},plan.to):result(clone(source),'');
 for(const pos of plan.pipelines)next=dropRouting(next.state,{kind:'routing-library',type:1},pos);
 return {...result(next.state,plan.op==='output'?'Sortie indépendante vers OUT ; réglages conservés':'Nouvelle branche depuis IN ; réglages conservés'),plan};
}
