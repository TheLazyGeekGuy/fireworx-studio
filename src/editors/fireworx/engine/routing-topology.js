// Matrix semantics, independent implementation from manual pp.22–26 and the
// attributed sgorpi grid-edit observations. No arbitrary MIDI wire identifiers.
import {isGenerator} from './catalog.js';
const key=c=>`${c.col}:${c.row}`;
export const routingItems=[{type:1,label:'Pipeline · liaison horizontale',max:null},{type:3,label:'Feedback Return',max:1},{type:4,label:'Feedback Send',max:1},{type:5,label:'Insert Return',max:1},{type:6,label:'Insert Send',max:1}];
export function matrixTopology(cells,rows){
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row<rows),at=new Map(occupied.map(c=>[key(c),c])),edges=[],segments=[];
 const last=Math.max(-1,...occupied.map(c=>c.col));
 const partner=(col,row)=>{for(let r=row-1;r>=0;r--)if(at.has(`${col}:${r}`))return at.get(`${col}:${r}`);for(let r=row+1;r<rows;r++)if(at.has(`${col}:${r}`))return at.get(`${col}:${r}`);return null;};
 for(let row=0;row<rows;row++)for(let col=0;col<8;col++){
  if(!at.has(`${col}:${row}`)||at.has(`${col-1}:${row}`))continue;
  const start=at.get(`${col}:${row}`),chain=[start];let end=col;
  while(at.has(`${end+1}:${row}`)){const next=at.get(`${++end}:${row}`);edges.push({from:chain.at(-1),to:next,kind:'series'});chain.push(next);}
  const input=col===0?'IN':partner(col,row),output=end===last?'OUT':partner(end+1,row);
  if(input)edges.push({from:input,to:start,kind:input==='IN'?'input':'split'});
  if(output)edges.push({from:chain.at(-1),to:output,kind:output==='OUT'?'output':'merge'});
  segments.push({start,end:chain.at(-1),input,output});
 }
 // IO-1: a cell has an inlet junction and an outlet. A split edge does not carry audio from its
 // partner's output: it joins the segment start's inlet to the partner's inlet (same column).
 // Resolve those aliases first, then collect the outlets (or IN) that feed each junction.
 const parent=new Map(),root=k=>{while(parent.has(k)&&parent.get(k)!==k)k=parent.get(k);return k;};
 for(const c of occupied)parent.set(key(c),key(c));
 for(const e of edges)if(e.kind==='split'){const a=root(key(e.from)),b=root(key(e.to));if(a!==b)parent.set(b,a);}
 const feeders=new Map(),feed=(c,source)=>{const r=root(key(c));if(!feeders.has(r))feeders.set(r,[]);if(!feeders.get(r).includes(source))feeders.get(r).push(source);};
 for(const e of edges)if(e.kind==='series'||e.kind==='merge'||e.kind==='input')feed(e.to,e.from);
 const sourcesOf=c=>feeders.get(root(key(c)))??[];
 for(const s of segments){s.sources=sourcesOf(s.start);s.fed=s.sources.length>0||generatorCell(s.start);}
 return {edges,segments,sourcesOf,warnings:segments.filter(s=>!s.fed||!s.output).map(s=>`Branche ${s.start.col+1}:${s.start.row+1} ${!s.fed?(s.input?'sans entrée : jonction partagée non alimentée':'sans entrée'):'sans sortie'}`)};
}
// A Synth cell (block type 18) or a catalogued generator produces audio without an input.
const generatorCell=c=>c.type===18||isGenerator(c.algorithm);
// Selection inspector: resolved audio sources (IO-1), and the outlet's destinations. Split edges
// are inlet aliases, never outputs of the partner.
export function routingForCell(cells,rows,selected){
 const graph=matrixTopology(cells,rows),same=c=>typeof c!=='string'&&key(c)===key(selected);
 return {inputs:graph.sourcesOf(selected),outputs:graph.edges.filter(e=>e.kind!=='split'&&same(e.from)).map(e=>e.to)};
}
export function connectionPlan(cells,anchor,mode,rows){
 if(!anchor)throw new Error('Sélectionnez un bloc de référence pour cette liaison');
 if(mode==='series'){if(anchor.col===7)throw new Error('Aucune colonne après ce bloc');return {to:{col:anchor.col+1,row:anchor.row},pipelines:[]};}
 if(!['parallel','return'].includes(mode))throw new Error('Mode de liaison inconnu');
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row<rows),last=Math.max(anchor.col,...occupied.map(c=>c.col));
 if(mode==='return'&&!occupied.some(c=>c.col===anchor.col+1&&c.row===anchor.row))throw new Error('Le retour en série exige un bloc ou pipeline juste après le bloc de référence');
 const end=mode==='return'?anchor.col:last;
 const nearest=(col,row)=>occupied.filter(c=>c.col===col&&c.row<row).sort((a,b)=>b.row-a.row)[0]??occupied.filter(c=>c.col===col&&c.row>row).sort((a,b)=>a.row-b.row)[0];
 const row=Array.from({length:rows},(_,row)=>row).filter(row=>row!==anchor.row).sort((a,b)=>Math.abs(a-anchor.row)-Math.abs(b-anchor.row)||b-a).find(row=>{
  if(occupied.some(c=>c.row===row&&c.col>=anchor.col&&c.col<=end))return false;
  // An occupied preceding cell would feed this inlet in series, bypassing the
  // intended split junction. A return needs an empty gap before its merge too.
  if(anchor.col>0&&occupied.some(c=>c.col===anchor.col-1&&c.row===row))return false;
  if(mode==='return'&&occupied.some(c=>c.col===anchor.col+1&&c.row===row))return false;
  if(anchor.col>0&&nearest(anchor.col,row)?.row!==anchor.row)return false;
  return mode!=='return'||nearest(anchor.col+1,row)?.row===anchor.row;
 });
 if(row===undefined)throw new Error('Libérez une ligne compatible avec les points de séparation et de retour');
 return {to:{col:anchor.col,row},pipelines:Array.from({length:end-anchor.col},(_,i)=>({col:anchor.col+1+i,row}))};
}
// A cable is outlet(source) -> inlet(target). A parallel target belongs beside
// the source's successor, not beside the source itself (which would alias its inlet).
export function portConnectionPlan(cells,source,target,mode,rows){
 if(!source||!target)throw Error('Choisissez deux blocs existants');
 if([source,target].some(n=>!Number.isInteger(n.col)||n.col<0||n.col>7||!Number.isInteger(n.row)||n.row<0||n.row>=rows))throw Error('Choisissez deux blocs dans la matrice visible');
 if(source.id===target.id)throw Error('Une sortie ne peut pas être reliée à sa propre entrée');
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row<rows&&(c.col!==target.col||c.row!==target.row));
 if(mode==='series')return connectionPlan(occupied,source,'series',rows);
 if(!['parallel','return'].includes(mode))throw Error('Mode de liaison inconnu');
 if(source.col===7)throw Error('Aucune colonne après cette sortie ; déplacez le bloc vers la gauche');
 const successor=occupied.find(c=>c.col===source.col+1&&c.row===source.row);
 if(successor)return connectionPlan(occupied,successor,mode,rows);
 // Turning A -> B into A -> (direct || B) requires an explicit direct path.
 // A pipeline is a matrix cell, not a new effect/instance or a wet/dry setting.
 const end=mode==='parallel'?Math.max(source.col+1,...occupied.map(c=>c.col)):source.col+1;
 const direct=Array.from({length:end-source.col},(_,i)=>({col:source.col+1+i,row:source.row,type:1})).filter(p=>!occupied.some(c=>c.col===p.col&&c.row===p.row));
 const anchor=direct[0],plan=connectionPlan([...occupied,...direct],anchor,mode,rows);
 return {...plan,pipelines:[...direct,...plan.pipelines]};
}
// #74 cable drag: one gesture = one matrix intention, shared by pointer, touch and keyboard.
// grabbed / drop: {id, side:'in'|'out'} for a block port, or {terminal:'IN'|'OUT'}.
// alternate (Maj) turns a parallel or IN branch into « + retour » (rejoin instead of OUT).
//  block inlet  -> other block outlet : series, the grabbed block after that block
//  block outlet -> other block inlet  : series, that block after the grabbed one
//  block inlet  -> other block inlet  : parallel with it (shares its input junction)
//  block inlet  -> IN                 : new branch from the main input
//  block outlet -> OUT                : independent output (Pipelines up to the last column)
export function dragConnectionPlan(cells,nodes,rows,grabbed,drop,{alternate=false}={}){
 const node=id=>nodes.find(n=>n.id===id);
 if(!grabbed?.id||!node(grabbed.id))throw Error('Saisissez le port d’un bloc présent dans la matrice');
 if(!drop)throw Error('Relâchez le câble sur un port, sur IN ou sur OUT');
 if(drop.id===grabbed.id)throw Error('Un bloc ne peut pas être relié à lui-même');
 if(drop.id&&!node(drop.id))throw Error('Ce bloc n’est plus dans la matrice');
 const g=node(grabbed.id),visible=[g,...(drop.id?[node(drop.id)]:[])];
 if(visible.some(n=>n.row>=rows))throw Error('Choisissez des blocs dans la matrice visible');
 const side=drop.terminal??drop.side;
 if(grabbed.side==='in'&&side==='out')return {op:'series',mode:'series',moving:g.id,source:drop.id,target:g.id,...portConnectionPlan(cells,node(drop.id),g,'series',rows)};
 if(grabbed.side==='out'&&side==='in')return {op:'series',mode:'series',moving:drop.id,source:g.id,target:drop.id,...portConnectionPlan(cells,g,node(drop.id),'series',rows)};
 if(grabbed.side==='in'&&side==='in'){const mode=alternate?'return':'parallel',others=cells.filter(c=>c.col!==g.col||c.row!==g.row);return {op:mode,mode,moving:g.id,anchor:drop.id,...connectionPlan(others,node(drop.id),mode,rows)};}
 if(grabbed.side==='in'&&side==='IN')return {op:alternate?'input-return':'input',mode:alternate?'return':'parallel',moving:g.id,...inputBranchPlan(cells,g,rows,alternate?'return':'parallel')};
 if(grabbed.side==='out'&&side==='OUT')return {op:'output',mode:'output',moving:null,...outputBranchPlan(cells,g,rows)};
 throw Error(grabbed.side==='out'?'Une sortie se relie à l’entrée d’un bloc ou à OUT':'Une entrée se relie à la sortie d’un bloc, à l’entrée d’un bloc (parallèle) ou à IN');
}
// A block at column 1 is fed by IN directly. Parallel: Pipelines carry it to the last used
// column (independent branch to OUT). Return: it rejoins the nearest block of column 2.
export function inputBranchPlan(cells,moving,rows,mode='parallel'){
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row<rows&&(c.col!==moving.col||c.row!==moving.row)),last=Math.max(0,...occupied.map(c=>c.col));
 const nearest=(col,row)=>occupied.filter(c=>c.col===col&&c.row<row).sort((a,b)=>b.row-a.row)[0]??occupied.filter(c=>c.col===col&&c.row>row).sort((a,b)=>a.row-b.row)[0];
 const order=Array.from({length:rows},(_,r)=>r).sort((a,b)=>(a===moving.row?-1:b===moving.row?1:0)||Math.abs(a-moving.row)-Math.abs(b-moving.row)||b-a);
 const row=order.find(r=>mode==='return'?!occupied.some(c=>c.row===r&&c.col<=1)&&!!nearest(1,r):!occupied.some(c=>c.row===r&&c.col<=last));
 if(row===undefined)throw Error(mode==='return'?'Aucune ligne libre en colonne 1–2 avec un bloc de retour en colonne 2':'Aucune ligne libre pour une nouvelle branche depuis IN : augmentez la grille ou libérez une ligne');
 return {to:{col:0,row},pipelines:mode==='return'?[]:Array.from({length:last},(_,i)=>({col:1+i,row}))};
}
// Independent output: the grabbed outlet reaches OUT through Pipelines on its own row.
export function outputBranchPlan(cells,source,rows){
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row<rows&&(c.col!==source.col||c.row!==source.row)),last=Math.max(source.col,...occupied.map(c=>c.col));
 if(occupied.some(c=>c.row===source.row&&c.col===source.col+1))throw Error('Cette sortie alimente déjà le bloc suivant en série : glissez plutôt son entrée pour le déplacer');
 if(occupied.some(c=>c.row===source.row&&c.col>source.col))throw Error('Ligne occupée après ce bloc : la branche ne peut pas atteindre OUT sans traverser un autre bloc');
 return {to:{col:source.col,row:source.row},pipelines:Array.from({length:last-source.col},(_,i)=>({col:source.col+1+i,row:source.row}))};
}
