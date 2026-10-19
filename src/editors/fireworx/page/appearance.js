// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.
import {localAppearance,proposals,normalizeAppearance,validColors,renderNames,richMaterial,familyAccents} from '../engine/appearance-presets.js';
import {families} from '../engine/catalog.js';
export function create_appearance(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;



const storageKey='midi-studio:fireworx:appearance:v1';
const colorNames={background:'Fond',surface:'Surface',text:'Texte',muted:'Texte secondaire',accent:'Accent',line:'Séparateurs'};
// Rich render (#75): one extra stylesheet, scoped to html[data-render=rich]; inert in flat.
// Block cards get their family through the cell's existing aria-label (local and live forms).
 const familyCardCSS=()=>families.map(f=>`html[data-render=rich] .cell:is(${f.algorithms.flatMap(a=>[`[aria-label$=", ${f.name} ${a.name}"]`,`[aria-label$=", ${a.name}"]`]).join(',')}){--rich-family:var(--family-${f.id})}`).join('\n');
function installRichLayer(){environment.installStyle(familyCardCSS().replaceAll('html[','.fw-root['));}

 function createAppearance({onChange}){
 let saved;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
 let current=normalizeAppearance(saved);
 installRichLayer();
 document.querySelector('.tabs').insertAdjacentHTML('afterend',`<div class="appearance-tools"><button id="appearance-open">Apparence <span>↗</span></button><span id="appearance-summary"></span><div role="group" aria-label="Style de façade"><button data-surface="hardware">Façade matérielle</button><button data-surface="modern">Vue moderne</button></div><button id="appearance-render-toggle" aria-pressed="false" title="Rendu : plat ou relief (potentiomètres, voyants, cartes). Préférence locale, sans MIDI.">Relief</button></div>`);
 document.body.insertAdjacentHTML('beforeend',`<dialog class="appearance-dialog" aria-labelledby="appearance-title"><header><div><p class="eyebrow">FIREWORX · APPARENCE LOCALE</p><h2 id="appearance-title">Quatre pistes, un même instrument.</h2></div><button data-appearance-close aria-label="Fermer l’apparence">Fermer ×</button></header><p>Chaque palette conserve la façade matérielle et propose une vue moderne. Les couleurs et la disposition se combinent librement.</p><div class="appearance-proposals">${proposals.map(p=>{const t=localAppearance.themes.find(t=>t.id===p.theme);return `<button data-proposal="${p.theme}" data-fw-style="--sample-bg:${t.colors.background};--sample-surface:${t.colors.surface};--sample-text:${t.colors.text};--sample-accent:${t.colors.accent};--sample-line:${t.colors.line}"><span class="appearance-mini" data-mini-layout="${p.layout}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>${p.title}</strong><span>${p.description}</span></button>`;}).join('')}</div><div class="appearance-settings"><label>Palette<select id="appearance-theme">${localAppearance.themes.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></label><label>Disposition monobloc<select id="appearance-layout">${localAppearance.layouts.map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}</select></label><label>Façade<select id="appearance-surface"><option value="hardware">Matérielle fidèle</option><option value="modern">Moderne et plate</option></select></label><label>Rendu<select id="appearance-render"><option value="flat">Plat (par défaut)</option><option value="rich">Relief : matières, voyants, cartes</option></select></label></div><p id="appearance-layout-help"></p><details class="appearance-custom"><summary>Personnaliser les couleurs de ce module</summary><div>${Object.entries(colorNames).map(([key,name])=>`<label>${name}<input type="color" data-appearance-color="${key}"></label>`).join('')}</div><p>Les textes et l’accent doivent conserver un contraste d’au moins 4,5:1 sur le fond et la surface.</p><button id="appearance-reset-colors">Rétablir les couleurs de la palette</button></details><p id="appearance-status" role="status">Préférences locales au navigateur, indépendantes du patch et du MIDI.</p></dialog>`);
 const dialog=document.querySelector('.appearance-dialog'),$=id=>document.getElementById(id);
 let previousLayout,richTokenKey;
 function apply(){
  const theme=localAppearance.themes.find(t=>t.id===current.theme),colors=current.colors??environment.inheritedColors?.()??theme.colors;
  if(previousLayout!==current.layout){document.getElementById('monobloc').classList.toggle('library-collapsed',current.layout==='focus');previousLayout=current.layout;}
  const light=colors.background.match(/^#([0-9a-f]{6})$/i),rgb=light?parseInt(light[1],16):0,scheme=light?(((rgb>>16)*.299+((rgb>>8)&255)*.587+(rgb&255)*.114)>140?'light':'dark'):theme.scheme;
  const root=document.documentElement;
  root.dataset.localTheme=current.theme;root.dataset.localLayout=current.layout;root.dataset.panelSurface=current.surface;root.dataset.render=current.render;root.dataset.localScheme=scheme;
  root.style.colorScheme=scheme;
  for(const [key,name] of Object.entries({background:'bg',surface:'surface',text:'text',muted:'muted',accent:'accent',line:'line'}))root.style.setProperty(`--${name}`,colors[key]);
  const tokenKey=JSON.stringify([scheme,colors]);
  if(tokenKey!==richTokenKey){richTokenKey=tokenKey;const m=richMaterial(colors,scheme);for(const [k,v] of Object.entries({raised:m.raised,sunken:m.sunken,well:m.well,selected:m.selected,'knob-hi':m.knobHi,'knob-lo':m.knobLo,shadow:m.shadow,highlight:m.highlight}))root.style.setProperty(`--rich-${k}`,v);for(const [id,c] of Object.entries(familyAccents(colors,scheme,m)))root.style.setProperty(`--family-${id}`,c);}
  $('appearance-summary').textContent=`${theme.name}${current.colors?' · personnalisé':''} / ${localAppearance.layouts.find(l=>l.id===current.layout).name}${current.render==='rich'?' · '+renderNames.rich:''}`;
  $('appearance-layout-help').textContent=localAppearance.layouts.find(l=>l.id===current.layout).description+' Les dispositions s’appliquent à l’onglet Monobloc.';
  for(const axis of ['theme','layout','surface','render'])$(`appearance-${axis}`).value=current[axis];
  $('appearance-render-toggle').setAttribute('aria-pressed',String(current.render==='rich'));
  document.querySelectorAll('[data-surface]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.surface===current.surface)));
  dialog.querySelectorAll('[data-proposal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.proposal===current.theme)));
  dialog.querySelectorAll('[data-appearance-color]').forEach(input=>input.value=colors[input.dataset.appearanceColor]);
 }
 function change(patch){current=normalizeAppearance({...current,...patch});if(patch.theme)environment.setInherit(false);apply();try{localStorage.setItem(storageKey,JSON.stringify(current));$('appearance-status').textContent='Apparence enregistrée dans ce navigateur. Aucun message MIDI.';}catch{$('appearance-status').textContent='Apparence appliquée pour cette session ; stockage local indisponible.';}onChange();}
 $('appearance-open').onclick=()=>dialog.showModal();dialog.querySelector('[data-appearance-close]').onclick=()=>dialog.close();
 document.querySelectorAll('[data-surface]').forEach(b=>b.onclick=()=>change({surface:b.dataset.surface}));
 dialog.querySelectorAll('[data-proposal]').forEach(b=>b.onclick=()=>{const p=proposals.find(p=>p.theme===b.dataset.proposal);change({theme:p.theme,layout:p.layout,colors:null});});
 $('appearance-theme').onchange=e=>change({theme:e.target.value,colors:null});
 $('appearance-layout').onchange=e=>change({layout:e.target.value});
 $('appearance-surface').onchange=e=>change({surface:e.target.value});
 $('appearance-render').onchange=e=>change({render:e.target.value});
 $('appearance-render-toggle').onclick=()=>change({render:current.render==='rich'?'flat':'rich'});
 dialog.querySelectorAll('[data-appearance-color]').forEach(input=>input.onchange=()=>{const theme=localAppearance.themes.find(t=>t.id===current.theme),colors={...(current.colors??theme.colors),[input.dataset.appearanceColor]:input.value};if(!validColors(colors)){apply();$('appearance-status').textContent='Couleur refusée : contraste des textes ou de l’accent inférieur à 4,5:1.';return;}change({colors});});
 $('appearance-reset-colors').onclick=()=>change({colors:null});
 apply();
 return {get current(){return current;},refresh:apply,inherit(){environment.setInherit(true);current={...current,colors:null};apply();onChange();}};
}

return {familyCardCSS,createAppearance};
}
