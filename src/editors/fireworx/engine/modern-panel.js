import {alphaStripHTML} from './alpha-display.js';
import {effectControlState} from './effect-control.js';
import {panelGeometry} from './panel.js';
import {renderLCD,renderPresetLCD,renderAlphaLCD,routingSummary} from './lcd.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Same control inventory, action IDs and routing projection as the hardware face.
// Levels and physical status have no read protocol here: unlit scales are unknown,
// never animated or derived from the DSP estimate / connection state.
export function renderModernPanel({nodes,rows,selected,cells,routes,presetName,alphaText,presetStatus,presetSource,alphaOverview,recall,screenMode='routing',familyFor,algorithmFor}){
 const n=nodes.find(n=>n.id===selected),enabled=family=>effectControlState({nodes,rows},family,familyFor).enabled;
 const rotary=label=>`<button class="modern-rotary" data-panel-rotary="${label}" aria-label="${label}"><span class="modern-dial" data-encoder="${['PARAMETER','VALUE','α MOD'].includes(label)}" aria-hidden="true"><i data-panel-rotor="${label}"></i></span><span>${label}</span><output></output></button>`;
 const action=label=>`<button data-panel-action="${esc(label)}">${label==='TEMPO'?'<i class="panel-tempo-led" data-panel-indicator="Tempo" aria-hidden="true"></i>':['EFFECTS','MOD','I/O SETUP'].includes(label)?`<i class="panel-menu-led" data-panel-menu-led="${esc(label)}" aria-hidden="true"></i>`:''}${esc(label)}</button>`;
 const key=k=>k.family?`<button data-family="${k.family}" aria-pressed="${enabled(k.family)}" data-enabled="${enabled(k.family)}" title="${enabled(k.family)?'Désactiver':'Réactiver'} ${k.label} · toute la famille">${k.label}</button>`:action(k.label);
 const scale=(name,values)=>`<div class="modern-meter" data-panel-meter="${name}" aria-label="${name} : niveau non reçu"><strong>${name}</strong><div class="modern-meter-scale" aria-hidden="true">${values.map(v=>`<span><i></i><small>${v}</small></span>`).join('')}</div><output>—</output></div>`;
 const presentation={ink:'var(--accent)',paper:'var(--bg)',clipId:'fw-modern-lcd-routing'};
 const lcd=screenMode==='alpha'?renderAlphaLCD(alphaOverview,presentation):screenMode==='preset'?renderPresetLCD({nodes,presetName,alphaText,presetSource,recall},presentation):renderLCD({nodes,rows,selected,cells,routes},familyFor,algorithmFor,undefined,presentation);
 return `<div class="modern-front modern-complete">
  <div class="modern-identity"><strong>FireworX<span> / </span></strong><span class="modern-instrument">SIGNAL PROCESSOR</span><div class="modern-inputs">${rotary('IN')}${rotary('OUT')}</div><div class="modern-name-display" aria-label="Afficheur de nom">${presetName?esc(presetName):'—'}</div>${action('POWER')}</div>
  <section class="modern-screen-section" aria-label="Écran et indicateurs du FireworX">
   <div class="modern-input-meters" aria-label="INPUT LEVEL"><span class="modern-caption">INPUT LEVEL</span><div>${scale('L',[0,-3,-6,-12,-18,-24])}${scale('R',[0,-3,-6,-12,-18,-24])}</div><span class="modern-status" data-panel-indicator="Overflow"><i></i>Overflow <output>—</output></span></div>
   <button class="modern-display lcd-hit" ${screenMode==='routing'?`aria-description="${esc(routingSummary({nodes,rows,selected},familyFor))}"`:''} aria-label="${screenMode==='alpha'?'Affectations Alpha Mod':screenMode==='preset'?'Recall : sélectionner Preset, Bank ou Filter ; LIST ouvre la bibliothèque':'Agrandir la matrice'}"><span class="eyebrow">${screenMode==='alpha'?'α MOD · AFFECTATIONS':screenMode==='preset'?'RECALL · PRESET':'EFFECTS · ROUTING'} <span>↗</span></span><span class="modern-lcd">${lcd}</span><small>${screenMode==='alpha'?'Liens du preset · position CC brute':screenMode==='preset'?(recall?.loading?'Chargement et relecture…':recall?.error?'Lecture indisponible':recall?.pending?'ENTER pour charger · EXIT pour annuler':'VALUE : preset · PARAMETER : champ'):n?`${esc(familyFor(n.algorithm).name)} · ${n.muted?'DÉSACTIVÉ':'ACTIF'} · ${n.col+1}:${n.row+1}`:'Bibliothèque → matrice → réglages'}</small></button>
   <div class="modern-output-meters">${scale('Gain Red. dB',[-3,-6,-10,-14,-20])}<div class="modern-indicators">${['MIDI','Digital','Edited'].map(label=>`<span class="modern-status" data-panel-indicator="${label}" aria-label="${label} : état matériel non reçu"><i></i>${label}<output>—</output></span>`).join('')}</div></div>
   <p class="modern-meter-note">Niveaux et Digital non reçus : — · voyants = état de l’éditeur</p>
  </section>
  <section class="modern-effects-section"><h3>EFFECTS CONTROL</h3><div class="modern-effects" role="group" aria-label="Effects Control">${panelGeometry.keys.slice(0,15).map(key).join('')}</div></section>
  <section class="modern-control-section"><h3>CONTROL</h3><div class="modern-control-keys">${panelGeometry.keys.slice(15,21).map(key).join('')}</div><div class="modern-navigation" role="group" aria-label="Navigation du panneau">${panelGeometry.keys.slice(21).map(key).join('')}</div>${alphaStripHTML()}<div class="modern-encoders">${['PARAMETER','VALUE','α MOD'].map(rotary).join('')}</div></section>
 </div>`;
}
