// Modulation matrix (owner request 2026-10-21, inspired by the layout of the CtrlrX FireworX panel's MODIFIERS > MATRIX
// page; independent implementation). Rows: the 21 modulation sources (Alpha Mod, Ext 1–8, detectors, ADSR, LFO,
// Freeform, Function). Columns: the assignable parameters of the effects, grouped by block. A dot is a link; clicking a
// dot selects it, clicking an empty cell gives that destination this source (one source per destination). A detail
// panel, a "new link" form and a summary table of every link complete it. No browser globals: the caller's document.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memory=new WeakMap();
const VIEW_KEY='fireworx-modmatrix-view-v1',LOCKED_KEY='fireworx-modmatrix-locked-v1';

/** Pure layout: visible columns, cells, trails (the line from the source label to its last dot). */
export function matrixLayout({sources,columns,links,view='all',group='',showLocked=true}){
 const linked=new Map(links.filter(l=>l.column).map(l=>[l.column,l]));
 // Locked columns (not modulatable on the unit) are shown greyed with their reason, never in the « modulated » view.
 const shown=columns.filter(c=>(c.locked?showLocked&&view==='all':view==='all'||linked.has(c.key))&&(!group||c.group===group));
 const index=new Map(shown.map((c,i)=>[c.key,i]));
 const rows=sources.map(s=>{
  const dots=links.filter(l=>l.source===s.key&&l.column&&index.has(l.column)).map(l=>index.get(l.column));
  const last=dots.length?Math.max(...dots):-1;
  return {...s,count:links.filter(l=>l.source===s.key).length,cells:shown.map((c,i)=>{const link=linked.get(c.key);return {column:c,link:link?.source===s.key?link:null,taken:!!link&&link.source!==s.key,trail:i<last};})};
 });
 const groups=[];for(const c of shown){const g=groups.at(-1);if(g?.name===c.group)g.span++;else groups.push({name:c.group,span:1});}
 return {rows,columns:shown,groups,allGroups:[...new Set(columns.map(c=>c.group))],hidden:links.filter(l=>!l.column||!index.has(l.column)).length};
}

/**
 * host: element to fill. options: {sources:[{key,label}], columns:[{key,group,label,locked?,reason?}], links:[{id,source,column|null,
 * sourceLabel,columnLabel,transform?:{low,mid,high,slope,glide}}], max, readonly, onCreate(sourceKey,columnKey),
 * onAssign(linkId,sourceKey), onDelete(linkId), onTransform?(linkId,field,value), memoryKey?, localStorage?}
 */
