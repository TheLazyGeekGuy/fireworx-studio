// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.

export function create_hints(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// One local tooltip for hover, keyboard focus and touch/click. No editor state/MIDI.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const hintButton=(text,label='Informations')=>`<button type="button" class="hint-trigger" data-hint="${esc(text)}" aria-label="${esc(label)}">ⓘ</button>`;
 function createHints(){
 const tip=document.createElement('div');tip.id='module-hint';tip.className='module-hint';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);
 let active=null,dismissed=null;
 const hide=()=>{active?.removeAttribute('aria-describedby');active=null;tip.hidden=true;};
 function show(anchor){
  if(!anchor?.isConnected||dismissed===anchor)return;
  if(active!==anchor)hide();active=anchor;
  const parent=anchor.closest('dialog[open]')??document.body;if(tip.parentElement!==parent)parent.append(tip);
  tip.textContent=anchor.dataset.hint;tip.hidden=false;anchor.setAttribute('aria-describedby',tip.id);
  const b=anchor.getBoundingClientRect(),t=tip.getBoundingClientRect(),gap=6;
  const clip=anchor.closest('.device-settings,.engine-content')?.getBoundingClientRect();
  if(b.bottom<8||b.top>innerHeight-8||clip&&(b.bottom<clip.top||b.top>clip.bottom)){hide();return;}
  tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,b.left))+'px';
  tip.style.top=Math.max(8,b.bottom+gap+t.height<=innerHeight-8?b.bottom+gap:b.top-t.height-gap)+'px';
 }
 document.addEventListener('pointerover',e=>{const a=e.target.closest('[data-hint]');if(dismissed&&!dismissed.contains(e.target)&&!tip.contains(e.target))dismissed=null;if(a)show(a);});
 document.addEventListener('pointerout',e=>{const a=e.target.closest('[data-hint]');if(a&&a!==e.relatedTarget?.closest?.('[data-hint]')){dismissed=null;if(!tip.contains(e.relatedTarget)&&document.activeElement!==a)hide();}if(tip.contains(e.target)&&!tip.contains(e.relatedTarget)&&!active?.contains(e.relatedTarget)&&document.activeElement!==active)hide();});
 document.addEventListener('focusin',e=>{const a=e.target.closest('[data-hint]');if(a!==dismissed)dismissed=null;if(a)show(a);else hide();});
 document.addEventListener('focusout',e=>{if(e.target===dismissed)dismissed=null;if(e.target===active)hide();});
 document.addEventListener('click',e=>{const a=e.target.closest('[data-hint]');if(a){dismissed=null;show(a);}else if(!tip.contains(e.target))hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tip.hidden){e.preventDefault();e.stopImmediatePropagation();dismissed=active;hide();}},true);
 // Focusing a control can scroll it into view after focusin. Keep keyboard help
 // anchored through that scroll; pointer-only help closes when its surface moves.
 document.addEventListener('scroll',e=>{if(!tip.contains(e.target)){if(active&&active===document.activeElement)show(active);else hide();}},true);
 window.addEventListener('resize',()=>{if(active&&active===document.activeElement)show(active);else hide();});
 window.addEventListener('pagehide',hide);
 return {hide};
}

return {hintButton,createHints};
}
