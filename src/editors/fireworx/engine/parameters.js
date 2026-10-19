import {findAlgorithm,controlsFor as documentedControls} from './catalog.js';

export function expandParameters(parameters){
 return parameters.flatMap(p=>{
  const m=p.match(/(\d+)–(\d+)/);
  if(m)return expandParameters(Array.from({length:Number(m[2])-Number(m[1])+1},(_,i)=>p.replace(m[0],String(Number(m[1])+i))));
  if(p.includes('Left–Right'))return expandParameters([p.replace('Left–Right','Left'),p.replace('Left–Right','Right')]);
  return [p];
 });
}
const choices={
 'reverb-simple:Type':['Room','Club','Hall','Church','Cathedral','Grand Hall','Fast Decay','Slow Decay','Plate','Spring'],
 'reverb-simple:Color':['Wool','Warm','Real','Clear','Bright','Crisp','Glass','Extreme'],
 'curve:Curve':['Sine','Triangle','Square','Saw'],
 'noise:Noise Type':['White','Pink'],
 'resonance:Order':['2','4'],
 'phaser:Order':['4','8','12'],
 'phaser:Range':['Low','High'],
 'soft-compressor:Knee Mode':['Soft','Hard']
};
const normalize=(id,label)=>id==='delay-six'?label.replace(/^Time (\d)$/,'Tap $1'):id==='delay-dual-three'?label.replace(/^Time (\d)$/,(_,x)=>`Line ${Math.floor((Number(x)-1)/3)+1} / Time ${(Number(x)-1)%3+1}`):label;
export function editableControlsFor(id){
 const a=findAlgorithm(id);if(!a)throw new Error('Algorithme inconnu');
 const known=documentedControls(id).map(c=>({...c,label:normalize(id,c.label),kind:'number',rangeKind:c.rangeKind??'manual-domain'}));
 return expandParameters(a.parameters).map(original=>{
  const label=original.replace(/\*$/,''),modulatable=original.endsWith('*');
  if(id==='reverb-advanced'&&['Decay Time','Decay Predelay'].includes(label))return {kind:'number',label,min:0,max:100,step:1,value:50,unit:'u. démo',page:'68–69',rangeKind:'normalized-demo',manualStatus:'unconfirmed',modulatable:false,comment:'Champ hérité du brouillon, non établi comme paramètre Advanced autonome dans le manuel. Valeur conservée pour relire les anciens fichiers ; édition désactivée.'};
  const documented=known.find(c=>c.label===label);
  if(documented)return {...documented,modulatable};
  if(choices[`${id}:${label}`])return {kind:'choice',label,options:choices[`${id}:${label}`],value:choices[`${id}:${label}`][0],page:a.page,unit:'',rangeKind:'manual-options',modulatable:false,comment:'Choix nommés dans le manuel ; aucun encodage MIDI n’est déduit.'};
  if(label==='Tempo')return {kind:'choice',label,options:['Ignored','16/1','8/1','4/1','2/1','1/1','1/2','1/4','1/8','1/16','1/32','1/4T','1/8T','1/16T','1/4D','1/8D','1/16D'],value:'Ignored',unit:'',page:a.page,rangeKind:'manual-options',modulatable:false,comment:'Subdivisions de tempo pour la maquette. Aucune horloge MIDI ni synchronisation audio active.'};
  if(/^(Mod Link|Carrier AGC|Golden Ratio|Phase Reversed)$/.test(label))return {kind:'choice',label,options:label==='Mod Link'?['Speed','Shape']:['Off','On'],value:label==='Mod Link'?'Speed':'Off',page:a.page,unit:'',rangeKind:'study-options',modulatable:false,comment:'Sélecteur local de maquette. Valeur et encodage matériels à valider.'};
  if(label==='LFO Curve')return {kind:'choice',label,options:['Sine','Triangle'],value:'Sine',page:a.page,unit:'',rangeKind:'study-options',modulatable:false,comment:'Formes locales de maquette, sans générateur audio.'};
  if((id==='resonator'&&/^Voice [2-4] Resonance$/.test(label))||(id==='pitch-dual'&&label==='Pitch 2')){
   const first=known.find(c=>c.label===(id==='resonator'?'Voice 1 Resonance':'Pitch 1'));
   return {...first,label,modulatable};
  }
  return {kind:'number',label,min:0,max:100,step:1,value:50,unit:'u. démo',page:a.page,rangeKind:'normalized-demo',modulatable,
   comment:'Échelle normalisée 0–100 pour tester le réglage. Ce domaine n’est pas celui du FireworX ; unités, limites et encodage restent à établir.'};
 });
}
export function validControlValue(control,v){return control.kind==='choice'?typeof v==='string'&&control.options.includes(v):typeof v==='number'&&Number.isFinite(v)&&v>=control.min&&v<=control.max;}
