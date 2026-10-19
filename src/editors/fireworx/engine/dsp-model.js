import {deviceMap} from './device-codec.js';
const specials={1:1,3:4,4:4,5:5,6:5};
export function deviceDspEstimate(buffer,{reservePoints=0}={}){
 if(!Number.isFinite(reservePoints)||reservePoints<0||reservePoints>30)throw Error('DSP reserve must be 0–30 percentage points');
 const entries=buffer.nodes.map(n=>({id:n.id,algorithm:n.algorithm,instance:n.instanceIndex,cost:deviceMap.algorithms[n.algorithm]?.dsp??null,muted:n.muted}));
 for(const c of buffer.cells.filter(c=>c.row<buffer.rows&&specials[c.type]!==undefined))entries.push({id:`route-${c.col}-${c.row}`,type:c.type,cost:specials[c.type]});
 const unknown=entries.some(e=>e.cost===null)||buffer.unknown.length>0,estimated=entries.reduce((sum,e)=>sum+(e.cost??0),0),upper=estimated+reservePoints;
 const state=unknown?'unknown':estimated>100?'overload':estimated===100?'limit':upper>100?'reserve':estimated>=90?'high':'ok';
 return {estimated:unknown?null:estimated,knownSubtotal:estimated,reservePoints,withReserve:unknown?null:upper,headroom:unknown?null:100-estimated,state,entries,hardwareMeasured:false,scope:'Third-party additive model; muted and parallel instances still count. No hardware DSP telemetry.'};
}
export function compareDspObservation(estimated,observed){
 if(![estimated,observed].every(v=>Number.isFinite(v)&&v>=0&&v<=300))throw Error('Invalid DSP comparison');
 return {estimated,observed,differencePoints:estimated-observed,relativeErrorPercent:observed?(estimated-observed)/observed*100:null,calibratesOtherPatches:false};
}
export function estimateAlgorithmCost({before,after,instances=1,sampleRate,algorithm,context=''}){
 if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length||before.length<1||before.length>20||![...before,...after].every(v=>Number.isFinite(v)&&v>=0&&v<=100))throw Error('Une à vingt paires de charges DSP de 0 à 100 % requises');
 const definition=deviceMap.algorithms[algorithm],quota=definition&&deviceMap.defaults[definition.document]?.count;
 if(!Number.isInteger(instances)||instances<1||!quota||instances>quota||![44100,48000].includes(sampleRate)||typeof context!=='string'||context.length>240)throw Error('Algorithme, fréquence et nombre d’instances invalides');
 const deltas=after.map((v,i)=>(v-before[i])/instances).sort((a,b)=>a-b);if(deltas[0]<0)throw Error('La charge avec le bloc est inférieure à la référence ; contrôlez le contexte');
 const n=deltas.length,cost=n%2?deltas[(n-1)/2]:(deltas[n/2-1]+deltas[n/2])/2;
 return {algorithm,sampleRate,instances,context,before:[...before],after:[...after],estimatedUnitCost:cost,spreadPoints:deltas.at(-1)-deltas[0],samples:n,quality:n>=3?'repeated-manual-readings':'single-manual-pair',provenance:'user-entered TOOL DSP LOAD readings; not MIDI telemetry',changesGlobalModel:false};
}
