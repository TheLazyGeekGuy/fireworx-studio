import {dspLoadColor} from '../engine/dsp-color.js';
// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {dspBudgetState,dspCeilingMargin,maximumDspCeiling} from '../engine/dsp-policy.js';
export function create_dsp_banner(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;
const {dspPreferences}=dependencies.dsp_preferences;


 function dspBanner(estimated,{label='DSP · ESTIMATION PRUDENTE',ceiling=dspPreferences.ceiling}={}){
 const risk=dspLoadColor(estimated),b=dspBudgetState(estimated,ceiling),state={ok:'DISPONIBLE',high:'PROCHE DU PLAFOND',limit:'PLAFOND ATTEINT',reserve:'PLAFOND DÉPASSÉ',overload:b.available>=0?'DÉPASSEMENT ESTIMÉ · AUTORISÉ':'SURCHARGE ESTIMÉE',unknown:'CHARGE INCOMPLÈTE'}[b.state];
 return `<div class="dsp-banner dsp-banner-${b.state}" data-dsp-zone="${risk.zone}" data-fw-style="--dsp-tone:${risk.color}"><div class="dsp-current"><span class="eyebrow">${label}</span><strong class="budget-total">≈ ${estimated??'?'} %</strong></div><div class="dsp-ceiling-control"><label for="dsp-ceiling">Plafond<input id="dsp-ceiling" type="number" min="1" max="${maximumDspCeiling}" step="1" value="${ceiling}" aria-label="Plafond DSP commun (%)"><span>%</span></label><span id="dsp-chosen-reserve">${dspCeilingMargin(ceiling)}</span></div><span class="budget-state dsp-${b.state}">${state}${b.available===null?'':` · ${b.available<0?Math.abs(b.available)+' pts au-dessus':b.available+' pts avant plafond'}`}</span><button id="dsp-open" title="Détail des coûts estimés et relevés manuels">DSP / détails</button><div class="dsp-banner-track" aria-hidden="true"><i data-fw-style="width:${Math.min(100,(estimated??0)*100/Math.max(100,ceiling))}%"></i><b data-fw-style="left:${ceiling*100/Math.max(100,ceiling)}%"></b></div></div>`;
}
 function bindDspCeiling(container,onNotice=()=>{}){
 const input=container.querySelector('#dsp-ceiling');input.onchange=()=>{try{dspPreferences.set(input.valueAsNumber);}catch(e){input.value=String(dspPreferences.ceiling);onNotice(e.message);}};
}

return {dspBanner,bindDspCeiling};
}
