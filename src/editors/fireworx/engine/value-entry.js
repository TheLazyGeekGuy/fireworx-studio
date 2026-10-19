// A single visible value below a rotary. Entry stays local until commit.
// Only labelled enumerations qualify; small numeric domains remain rotaries.
export function shortChoices(values,range){
 if(!values)return null;
 const entries=Object.entries(values).filter(([key])=>/^-?\d+$/.test(key)&&(!range||Number(key)>=range[0]&&Number(key)<=range[1]));
 return entries.length>0&&entries.length<=5?entries.map(([key,label])=>[key,/^(off|mix|dry|wet)$/i.test(label)?label[0].toUpperCase()+label.slice(1).toLowerCase():label]):null;
}
export function bindChoiceList({editor,get,set,parse=Number,disabled=()=>false,onError=()=>{}}){
 const reset=()=>{editor.value=String(get());delete editor.dataset.pendingChoice;};
 const commit=()=>{
  if(disabled()){reset();return;}
  try{const next=parse(editor.value);if(!Object.is(next,get()))set(next);delete editor.dataset.pendingChoice;}
  catch(e){reset();onError(e.message);}
 };
 editor.title='Clic : appliquer · Flèches : parcourir · Entrée : appliquer · Échap : annuler';
 editor.setAttribute('aria-description',editor.title);
 let keyboardPreview=false;
 editor.onchange=()=>{if(keyboardPreview){editor.dataset.pendingChoice='true';return;}commit();};
 editor.onpointerdown=()=>{keyboardPreview=false;};
 editor.onkeydown=e=>{
  keyboardPreview=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Enter',' ','Escape'].includes(e.key)){
   e.preventDefault();e.stopPropagation();if(disabled())return;
   if(e.key==='Escape'){reset();return;}
   if(e.key==='Enter'||e.key===' '){commit();return;}
   const options=[...editor.options].filter(o=>!o.disabled);if(!options.length)return;
   const index=options.findIndex(o=>o.value===editor.value),delta=['ArrowUp','ArrowLeft','PageUp'].includes(e.key)?-1:1;
   const next=e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+delta));
   editor.value=options[next].value;editor.dataset.pendingChoice='true';
  }
 };
 // Leaving a keyboard preview never commits an intermediate routing value.
 editor.onblur=()=>{if(keyboardPreview||editor.dataset.pendingChoice)reset();keyboardPreview=false;};
}
// Native selects also perform type-ahead while closed. Keep those previews local
// until Enter/Space; pointer selection remains a deliberate immediate action.
export function guardSelectCommits(root){
 const pending=new WeakMap();
 root.addEventListener('keydown',e=>{const el=e.target;if(el?.tagName!=='SELECT'||el.hasAttribute('data-choice-list'))return;
  if(e.key==='Escape'){if(pending.has(el)){el.value=pending.get(el);pending.delete(el);}return;}
  if(e.key==='Enter'||e.key===' '){if(pending.has(el)){e.preventDefault();pending.delete(el);el.dispatchEvent(new Event('change',{bubbles:true}));}return;}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.key.length===1||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))&&!pending.has(el))pending.set(el,el.value);
 },true);
 root.addEventListener('change',e=>{if(pending.has(e.target)){e.stopImmediatePropagation();}},true);
 root.addEventListener('pointerdown',e=>{const el=e.target.closest?.('select');if(el)pending.delete(el);},true);
 root.addEventListener('blur',e=>{if(pending.has(e.target)){e.target.value=pending.get(e.target);pending.delete(e.target);}},true);
}
export function bindValueEntry({value,editor,get,set,parse=Number,disabled=()=>false,onError=()=>{}}){
 if(editor.hasAttribute('data-choice-list'))return bindChoiceList({editor,get,set,parse,disabled,onError});
 let open=false,committing=false;
 const hide=(focus=false)=>{open=false;editor.hidden=true;value.hidden=false;editor.setCustomValidity('');editor.removeAttribute('aria-invalid');value.setAttribute('aria-expanded','false');if(focus&&value.isConnected)value.focus();};
 const commit=(focus=false)=>{
  if(!open||committing)return;
  if(disabled()){hide(focus);return;}
  try{const next=parse(editor.value);committing=true;set(next);hide(focus);}
  catch(e){editor.setCustomValidity(e.message);editor.setAttribute('aria-invalid','true');onError(e.message);}
  finally{committing=false;}
 };
 const begin=()=>{if(open||disabled())return;open=true;editor.value=String(get());editor.hidden=false;value.hidden=true;value.setAttribute('aria-expanded','true');editor.focus();if(editor.tagName==='INPUT')editor.select();};
 value.ondblclick=e=>{e.preventDefault();begin();};
 value.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();begin();}};
 editor.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hide(true);}else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();commit(true);}};
 editor.onblur=()=>commit();
 editor.oninput=()=>{editor.setCustomValidity('');editor.removeAttribute('aria-invalid');};
 if(editor.tagName==='SELECT')editor.onchange=()=>commit(true);
 return {open:begin,cancel:()=>hide()};
}

