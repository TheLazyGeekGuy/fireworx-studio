// Editorial UI organization only: does not change descriptor domains or DSP behavior.
export const familyWorkspaces={
 modifier:{name:'Contrôle',core:'Paramètres de contrôle',hint:'Sources internes et routage',symbol:'M2 15H10L16 4L22 25L28 15H30'},
 dynamic:{name:'Dynamique',core:'Seuil & compression',hint:'Courbe de transfert · détection · enveloppe',symbol:'M2 22L13 11L29 6'},
 filter:{name:'Filtres',core:'Fréquences & résonance',hint:'Réponse fréquentielle · bandes · résonance',symbol:'M2 23L9 22L13 6H22L27 23H30'},
 formant:{name:'Voyelles',core:'Trajectoire des voyelles',hint:'Start → Thru → End · couleur · balayage',symbol:'M2 19Q9 1 16 15T30 8'},
 distort:{name:'Saturation',core:'Grain & coloration',hint:'Transfert · coloration · filtrage',symbol:'M2 21L9 7H15L21 22H29'},
 vocode:{name:'Porteuse',core:'Porteuse & analyse',hint:'Porteuse · contrôle · bandes latérales',symbol:'M2 15H10L15 5L21 25L26 15H30'},
 synth:{name:'Générateur',core:'Source & forme',hint:'Oscillateur · forme · filtrage',symbol:'M2 15Q6 0 10 15T18 15T26 15T30 15'},
 pitch:{name:'Transposition',core:'Accordage & voix',hint:'Voix indépendantes · délai · réinjection',symbol:'M2 19H13V7H30M2 25H20V13H30'},
 chorus:{name:'Modulation',core:'Mouvement & modulation',hint:'Vitesse · profondeur · phase',symbol:'M2 10Q9 0 16 10T30 10M2 23Q9 13 16 23T30 23'},
 delay:{name:'Échos',core:'Temps & synchronisation',hint:'Chronologie · taps · feedback',symbol:'M3 25V4M11 25V10M19 25V16M27 25V21'},
 reverb:{name:'Espace',core:'Pièce & caractère',hint:'Réflexions · déclin · diffusion',symbol:'M2 24V7M7 24V12M12 7Q16 16 30 24'},
 pan:{name:'Stéréo',core:'Position & mouvement',hint:'Champ stéréo · mouvement · phase',symbol:'M2 15H30M9 8L2 15L9 22M23 8L30 15L23 22'},
 eq:{name:'Égalisation',core:'Réponse & bandes',hint:'Gain · fréquence · largeur de bande',symbol:'M2 18Q8 18 12 5Q16 18 20 18T30 12'}
};
export const familySymbol=id=>`<svg class="family-symbol" viewBox="0 0 32 30" aria-hidden="true"><path d="${familyWorkspaces[id].symbol}"/></svg>`;
export function parameterGroups(family,controls){
 const groups=new Map();
 controls.forEach((control,index)=>{
  const label=control.label;let name;
  if(/^(Mix|In Level|Out Level|LED Meter|Input|Input source|Mute mode|Out [LR](?: routing)?)$/i.test(label))name='Entrée / sortie';
  else if(family==='delay'&&/^Line [12] \/ /.test(label)){const match=label.match(/^Line ([12]) \/ \w+ ([1-3])/);name=match?`Ligne ${match[1]} · tap ${match[2]}`:label.split(' / ')[0];}
  else if(family==='delay'&&/^(Time|Tap|Levels?|Pan(?: Position)?|Lowcut|Highcut|Feedback) [1-6]$/.test(label))name=`Tap ${label.match(/[1-6]$/)[0]}`;
  else if(family==='reverb'&&/^Room/.test(label))name='Premières réflexions';
  else if(family==='reverb'&&/^(Decay|Diffuse|Reverb)/.test(label))name='Déclin & diffusion';
  else if(family==='vocode'&&/^(Carrier|AGC)/.test(label))name='Porteuse';
  else if(family==='vocode'&&/^Vox/.test(label))name='Voix / contrôle';
  else if(['eq','pitch','filter'].includes(family)&&(/^(?:Voice|Band) [1-5]/.test(label)||family==='eq'&&/^(?:Gain|Freq|Bandwidth|BW|Slope\/BW) [1-5]$/.test(label)||family==='pitch'&&/ [12]$/.test(label))){const match=label.match(/[1-5]/);name=(family==='eq'?'Bande ':family==='filter'&&label.startsWith('Band')?'Bande ':'Voix ')+match[0];}
  else if(/^(Attack|Release|Hold|Sustain)/.test(label))name='Enveloppe';
  else if(/Feedback|Cross Feedback/.test(label))name='Réinjection';
  else if(/^(Mod Link|Speed|Tempo|Depth|LFO|Golden|Phase)/.test(label))name='Modulation & tempo';
  else if(/Locut|Hicut|Highcut|Lowcut|Damp|Color|Brightness|Body/.test(label))name=['filter','eq'].includes(family)?familyWorkspaces[family].core:'Couleur & filtres';
  else name=familyWorkspaces[family].core;
  if(!groups.has(name))groups.set(name,[]);groups.get(name).push({control,index});
 });
 const entries=[...groups].map(([name,items])=>({name,items}));
 const core=familyWorkspaces[family].core;
 return [...entries.filter(g=>g.name===core),...entries.filter(g=>g.name!==core&&g.name!=='Entrée / sortie'),...entries.filter(g=>g.name==='Entrée / sortie')];
}

// Signal-flow presentation only; original field IDs and control indices survive.
export function renderSignalSettings(groups,renderSection){
 const common=groups.find(g=>g.name==='Entrée / sortie');
 if(!common)return groups.map(renderSection).join('');
 const input=[],output=[];
 for(const item of common.items)(/^(Input(?: source)?|In Level)$/i.test(item.control.label)?input:output).push(item);
 const order=['Input source','Input','In Level','Mix','Out Level','Out L','Out L routing','Out R','Out R routing','Mute mode','LED Meter'];
 for(const items of [input,output])items.sort((a,b)=>order.indexOf(a.control.label)-order.indexOf(b.control.label));
 const rail=(items,side,name)=>items.length?renderSection({name,items,side},side):'';
 return `<div class="signal-settings">${rail(input,'input','Entrée')}<div class="signal-core" role="group" aria-label="Paramètres du bloc">${groups.map((g,i)=>g===common?'':renderSection(g,i)).join('')}</div>${rail(output,'output','Sortie')}</div>`;
}
