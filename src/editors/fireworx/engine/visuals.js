import {findAlgorithm,findFamily} from './catalog.js';
import {editableControlsFor as controlsFor,expandParameters} from './parameters.js';
export {expandParameters} from './parameters.js';
const text=(x,y,s,extra='')=>`<text x="${x}" y="${y}" ${extra}>${s}</text>`;
const path=(d,cls='signal')=>`<path class="${cls}" d="${d}"/>`;
const line=(x1,y1,x2,y2,cls='guide')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const wave=(fn,start=45,end=695,base=115,amp=48)=>Array.from({length:180},(_,i)=>`${i?'L':'M'}${start+(end-start)*i/179},${base-amp*fn(i/179)}`).join(' ');
export function visualFor(n,read){
 const a=findAlgorithm(n.algorithm),family=findFamily(n.algorithm).id,c=controlsFor(n.algorithm),v=label=>{const d=c.find(x=>x.label===label);return d?read(n,d):null;};
 const handle=(label,x,y,axis='x',log=false)=>{const index=c.findIndex(x=>x.label===label);return index<0||c[index].manualStatus==='unconfirmed'?'':`<circle class="visual-handle" cx="${x}" cy="${y}" r="7" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="${c[index].min}" aria-valuemax="${c[index].max}" aria-valuenow="${read(n,c[index])}" data-vcontrol="${index}" data-id="${n.id}" data-axis="${axis}" data-log="${log}"/>`;};
 const freqX=(f,min=20,max=16000)=>45+650*Math.log(f/min)/Math.log(max/min);
 const norm=(label,fallback=.5)=>{const d=c.find(x=>x.label===label);return d&&d.kind!=='choice'?(read(n,d)-d.min)/(d.max-d.min):fallback;};
 let picture='',caption='',title='';
 if(family==='filter'){
  if(n.algorithm==='resonance'){
   const low=v('Locut Freq'),high=v('Hicut Freq'),lx=freqX(low),hx=freqX(high);
   picture=path(`M45 192C${lx-40} 192 ${lx-14} 65 ${lx} 65L${hx} 65C${hx+20} 65 ${hx+32} 192 695 192`)+handle('Locut Freq',lx,65,'x',true)+handle('Hicut Freq',hx,65,'x',true);
   title='FENÊTRE DE FRÉQUENCES';caption='Déplacez les deux poignées : coupe-bas et coupe-haut. Profil pédagogique ; résonance et pente non simulées.';
  }else if(n.algorithm==='resonator'||n.algorithm==='resochord'){
   picture=Array.from({length:4},(_,i)=>{const x=n.algorithm==='resonator'&&i===0?freqX(v('Voice 1 Resonance'),55,1750):160+i*140;return path(`M${x-45} 190Q${x-15} 185 ${x} 48Q${x+15} 185 ${x+45} 190`)+text(x,218,`VOIX ${i+1}`,'text-anchor="middle"');}).join('')+(n.algorithm==='resonator'?handle('Voice 1 Resonance',freqX(v('Voice 1 Resonance'),55,1750),48,'x',true):'');
   title='QUATRE RÉSONATEURS';caption='Voix en parallèle. Positions non renseignées illustratives ; le graphique ne calcule pas la réponse du DSP.';
  }else{picture=path(wave(t=>n.algorithm==='phaser'?-.7+1.3*Math.pow(Math.sin(t*Math.PI*6),12):-.6+1.5*Math.pow(Math.sin(t*Math.PI*2),8),45,695,115,65));title=n.algorithm==='phaser'?'FILTRES / RÉINJECTION / MODULATION':'BANDES GAUCHE / DROITE';caption='Architecture illustrée. Sélectionnez un paramètre ci-dessous pour vérifier son domaine et sa disponibilité.';}
 }else if(family==='delay'){
  const times=c.filter(x=>x.unit==='ms'),max=times[0]?.max??1350;
  picture=line(45,173,695,173,'signal')+times.map((d,i)=>{const x=45+650*read(n,d)/max,y=55+(i%2)*27;return line(x,y,x,173,'signal')+handle(d.label,x,y)+text(x,y-13,`${read(n,d)} ms`,'text-anchor="middle"')+text(x,198,`T${i+1}`,'text-anchor="middle"');}).join('');
  if(!times.length)picture+=path('M680 65H100L125 47M100 65L125 83')+text(380,112,'SEGMENTS INVERSÉS','text-anchor="middle"');
  title=n.algorithm==='delay-reverse'?'LECTURE REVERSE':`CHRONOLOGIE · ${times.length} ${times.length===1?'TAP':'TAPS'}`;
  caption=n.algorithm==='delay-dual-three'?'Deux lignes de trois taps : mémoire de retard partagée. Le total par ligne reste à valider ; cette esquisse ne certifie pas les combinaisons.':'Déplacez les taps pour modifier les temps locaux. Aucun audio ni niveau de retour mesuré.';
  picture+=text(45,220,'0')+text(695,220,`${max} ms`,'text-anchor="end"');
 }else if(family==='reverb'){
  const decayControl=c.find(x=>x.label==='Decay Time'&&x.manualStatus!=='unconfirmed'),x=decayControl?45+650*norm('Decay Time'):400;
  picture=Array.from({length:9},(_,i)=>line(65+i*14,145-i%3*18,65+i*14,190,'reflection')).join('')+path(`M195 62C${Math.max(230,x)} 73 ${Math.max(270,x)} 178 695 190`)+text(65,38,'PREMIÈRES RÉFLEXIONS')+text(430,38,'DÉCLIN')+handle('Decay Time',x,80)+text(45,220,'0')+text(695,220,decayControl?`${decayControl.max} ${decayControl.unit}`:'schéma non gradué','text-anchor="end"');
  title=n.algorithm==='reverb-simple'?'ESPACE / DÉCLIN':'ROOM / COLOR / DECAY';caption='Forme illustrative de la réverbération ; ni réponse impulsionnelle mesurée ni émulation du M5000.';
 }else if(family==='eq'){
  const count=n.algorithm==='eq-fixed'?5:4;
  picture=line(45,115,695,115)+path(wave(t=>{let z=0;for(let i=0;i<count;i++)z+=(v(`Gain ${i+1}`)??0)/12*Math.exp(-Math.pow((t-(i+1)/(count+1))*15,2));return z;},45,695,115,65))+Array.from({length:count},(_,i)=>{const x=45+650*(i+1)/(count+1),gain=v(`Gain ${i+1}`)??0;return handle(`Gain ${i+1}`,x,115-gain/12*90,'y')+text(x,219,`BANDE ${i+1}`,'text-anchor="middle"');}).join('');
  title=`ÉGALISEUR · ${count} BANDES`;caption='Poignées : gain ±12 dB. Fréquences et largeurs illustratives ; la courbe ne représente pas une réponse calculée du FireworX.';
 }else if(family==='dynamic'){
  const gate=n.algorithm==='gate',tx=100+norm('Threshold')*450,ty=190-(tx-60)*155/610,ratio=1+norm('Ratio')*16;picture=line(60,190,670,35)+path(gate?`M60 ${Math.min(230,ty+(tx-60)*ratio*.15)}L${tx} ${ty}L670 35`:`M60 190L${tx} ${ty}L670 ${ty-(670-tx)/ratio*.25}`)+line(tx,35,tx,200)+text(tx,220,'THRESHOLD','text-anchor="middle"')+text(600,95,gate?'EXPANSION':'RATIO');
  title=gate?'EXPANSION SOUS LE SEUIL':n.algorithm==='soft-compressor'?'COMPRESSION RMS':'COMPRESSION DES CRÊTES';caption='Seuil et ratio commandent cette esquisse normalisée. Aucun niveau audio ni gain de réduction reçu ; aucune équivalence matérielle.';
 }else if(family==='formant'){
  const sy=190-150*norm('Start'),my=190-150*norm('Thru'),ey=190-150*norm('End');picture=path(`M90 ${sy}Q220 ${my-50} 360 ${my}T650 ${ey}`)+[['START',90,sy],['THRU',360,my],['END',650,ey]].map(([s,x,y])=>`<circle class="fixed-point" cx="${x}" cy="${y}" r="6"/>`+text(x,y+27,s,'text-anchor="middle"')).join('');
  title='TRAJECTOIRE DES VOYELLES';caption='Start → Thru → End ; Sweep parcourt la trajectoire. Les coordonnées sont illustratives tant que les valeurs ne sont pas documentées.';
 }else if(family==='distort'){
  picture=path(wave(t=>n.algorithm==='drive'?Math.tanh(2.8*Math.sin(t*Math.PI*4)):Math.round(Math.sin(Math.floor(t*30)/30*Math.PI*4)*3)/3));
  title=n.algorithm==='drive'?'SATURATION / HARMONIQUES':'ALIASER + QUANTIZER';caption=n.algorithm==='drive'?'Drive, Body, Brightness et Smasher colorent le signal. Cette forme décrit le principe, pas l’algorithme propriétaire.':'Exemple visuel de sous-échantillonnage et de quantification. Aucun traitement audio dans le navigateur.';
 }else if(family==='vocode'){
  picture=`<rect class="diagram-box" x="270" y="64" width="200" height="105"/>`+text(370,109,n.algorithm==='vocoder'?'VOCODER':'RING MOD','text-anchor="middle"')+text(370,133,'MONO → PAN','text-anchor="middle"')+line(45,86,270,86,'signal')+line(45,151,270,151,'signal')+line(470,116,695,116,'signal')+text(45,69,n.algorithm==='ring-internal'?'PORTEUSE INTERNE':'CARRIER')+text(45,182,n.algorithm==='vocoder'?'VOX / CONTROL':'SIGNAL')+(n.algorithm==='ring-internal'?handle('Carrier',freqX(v('Carrier'),2,2000),201,'x',true):'');
  title=n.algorithm==='vocoder'?'DEUX RÔLES D’ENTRÉE':'BANDES SOMME / DIFFÉRENCE';caption='Le schéma conserve la distinction porteuse / contrôle ; Carrier Channel intervertit les rôles des canaux externes.';
 }else if(family==='synth'){
  const f=v('Freq')??200,cycles=2+Math.log2(Math.max(f,1))/3,shape=v('Curve');
  picture=path(wave(t=>n.algorithm==='noise'?Math.sin(t*423)*Math.sin(t*177):n.algorithm==='chaos'?Math.sin(t*cycles*8)*Math.sin(t*19+(v('Chaos')??40)/20):(shape==='Square'?Math.sign(Math.sin(t*Math.PI*2*cycles)):shape==='Saw'?2*((t*cycles)%1)-1:shape==='Triangle'?2/Math.PI*Math.asin(Math.sin(t*Math.PI*2*cycles)):Math.sin(t*Math.PI*2*cycles))))+(v('Freq')!==null?handle('Freq',freqX(f,n.algorithm==='chaos'?1:2,n.algorithm==='chaos'?1000:2000),205,'x',true):'');
  title=n.algorithm==='curve'?'OSCILLATEUR AUDIO':n.algorithm==='chaos'?'GÉNÉRATEUR DE CHAOS':'BRUIT BLANC / ROSE';caption='Forme pédagogique. La fréquence locale déplace la poignée ; aucun oscillateur audio ou générateur fractal matériel n’est émulé.';
 }else if(family==='pitch'){
  const count=n.algorithm==='pitch-dual'?2:1,pitch=v('Pitch 1')??0;
  picture=Array.from({length:count},(_,i)=>line(45,100+i*55,695,100+i*55)+text(50,88+i*55,`VOIX ${i+1}`)).join('')+handle('Pitch 1',370,115-pitch/2400*90,'y')+text(695,30,'+2400 cents','text-anchor="end"')+text(695,215,'−2400 cents','text-anchor="end"');title='TRANSPOSITION / VOIX';caption='Déplacez verticalement la première voix. Délai, panoramique et réinjection de chaque voix restent des paramètres distincts.';
 }else if(family==='chorus'){
  picture=path(wave(t=>Math.sin(t*Math.PI*(1+norm('Speed')*10)),45,695,90,10+norm('Depth')*40))+path(wave(t=>Math.sin(t*Math.PI*(1+norm('Speed')*10)+Math.PI*(.2+norm('LFO Phase'))),45,695,156,10+norm('Depth')*40),'signal-secondary')+text(45,33,'L')+text(45,215,'R');title=n.algorithm.includes('flanger')?'MODULATION / FEEDBACK':'MODULATION DES DÉLAIS';caption='Deux trajectoires illustrent les relations de phase ; vitesse, profondeur et déphasage ne sont pas des mesures reçues.';
 }else if(family==='pan'){
  const trem=n.algorithm.includes('tremolo');picture=path(wave(t=>Math.sin(t*Math.PI*(1+norm('Speed')*10)),45,695,90,10+norm('Depth')*40))+path(wave(t=>Math.sin(t*Math.PI*(1+norm('Speed')*10)+(trem?0:Math.PI)),45,695,156,10+norm('Depth')*40),'signal-secondary')+text(45,30,'L')+text(45,215,'R');title=trem?'VARIATION COMMUNE L / R':n.algorithm==='stereo-enhancer'?'ÉLARGISSEMENT STÉRÉO':'MOUVEMENT DU PANORAMIQUE';caption=trem?'Les niveaux gauche/droite suivent le même mouvement. Tracé illustratif, sans LFO matériel reçu.':'Les niveaux varient en opposition. Le mode Surround ajoute des relations de phase ; le tracé reste conceptuel.';
 }
 const grid=Array.from({length:7},(_,i)=>line(45+i*650/6,28,45+i*650/6,200)).join('')+Array.from({length:4},(_,i)=>line(45,35+i*55,695,35+i*55)).join('');
 return `<div class="algorithm-visual" data-visual="${n.id}"><div class="visual-header"><span>${title}</span><small>VUE PÉDAGOGIQUE · VALEURS LOCALES</small></div><svg viewBox="0 0 740 240" aria-label="${a.name} : ${title}" role="group">${grid}${picture}</svg><p>${caption}</p></div>`;
}
