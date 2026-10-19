// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {defaultDspCeiling,validateDspCeiling} from '../engine/dsp-policy.js';
export function create_dsp_preferences(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;


 const dspCeilingKey='midi-studio:fireworx:dsp-ceiling:v1';
 function createDspPreferences(storage){
 const listeners=new Set();let value=defaultDspCeiling;
 const read=()=>{try{const saved=storage?.getItem(dspCeilingKey);return saved===null||saved===undefined?defaultDspCeiling:validateDspCeiling(Number(saved));}catch{return defaultDspCeiling;}};
 value=read();const notify=()=>{for(const fn of listeners)fn(value);};
 return {get ceiling(){return value;},set(next){validateDspCeiling(next);if(next===value)return;storage?.setItem(dspCeilingKey,String(next));value=next;notify();},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},reload(){const next=read();if(next!==value){value=next;notify();}}};
}
let storage;if(typeof window!=='undefined'){try{storage=window.localStorage;}catch{}}
 const dspPreferences=createDspPreferences(storage);
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===dspCeilingKey||event.key===null)dspPreferences.reload();});

return {dspCeilingKey,createDspPreferences,dspPreferences};
}
