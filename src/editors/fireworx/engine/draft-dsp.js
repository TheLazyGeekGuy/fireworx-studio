import {deviceMap} from './device-codec.js';
import {costKey} from './budget.js';
const routingCost={1:1,3:4,4:4,5:5,6:5};
export function draftDspEstimate(state){
 let total=(state.baselines?.[state.rate]??0)+(state.pitchDetector?4:0),unknown=false;
 for(const n of state.nodes){const cost=state.costs?.[costKey(n.algorithm,state.rate)]??deviceMap.algorithms[n.algorithm]?.dsp;if(!Number.isFinite(cost))unknown=true;else total+=cost;}
 for(const c of state.routes??[])if(c.row<state.rows)total+=routingCost[c.type]??0;
 return unknown?null:Math.round(total*100)/100;
}
