// F1 printed pp. 28–29, 34, 48, 50–73. No exact per-algorithm costs are published.
export const rates=[44100,48000];
export function costKey(algorithm,rate){if(!rates.includes(rate))throw new Error('Unsupported sample rate');return `${algorithm}@${rate}`;}
export function familyEnvelope(dsp){const p=dsp.split('–').map(Number);return [p[0],p[1]??p[0]];}
export function summarizeBudget(nodes,familyFor,observations={},rate=44100,baseline=null,pitchDetector=false){
 let low=0,high=0,subtotal=0,known=0;
 const items=nodes.map(n=>{
  const family=familyFor(n.algorithm),envelope=familyEnvelope(family.dsp),observed=observations[costKey(n.algorithm,rate)]??null;
  if(observed!==null&&(!Number.isFinite(observed)||observed<0||observed>100))throw new Error('Invalid DSP observation');
  low+=envelope[0];high+=envelope[1];if(observed!==null){known++;subtotal+=observed;}
  // Mute and topology do not imply processor deallocation. Count every placed instance.
  return {node:n.id,algorithm:n.algorithm,observed,envelope};
 });
 if(baseline!==null&&(!Number.isFinite(baseline)||baseline<0||baseline>100))throw new Error('Invalid baseline');
 const pitch=pitchDetector?4:0;
 const predicted=known===nodes.length&&baseline!==null?Math.round((baseline+subtotal+pitch)*100)/100:null;
 return {rate,items,known,count:nodes.length,subtotal,pitch,baseline,predicted,
  envelope:[low+pitch,high+pitch],
  status:predicted!==null?(predicted>100?'predicted-overload':'predicted-within'):low+pitch>100?'family-envelope-overload':high+pitch>100?'uncertain-overload':'unverified'};
}
