// One transient input on the facade. It never owns a MIDI sender or commits on blur.
export function createPanelEntry(container){
 let form=null;
 const close=()=>{form?.remove();form=null;};
 return {close,open({anchor,label,value,type='text',min,max,maxLength,commit}){
  close();const doc=container.ownerDocument;form=doc.createElement('form');form.className='panel-inline-entry';form.setAttribute('aria-label',label);
  const input=doc.createElement('input'),error=doc.createElement('span');input.type=type;input.value=String(value??'');input.setAttribute('aria-label',label);input.title='Entrée : valider · Échap : annuler';if(min!==undefined)input.min=String(min);if(max!==undefined)input.max=String(max);if(maxLength)input.maxLength=maxLength;
  error.setAttribute('role','alert');form.append(input,error);container.append(form);
  const box=container.getBoundingClientRect(),target=anchor.getBoundingClientRect();form.style.left=Math.max(0,Math.min(box.width-180,target.left-box.left))+'px';form.style.top=Math.max(0,target.top-box.top)+'px';form.style.width=Math.max(170,Math.min(340,target.width))+'px';
  form.onsubmit=e=>{e.preventDefault();if(!input.reportValidity())return;try{commit(type==='number'?input.valueAsNumber:input.value);close();}catch(e){error.textContent=e.message;input.setAttribute('aria-invalid','true');}};
  form.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}};form.onclick=e=>e.stopPropagation();form.ondblclick=e=>e.stopPropagation();input.focus();input.select();
 }};
}