const divisor={ '01db':10,'01ms':10,'01s':10,tenths:10,hundredths:100,octwidth:100,octbw:10 };
export function fieldEntryValue(field,raw,curves={}){
 if(field.offValue!==null&&field.offValue!==undefined&&raw===field.offValue)return 'Off';
 const c=curves[field.curve];if(c?.steps_per_oct)return String(Number((c.min_hz*2**(raw/c.steps_per_oct)).toPrecision(4)));
 if(divisor[field.enc])return String(raw/divisor[field.enc]);
 if(field.enc==='pct_bipolar')return String(raw*2-100);
 if(field.enc==='tune_hz')return String(raw+256);
 if(field.enc==='pan_i8')return raw===0?'Centre':`${raw<0?'L':'R'}${Math.abs(raw)}`;
 if(field.enc==='pan_uni')return raw===50?'Centre':`${raw<50?'L':'R'}${Math.abs(raw-50)}`;
 return String(raw);
}
export function parseFieldEntry(field,text,curves={}){
 const s=String(text).trim().replace(',','.');let raw;
 if(/^off$/i.test(s)&&field.offValue!==null&&field.offValue!==undefined)raw=field.offValue;
 else if(['pan_i8','pan_uni'].includes(field.enc)&&/^(centre|center|[LR]\s*\d+)$/i.test(s)){
  const v=/^L/i.test(s)?-Number(s.slice(1)): /^R/i.test(s)?Number(s.slice(1)):0;raw=field.enc==='pan_uni'?50+v:v;
 }else{
  const match=/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(Hz|kHz|ms|s|dB|%|cents|oct)?$/i.exec(s);if(!match)throw Error('Valeur numérique ou Off attendu');
  let v=Number(match[1]);const suffix=match[2]?.toLowerCase(),unit=field.unit?.toLowerCase();
  if(suffix){if(suffix==='khz'&&unit==='hz')v*=1000;else if(suffix==='s'&&unit==='ms')v*=1000;else if(suffix==='ms'&&unit==='s')v/=1000;else if(suffix!==unit)throw Error(`Unité attendue : ${field.unit??'valeur brute'}`);}
  const c=curves[field.curve];raw=c?.steps_per_oct?(v>0?c.steps_per_oct*Math.log2(v/c.min_hz):NaN):divisor[field.enc]?v*divisor[field.enc]:field.enc==='pct_bipolar'?(v+100)/2:field.enc==='tune_hz'?v-256:v;
  if(!Number.isFinite(raw))throw Error('Valeur hors domaine');raw=Math.round(raw);
 }
 if(!Number.isInteger(raw)||!field.range||raw<field.range[0]||raw>field.range[1]||field.values&&!Object.hasOwn(field.values,String(raw)))throw Error('Valeur hors du domaine du paramètre');
 return raw;
}
