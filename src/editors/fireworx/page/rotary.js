// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.

export function create_rotary(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// One gesture vocabulary for bounded values, enumerations and endless encoders.
// Rendering is CSS-only (flat or rich relief, #75); `data-turning` marks an active drag.
const dialAngle=(value,min,max)=>-135+270*Math.max(0,Math.min(1,(value-min)/(max-min||1)));
 function fieldSteps(field){
 if(field.values&&field.range)return Object.keys(field.values).filter(k=>/^-?\d+$/.test(k)).map(Number).filter(v=>v>=field.range[0]&&v<=field.range[1]).sort((a,b)=>a-b);
 return null;
}
 function stepField(field,value,delta){
 if(!field.range||!field.editable)return value;
 const steps=fieldSteps(field);
 return steps?steps[Math.max(0,Math.min(steps.length-1,Math.max(0,steps.indexOf(value))+delta))]:Math.max(field.range[0],Math.min(field.range[1],value+delta));
}
 function fieldAngle(field,value){const steps=fieldSteps(field);return steps?dialAngle(steps.indexOf(value),0,steps.length-1):dialAngle(value,...field.range);}
 function bindRotary(element,{get,set,min=0,max=127,step=1,turn,onStart=()=>{},onEnd=()=>{}}){
 const change=delta=>{if(element.disabled)return;if(turn)turn(delta);else set(Math.max(min,Math.min(max,get()+delta*step)));};
 let suppressClick=false;
 // A click selects/focuses a control; only a drag or explicit key changes it.
 element.onclick=()=>{suppressClick=false;};
 element.onkeydown=e=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();onStart();if(!turn&&['Home','End'].includes(e.key))set(e.key==='Home'?min:max);else change((['ArrowUp','ArrowRight','End'].includes(e.key)?1:-1)*(e.shiftKey?10:1));onEnd();};
 element.onwheel=e=>{if(element.disabled||!e.altKey||document.activeElement!==element)return;e.preventDefault();onStart();change((e.deltaY<0?1:-1)*(e.shiftKey?10:1));onEnd();};
 element.onpointerdown=e=>{
  if(e.button!==0||element.disabled)return;e.preventDefault();element.focus();onStart();element.dataset.turning='';const start=e.clientY;let ticks=0;
  const move=event=>{const next=Math.trunc((start-event.clientY)/(event.shiftKey?16:4));if(next!==ticks){suppressClick=true;change(next-ticks);ticks=next;}};
  const end=()=>{delete element.dataset.turning;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);onEnd();suppressClick=true;setTimeout(()=>{suppressClick=false;},0);};
  const cancel=()=>{delete element.dataset.turning;suppressClick=true;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);onEnd();};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
 };
}

return {dialAngle,fieldSteps,stepField,fieldAngle,bindRotary};
}
