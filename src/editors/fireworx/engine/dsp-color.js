// Visual risk scale only: no calibration, budget decision or MIDI effects.
const bands=[
 {zone:'green',min:0,max:60,from:[35,125,76],to:[79,155,66]},
 {zone:'orange',min:60,max:85,from:[201,133,23],to:[231,102,20]},
 {zone:'red',min:85,max:95,from:[204,52,39],to:[235,33,40]},
 {zone:'scarlet',min:95,max:100,from:[255,23,55],to:[204,0,35]},
 {zone:'black',min:100,max:108,from:[26,15,19],to:[5,5,7]}
];
export function dspLoadColor(estimated){
 if(estimated===null)return {zone:'unknown',color:'var(--muted)'};
 if(!Number.isFinite(estimated)||estimated<0)throw Error('Estimation DSP invalide');
 const band=bands.find(b=>estimated<b.max)??bands.at(-1),t=Math.min(1,Math.max(0,(estimated-band.min)/(band.max-band.min))),eased=t*(2-t);
 const color='#'+band.from.map((n,i)=>Math.round(n+(band.to[i]-n)*eased).toString(16).padStart(2,'0')).join('');
 return {zone:band.zone,color};
}
