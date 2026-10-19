// Received bytes that carry no established parameter: shown read-only as « Octets non décodés »
// so nothing received is invisible. Pure functions, no MIDI, no DOM access. The editor never
// writes these bytes: they are preserved byte-exact by every operation.
// Source of the holes: pinned ctrlrx-sgorpi descriptors (commit f5db5406, spec/, "unknown-hole"
// and "inferred" entries), plus the slot ownership stated by those descriptors and checked on the
// 400 Factory captures of 16/10 (docs/instruments/fireworx/UI-COVERAGE.md).
import {deviceMap,fieldById} from './device-codec.js';
const span=(a,b)=>Array.from({length:b-a},(_,i)=>a+i);
const notWritten='Non validé en écriture et absent de la page de l’appareil selon la source ; conservé tel quel.';
// Record holes: rel = offsets relative to the record base, variant = owning sub-type (absent = shared).
const recordHoles=[
 {doc:'chorus_flanger',rel:[25],variant:2,label:'Flanger classique · +25',source:'blocks/chorus_flanger.json unk_25',note:'Octet final du créneau Flanger classique ; nul dans les 425 presets du corpus de la source. '+notWritten},
 {doc:'delay',rel:[9],variant:0,label:'Stéréo · +9',source:'blocks/delay.json unk_9',note:'Dans le créneau Stéréo, entre Tempo et Feedback ; une valeur plantée n’apparaît nulle part. '+notWritten},
 {doc:'delay',rel:span(130,136),variant:5,label:'Reverse · +130…+135',source:'blocks/delay.json unk_rev_tail',note:'Créneau Reverse (+130…+159) : la page n’expose que Grade, Pan, Lo Cut, Hi Cut et Trig. Valeurs variables dans les presets Reverse. '+notWritten},
 {doc:'delay',rel:span(138,148),variant:5,label:'Reverse · +138…+147',source:'blocks/delay.json unk_rev_mid',note:'Entre Grade et Pan du créneau Reverse. '+notWritten},
 {doc:'delay',rel:[149,150],variant:5,label:'Reverse · +149/+150',source:'blocks/delay.json unk_rev_elem2',note:'Constants (206, 50) = i8 −50/+50 ; hypothèse non établie d’éléments 2–3 d’un tableau Pan. '+notWritten},
 {doc:'delay',rel:[152,153],variant:5,label:'Reverse · +152/+153',source:'blocks/delay.json unk_rev_locut23',note:'Positions 2–3 sous la même hypothèse de tableau (Lo Cut). '+notWritten},
 {doc:'delay',rel:[155,156],variant:5,label:'Reverse · +155/+156',source:'blocks/delay.json unk_rev_hicut23',note:'Constants 100/100 dans les presets Reverse (Hi Cut 2–3 hypothétiques). '+notWritten},
 {doc:'delay',rel:[158,159],variant:5,label:'Reverse · +158/+159',source:'blocks/delay.json unk_rev_trig23',note:'Deux derniers octets de l’enregistrement Delay. '+notWritten},
 {doc:'distortion',rel:[11],label:'Distortion · +11',source:'blocks/distortion.json unk_793',note:'Entre les créneaux Drive et Cruncher ; nul dans les 425 presets du corpus. '+notWritten},
 {doc:'dynamics',rel:[15],variant:1,label:'Soft Compressor · +15',source:'blocks/dynamics.json unk_15',note:'Nul dans les 425 presets du corpus. '+notWritten},
 {doc:'dynamics',rel:[21],variant:2,label:'Hard Compressor · +21',source:'blocks/dynamics.json unk_21',note:'Nul dans les 425 presets du corpus. '+notWritten},
 {doc:'filters',rel:[11],label:'Filters · +11',source:'blocks/filters.json unk_309',note:'Nul dans les presets Filters du corpus. '+notWritten},
 ...[0,1,2,3].map(i=>({doc:'filters',rel:[14+4*i,15+4*i],variant:1,label:`Bandpass · bande ${['G1','G2','D1','D2'][i]} +${14+4*i}/+${15+4*i}`,source:'blocks/filters.json bp_unk_312',note:'Deux derniers octets de chaque enregistrement de bande ; i16be 0 ou 50, identique sur les quatre bandes d’un preset (28 presets Bandpass, sans lien avec Bands used). Place d’un gain de bande EQ : hypothèse non établie. '+notWritten})),
 {doc:'filters',rel:[29],variant:1,label:'Bandpass · +29',source:'blocks/filters.json bp_unk_327',note:'Nul dans tous les presets Bandpass. '+notWritten},
 {doc:'filters',rel:[37],variant:2,label:'Phaser · +37',source:'blocks/filters.json ph_unk_335',note:'Nul dans tous les presets Phaser. '+notWritten},
 {doc:'filters',rel:span(70,74),variant:3,label:'Resonator · +70…+73',source:'blocks/filters.json res_unk_368',note:'Restes des octets Freq/Chord du Resochord, non lus par l’algorithme Resonator. '+notWritten},
 {doc:'filters',rel:span(38,46),variant:4,label:'Resochord · fréquences de voix calculées +38…+45',source:'blocks/filters.json rc_derived_voice_freq (inferred)',note:'Selon la source, les quatre fréquences de voix que l’appareil calcule à partir de Freq et Chord ; non exposées sur la page, lecture seule.'},
 {doc:'filters',rel:[73],variant:4,label:'Resochord · +73',source:'blocks/filters.json rc_unk_371',note:'Nul dans tous les presets Resochord. '+notWritten},
 {doc:'pan_tremolo',rel:[6],variant:0,label:'Tremolo simple · +6',source:'blocks/pan_tremolo.json unk_6',note:'Premier octet du créneau Tremolo simple ; nul dans les 425 presets. '+notWritten},
 {doc:'pan_tremolo',rel:[10],variant:1,label:'Tremolo avancé · +10',source:'blocks/pan_tremolo.json unk_10',note:'Premier octet du créneau Tremolo avancé ; nul dans les 425 presets. '+notWritten},
 {doc:'pan_tremolo',rel:[17],variant:2,label:'Panner simple · +17',source:'blocks/pan_tremolo.json unk_17',note:'Premier octet du créneau Panner simple ; nul dans les 425 presets. '+notWritten},
 {doc:'pan_tremolo',rel:[21,22],variant:3,label:'Panner surround · +21/+22',source:'blocks/pan_tremolo.json unk_21',note:'En tête du créneau Panner surround ; +22 = 1 dans un seul preset du corpus. '+notWritten},
 {doc:'pan_tremolo',rel:[31,32,33],variant:4,label:'Stereo Enhancer · +31…+33',source:'blocks/pan_tremolo.json unk_31',note:'Créneau entier du Stereo Enhancer, qui n’a pas de paramètre propre (Mix/In/Out seulement). '+notWritten},
 {doc:'reverb',rel:[11,12],label:'Reverb · +11/+12',source:'blocks/reverb.json unk_11, unk_12',note:'Trou entre les créneaux Simple et Advanced ; +12 est forcé à 0 par l’appareil selon la source. '+notWritten},
 {doc:'synth',rel:[12],variant:0,label:'Curve · +12',source:'blocks/synth.json curve_unk_12',note:'Invisible sur toutes les pages ; 1 dans un seul preset du corpus. '+notWritten},
 {doc:'synth',rel:[13,16],variant:1,label:'Chaos · +13/+16',source:'blocks/synth.json chaos_unk_13, chaos_unk_16',note:'Invisibles ; +16 est forcé à 0 par l’appareil selon la source. '+notWritten},
 {doc:'synth',rel:[23],variant:2,label:'Noise · +23',source:'blocks/synth.json noise_unk_23',note:'Dernier octet de l’enregistrement Synth ; nul dans les 425 presets. '+notWritten},
 {doc:'vocode',rel:[22],label:'Vocode · +22',source:'blocks/vocode.json unk_22',note:'Forcé à 0 par l’appareil selon la source. '+notWritten}
];
// Preset-level holes, attached to the utility view that owns the neighbouring parameters.
const globalHoles=[
 {offsets:[1040],scope:'modifiers.pitch_detect[0].',label:'Pitch Detect · octet +2',source:'modifiers.json pd_p2',note:'Vaut 1 dans les 400 presets Factory et les 425 du corpus : réglage actif sans paramètre de façade connu (le manuel ne liste que Lo Note, Hi Note, Master Tune). '+notWritten},
 {offsets:[1048],scope:'modifiers.adsr[0].',label:'ADSR 1 · octet +2',source:'modifiers.json adsr_p2',note:'0, 12 ou 24 dans les presets Factory. L’hypothèse « Sustain time » a été réfutée par la source (la page ADSR liste cinq paramètres). '+notWritten},
 {offsets:[1054],scope:'modifiers.adsr[1].',label:'ADSR 2 · octet +2',source:'modifiers.json adsr_p2',note:'0 ou 24 dans les presets Factory ; même statut que ADSR 1. '+notWritten},
 {offsets:[1074],scope:'modifiers.freeform[0].',label:'Freeform · octet +0',source:'modifiers.json ff_p0',note:'0 ou 255 ; candidat « Slide Curve » affaibli par la source (la page Freeform ne liste que huit paramètres). '+notWritten},
 {offsets:[1116],scope:'modifiers.function[0].',label:'Fonction 1 · octet +2',source:'modifiers.json fn_p2',note:'0 ou 28 dans les presets Factory ; aucun paramètre du manuel ne lui correspond. '+notWritten},
 {offsets:[1122],scope:'modifiers.function[1].',label:'Fonction 2 · octet +2',source:'modifiers.json fn_p2',note:'0 ou 1 dans les presets Factory. '+notWritten},
 {offsets:span(174,178),scope:'global',label:'Preset · @174…@177',source:'common.json gap_174',note:'Trou de l’en-tête commun ; 255 dans un seul preset Factory. '+notWritten},
 {offsets:[206,207],scope:'global',label:'Preset · @206/@207',source:'common.json gap_206',note:'Avant les nœuds de routage (« node-region header? » selon la source) ; 249–253 dans 14 presets Factory. '+notWritten},
 {offsets:[1030,1031],scope:'global',label:'Preset · @1030/@1031',source:'common.json gap_1030',note:'@1030 se comporte en i8 −100…0 dB validé, @1031 non validé : paire niveau + routage probable, non établie. Non nul dans 11 presets Factory. '+notWritten}
];
const selectorFor=(doc,instance)=>{const a=Object.values(deviceMap.algorithms).find(a=>a.document===doc&&a.selector);return a?fieldById.get(a.selector.replace('.inst[0]',`.inst[${instance}]`)):null;};
export const undecodedEntries=Object.freeze([
 ...recordHoles.flatMap(h=>{const d=deviceMap.defaults[h.doc];return Array.from({length:d.count},(_,instance)=>{const selector=selectorFor(h.doc,instance);
  return h.rel.map(rel=>({offset:d.base+instance*d.stride+rel,doc:h.doc,blockTypeId:d.block_type_id,instance,condition:h.variant===undefined?null:{offset:selector.offset,value:h.variant},label:h.label,source:h.source,note:h.note}));}).flat();}),
 ...globalHoles.flatMap(h=>h.offsets.map(offset=>({offset,scope:h.scope,condition:null,label:h.label,source:h.source,note:h.note})))
]);
// node: an engine {algorithm,instanceIndex}, a utility {scopePrefix}, or {scope:'global'}.
export function undecodedBytes(buffer,node){
 const p=buffer.payload??buffer,a=node?.algorithm&&deviceMap.algorithms[node.algorithm];
 return undecodedEntries.filter(e=>a?e.doc===a.document&&e.instance===node.instanceIndex:e.scope!==undefined&&e.scope===(node?.scopePrefix??node?.scope))
  .filter(e=>!e.condition||p[e.condition.offset]===e.condition.value).map(e=>({...e,value:p[e.offset]}));
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Read-only HTML appended to the engine/utility view. Groups bytes by hole label.
export function receivedBytesSection(buffer,node){
 const items=undecodedBytes(buffer,node),texts=[];
 if(node?.scopePrefix==='modifiers.alpha_mod[0].'||node?.scope==='global')texts.push(`<p class="received-text"><strong>Texte Alpha reçu</strong> <q data-received-alpha>${esc(buffer.alphaText)}</q></p>`);
 if(node?.scope==='global')texts.unshift(`<p class="received-text"><strong>Nom du preset reçu</strong> <q data-received-name>${esc(buffer.name)}</q></p>`);
 if(!items.length)return texts.length?`<section class="received-bytes">${texts.join('')}</section>`:'';
 const groups=new Map();for(const e of items)(groups.get(e.label)??groups.set(e.label,[]).get(e.label)).push(e);
 const nonzero=items.filter(e=>e.value).length;
 return `<section class="received-bytes">${texts.join('')}<details class="undecoded-bytes" data-undecoded-section ${nonzero?'open':''}><summary>Octets non décodés · ${items.length} reçu(s), ${nonzero} non nul(s) · lecture seule</summary><p>Octets reçus sans paramètre établi. Affichés en offset = valeur brute ; jamais écrits par l’éditeur, conservés à chaque opération.</p><ul>${[...groups].map(([label,list])=>`<li title="${esc(list[0].note+' Source : '+list[0].source)}"><span>${esc(label)}</span>${list.map(e=>`<code data-undecoded-offset="${e.offset}" data-undecoded-value="${e.value}">@${e.offset}=${e.value}</code>`).join('')}</li>`).join('')}</ul></details></section>`;
}
