// Presentation only: no MIDI output, polling, device globals or DOM dependencies.
export function createPanelIndicators({now=()=>performance.now()}={}){
 const blank=()=>({last:-Infinity,beat:-Infinity,ticks:0,intervals:[]}),clocks={rx:blank(),tx:blank()};
 let midiUntil=-Infinity,bpm=120,mode='auto',anchor=now();
 const pulse=100;
 return {
  configure({bpm:next=bpm,source=mode,reset=false}={}){
   if(!Number.isFinite(next)||next<20||next>300||!['auto','internal','midi'].includes(source))return;
   if(reset||next!==bpm||source!==mode)anchor=now();if(reset)clocks.tx=blank();bpm=next;mode=source;
  },
  activity(direction,bytes,timestamp){
   if(!bytes?.length)return;const time=now();midiUntil=Math.max(midiUntil,time+pulse,Number.isFinite(timestamp)?timestamp+pulse:0);
   if(!clocks[direction]||bytes[0]!==248)return;
   const c=clocks[direction],at=direction==='tx'&&Number.isFinite(timestamp)?Math.max(time,timestamp):time,gap=at-c.last;
   if(gap>500){c.ticks=0;c.intervals=[];}else if(gap>0&&gap<500){c.intervals.push(gap);if(c.intervals.length>48)c.intervals.shift();}
   if(c.ticks%24===0)c.beat=at;c.ticks++;c.last=at;
  },
  clearActivity(){midiUntil=-Infinity;clocks.rx=blank();clocks.tx=blank();},
  get snapshot(){
   const time=now(),direction=time-clocks.rx.last<1000?'rx':time-clocks.tx.last<1000?'tx':null,c=clocks[direction],external=mode==='midi'||mode==='auto'&&!!c;
   const period=60000/bpm,phase=((time-anchor)%period+period)%period;
   const measured=c?.intervals.length>=6?60000/(24*c.intervals.reduce((a,b)=>a+b,0)/c.intervals.length):null;
   return {midi:time<midiUntil,tempo:external?!!c&&time>=c.beat&&time-c.beat<pulse:phase<pulse,tempoSource:external?(c?'midi-'+direction:'waiting'):'internal',bpm:external?(measured?Math.round(measured*10)/10:null):bpm,mode};
  }
 };
}
// Running modulation values are readback-derived, not preset edits.
export function payloadEdited(reference,current){return !!reference&&!!current&&(reference.length!==current.length||current.some((v,i)=>v!==reference[i]&&!(i>=1131&&i<=1359&&(i-1131)%12===0)));}
