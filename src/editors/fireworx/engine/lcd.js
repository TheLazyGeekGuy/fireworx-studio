// Manual FR p.22 illustration: four columns and three rows visible, grid up to 8×8.
// Projection of local study state, not a captured or decoded device screen.
import {matrixTopology} from './routing-topology.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Recall / Preset arrangement from manual FR p.14. Source is local provenance,
// not an address reported by P0. Unknown bank and slot remain unknown.
export function renderPresetLCD({presetName='',alphaText='',presetSource=null,recall=null}, {ink='#29461a',paper='#b4cb60'}={}){
 const browsing=recall?.active;if(browsing){presetName=recall.name;alphaText=recall.alphaText;presetSource=recall.source;}
 const alpha=/[\uFFFD\u0000-\u001f\u007f]/.test(alphaText)?'':String(alphaText??'').trim();
 const bank={factory:'FACTORY',user:'USER',card:'CARD'}[presetSource?.bank]??'—',slot=bank==='—'?'—':presetSource.slot;
 const selected=browsing?recall.field:'preset',filter=(recall?.filterLabel??'OFF').toUpperCase(),pending=browsing&&recall.pending;
 const confirmation=browsing?'selected':presetSource?.confirmation??'unknown',unconfirmed=['pending','unverified'].includes(confirmation);
 const text=(x,y,value,size=11,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${esc(value)}</text>`;
 const row=(id,y,label)=>`<g data-recall-field="${id}">${selected===id?`<rect x="6" y="${y}" width="134" height="16" fill="${ink}"/>`:''}${text(8,y+12,label,11,selected===id?`fill="${paper}"`:'')}</g>`;
 const title=browsing?'Preset sélectionné : ':'Preset courant : ';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262 124" role="img" aria-label="${title}${esc(presetName||'Brouillon local')}" data-preset-confirmation="${esc(confirmation)}" data-recall-pending="${!!pending}" data-recall-slot="${slot}" data-recall-bank="${esc(recall?.source?.bank??presetSource?.bank??'')}" data-recall-field="${esc(selected)}"><title>${browsing?'VALUE parcourt ; PARAMETER choisit Preset / Bank / Filter ; ENTER charge ; EXIT annule. Filtre sur les copies lues.':presetSource?'Banque et numéro de la copie source ; P0 ne rapporte pas son adresse d’origine.':'Banque et numéro inconnus : non fournis par P0.'}${unconfirmed?' Chargement de cette source non confirmé par relecture ; consultez le statut MIDI.':''}${recall?.catalogueName?' Nom issu du catalogue Factory ; données du preset non relues.':''}</title><rect width="262" height="124" fill="${paper}"/><g fill="${ink}" font-family="monospace" font-weight="bold">${text(5,16,'RECALL',13)}<rect x="173" y="5" width="50" height="14" fill="${ink}"/>${text(175,16,'PRESET',11,`fill="${paper}"`)}${text(227,16,'LIST',11)}<path d="M5 22h252M5 100h252" stroke="${ink}" stroke-dasharray="1 2" stroke-width="1.5"/><rect x="6" y="26" width="134" height="48" fill="none" stroke="${ink}" stroke-width="1.5"/>${row('preset',26,'PRESET:')}${row('bank',42,'BANK:   '+bank)}${row('filter',58,'FILTER: '+filter.slice(0,10))}<path d="M6 42h134M6 58h134" stroke="${ink}"/><rect x="146" y="26" width="110" height="48" fill="none" stroke="${ink}" stroke-width="1.5"/>${text(250,68,slot,40,'text-anchor="end"')}<text x="5" y="94" font-size="14" font-weight="normal" textLength="${Math.min(250,(presetName||'Brouillon local').length*8.4)}" lengthAdjust="spacingAndGlyphs">${esc((presetName||'Brouillon local').slice(0,20))}</text><rect x="5" y="105" width="59" height="14" fill="${ink}"/>${text(7,116,'α·MOD:',10,`fill="${paper}"`)}<text x="67" y="116" font-size="10" textLength="${Math.min(188,(alpha||'—').length*6)}" lengthAdjust="spacingAndGlyphs">${esc(alpha||'—')}</text>${pending||unconfirmed?text(255,119,unconfirmed?'!':'*',10,'text-anchor="end"'):''}</g></svg>`;
}
export function renderAlphaLCD({alphaText='',links=[],cursor=0,value=null}, {ink='#29461a',paper='#b4cb60'}={}){
 const first=Math.max(0,Math.min(Math.max(0,links.length-6),cursor-5)),safe=s=>String(s??'').replace(/[\uFFFD\u0000-\u001f\u007f]/g,'').trim();
 const rows=links.slice(first,first+6).map((r,i)=>`<text x="12" y="${38+i*14}" font-size="8">${cursor===first+i?'▶':' '}${esc(r.label.slice(0,28))}</text>`).join('');
 const known=Number.isInteger(value),angle=known?(-135+270*value/127)*Math.PI/180:null;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262 124" role="img" aria-label="Alpha Mod : ${links.length} liens"><title>Position : dernier CC brut connu, sans lecture de la position physique ni simulation Bounce.</title><rect width="262" height="124" fill="${paper}"/><g fill="${ink}" font-family="monospace"><text x="5" y="16" font-size="11" font-weight="bold">α·MOD: ${esc((safe(alphaText)||'—').slice(0,23))}</text><path d="M5 23h252M197 29v84" stroke="${ink}" stroke-dasharray="1 2"/>${rows||'<text x="10" y="48" font-size="9">AUCUN LIEN ALPHA</text>'}<circle cx="228" cy="60" r="23" fill="none" stroke="${ink}" stroke-width="2"/>${known?`<path d="M228 60L${228+19*Math.sin(angle)} ${60-19*Math.cos(angle)}" stroke="${ink}" stroke-width="3"/>`:''}<text x="228" y="104" text-anchor="middle" font-size="13">${known?value:'—'}</text><text x="228" y="117" text-anchor="middle" font-size="6">CC BRUT</text></g></svg>`;
}
export function lcdWindow({nodes,selected,rows},origin){
 const n=nodes.find(n=>n.id===selected),maxRow=Math.max(0,rows-3);
 const col=Math.min(4,Math.max(0,origin?.col??(n?Math.floor(n.col/4)*4:0)));
 const row=Math.min(maxRow,Math.max(0,origin?.row??(n?Math.floor(n.row/3)*3:0)));
 return {col,row,columns:4,rows:Math.min(3,rows),nodes:nodes.filter(n=>n.col>=col&&n.col<col+4&&n.row>=row&&n.row<row+3)};
}
const instanceNumber=(state,node,familyFor)=>Number.isInteger(node.instanceIndex)?node.instanceIndex+1:state.nodes.filter(p=>familyFor(p.algorithm).id===familyFor(node.algorithm).id).sort((a,b)=>a.id.localeCompare(b.id)).indexOf(node)+1;
export function routingSummary(state,familyFor,origin){
 return lcdWindow(state,origin).nodes.map(node=>`${familyFor(node.algorithm).name} ${instanceNumber(state,node,familyFor)} : ${node.muted?'désactivé (Mute)':'actif'}`).join(' ; ');
}
export function renderLCD(state,familyFor,algorithmFor,origin,{ink='#29461a',paper='#b4cb60',clipId='fw-lcd-routing'}={}){
 const view=lcdWindow(state,origin),n=state.nodes.find(n=>n.id===state.selected);
 const text=(x,y,s,size=7,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${s}</text>`;
 const rows=Array.from({length:view.rows},(_,r)=>{
  const y=26+r*26;
  const blocks=Array.from({length:4},(_,c)=>{
   const node=view.nodes.find(n=>n.col===view.col+c&&n.row===view.row+r),x=24+c*55;
   if(!node){const route=(state.cells??state.routes??[]).find(n=>n.col===view.col+c&&n.row===view.row+r&&n.type);if(route){if(route.type===1)return `<path d="M${x} ${y+9.5}h45" stroke="${ink}"/>`;const label={3:'FB R',4:'FB S',5:'INS R',6:'INS S'}[route.type]??'?';return `<rect x="${x}" y="${y}" width="45" height="19" fill="${paper}" stroke="${ink}"/>${text(x+22,y+13,label,8,'text-anchor="middle"')}`;}return `<path d="M${x+6} ${y}h-6v5m0 9v5h6m33 0h6v-5m0-9v-5h-6" fill="none" stroke="${ink}" stroke-width="1.4"/>`;}
   const label=familyFor(node.algorithm).id==='delay'?'DLY':familyFor(node.algorithm).name.slice(0,3).toUpperCase();
   const active=node.id===state.selected,instance=instanceNumber(state,node,familyFor);
   // Mute and selection are independent. No dotted wire: the manual reserves
   // those for Wet outputs (FR p.29). The strike is an editor visual convention.
   return `<g data-lcd-node="${node.id}" data-lcd-muted="${!!node.muted}" aria-label="${esc(familyFor(node.algorithm).name)} ${instance} : ${node.muted?'désactivé (Mute)':'actif'}"><title>${esc(familyFor(node.algorithm).name)} ${instance} · ${node.muted?'Mute · comportement défini par le mode Mute du bloc':'actif'}</title><rect x="${x}" y="${y}" width="45" height="19" fill="${active?ink:paper}" stroke="${ink}" stroke-width="1.5"/>${text(x+22.5,y+13,label+instance,11,`fill="${active?paper:ink}" text-anchor="middle" font-family="monospace" font-weight="bold"`)}${node.muted?`<path data-lcd-mute-mark d="M${x+4} ${y+9.5}h37" stroke="${active?paper:ink}" stroke-width="1.6"/>`:''}</g>`;
  }).join('');
  return blocks;
 }).join('');
 const point=c=>({x:24+(c.col-view.col)*55,y:35.5+(c.row-view.row)*26});
 const links=matrixTopology(state.cells??[...state.nodes,...(state.routes??[])],state.rows).edges.map(e=>{const a=typeof e.from==='string'?null:point(e.from),b=typeof e.to==='string'?null:point(e.to),x1=a?(e.kind==='split'?a.x-5:a.x+45):15,x2=b?b.x-5:247;return `<path d="M${x1} ${a?.y??b.y}H${x2}V${b?.y??a.y}" fill="none" stroke="${ink}" stroke-width="1.3"/>`;}).join('');
 const summary=routingSummary(state,familyFor,origin);
 const label=n?`${n.muted?'MUTE · ':''}${familyFor(n.algorithm).name.toUpperCase()} · ${algorithmFor(n.algorithm).name}`:'EMPTY GRID';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262 124" role="img" aria-label="Fenêtre LCD : colonnes ${view.col+1} à ${view.col+4}, lignes ${view.row+1} à ${view.row+view.rows}. ${esc(summary)}"><defs><clipPath id="${clipId}"><rect x="15" y="24" width="232" height="79"/></clipPath></defs><rect width="262" height="124" fill="${paper}"/><g fill="${ink}" font-family="monospace">${text(5,12,'EFFECTS TOOL EDIT ROUTING LAYOUT',8)}<rect x="90" y="3" width="39" height="12" fill="none" stroke="${ink}"/><path d="M5 19h252" stroke="${ink}" stroke-dasharray="1 2"/><path d="M5 26h10v71H5zM247 26h10v71h-10z" fill="none" stroke="${ink}"/>${text(10,38,'I',8,'text-anchor="middle"')}${text(252,38,'O',8,'text-anchor="middle"')}<g clip-path="url(#${clipId})">${links}</g>${rows}<rect x="4" y="105" width="254" height="15" fill="${ink}"/>${text(7,116,label.slice(0,30),7,`fill="${paper}"`)}${text(254,116,n?`${n.col+1}:${n.row+1}`:'—',8,`fill="${paper}" text-anchor="end"`)}</g></svg>`;
}
