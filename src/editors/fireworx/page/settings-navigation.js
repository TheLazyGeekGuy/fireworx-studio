// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {familySymbol} from '../engine/workspaces.js';
import {findAlgorithm,findFamily} from '../engine/catalog.js';
import {costBadge} from '../engine/cost-badge.js';
export function create_settings_navigation(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// Two semantic workspaces. Selection/coordinates stay in hints, not in the visible label.



const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function blockSelector(n,{selected,device=false,nodes=[]}={}){
 const f=findFamily(n.algorithm),a=findAlgorithm(n.algorithm),instance=device?n.instanceIndex+1:Math.max(1,nodes.filter(z=>findFamily(z.algorithm).id===f.id).findIndex(z=>z.id===n.id)+1),label=`${f.name} ${instance}`,description=`${label} · ${a.name} · colonne ${n.col+1}, ligne ${n.row+1}`;
 return `<button type="button" ${device?'data-device-node':'data-edit-node'}="${esc(n.id)}" aria-pressed="${n.id===selected}" aria-label="${esc(description)}" data-hint="${esc(description)}" data-fw-style="--block-accent:var(--family-${f.id},var(--accent))">${familySymbol(f.id)}<span>${esc(label)} ${costBadge(n.algorithm)}</span></button>`;
}
 function settingsNavigation(tabs,{page,items,onPage}){
 tabs.classList.add('settings-navigation');tabs.innerHTML=`<div class="settings-page-tabs" role="tablist" aria-label="Organisation des réglages"><button id="settings-page-signal" role="tab" type="button" data-settings-page="signal" aria-selected="${page==='signal'}" aria-controls="editors" tabindex="${page==='signal'?0:-1}">Éléments du signal</button><button id="settings-page-modulation" role="tab" type="button" data-settings-page="modulation" aria-selected="${page==='modulation'}" aria-controls="editors" tabindex="${page==='modulation'?0:-1}">Modulations</button><span id="mod-assignment-state" hidden></span><button id="mod-assignment-cancel" type="button" aria-label="Annuler l’affectation de modulation" hidden>×</button></div><div class="settings-items">${items}</div>`;
 const panel=document.getElementById('editors');panel.removeAttribute('aria-label');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','settings-page-'+page);
 tabs.querySelectorAll('[data-settings-page]').forEach(b=>{b.onclick=()=>onPage(b.dataset.settingsPage);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=['Home','ArrowLeft'].includes(e.key)?'signal':'modulation';onPage(next);document.getElementById('settings-page-'+next)?.focus();};});
}

return {blockSelector,settingsNavigation};
}
