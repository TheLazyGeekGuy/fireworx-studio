// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {routingForCell} from '../engine/routing-topology.js';
export function create_port_links(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// Clickable and draggable audio-bus ports. Pending cables are UI state only; Apply and
// drop delegate to the real matrix model. No arbitrary edge list or MIDI sender lives here.

 function createPortLinks({stage,grid,getModel,label,preview,apply,previewDrag,applyDrag,onNotice}){
 const svgNS='http://www.w3.org/2000/svg',layer=document.createElement('div'),ghost=document.createElementNS(svgNS,'svg'),dialog=document.createElement('dialog'),chooser=document.createElement('section');
 layer.className='port-layer';ghost.classList.add('port-preview');ghost.setAttribute('aria-hidden','true');
 dialog.className='library-dialog port-link-dialog';dialog.setAttribute('aria-label','Relier les blocs');
 dialog.innerHTML=`<header><h2>Relier les blocs</h2><button type="button" data-link-close aria-label="Fermer le raccordement">Fermer ×</button></header><p data-link-title></p><label>Raccordement<select data-link-mode><option value="series">Série · insérer après la sortie source</option><option value="parallel">Branche parallèle jusqu’à OUT</option><option value="return">Branche parallèle puis retour en série</option></select></label><p data-link-status role="status"></p><div class="port-matrix" aria-label="Aperçu de la matrice"></div><p>Les positions et pipelines de la matrice déterminent les liaisons. Les réglages des blocs sont conservés.</p><div class="device-dialog-actions"><button type="button" data-link-apply>Appliquer la liaison</button><button type="button" data-link-cancel>Annuler</button></div>`;
 chooser.className='port-chooser';chooser.hidden=true;chooser.setAttribute('aria-label','Raccordement du port');
 chooser.innerHTML=`<header><strong data-port-title></strong><button type="button" data-port-cancel aria-label="Annuler le raccordement">×</button></header><div class="port-mode-choices" role="group" aria-label="Mode du raccordement"><button type="button" data-port-mode="series">Série</button><button type="button" data-port-mode="parallel">Parallèle → OUT</button><button type="button" data-port-mode="return">Parallèle + retour</button></div><label><span data-port-other-label></span><select data-port-other><option value="">Choisir un bloc…</option></select></label><p>Choisissez un bloc ici, ou cliquez sur son autre extrémité dans la matrice.</p><button type="button" data-port-preview disabled>Voir l’aperçu</button>`;
 stage.append(ghost,layer);document.body.append(dialog,chooser);grid.classList.add('ports-enabled');
 const $=selector=>dialog.querySelector(selector),mode=$('[data-link-mode]'),button=$('[data-link-apply]'),status=$('[data-link-status]');
 let source=null,target=null,pointer=null,openedVersion=null,disposed=false,chosenSide=null;
 const other=chooser.querySelector('[data-port-other]'),showPreview=chooser.querySelector('[data-port-preview]');
 const find=id=>getModel().nodes.find(n=>n.id===id);
 const port=(id,side)=>[...layer.children].find(el=>el.dataset.portNode===id&&el.dataset.portSide===side);
 const point=(id,side)=>{const el=port(id,side);if(!el)return null;return {x:parseFloat(el.style.left),y:parseFloat(el.style.top)};};
 function draw(){
  const rect=stage.getBoundingClientRect();ghost.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);ghost.replaceChildren();
  const from=source?point(source,'out'):pointer,to=target?point(target,'in'):pointer;
  if(!from||!to)return;
  const path=document.createElementNS(svgNS,'path'),middle=(from.x+to.x)/2;
  path.setAttribute('d',`M${from.x} ${from.y}H${middle}V${to.y}H${to.x}`);path.setAttribute('data-pending-link','');ghost.append(path);
 }
 function clear(){source=target=pointer=openedVersion=chosenSide=null;chooser.hidden=true;ghost.replaceChildren();stage.classList.remove('linking-ports');for(const el of layer.children)el.setAttribute('aria-pressed','false');}
 function cancel(){const id=source??target;dialog.close();clear();if(id)port(id,'out')?.focus();}
 function refreshPreview(){
  button.disabled=true;$('.port-matrix').replaceChildren();
  const a=find(source),b=find(target);if(!a||!b){status.textContent='Un bloc a été retiré ; refaites la liaison.';return;}
  $('[data-link-title]').textContent=`Sortie L/R : ${label(a)} → Entrée L/R : ${label(b)}`;
  try{
   const next=preview(source,target,mode.value),matrix=$('.port-matrix');matrix.style.gridTemplateRows=`repeat(${next.rows},auto)`;
   for(let row=0;row<next.rows;row++)for(let col=0;col<8;col++){
    const cell=document.createElement('span'),node=next.nodes.find(n=>n.col===col&&n.row===row),route=next.cells.find(c=>c.col===col&&c.row===row&&(c.type??1)!==0);
    cell.textContent=node?label(node):route?'─':'·';cell.title=node?`${label(node)} · ${col+1}:${row+1}`:`${col+1}:${row+1}`;
    if(node?.id===source||node?.id===target)cell.className='port-matrix-focus';matrix.append(cell);
   }
   status.textContent=next.changed?'Aperçu uniquement : les blocs seront replacés comme ci-dessous.':'Cette liaison est déjà présente ; aucun envoi nécessaire.';button.disabled=!next.changed;
  }catch(e){status.textContent=e.message;}
 }
 function placeChooser(){
  if(chooser.hidden)return;const selected=port(chosenSide==='out'?source:target,chosenSide);if(!selected)return;
  const box=selected.getBoundingClientRect(),w=chooser.getBoundingClientRect().width,h=chooser.getBoundingClientRect().height;
  chooser.style.left=`${Math.max(8,Math.min(box.left,innerWidth-w-8))}px`;
  chooser.style.top=`${Math.max(8,box.top-h-10>=8?box.top-h-10:Math.min(box.bottom+10,innerHeight-h-8))}px`;
 }
 function refreshChooser(side){
  chosenSide=side;const id=side==='out'?source:target,node=find(id);if(!node)return;
  chooser.querySelector('[data-port-title]').textContent=`${side==='out'?'Sortie':'Entrée'} L/R · ${label(node)}`;
  chooser.querySelector('[data-port-other-label]').textContent=side==='out'?'Bloc à alimenter':'Sortie du bloc source';
  other.replaceChildren(new Option('Choisir un bloc…',''));
  for(const n of getModel().nodes.filter(n=>n.id!==id))other.add(new Option(label(n),n.id));
  showPreview.disabled=true;chooser.hidden=false;
  chooser.querySelectorAll('[data-port-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.portMode===mode.value)));
  placeChooser();
 }
 function choose(id,side){
  const model=getModel();if(model.disabled){onNotice('Connexion en cours ou capture en consultation seule');return;}
  if(!model.nodes.some(n=>n.id===id)){onNotice('Ce bloc n’est plus dans la matrice');return;}
  if(!source&&!target)mode.value='series';
  if(side==='out')source=id;else target=id;
  if(source&&target){
   if(source===target){target=null;refreshChooser('out');onNotice('Choisissez l’entrée d’un autre bloc');render();return;}
   chooser.hidden=true;openedVersion=model.version;dialog.showModal();refreshPreview();
  }else{refreshChooser(side);onNotice('Choisissez Série ou Parallèle, puis le bloc à raccorder. Échap pour annuler.');}
  render();
  if(!dialog.open&&!chooser.hidden)chooser.querySelector(`[data-port-mode="${mode.value}"]`)?.focus({preventScroll:true});
 }
 function render(){
  if(disposed)return;const model=getModel();if(source&&!model.nodes.some(n=>n.id===source)||target&&!model.nodes.some(n=>n.id===target)){dialog.close();clear();}
  const active=[...layer.children].find(el=>el===document.activeElement),focus=active&&{id:active.dataset.portNode,side:active.dataset.portSide,terminal:active.dataset.portTerminal};
  layer.replaceChildren();const rect=stage.getBoundingClientRect();
  for(const node of model.nodes){
   const cell=[...grid.querySelectorAll('[data-node]')].find(el=>el.dataset.node===node.id);if(!cell)continue;const box=cell.getBoundingClientRect();
   for(const side of ['in','out']){
    const el=document.createElement('button');el.type='button';el.className=`audio-port port-${side}`;el.dataset.portNode=node.id;el.dataset.portSide=side;
    const text=`${side==='in'?'Entrée':'Sortie'} L/R · ${label(node)}`;el.setAttribute('aria-label',text);el.title=text;el.setAttribute('aria-pressed',String(side==='out'?source===node.id:target===node.id));el.disabled=!!model.disabled;
    el.style.left=`${(side==='in'?box.left:box.right)-rect.left}px`;el.style.top=`${box.top+box.height/2-rect.top}px`;
    el.onpointerdown=e=>{e.stopPropagation();press(e,{id:node.id,side});};
    el.onclick=e=>{e.stopPropagation();if(swallowClick)return;if(cable?.keyboard){aim({id:node.id,side},e.shiftKey);release();return;}choose(node.id,side);};
    el.onkeydown=e=>{if(e.key===' '&&!cable&&!dialog.open&&!e.repeat){e.preventDefault();swallowClick=true;begin({id:node.id,side},true);}};
    el.onkeyup=e=>{if(e.key===' '&&swallowClick){e.preventDefault();setTimeout(()=>{swallowClick=false;},0);}};
    el.onfocus=()=>{if(cable?.keyboard)aim({id:node.id,side},false);};
    if(cable&&cable.grabbed.id===node.id&&cable.grabbed.side===side)el.classList.add('port-grabbed');
    if(cable?.over&&cable.over.id===node.id&&cable.over.side===side)el.classList.add('port-drop-target');
    layer.append(el);
   }
  }
  if(cable)renderTerminals(rect);
  stage.classList.toggle('linking-ports',!!(source||target));if(cable)drawCable();else draw();placeChooser();
  if(focus&&!dialog.open&&chooser.hidden)(focus.terminal?layer.querySelector(`[data-port-terminal="${focus.terminal}"]`):port(focus.id,focus.side))?.focus({preventScroll:true});
 }
 // #74 cable drag. Pressing a port and moving more than 6 px starts a cable; hovering an
 // endpoint (another block's port, IN or OUT) previews the whole resulting matrix; release
 // applies one operation (Undo restores). Space on a focused port grabs a cable for the
 // keyboard: Tab to an endpoint (preview on focus), Enter or Space drops. Maj = « + retour ».
 let cable=null,swallowClick=false,stopPress=null;
 const panel=document.createElement('section');panel.className='port-drag-preview';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.setAttribute('aria-label','Aperçu du câble');document.body.append(panel);
 const same=(a,b)=>!!a&&!!b&&a.terminal===b.terminal&&a.id===b.id&&a.side===b.side;
 const endpointOf=el=>el?.dataset.portTerminal?{terminal:el.dataset.portTerminal}:el?.dataset.portNode?{id:el.dataset.portNode,side:el.dataset.portSide}:null;
 const endpointElement=e=>e?.terminal?layer.querySelector(`[data-port-terminal="${e.terminal}"]`):e?port(e.id,e.side):null;
 function renderTerminals(rect){
  const first=grid.querySelector('[data-row="0"]')?.getBoundingClientRect()??grid.getBoundingClientRect(),g=grid.getBoundingClientRect();
  for(const t of ['IN','OUT']){
   const el=document.createElement('button');el.type='button';el.className=`audio-terminal terminal-${t.toLowerCase()}`;el.dataset.portTerminal=t;el.textContent=t;
   el.setAttribute('aria-label',t==='IN'?'Entrée générale IN : nouvelle branche depuis l’entrée':'Sortie générale OUT : sortie indépendante');
   el.style.left=`${(t==='IN'?g.left-14:g.right+14)-rect.left}px`;el.style.top=`${first.top+first.height/2-rect.top}px`;
   if(same(cable.over,{terminal:t}))el.classList.add('port-drop-target');
   el.onpointerdown=e=>e.stopPropagation();el.onclick=e=>{e.stopPropagation();if(cable?.keyboard){aim({terminal:t},e.shiftKey);release();}};el.onfocus=()=>{if(cable?.keyboard)aim({terminal:t},false);};
   layer.append(el);
  }
 }
 function drawCable(){
  const rect=stage.getBoundingClientRect();ghost.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);ghost.replaceChildren();if(!cable)return;
  const at=e=>{const el=endpointElement(e);return el&&{x:parseFloat(el.style.left),y:parseFloat(el.style.top)};};
  const from=at(cable.grabbed),to=cable.over?at(cable.over):cable.point;if(!from||!to)return;
  const path=document.createElementNS(svgNS,'path'),middle=(from.x+to.x)/2;path.setAttribute('d',`M${from.x} ${from.y}H${middle}V${to.y}H${to.x}`);path.setAttribute('data-pending-link','drag');
  if(cable.result?.error)path.classList.add('cable-refused');ghost.append(path);
 }
 const intention=plan=>{
  const g=find(cable.grabbed.id),o=cable.over?.id&&find(cable.over.id),n=x=>x?label(x):'?';
  return {series:plan.moving===g?.id?`Série : ${n(g)} après ${n(o)}`:`Série : ${n(o)} après ${n(g)}`,parallel:`Parallèle : ${n(g)} partage l’entrée de ${n(o)}, branche jusqu’à OUT`,return:`Parallèle + retour : ${n(g)} partage l’entrée de ${n(o)}, puis rejoint la suite`,
   input:`Nouvelle branche : IN → ${n(g)} → OUT`,'input-return':`Nouvelle branche : IN → ${n(g)}, puis retour en colonne 2`,output:`Sortie indépendante : ${n(g)} → OUT`}[plan.op];
 };
 function showPanel(x,y){
  panel.replaceChildren();if(!cable?.over){panel.hidden=true;return;}
  const r=cable.result,title=document.createElement('strong'),status=document.createElement('p');panel.dataset.dragState=r.error?'refused':r.changed?'ready':'unchanged';
  title.textContent=r.error?'Placement impossible':intention(r.plan);status.textContent=r.error?`${r.error} — rien ne sera appliqué.`:r.changed?`Aperçu uniquement : relâchez pour appliquer (une opération, Annuler restaure).${cable.over.terminal==='OUT'||r.plan.op==='series'?'':' Maj : '+(cable.alternate?'branche jusqu’à OUT':'+ retour')+'.'}`:'Liaison déjà présente : aucun envoi.';
  if(r.error)status.className='port-drag-error';panel.append(title,status);
  if(!r.error){
   const model=getModel(),before=new Set((model.cells??[]).filter(c=>(c.type??1)!==0).map(c=>`${c.col}:${c.row}`)),matrix=document.createElement('div');matrix.className='port-matrix';matrix.style.gridTemplateRows=`repeat(${r.rows},auto)`;
   for(let row=0;row<r.rows;row++)for(let col=0;col<8;col++){
    const cell=document.createElement('span'),node=r.nodes.find(n=>n.col===col&&n.row===row),route=r.cells.find(c=>c.col===col&&c.row===row&&(c.type??1)!==0&&!r.nodes.some(n=>n.col===col&&n.row===row));
    cell.textContent=node?label(node):route?'─':'·';cell.dataset.previewCell=`${col}:${row}`;
    if(node&&node.id===r.plan.moving)cell.className='port-matrix-focus';else if(route&&!before.has(`${col}:${row}`))cell.className='port-matrix-new';matrix.append(cell);
   }
   panel.append(matrix);
   // Other blocks whose resolved audio sources change (IO-1 junctions): the whole route delta.
   const name=c=>typeof c==='string'?c:(model.nodes.find(n=>n.col===c.col&&n.row===c.row)??r.nodes.find(n=>n.col===c.col&&n.row===c.row))?.id;
   const delta=model.nodes.filter(n=>n.id!==r.plan.moving).map(n=>{const after=r.nodes.find(x=>x.id===n.id);if(!after)return null;
    const a=routingForCell(model.cells??[],model.rows??r.rows,n).inputs.map(name).join(','),b=routingForCell(r.cells,r.rows,after).inputs.map(name).join(',');return a!==b?`${label(n)} : entrée modifiée`:null;}).filter(Boolean);
   if(delta.length){const p=document.createElement('p');p.textContent='Autres changements : '+delta.join(' · ');panel.append(p);}
  }
  panel.hidden=false;const box=panel.getBoundingClientRect(),anchor=cable.keyboard?endpointElement(cable.over)?.getBoundingClientRect():null;
  const px=anchor?anchor.right:x??cable.client?.x??0,py=anchor?anchor.bottom:y??cable.client?.y??0;panel.style.left=`${Math.max(8,Math.min(px+18,innerWidth-box.width-8))}px`;panel.style.top=`${Math.max(8,py+18+box.height>innerHeight-8?py-box.height-18:py+18)}px`;
 }
 function aim(endpoint,alternate,x,y){
  if(!cable)return;const over=endpoint&&!same(endpoint,cable.grabbed)?endpoint:null;
  if(same(over,cable.over)&&alternate===cable.alternate&&cable.result){if(over&&x!==undefined)showPanel(x,y);return;}
  cable.over=over;cable.alternate=alternate;layer.querySelectorAll('.port-drop-target').forEach(el=>el.classList.remove('port-drop-target'));
  if(!over){cable.result=null;showPanel();drawCable();return;}
  endpointElement(over)?.classList.add('port-drop-target');
  try{cable.result={...previewDrag(cable.grabbed,over,{alternate}),error:null};}catch(e){cable.result={error:e.message};}
  showPanel(x,y);drawCable();
 }
 function begin(grabbed,keyboard){
  if(!previewDrag||!applyDrag)return;
  if(source||target){dialog.close();clear();}
  cable={grabbed,keyboard,over:null,alternate:false,result:null,point:null,version:getModel().version};stage.classList.add('dragging-cable');render();
  onNotice(keyboard?'Câble saisi : Tab jusqu’à un port, IN ou OUT (aperçu), puis Entrée. Maj : + retour. Échap annule.':'Glissez le câble jusqu’à un port, IN ou OUT ; relâchez pour appliquer. Maj : + retour. Échap annule.');
 }
 function finishCable(){stopPress?.();cable=null;stage.classList.remove('dragging-cable');panel.hidden=true;panel.replaceChildren();ghost.replaceChildren();}
 function abort(message){finishCable();render();if(message)onNotice(message);}
 function release(){
  const c=cable;if(!c)return;
  if(!c.over)return abort('Câble relâché hors d’une extrémité : aucune modification');
  if(getModel().version!==c.version)return abort('La matrice a changé pendant le geste ; refaites la liaison pour revoir son aperçu. Aucune modification.');
  if(c.result?.error)return abort(`${c.result.error} — rien n’a été appliqué`);
  if(!c.result?.changed)return abort('Liaison déjà présente : aucun envoi');
  const {grabbed,over,alternate}=c;finishCable();applyDrag(grabbed,over,{alternate});render();
 }
 function press(e,grabbed){
  if(e.button!==0||getModel().disabled||cable||!previewDrag)return;
  stopPress?.();const start={x:e.clientX,y:e.clientY},id=e.pointerId;
  const move=ev=>{if(ev.pointerId!==id)return;if(!cable){if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)<6)return;begin(grabbed,false);}if(!cable)return stop();
   ev.preventDefault();const r=stage.getBoundingClientRect();cable.point={x:ev.clientX-r.x,y:ev.clientY-r.y};cable.client={x:ev.clientX,y:ev.clientY};aim(endpointOf(document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-port-node],[data-port-terminal]')),ev.shiftKey,ev.clientX,ev.clientY);if(!cable.over)drawCable();};
  const end=ev=>{if(ev.pointerId!==id)return;stop();if(!cable||cable.keyboard)return;swallowClick=true;setTimeout(()=>{swallowClick=false;},0);aim(endpointOf(document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-port-node],[data-port-terminal]')),ev.shiftKey,ev.clientX,ev.clientY);release();};
  const lost=ev=>{if(ev.pointerId!==id)return;stop();if(cable&&!cable.keyboard)abort('Câble interrompu ; aucune modification');};
  const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',lost);stopPress=null;};stopPress=stop;
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end);window.addEventListener('pointercancel',lost);
 }
 const shift=e=>{if(cable?.over&&e.key==='Shift')aim(cable.over,e.type==='keydown');};
 window.addEventListener('keydown',shift);window.addEventListener('keyup',shift);
 const move=e=>{if(!(source||target)||dialog.open)return;const r=stage.getBoundingClientRect();pointer={x:e.clientX-r.x,y:e.clientY-r.y};draw();};
 const escape=e=>{if(e.key==='Escape'&&cable){e.preventDefault();const g=cable.grabbed;abort('Câble annulé ; aucune modification');port(g.id,g.side)?.focus({preventScroll:true});return;}
  if(e.key==='Escape'&&!dialog.open&&(source||target)){e.preventDefault();const id=source??target,side=source?'out':'in';clear();render();port(id,side)?.focus({preventScroll:true});onNotice('Liaison annulée');}};
 const outside=e=>{if(!chooser.hidden&&!dialog.open&&!chooser.contains(e.target)&&!e.target.closest('.audio-port')){clear();render();}};
 stage.addEventListener('pointermove',move);window.addEventListener('keydown',escape);
 window.addEventListener('scroll',placeChooser,true);window.addEventListener('resize',placeChooser);document.addEventListener('pointerdown',outside);
 const hide=()=>{finishCable();dialog.close();clear();};window.addEventListener('pagehide',hide);
 mode.onchange=refreshPreview;for(const selector of ['[data-link-close]','[data-link-cancel]'])$(selector).onclick=cancel;
 chooser.querySelector('[data-port-cancel]').onclick=()=>{clear();render();};
 chooser.querySelectorAll('[data-port-mode]').forEach(b=>b.onclick=()=>{mode.value=b.dataset.portMode;chooser.querySelectorAll('[data-port-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 other.onchange=()=>{showPreview.disabled=!other.value;};
 showPreview.onclick=()=>{if(other.value)choose(other.value,chosenSide==='out'?'in':'out');};
 dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 button.onclick=()=>{
  if(getModel().version!==openedVersion){openedVersion=getModel().version;refreshPreview();status.textContent='La matrice a changé. Vérifiez le nouvel aperçu avant d’appliquer.';return;}
  refreshPreview();if(button.disabled)return;const a=source,b=target,kind=mode.value;dialog.close();clear();apply(a,b,kind);render();
 };
 return {render,cancel,dispose(){if(disposed)return;disposed=true;hide();stage.removeEventListener('pointermove',move);window.removeEventListener('keydown',escape);window.removeEventListener('keydown',shift);window.removeEventListener('keyup',shift);window.removeEventListener('pagehide',hide);window.removeEventListener('scroll',placeChooser,true);window.removeEventListener('resize',placeChooser);document.removeEventListener('pointerdown',outside);layer.remove();ghost.remove();dialog.remove();chooser.remove();panel.remove();grid.classList.remove('ports-enabled');}};
}

return {createPortLinks};
}
