// Console layout: a draggable divider between the signal chain (left) and the block settings / modulation matrix
// (right), owner request 2026-10-21. The left width is kept per viewer; double-click or Home restores the default.
// Presentation only: no state, history or MIDI. CSSOM setters only (CSP: no inline style attribute).
const MIN_LEFT=310,MIN_RIGHT=360,STEP=24;
export function mountColumnSplit({area,left,right,window,localStorage,ResizeObserver,storageKey='fireworx-chain-width-v1'}){
 const handle=area.ownerDocument.createElement('div');
 handle.className='column-split';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');
 handle.setAttribute('aria-label','Largeur de la chaîne du signal');handle.title='Glisser pour redimensionner · double-clic : largeur par défaut';
 area.append(handle);
 let width=null;try{const saved=Number(localStorage.getItem(storageKey));if(Number.isFinite(saved)&&saved>=MIN_LEFT)width=saved;}catch{/* default width */}
 const active=()=>window.getComputedStyle(area).gridTemplateAreas.includes('chain editor');
 const gap=()=>parseFloat(window.getComputedStyle(area).columnGap)||0;
 const clamp=value=>Math.round(Math.max(MIN_LEFT,Math.min(area.clientWidth-MIN_RIGHT-gap(),value)));
 function place(){
  handle.hidden=!active();if(handle.hidden)return;
  // From below the full-width DSP banner to the bottom of the two columns.
  const box=area.getBoundingClientRect(),edge=left.getBoundingClientRect().right-box.left+gap()/2,banner=area.querySelector('#dsp-budget')?.getBoundingClientRect();
  handle.style.left=`${edge-5}px`;handle.style.top=`${banner&&banner.height?banner.bottom-box.top+4:0}px`;handle.setAttribute('aria-valuenow',String(Math.round(left.getBoundingClientRect().width)));
  handle.setAttribute('aria-valuemin',String(MIN_LEFT));handle.setAttribute('aria-valuemax',String(Math.max(MIN_LEFT,Math.round(area.clientWidth-MIN_RIGHT-gap()))));
 }
 function apply(value,save=true){
  width=value===null?null:clamp(value);
  if(width===null)area.style.removeProperty('--fw-chain-width');else area.style.setProperty('--fw-chain-width',`${width}px`);
  if(save)try{if(width===null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,String(width));}catch{/* per-viewer convenience only */}
  place();
 }
 handle.onpointerdown=e=>{
  if(e.button!==0||!active())return;e.preventDefault();handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
  const start=e.clientX,from=left.getBoundingClientRect().width;
  handle.onpointermove=m=>apply(from+m.clientX-start,false);
  handle.onpointerup=handle.onpointercancel=()=>{handle.onpointermove=handle.onpointerup=handle.onpointercancel=null;handle.classList.remove('dragging');apply(width);};
 };
 handle.ondblclick=()=>apply(null);
 handle.onkeydown=e=>{const now=left.getBoundingClientRect().width;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();apply(now+(e.key==='ArrowLeft'?-STEP:STEP));}
  else if(e.key==='Home'){e.preventDefault();apply(null);}};
 const observer=new ResizeObserver(()=>{if(width!==null&&active()&&clamp(width)!==width)apply(width,false);else place();});
 observer.observe(area);observer.observe(right);observer.observe(left);const banner=area.querySelector('#dsp-budget');if(banner)observer.observe(banner);
 if(width!==null)apply(width,false);else place();
 return {place,dispose(){observer.disconnect();handle.remove();}};
}
