// Bounded Tap input, not MIDI Clock and not a guessed CC-value-to-BPM conversion.
export function planTempoTaps({bpm,channel,cc}){
 if(!Number.isFinite(bpm)||bpm<20||bpm>300||!Number.isInteger(channel)||channel<1||channel>16||!Number.isInteger(cc)||cc<0||cc>119)throw Error('Tempo : BPM 20–300, canal 1–16 et CC 0–119 requis');
 const period=60000/bpm,events=[{at:0,value:0}],pulseMs=35;
 for(let i=0;i<4;i++){events.push({at:35+i*period,value:127,tap:i+1},{at:35+i*period+pulseMs,value:0});}
 return {bpm,channel,cc,period,taps:4,events,durationMs:events.at(-1).at};
}
function wait(ms,signal){return new Promise((resolve,reject)=>{const finish=()=>{signal?.removeEventListener('abort',abort);resolve();},abort=()=>{clearTimeout(timer);reject(new DOMException('Réglage tempo interrompu','AbortError'));},timer=setTimeout(finish,ms);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});}
export async function performTempoTaps(config,{send,signal,onProgress=()=>{},now=()=>performance.now(),sleep=wait}={}){
 const plan=planTempoTaps(config),start=now(),times=[];let sent=0;
 for(const event of plan.events){
  signal?.throwIfAborted();const remaining=start+event.at-now();if(remaining>0)await sleep(remaining,signal);signal?.throwIfAborted();
  if(event.tap&&now()-(start+event.at)>35)throw Error('Ordonnancement trop tardif : BPM non confirmé, recommencez au premier plan');
  send(Uint8Array.of(175+plan.channel,plan.cc,event.value));sent++;
  if(event.tap){times.push(now());onProgress({tap:event.tap,total:4,bpm:plan.bpm});}
 }
 return {requestedBpm:plan.bpm,channel:plan.channel,cc:plan.cc,taps:4,messages:sent,intervalsMs:times.slice(1).map((t,i)=>t-times[i]),hardwareBpmReadback:false,continuousClock:false};
}
