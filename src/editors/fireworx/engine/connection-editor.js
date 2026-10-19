// Per-view routing action for existing engines. Choosing a mode/reference is
// inert: only Apply invokes the same model operation as drag-and-drop.
export function mountConnectionEditor(host,{nodes,selected,label,choices,preview,apply,disabled=false}){
 for(const key of choices.keys())if(!nodes.some(n=>n.id===key))choices.delete(key);
 const selectedNode=nodes.find(n=>n.id===selected),others=nodes.filter(n=>n.id!==selected);
 if(!selectedNode)return;
 const preceding=others.filter(n=>n.col<selectedNode.col).sort((a,b)=>b.col-a.col||Math.abs(a.row-selectedNode.row)-Math.abs(b.row-selectedNode.row));
 const choice=choices.get(selected)??{mode:'series',anchor:preceding[0]?.id??others[0]?.id??''};
 if(!others.some(n=>n.id===choice.anchor))choice.anchor=preceding[0]?.id??others[0]?.id??'';
 choices.set(selected,choice);
 host.innerHTML=`<section class="connection-editor" role="group" aria-label="Raccordement du bloc"><div class="connection-heading"><strong title="Déplace ce bloc dans la matrice par rapport au bloc de référence. Les paramètres sont conservés. Aucun changement avant Appliquer.">Raccordement</strong><span data-reconnect-source></span></div><div class="connection-fields"><label>Mode<select data-reconnect-mode aria-label="Mode de raccordement"><option value="series">Série après</option><option value="parallel">Parallèle jusqu’à OUT</option><option value="return">Parallèle puis retour en série</option></select></label><label>Référence<select data-reconnect-anchor aria-label="Bloc de référence"></select></label><button type="button" data-reconnect-apply title="Appliquer ce raccordement en conservant les paramètres du bloc">Appliquer</button></div><p data-reconnect-preview role="status" aria-live="polite"></p></section>`;
 host.querySelector('[data-reconnect-source]').textContent=label(selectedNode);
 const mode=host.querySelector('[data-reconnect-mode]'),anchor=host.querySelector('[data-reconnect-anchor]'),button=host.querySelector('[data-reconnect-apply]'),status=host.querySelector('[data-reconnect-preview]');
 for(const n of others)anchor.add(new Option(`${label(n)} · ${n.col+1}:${n.row+1}`,n.id));
 mode.value=choice.mode;anchor.value=choice.anchor;
 mode.disabled=anchor.disabled=disabled||!others.length;
 function refresh(){
  choice.mode=mode.value;choice.anchor=anchor.value;button.disabled=true;host.querySelector('.connection-editor').dataset.state='idle';
  if(disabled){status.textContent='Raccordement indisponible pendant la lecture ou dans cette capture archivée.';return;}
  if(!others.length){status.textContent='Ajoutez un autre bloc pour choisir une référence.';return;}
  try{const next=preview(choice.anchor,choice.mode);status.textContent=next.changed?`→ Colonne ${next.col+1} · ligne ${next.row+1}`:'Ce raccordement est déjà appliqué.';button.disabled=!next.changed;}
  catch(e){status.textContent=e.message;host.querySelector('.connection-editor').dataset.state='error';}
 }
 mode.onchange=anchor.onchange=refresh;
 button.onclick=()=>{refresh();if(!button.disabled)apply(choice.anchor,choice.mode);};
 refresh();
}
