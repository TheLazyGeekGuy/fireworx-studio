// Pure editor budget policy. It does not calibrate the estimate or set hardware DSP mode.
export const defaultDspCeiling=98;
export const maximumDspCeiling=108;
export const dspCeilingMargin=ceiling=>ceiling>100?`Tolérance +${ceiling-100} pts au-delà de 100 %`:`Réserve ${100-ceiling} pts`;
export function validateDspCeiling(value){
 if(!Number.isInteger(value)||value<1||value>maximumDspCeiling)throw Error('Plafond DSP : entier de 1 à 108 % requis');
 return value;
}
export function dspBudgetState(estimated,ceiling=defaultDspCeiling){
 validateDspCeiling(ceiling);if(estimated!==null&&(!Number.isFinite(estimated)||estimated<0))throw Error('Estimation DSP invalide');
 const available=estimated===null?null:ceiling-estimated,reserve=100-ceiling;
 const state=estimated===null?'unknown':estimated>100?'overload':estimated>ceiling?'reserve':estimated===ceiling?'limit':available<=5?'high':'ok';
 return {estimated,ceiling,reserve,available,headroom:estimated===null?null:100-estimated,state};
}
export function assertDspTransition(before,after,ceiling=defaultDspCeiling){
 const budget=dspBudgetState(after,ceiling);
 // Imported/physical patches may already exceed the model's ceiling. Allow a move,
 // mute, removal or cheaper algorithm, but no further increase above the ceiling.
 if(after===null)throw Error('Estimation DSP incomplète : ajout ou raccordement non validé');
 if(after>ceiling&&(before===null||after>before))throw Error(`Plafond DSP ${ceiling} % dépassé : ≈ ${after} % prévus (${dspCeilingMargin(ceiling)})`);
 return budget;
}