export function renderModulationMatrix(host,options){
 const {sources,columns,links,max=20,readonly=false,onCreate,onAssign,onDelete,onTransform}=options;
 // The caller re-renders its whole panel after each edit: selection and filters live on a stable key (its container).
 const key=options.memoryKey??host,store=options.localStorage??host.ownerDocument?.defaultView?.localStorage;
 const state=memory.get(key)??{selected:null,view:null,group:'',column:null,showLocked:null,focus:''};memory.set(key,state);
 if(state.view===null){let saved=null,locked=null;try{saved=store?.getItem(VIEW_KEY);locked=store?.getItem(LOCKED_KEY);}catch{}state.view=saved==='used'?'used':'all';state.showLocked=locked!=='false';}
 if(state.selected!==null&&!links.some(l=>l.id===state.selected))state.selected=null;
 if(state.group&&!columns.some(c=>c.group===state.group))state.group='';
 const layout=matrixLayout({sources,columns,links,view:state.view,group:state.group,showLocked:state.showLocked}),open=columns.filter(c=>!c.locked),lockedCount=columns.length-open.length;
 const selected=links.find(l=>l.id===state.selected)??null,selectedColumn=selected?.column??state.column;
 // Manual p.32: an active transformation shows as a small square on the connection (identity = 0 / 50 / 100, slope 0, glide 10).
 const transformed=l=>!!l.transform&&(l.transform.low!==0||l.transform.mid!==50||l.transform.high!==100||l.transform.slope!==0||l.transform.glide!==10);
 const fields=[['low','Low',0,100,'%'],['mid','Mid',0,100,'%'],['high','High',0,100,'%'],['slope','Slope',-90,90,''],['glide','Glide',0,30,'']];
 const detail=selected?`<dl><dt>Source</dt><dd>${esc(selected.sourceLabel)}</dd><dt>Destination</dt><dd>${esc(selected.columnLabel)}</dd><dt>Lien</dt><dd>n° ${Number(selected.id)+1}</dd></dl>
  ${selected.transform&&onTransform?`<div class="mm-transform">${fields.map(([f,label,min,maxv,unit])=>`<label>${label}<input type="range" min="${min}" max="${maxv}" step="1" value="${selected.transform[f]}" data-mm-transform="${f}" ${readonly?'disabled':''}><output>${selected.transform[f]}${unit}</output></label>`).join('')}</div>`:''}
  <button type="button" data-mm-delete ${readonly?'disabled':''}>Supprimer le lien</button>`
  :'<p>Cliquez une pastille pour voir son lien, ou une case vide pour affecter cette source à ce paramètre.</p>';
 // Source focus (owner request 2026-10-21): the chosen source's row is highlighted; the links table follows it.
 if(state.focus&&!sources.some(s=>s.key===state.focus))state.focus='';
 const linkCount=k=>links.filter(l=>l.source===k).length;
 const focusOptions=`<option value="">Toutes</option>${sources.map(s=>`<option value="${esc(s.key)}" ${s.key===state.focus?'selected':''}>${esc(s.label)}${linkCount(s.key)?` (${linkCount(s.key)})`:''}</option>`).join('')}`;
 const groupOptions=['',...layout.allGroups].map(g=>`<option value="${esc(g)}" ${g===state.group?'selected':''}>${g?esc(g):'Tous les effets'}</option>`).join('');
 const blockNames=[...new Set(open.map(c=>c.group))];
 host.innerHTML=`<section class="mod-matrix" aria-label="Matrice de modulation">
 <header><strong>MODIFICATEURS › MATRICE</strong><span>${links.length} / ${max} liens utilisés</span>
  <span class="mm-view" role="group" aria-label="Colonnes"><button type="button" data-mm-view="all" aria-pressed="${state.view==='all'}">Tous les paramètres</button><button type="button" data-mm-view="used" aria-pressed="${state.view==='used'}">Paramètres modulés</button></span>
  <label>Source<select data-mm-focus>${focusOptions}</select></label><label>Effet<select data-mm-group>${groupOptions}</select></label>${lockedCount?`<label class="mm-locked-toggle" title="Paramètres que le FireworX ne module pas (manuel, ou identifiant refusé par l’appareil)"><input type="checkbox" data-mm-locked ${state.showLocked?'checked':''}> Non modulables (${lockedCount}, grisés)</label>`:''}</header>
 <div class="mm-body"><div class="mm-scroll">${layout.columns.length?`<table class="mm-grid"><thead><tr><th rowspan="2" class="mm-corner">Source \\ Destination</th>${layout.groups.map(g=>`<th colspan="${g.span}" class="mm-group">${esc(g.name)}</th>`).join('')}</tr>
  <tr>${layout.columns.map(c=>`<th class="mm-param${c.key===selectedColumn?' mm-current':''}${c.locked?' mm-locked':''}" title="${esc(c.group)} · ${esc(c.label)}${c.locked?` — ${esc(c.reason??'non modulable')}`:''}"><span>${esc(c.label)}</span></th>`).join('')}</tr></thead>
  <tbody>${layout.rows.map(r=>`<tr class="${r.count?'mm-active':''}${r.key===state.focus?' mm-focus':''}" data-mm-row="${esc(r.key)}"><th scope="row">${options.onOpenSource?`<button type="button" class="mm-source" data-mm-open-source="${esc(r.key)}" title="Réglages de ${esc(r.label)} (page Modifiers)">${esc(r.label)}</button>`:esc(r.label)}${r.count?` <small>${r.count}</small>`:''}</th>${r.cells.map(cell=>{const k=cell.column.key,current=k===selectedColumn?' mm-current':'';
   if(cell.column.locked)return `<td class="mm-cell mm-locked${cell.trail?' mm-trail':''}" title="${esc(cell.column.label)} : ${esc(cell.column.reason??'non modulable')}"></td>`;
   if(cell.link)return `<td class="mm-cell mm-linked${cell.trail?' mm-trail':''}${current}"><button type="button" class="mm-dot${cell.link.id===state.selected?' mm-selected':''}${transformed(cell.link)?' mm-transformed':''}" title="${transformed(cell.link)?'Transformation active (Low / Mid / High / Slope / Glide modifiés)':'Lien direct'}" data-mm-link="${esc(cell.link.id)}" aria-pressed="${cell.link.id===state.selected}" aria-label="${esc(r.label)} → ${esc(cell.column.group)} · ${esc(cell.column.label)} : relié (lien ${Number(cell.link.id)+1})"></button></td>`;
   return `<td class="mm-cell${cell.trail?' mm-trail':''}${current}"><button type="button" class="mm-empty" data-mm-source="${esc(r.key)}" data-mm-column="${esc(k)}" ${readonly||(!cell.taken&&links.length>=max)?'disabled':''} aria-label="${esc(r.label)} → ${esc(cell.column.group)} · ${esc(cell.column.label)} : ${cell.taken?'remplacer la source actuelle':'affecter'}"></button></td>`;}).join('')}</tr>`).join('')}</tbody></table>`
   :`<p class="mm-none">${columns.length?'Aucun paramètre modulé : choisissez « Tous les paramètres » ou créez un lien.':'Aucun effet assignable dans la chaîne : ajoutez des blocs.'}</p>`}</div>
  <aside class="mm-side"><section class="mm-detail"><h4>DÉTAIL DU LIEN</h4>${detail}</section>
   <section class="mm-new"><h4>NOUVEAU LIEN</h4><label>Source<select data-mm-new-source>${sources.map(s=>`<option value="${esc(s.key)}">${esc(s.label)}</option>`).join('')}</select></label>
    <label>Effet<select data-mm-new-block>${blockNames.map(b=>`<option ${b===(state.group||blockNames[0])?'selected':''}>${esc(b)}</option>`).join('')}</select></label>
    <label>Paramètre<select data-mm-new-param></select></label><button type="button" data-mm-create ${readonly||links.length>=max||!columns.length?'disabled':''}>Créer le lien</button>
    <p>Le lien prend le premier des ${max} emplacements libres ; une destination n’a qu’une source. Low / Mid / High : valeur du paramètre quand la source est au minimum, au milieu, au maximum (manuel p.32).</p></section></aside></div>
 <footer><span>${links.length} / ${max} liens utilisés${layout.hidden?` · ${layout.hidden} hors de l’affichage (filtre ou destination non décodée, voir le tableau)`:''}</span><span>Cliquez une pastille pour sélectionner son lien, une case vide pour affecter la source de la ligne.</span></footer>
 <details class="mm-summary" open><summary>Tableau des liens (${links.length})</summary>${links.length?`<table><thead><tr><th>N°</th><th>Source</th><th>Destination</th>${links.some(l=>l.transform)?'<th>Low</th><th>Mid</th><th>High</th><th>Slope</th><th>Glide</th>':''}<th></th></tr></thead><tbody>
  ${[...links].sort((a,b)=>Number(a.id)-Number(b.id)).map(l=>`<tr class="${l.id===state.selected?'mm-selected-row':''}${state.focus&&l.source===state.focus?' mm-focus':''}"><td>${Number(l.id)+1}</td><td>${esc(l.sourceLabel)}</td><td><button type="button" class="mm-row-select" data-mm-link="${esc(l.id)}">${esc(l.columnLabel)}</button></td>${l.transform?fields.map(([f,,,,unit])=>`<td>${l.transform[f]}${unit}</td>`).join(''):links.some(x=>x.transform)?'<td colspan="5"></td>':''}<td><button type="button" data-mm-delete-row="${esc(l.id)}" ${readonly?'disabled':''} aria-label="Supprimer le lien ${Number(l.id)+1}">✕</button></td></tr>`).join('')}</tbody></table>`:'<p>Aucun lien de modulation.</p>'}</details>
</section>`;
 const q=s=>host.querySelector(s),idOf=v=>links.find(l=>String(l.id)===v)?.id;
 const fillParams=()=>{const block=q('[data-mm-new-block]')?.value;const select=q('[data-mm-new-param]');if(select)select.innerHTML=open.filter(c=>c.group===block).map(c=>`<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('');};
 fillParams();
 const rerender=()=>renderModulationMatrix(host,options);
 host.querySelectorAll('[data-mm-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.mmView;try{store?.setItem(VIEW_KEY,state.view);}catch{}rerender();});
 q('[data-mm-group]').onchange=e=>{state.group=e.target.value;rerender();};
 q('[data-mm-focus]').onchange=e=>{state.focus=e.target.value;rerender();host.querySelector('tr.mm-focus')?.scrollIntoView?.({block:'nearest'});};
 host.querySelectorAll('[data-mm-open-source]').forEach(b=>b.onclick=()=>options.onOpenSource(b.dataset.mmOpenSource));
 q('[data-mm-locked]')?.addEventListener('change',e=>{state.showLocked=e.target.checked;try{store?.setItem(LOCKED_KEY,String(state.showLocked));}catch{}rerender();});
 host.querySelectorAll('[data-mm-link]').forEach(b=>b.onclick=()=>{const id=idOf(b.dataset.mmLink);state.selected=state.selected===id?null:id;state.column=null;rerender();});
 host.querySelectorAll('[data-mm-source]').forEach(b=>b.onclick=()=>{if(readonly)return;const column=b.dataset.mmColumn,source=b.dataset.mmSource,owner=links.find(l=>l.column===column);
  state.column=column;if(owner){state.selected=owner.id;onAssign(owner.id,source);}else onCreate(source,column);});
 q('[data-mm-new-block]').onchange=fillParams;
 q('[data-mm-create]').onclick=()=>{const source=q('[data-mm-new-source]').value,column=q('[data-mm-new-param]').value;if(column)onCreate(source,column);};
 q('[data-mm-delete]')?.addEventListener('click',()=>{if(selected){const id=selected.id;state.selected=null;onDelete(id);}});
 host.querySelectorAll('[data-mm-delete-row]').forEach(b=>b.onclick=()=>{const id=idOf(b.dataset.mmDeleteRow);if(id===state.selected)state.selected=null;onDelete(id);});
 host.querySelectorAll('[data-mm-transform]').forEach(input=>{const out=input.nextElementSibling,field=input.dataset.mmTransform,unit=fields.find(f=>f[0]===field)[4];
  input.oninput=()=>{out.textContent=`${input.value}${unit}`;};input.onchange=()=>{if(selected)onTransform(selected.id,field,Number(input.value));};});
 return {select(id){state.selected=id;rerender();}};
}

/** Points the matrix at a link, a destination or a source (panel keys, alpha page, CTRL page): DOM only, no edit.
 * Filter changes re-render the matrix, so every step queries the current one. */
export function focusMatrix(root,{link=null,column=null,source=null}={}){
 const q=sel=>root?.querySelector?.(`.mod-matrix ${sel}`),all=sel=>[...(root?.querySelectorAll?.(`.mod-matrix ${sel}`)??[])];
 if(!root?.querySelector?.('.mod-matrix'))return false;
 if(source!==null){const focus=q('[data-mm-focus]');if(focus&&focus.value!==source){focus.value=source;focus.dispatchEvent(new Event('change'));}}
 if(link!==null){const dot=q(`.mm-grid [data-mm-link="${link}"]`)??q(`[data-mm-link="${link}"]`);if(dot&&dot.getAttribute('aria-pressed')!=='true')dot.click();q(`.mm-grid [data-mm-link="${link}"]`)?.scrollIntoView?.({block:'nearest',inline:'nearest'});}
 if(column!==null){
  if(!all('[data-mm-new-param] option').some(o=>o.value===column)){const blocks=q('[data-mm-new-block]');for(const o of [...(blocks?.options??[])]){blocks.value=o.value;blocks.dispatchEvent(new Event('change'));if(all('[data-mm-new-param] option').some(p=>p.value===column))break;}}
  const param=q('[data-mm-new-param]');if(param)param.value=column;}
 if(source!==null){const select=q('[data-mm-new-source]');if(select){select.value=source;select.focus();}}
 else if(column!==null)q('[data-mm-new-source]')?.focus();
 return true;
}
