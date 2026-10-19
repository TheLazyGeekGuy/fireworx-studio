// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {planTempoTaps} from '../engine/tempo-taps.js';
export function create_tempo_tap_view(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;


// Local description of the existing hardware CTRL/Tempo assignment, not a setup write.
 function mountTempoTapControls({section,bpmInput,getSession,getProfile,onApplied=()=>{},onNotice=()=>{}}){
 section.insertAdjacentHTML('beforeend',`<div class="tempo-send-config"><label>Tempo CTRL · CC<input id="tempo-cc" type="number" min="0" max="119" placeholder="CC réglé sur l’appareil"></label><label>Canal MIDI<input id="tempo-channel" type="number" min="1" max="16" value="1"></label></div><label><input id="tempo-confirm" type="checkbox"> Cette affectation correspond à Tempo dans I/O SETUP → CTRL</label><div class="device-dialog-actions"><button id="tempo-apply" type="button" disabled>Appliquer le BPM au FireworX</button><button id="tempo-stop" type="button" hidden>Arrêter</button></div><p id="tempo-send-state" role="status">Renseignez l’affectation Tempo pour appliquer le BPM au matériel.</p><p class="tempo-send-help">Envoi ponctuel de quatre taps sur ce contrôle, puis arrêt complet. Aucune MIDI Clock émise. Le BPM global n’a pas de retour numérique établi ; le preset est relu pour actualiser les réglages liés.</p>`);
 const $=id=>section.querySelector('#tempo-'+id),key='fireworx-tempo-tap-v1';let busy=false,controller=null,lastRequest=null;
 try{const p=JSON.parse(localStorage.getItem(key));if(p){planTempoTaps({...p,bpm:120});$('cc').value=p.cc;$('channel').value=p.channel;$('confirm').checked=p.confirmed===true;}}catch{}
 const config=()=>{if(!$('confirm').checked)throw Error('Affectation CTRL Tempo nécessaire');const p={bpm:bpmInput.valueAsNumber,cc:$('cc').valueAsNumber,channel:$('channel').valueAsNumber};planTempoTaps(p);const profile=getProfile();if(profile.channel===p.channel&&Object.entries(profile).some(([k,v])=>!['channel','on','off','confirmed'].includes(k)&&v===p.cc))throw Error('Le CC Tempo entre en conflit avec un autre contrôle du profil');return p;};
 const say=text=>{$('send-state').textContent=text;};
 function refresh(){let valid=false;try{config();valid=true;}catch{}$('apply').disabled=busy||!valid||!getSession()?.canAudition;$('stop').hidden=!busy;bpmInput.disabled=busy;for(const id of ['cc','channel','confirm'])$(id).disabled=busy;}
 for(const id of ['cc','channel','confirm'])$(id).onchange=()=>{lastRequest=null;try{const p={cc:$('cc').valueAsNumber,channel:$('channel').valueAsNumber,confirmed:$('confirm').checked};planTempoTaps({...p,bpm:120});localStorage.setItem(key,JSON.stringify(p));say('Prêt · modifier le BPM puis quitter le champ pour l’appliquer, ou utiliser le bouton.');}catch{try{localStorage.removeItem(key);}catch{}say('Renseignez un canal et le CC Tempo réglés sur le FireworX.');}refresh();};
 async function apply(){
  if(busy)return;let p,owner;
  try{p=config();owner=getSession();if(!owner?.canAudition||typeof owner.setTempoFromTaps!=='function')throw Error('Attendez une session FireworX synchronisée avant de régler le tempo');}catch(e){say(e.message);return;}
  busy=true;controller=new AbortController();refresh();say(`Réglage ponctuel de ${p.bpm} BPM…`);
  try{const result=await owner.setTempoFromTaps(p,{signal:controller.signal,onProgress:s=>say(`${s.bpm} BPM · tap ${s.tap} / ${s.total} · CC ${p.cc}, canal ${p.channel}`)});if(getSession()!==owner)throw Error('Session remplacée ; résultat tempo non confirmé');lastRequest=result;onApplied(result);const message=`${p.bpm} BPM demandés au FireworX · 4 taps envoyés, arrêt complet · preset relu`;say(message);onNotice(message);}
  catch(e){lastRequest=null;say(`Tempo non confirmé : ${e.message}`);onNotice($('send-state').textContent);}
  finally{busy=false;controller=null;refresh();}
 }
 $('apply').onclick=()=>void apply();$('stop').onclick=()=>controller?.abort();bpmInput.addEventListener('change',()=>{if($('confirm').checked)void apply();});
 window.addEventListener('pagehide',()=>controller?.abort());refresh();
 return {apply,refresh,get lastRequest(){return lastRequest?.requestedBpm===bpmInput.valueAsNumber?lastRequest:null;},stop(){controller?.abort();}};
}

return {mountTempoTapControls};
}
