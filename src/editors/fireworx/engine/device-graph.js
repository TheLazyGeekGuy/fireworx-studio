// Pure edits of the actual FireworX matrix and engine records. No MIDI/DOM.
import {deviceMap,fieldById,decodeDeviceBuffer,controlsForDevice,readField,editedPayload} from './device-codec.js';
import {frameWithPayload} from './live-protocol.js';
import {connectionPlan,portConnectionPlan,dragConnectionPlan} from './routing-topology.js';
import {isGenerator} from './catalog.js';
const offset=(col,row)=>44+col*16+row*2;
function cell(p,col,row){const o=offset(col,row);return {type:p[o],instance:p[o+1]};}
function position(pos,rows=8){if(!pos||!Number.isInteger(pos.col)||pos.col<0||pos.col>7||!Number.isInteger(pos.row)||pos.row<0||pos.row>7)throw new Error('Case hors matrice 8 × 8');if(pos.row>=rows)throw new Error('Augmentez la grille avant de placer un bloc sur cette ligne');}
function derive(p){
 for(let type=7;type<=18;type++){let mask=0;for(let o=44;o<172;o+=2)if(p[o]===type)mask|=1<<p[o+1];p[187+type]=mask;}
 for(let type=3;type<=6;type++){let present=0;for(let o=44;o<172;o+=2)if(p[o]===type)present=1;p[187+type]=present;}
 return p;
}
// Shared pure derivation for atomic multi-engine compositions, before validation.
export {derive as deriveDevicePresence};
function assertMatrix(p){
 const seen=new Set();for(let o=44;o<172;o+=2){const t=p[o],i=p[o+1];if(!t)continue;if(t>18)throw new Error('Type de bloc inconnu conservé ; ne déplacez pas cette case');
  if(t>=7){const d=Object.values(deviceMap.defaults).find(d=>d.block_type_id===t);if(!d||i>=d.count)throw new Error('Instance matérielle hors limites');const k=t+':'+i;if(seen.has(k))throw new Error('Une instance ne peut occuper deux cases');seen.add(k);}}
 let blank=0;for(let row=0;row<p[172];row++){const occupied=Array.from({length:8},(_,col)=>p[offset(col,row)]).some(Boolean);if(occupied){if(blank>2)throw new Error('Plus de deux lignes vides avant un bloc');blank=0;}else blank++;}
}
export function validateDeviceMatrix(buffer){
 if(buffer.payload[172]<1||buffer.payload[172]>8)throw Error('Grille de 1 à 8 lignes requise');
 assertMatrix(buffer.payload);
 if(buffer.unknown.length)throw Error('Algorithme ou bloc inconnu dans la matrice');
 const derived=derive(buffer.payload.slice());
 if(derived.slice(190,206).some((v,i)=>v!==buffer.payload[190+i]))throw Error('Présence des moteurs incohérente avec la matrice');
}
function finish(buffer,p){derive(p);assertMatrix(p);decodeDeviceBuffer(frameWithPayload(buffer.frame,p));return p;}
// Factory-200 records cover one variant per family, not every variant's defaults.
// Only repair values outside the active variant's documented domain on creation
// or algorithm change. Existing valid values and inactive bytes are preserved.
function validVariant(buffer,p,id){
 // Local OS2 observation: an active Dynamics record validates its dormant Soft
 // Compressor threshold too (Gate selected: seed -42 is rewritten to -30 @242).
 // This is an editor seed repair, not permission to normalize arbitrary aliases.
 const [,type,index]=id.split('-');
 if(Number(type)===7){const f=fieldById.get(`dynamics.inst[${Number(index)}].variant[1].soft_threshold`),v=readField(p,f);if(v<f.range[0]||v>f.range[1])p[f.offset]=Math.max(f.range[0],Math.min(f.range[1],v))&255;}
 const next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p)),n=next.nodes.find(n=>n.id===id),changes=new Map();
 for(const f of controlsForDevice(next,n).filter(f=>f.editable&&f.range)){
  const v=readField(next,f),keys=f.values&&Object.keys(f.values).map(Number).filter(Number.isInteger).sort((a,b)=>a-b);
  if(f.offValue!==null&&f.offValue!==undefined&&v===f.offValue)continue; // documented Off sentinel (e.g. LFO speed 255) is kept
  if(keys?.length&&!keys.includes(v))changes.set(f.id,keys.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a));
  else if(v<f.range[0]||v>f.range[1])changes.set(f.id,Math.max(f.range[0],Math.min(f.range[1],v)));
 }
 return changes.size?editedPayload(next,changes):p;
}
// Generator seed safety (#71, #73 comment of 17/10): the retained Synth seed carries Out Level
// 0 dB and Mix 100 %; a Curve added with it produced a full-scale 442 Hz tone on the real unit.
// New generator engines (catalog generatorAlgorithms) start at -36 dB, the lowest Out Level
// among the 56 Factory 1-400 generator instances (Factory 5 « Walkietalkie »), inside the
// field domain -100..0 dB. Engines received from the unit keep their own level.
export const generatorSeedOutLevel=-36;
function prudentSeed(p,algorithm,instance){
 if(!isGenerator(algorithm))return p;
 const a=deviceMap.algorithms[algorithm],f=fieldById.get(`${a.document}.inst[${instance}].out_level`);
 if(!f||generatorSeedOutLevel<f.range[0]||generatorSeedOutLevel>f.range[1])throw new Error('Niveau de sortie prudent du générateur introuvable');
 p[f.offset]=generatorSeedOutLevel&255;return p;
}
export function defaultDeviceRecord(buffer,node){
 const a=deviceMap.algorithms[node.algorithm],d=deviceMap.defaults[a.document],start=d.base+node.instanceIndex*d.stride,p=buffer.payload.slice();
 p.set(d.records[node.instanceIndex],start);
 const selector=a.selector&&fieldById.get(a.selector.replace('.inst[0]',`.inst[${node.instanceIndex}]`));if(selector)p[selector.offset]=a.variant;
 prudentSeed(p,node.algorithm,node.instanceIndex);
 return validVariant(buffer,p,node.id).slice(start,start+d.stride);
}
export function moveDeviceBlock(buffer,id,to,{swap=false}={}){
 const n=buffer.nodes.find(n=>n.id===id);if(!n)throw new Error('Moteur introuvable');return moveDeviceCell(buffer,n,to,{swap});
}
export function moveDeviceCell(buffer,source,to,{swap=false}={}){
 position(source,buffer.rows);position(to,buffer.rows);const p=buffer.payload.slice(),from=offset(source.col,source.row),dest=offset(to.col,to.row);if(!p[from])throw new Error('Case source vide');
 if(from===dest)return p;const pair=p.slice(from,from+2);p[from]=p[from+1]=0;
 if(swap){p.set(p.slice(dest,dest+2),from);p.set(pair,dest);}
 else{
  if(p[dest]){let free=to.col;while(free<8&&cell(p,free,to.row).type)free++;if(free===8)throw new Error('Ligne pleine ; utilisez Maj pour échanger deux blocs');for(let col=free;col>to.col;col--)p.set(p.slice(offset(col-1,to.row),offset(col-1,to.row)+2),offset(col,to.row));}
  p.set(pair,dest);
 }
 return finish(buffer,p);
}
export function addDeviceBlock(buffer,algorithm,to){
 position(to,buffer.rows);const a=deviceMap.algorithms[algorithm];if(!a)throw new Error('Algorithme inconnu');const d=deviceMap.defaults[a.document];if(!d)throw new Error('Initialisation du moteur inconnue');
 const used=new Set(buffer.nodes.filter(n=>n.blockTypeId===a.blockTypeId).map(n=>n.instanceIndex));let instance=0;while(used.has(instance))instance++;if(instance>=d.count)throw new Error(`Limite de ${d.count} moteur(s) de cette famille`);
 const p=buffer.payload.slice(),dest=offset(to.col,to.row);if(p[dest]){let free=to.col;while(free<8&&cell(p,free,to.row).type)free++;if(free===8)throw new Error('Ligne pleine');for(let col=free;col>to.col;col--)p.set(p.slice(offset(col-1,to.row),offset(col-1,to.row)+2),offset(col,to.row));}
 p.set(d.records[instance],d.base+instance*d.stride);
 const selector=a.selector&&fieldById.get(a.selector.replace('.inst[0]',`.inst[${instance}]`));if(selector)p[selector.offset]=a.variant;
 prudentSeed(p,algorithm,instance);
 p[dest]=a.blockTypeId;p[dest+1]=instance;p[171+a.blockTypeId]&=~(1<<instance);return finish(buffer,validVariant(buffer,p,`hw-${a.blockTypeId}-${instance}`));
}
export function removeDeviceBlock(buffer,id){const n=buffer.nodes.find(n=>n.id===id);if(!n)throw new Error('Moteur introuvable');const p=buffer.payload.slice(),o=offset(n.col,n.row);p[o]=p[o+1]=0;p[171+n.blockTypeId]&=~(1<<n.instanceIndex);return finish(buffer,p);}
export function changeDeviceAlgorithm(buffer,id,algorithm){const n=buffer.nodes.find(n=>n.id===id),a=deviceMap.algorithms[algorithm];if(!n||!a||n.blockTypeId!==a.blockTypeId)throw new Error('Choisissez un algorithme de la même famille');const p=buffer.payload.slice(),f=a.selector&&fieldById.get(a.selector.replace('.inst[0]',`.inst[${n.instanceIndex}]`));if(f)p[f.offset]=a.variant;if(n.algorithm!==algorithm)prudentSeed(p,algorithm,n.instanceIndex);return finish(buffer,validVariant(buffer,p,id));}
export function muteDeviceBlock(buffer,id){const n=buffer.nodes.find(n=>n.id===id);if(!n)throw new Error('Moteur introuvable');const p=buffer.payload.slice();p[171+n.blockTypeId]^=1<<n.instanceIndex;return finish(buffer,p);}
// One transaction for a whole family; never touch dormant engines or other bits.
export function setDeviceBlocksMuted(buffer,ids,muted){
 if(!Array.isArray(ids)||!ids.length||typeof muted!=='boolean')throw Error('Moteurs et état Mute requis');
 const p=buffer.payload.slice();
 for(const id of new Set(ids)){
  const n=buffer.nodes.find(n=>n.id===id&&n.row<buffer.rows);if(!n)throw Error('Moteur actif introuvable');
  const mask=1<<n.instanceIndex,o=171+n.blockTypeId;p[o]=muted?p[o]|mask:p[o]&~mask;
 }
 // Mute does not alter matrix presence masks or dormant records.
 return p;
}
export function resizeDeviceGrid(buffer,rows){if(!Number.isInteger(rows)||rows<1||rows>8)throw new Error('Grille de 1 à 8 lignes');if(rows<buffer.rows&&buffer.cells.some(c=>c.type&&c.row>=rows))throw new Error('Réduction refusée : déplacez les blocs hors des lignes à retirer ; le FireworX purge ces cases via SysEx');const p=buffer.payload.slice();p[172]=rows;return p;}
// Common-node defaults copied from our own Factory 200 expanded capture:
// rx-0213.syx SHA256 4b0406191ebdf988a0fbc915a71a059e3be5238300bfb7101bd1ca17d597d2d3.
const routingDefaults=[[0,100,0,0,2,98],[0,100,0,0,4,162],[0,100,0,0,2,98],[0,100,0,0,2,98]];
export function addDeviceRouting(buffer,type,to){
 position(to,buffer.rows);if(![1,3,4,5,6].includes(type))throw new Error('Type de routage non établi');
 if(type!==1&&buffer.cells.some(c=>c.type===type))throw new Error('Un seul élément de ce routage par preset');
 const p=buffer.payload.slice(),at=offset(to.col,to.row);if(p[at])throw new Error('Choisissez une case vide pour le routage');p[at]=type;p[at+1]=type===1?255:0;
 if(type>=3)p.set(routingDefaults[type-3],208+(type-3)*6);return finish(buffer,p);
}
export function removeDeviceCell(buffer,pos){position(pos);const n=buffer.nodes.find(n=>n.col===pos.col&&n.row===pos.row);if(n)return removeDeviceBlock(buffer,n.id);const p=buffer.payload.slice(),at=offset(pos.col,pos.row);p[at]=p[at+1]=0;return finish(buffer,p);}
export function connectDeviceBlock(buffer,payload,anchorId,mode){
 const anchor=buffer.nodes.find(n=>n.id===anchorId),moving=buffer.nodes.find(n=>n.id===payload.id);
 if(moving?.id===anchorId)throw new Error('Choisissez un autre bloc comme référence');
 const cells=buffer.cells.filter(c=>!moving||c.col!==moving.col||c.row!==moving.row),plan=connectionPlan(cells,anchor,mode,buffer.rows);
 let p=payload.kind==='library'?addDeviceBlock(buffer,payload.algorithm,plan.to):moveDeviceBlock(buffer,payload.id,plan.to);
 for(const pos of plan.pipelines){const next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));p=addDeviceRouting(next,1,pos);}
 return finish(buffer,p);
}
export function connectDevicePorts(buffer,sourceId,targetId,mode){
 const plan=portConnectionPlan(buffer.cells,buffer.nodes.find(n=>n.id===sourceId),buffer.nodes.find(n=>n.id===targetId),mode,buffer.rows);
 let p=moveDeviceBlock(buffer,targetId,plan.to);
 for(const pos of plan.pipelines){const next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));p=addDeviceRouting(next,1,pos);}
 return finish(buffer,p);
}
// #74 cable drag on the P0 model: one structural operation through the existing planners.
// Engine records, Input/Out L/R, Mute bits and modulation links are never touched.
export function connectDeviceDrag(buffer,grabbed,drop,options={}){
 const plan=dragConnectionPlan(buffer.cells,buffer.nodes,buffer.rows,grabbed,drop,options);
 if(plan.op==='series')return connectDevicePorts(buffer,plan.source,plan.target,'series');
 if(plan.op==='parallel'||plan.op==='return')return connectDeviceBlock(buffer,{kind:'node',id:plan.moving},plan.anchor,plan.mode);
 let p=plan.moving?moveDeviceBlock(buffer,plan.moving,plan.to):buffer.payload.slice();
 for(const pos of plan.pipelines){const next=decodeDeviceBuffer(frameWithPayload(buffer.frame,p));p=addDeviceRouting(next,1,pos);}
 return finish(buffer,p);
}
export function layoutDeviceGrid(buffer,axis,index,action){
 const limit=axis==='col'?8:buffer.rows;if(!['col','row'].includes(axis)||!Number.isInteger(index)||index<0||index>=limit)throw new Error('Ligne ou colonne invalide');
 if(!['before','after','insert','delete'].includes(action))throw new Error('Action Layout inconnue');
 const p=buffer.payload.slice(),before=p.slice(),other=index+(action==='before'?-1:1);
 if(['before','after'].includes(action)&&(other<0||other>=limit))throw new Error('Bord de la grille atteint');
 if(action==='insert')for(const c of buffer.cells)if(c.type&&(axis==='col'?c.col:c.row)===limit-1&&(axis==='row'||c.row<buffer.rows))throw new Error('Bord occupé : insertion refusée');
 // Preserve dormant rows when operating on columns, as on the hardware.
 for(let col=0;col<8;col++)for(let row=0;row<buffer.rows;row++){
  const value=axis==='col'?col:row;let source=value;
  if(action==='before'||action==='after'){if(value===index)source=other;else if(value===other)source=index;}
  if(action==='insert'&&value>=index)source=value===index?-1:value-1;
  if(action==='delete'&&value>=index)source=value===limit-1?-1:value+1;
  const at=offset(col,row);if(source<0)p[at]=p[at+1]=0;else p.set(before.slice(offset(axis==='col'?source:col,axis==='row'?source:row),offset(axis==='col'?source:col,axis==='row'?source:row)+2),at);
 }
 return finish(buffer,p);
}
