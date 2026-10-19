// Display conversion only. CC wire values remain 0..127; no DSP/Bounce simulation.
export function alphaDisplay(raw=null,mode=1,origin=null){
 const known=Number.isInteger(raw)&&raw>=0&&raw<=127,bipolar=mode===1;
 const value=known?raw:0;
 // Keep MIDI's centre detent (64) at zero in the bipolar presentation.
 const signed=bipolar?(value<=64?(value-64)*100/64:(value-64)*100/63):value*100/127;
 const position=(signed+100)/200,index=Math.round(position*16),display=Math.round(signed);
 return {raw:known?raw:null,known,mode:bipolar?1:0,signed:display,position,index,
  text:`${display>0?'+':''}${display}`,
  description:known?`${display>0?'+':''}${display} · ${raw} / 127 · ${origin??'CC'} · position physique non relue`:`${display} · valeur initiale locale · position non reçue`,
 };
}
export const alphaStripSVG=()=>`<g data-alpha-strip role="img" aria-label="Alpha Mod"><rect x="1622" y="26" width="166" height="28" fill="#111b13" stroke="#697665"/>${Array.from({length:17},(_,i)=>`<rect data-alpha-led="${i}" x="${1628+i*9}" y="30" width="6" height="5" fill="#53683b"/>`).join('')}<text data-alpha-scale="min" x="1626" y="48" font-size="6" text-anchor="start">−100</text><text data-alpha-scale="zero" x="1703" y="48" font-size="6" text-anchor="middle">0</text><text data-alpha-scale="max" x="1783" y="48" font-size="6" text-anchor="end">+100</text></g>`;
export const alphaStripHTML=()=>`<div class="modern-alpha-scale" data-alpha-strip role="img" aria-label="Alpha Mod"><div class="alpha-leds" aria-hidden="true">${Array.from({length:17},(_,i)=>`<i data-alpha-led="${i}"></i>`).join('')}</div><div class="alpha-legends"><span>−100</span><span>0</span><span>+100</span></div></div>`;
export function paintAlphaStrip(root,state){
 for(const strip of root.querySelectorAll('[data-alpha-strip]')){
  strip.dataset.alphaRaw=state.raw??'';strip.dataset.alphaValue=String(state.signed);strip.dataset.alphaKnown=String(state.known);strip.dataset.alphaMode=String(state.mode);
  strip.setAttribute('aria-label',`α MOD : ${state.description}`);strip.setAttribute('title',`α MOD : ${state.description}`);
  for(const led of strip.querySelectorAll('[data-alpha-led]')){
   const on=Number(led.dataset.alphaLed)===state.index;led.dataset.ledOn=String(on);
   if(led.namespaceURI==='http://www.w3.org/2000/svg')led.setAttribute('fill',on?'#d7ed8b':'#53683b');
  }
 }
}
