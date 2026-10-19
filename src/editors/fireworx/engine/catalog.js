// Semantic source: TC Electronic FireworX FR Rev 2 / SW 2.00, printed pp. 22–23, 50–73.
// IDs below are application IDs. NONE is a MIDI address or manufacturer algorithm ID.
const a = (id, name, page, description, parameters) => ({id, name, page, description, parameters});
export const families = [
 {id:'dynamic', name:'Dynamic', max:3, dsp:'12–14', algorithms:[
  a('gate','Expander / Noise Gate','50–51','Atténue les signaux sous le seuil. Le taux infini transforme l’expanseur en porte de bruit.',['Threshold','Ratio','Attack','Release','Mix','In Level*','Out Level','LED Meter']),
  a('soft-compressor','Soft Compressor','51–52','Compresse le niveau moyen efficace ; attaque automatique et compensation de gain.',['Threshold','Ratio','Knee Mode','Release','Gain','In Level*','Out Level','LED Meter']),
  a('hard-compressor','Hard Compressor / Limiter','52','Réagit aux crêtes ; attaque réglable pour une compression plus franche.',['Threshold','Ratio','Attack','Release','Gain','Mix','In Level*','Out Level','LED Meter'])]},
 {id:'filter',name:'Filters',max:1,dsp:'11–45',algorithms:[
  a('resonance','Resonance','53','Associe coupe-bas et coupe-haut résonants. Le choix d’ordre modifie la pente : 12 ou 24 dB/octave.',['Order','Locut Freq*','Hicut Freq*','Lo Resonance*','Hi Resonance*','Mix*','In Level*','Out Level*']),
  a('bandpass','Bandpass','53–54','Sculpte des bandes passantes séparément à gauche et à droite. La description et le sélecteur du manuel divergent sur le nombre de bandes.',['Bands used','Band 1–2 / Left–Right Freq*','Band 1–2 / Left–Right Bandwidth*','Mix*','In Level*','Out Level*']),
  a('phaser','Phaser','54','Balaye des filtres et mélange le résultat au direct. Mod Link permet de remplacer le LFO interne par la matrice.',['Mod Link','Speed*','Tempo','Depth*','Order','Feedback Level*','Range','Mix*','In Level*','Out Level*']),
  a('resonator','Resonator','54–55','Quatre résonateurs en parallèle créent des harmoniques à partir de délais courts réinjectés.',['Voice 1–4 Resonance*','Voice 1–4 Feedback*','Voice 1–4 Filter Placement','Voice 1–4 Locut*','Voice 1–4 Highcut*','Voice 1–4 Level*','Voice 1–4 Pan*','Mix*','In Level*','Out Level*']),
  a('resochord','Resochord','55–56','Accorde quatre résonateurs sur un accord ; la fondamentale transpose l’ensemble.',['Freq*','Chord','Voice 1–4 Feedback*','Voice 1–4 Filter Placement','Voice 1–4 Locut*','Voice 1–4 Highcut*','Voice 1–4 Level*','Voice 1–4 Pan*','Mix*','In Level*','Out Level*'])]},
 {id:'formant',name:'Formant',max:1,dsp:'17–19',algorithms:[
  a('formant','Formant','56','Déplace le timbre sur une trajectoire de voyelles définie par Start, Thru et End.',['Start','Thru','End','Resonance*','Brightness*','Sweep*','Mix*','In Level*','Out Level*'])]},
 {id:'distort',name:'Distort',max:1,dsp:'12–17',algorithms:[
  a('drive','Drive','56–57','Saturation avec compensation de gain, coloration du grave et des aigus, et enrichissement harmonique.',['Drive*','Brightness*','Body*','Smasher*','Out Drive*','Mix*','In Level*','Out Level*']),
  a('cruncher','Cruncher','57','Combine aliasing et quantification réduite ; chaque contribution dispose de son propre niveau.',['Aliaser Factor*','Aliaser Level*','Quantize Grain Size*','Quantize Level*','In Locut*','In Hicut*','Out Locut*','Out Hicut*','Mix*','In Level*','Out Level*'])]},
 {id:'vocode',name:'Vocode',max:1,dsp:'33–46',algorithms:[
  a('vocoder','Vocoder','57–58','L’enveloppe de la voix filtre une porteuse. Deux entrées de rôles différents produisent une sortie mono panoramiquée.',['Carrier Chnl','Carrier AGC','AGC Maxgain','Output Pan*','Vox Locut*','Vox Highcut*','Carrier Locut*','Carrier Highcut*','Out Locut*','Out Highcut*','Mix*','In Level*','Out Level*']),
  a('ring-external','External Ring Modulator','58–59','Combine deux signaux et équilibre les bandes somme et différence de leurs fréquences.',['Carrier Chnl','Lower/Upper Band Balance*','Output Pan*','Carrier AGC','In 1–2 Locut*','In 1–2 Highcut*','Low/Up Locut*','Low/Up Highcut*','Mix*','In Level*','Out Level*']),
  a('ring-internal','Internal Ring Modulator','59–60','Génère sa porteuse sinusoïdale interne ; additionne les entrées gauche et droite pour le signal de contrôle.',['Carrier*','Lower/Upper Band Balance*','Output Pan*','In Locut*','In Highcut*','Low/Up Locut*','Low/Up Highcut*','Mix*','In Level*','Out Level*'])]},
 {id:'synth',name:'Synth',max:2,dsp:'14–16',algorithms:[
  a('curve','Curve Generator','60','Oscillateur audio carré, sinus, triangle ou dents de scie ; peut fournir la porteuse du vocoder.',['Freq*','Curve','Square PW*','Locut*','Highcut*','Mix*','In Level*','Out Level*']),
  a('chaos','Chaos Generator','60–61','Génération audio par formule fractale ; distincte des modulateurs de contrôle.',['Freq*','Chaos*','Locut*','Highcut*','Mix*','In Level*','Out Level*']),
  a('noise','Noise Generator','61','Source audio de bruit blanc ou rose, filtrable, notamment pour alimenter le vocoder.',['Noise Type','Locut*','Highcut*','Mix*','In Level*','Out Level*'])]},
 {id:'pitch',name:'Pitch',max:1,dsp:'17–20',algorithms:[
  a('pitch-single','Single Voice','61','Une voix transposée avec délai, panoramique et réinjection.',['Pitch 1*','Delay 1','Level 1*','Pan Position 1*','Feedback 1*','Mix*','In Level*','Out Level*']),
  a('pitch-dual','Dual Voice','61','Deux voix transposées indépendantes ; chaque réinjection transpose de nouveau le signal.',['Pitch 1–2*','Delay 1–2','Level 1–2*','Pan Position 1–2*','Feedback 1–2*','Mix*','In Level*','Out Level*'])]},
 {id:'chorus',name:'Chorus',max:2,dsp:'9–10',algorithms:[
  a('chorus-classic','Classic Chorus','61–62','Délai court modulé avec relation Golden Ratio entre vitesse et profondeur.',['Mod Link','Speed*','Tempo','Depth*','Mix*','In Level*','Out Level']),
  a('chorus-advanced','Advanced Chorus','62–63','Ajoute délai, déphasage, forme et phase du LFO au chorus.',['Mod Link','Speed*','Tempo','Depth*','Delay','Golden Ratio','Phase Reversed','LFO Curve','LFO Phase','Mix*','In Level*','Out Level*']),
  a('flanger-classic','Classic Flanger','63','Délai plus court avec réinjection ; une valeur négative inverse la phase de la boucle.',['Mod Link','Speed*','Tempo','Depth*','Feedback*','Mix*','In Level*','Out Level*']),
  a('flanger-advanced','Advanced Flanger','63–64','Expose le croisement des réinjections et les réglages détaillés du LFO.',['Mod Link','Speed*','Tempo','Depth*','Delay','Feedback*','Golden Ratio','Phase Reversed','Cross Feedback*','LFO Curve','LFO Phase','Mix*','In Level*','Out Level*'])]},
 {id:'delay',name:'Delay',max:2,dsp:'19–23',algorithms:[
  a('delay-stereo','Stereo','64–65','Même temps de délai sur les deux canaux en conservant la stéréo. Maximum documenté : 675 ms.',['Time','Tempo','Feedback*','Lowcut*','Highcut*','Mix*','In Level*','Out Level*']),
  a('delay-dual','Dual','65','Deux temps indépendants avec quatre chemins de réinjection. La somme des quatre réinjections est limitée à 100 %.',['Time 1–2','Tempo','Feedback 1→1*','Feedback 2→2*','Feedback 1→2*','Feedback 2→1*','Levels 1–2*','Pan 1–2*','Lowcut 1–2*','Highcut 1–2*','Mix*','In Level*','Out Level*']),
  a('delay-dual-three','Dual Three-Tap','65–66','Deux lignes de trois taps partagent la mémoire de retard ; ne pas proposer six délais maximaux indépendants.',['Line 1–2 / Time 1–3','Tempo','Line 1–2 / Feedback 1–3*','Line 1–2 / Levels 1–3*','Line 1–2 / Pan 1–3*','Line 1–2 / Lowcut 1–3*','Line 1–2 / Highcut 1–3*','Line Level 1–2*','Mix*','In Level*','Out Level*']),
  a('delay-one','One-Tap','66–67','Une répétition mono, panoramiquée ; retard maximal de 1350 ms.',['Time','Tempo','Feedback*','Pan Position*','Lowcut*','Highcut*','Mix*','In Level*','Out Level*']),
  a('delay-six','Six-Tap','67','Six prises sur une même ligne ; temps, niveaux, panoramiques et filtres par tap. Somme des réinjections limitée à 100 %.',['Tap 1–6','Tempo','Feedback 1–6*','Levels 1–6*','Pan Position 1–6*','Lowcut 1–6*','Highcut 1–6*','Mix*','In Level*','Out Level*']),
  a('delay-reverse','Reverse','67–68','Lit des segments inversés ; Grade définit la longueur, Trig commande arrêt/lecture ou redémarrage.',['Grade*','Pan*','Lowcut*','Highcut*','Trig (Start/Stop)*','Mix*','In Level*','Out Level*'])]},
 {id:'reverb',name:'Reverb',max:1,dsp:'39–44',algorithms:[
  a('reverb-simple','Simple','69–70','Réglage rapide de la même base de réverbération : type, déclin, pré-délai, niveau et couleur.',['Type','Decay Time','Predelay','Reverb Level','Color','Mix*','In Level*','Out Level*']),
  a('reverb-advanced','Advanced','68–69','Sépare premières réflexions et déclin : géométrie de pièce, couleurs et diffusion.',['Decay Time','Room Shape','Room Size','Reverb Level','High Color','High Factor','Low Color','Low Factor','Room Level','Room Color','Room Color Factor','Room Predelay','Decay Predelay','Decay Level','Diffuse','Decay Start','Mix','In Level*','Out Level*'])]},
 {id:'pan',name:'Pan',max:2,dsp:'4–7',algorithms:[
  a('tremolo-simple','Simple Tremolo','70–71','Module ensemble les niveaux gauche et droit.',['Speed*','Tempo','Depth*','Mix*','In Level*','Out Level*']),
  a('tremolo-advanced','Advanced Tremolo','70–71','Ajoute forme, largeur d’impulsion et phase du LFO au trémolo.',['Speed*','Tempo','Depth*','Curve','Pulsewidth*','LFO Phase','Mix*','In Level*','Out Level*']),
  a('panner-simple','Simple Panner','71–72','Fait varier les niveaux gauche et droit en sens opposés ; Mod Link peut donner la main à la matrice.',['Mod Link','Speed*','Tempo','Pan Center','Mix*','In Level*','Out Level*']),
  a('panner-surround','Surround Panner','71–72','Étend le panorama par relations de phase ; largeur et centre définissent l’espace.',['Speed*','Tempo','Curve','Pulsewidth*','LFO Phase','Pan Center','Width','Mix*','In Level*','Out Level*']),
  a('stereo-enhancer','Stereo Enhance','72','Élargit l’image stéréo avec de faibles retards.',['Mix*','In Level*','Out Level*'])]},
 {id:'eq',name:'EQ',max:1,dsp:'19–22',algorithms:[
  a('eq-fixed','Fixed Parametric','72','Cinq bandes stéréo : deux shelves et trois cloches. Les paramètres de bandes ne sont pas marqués modulables.',['Freq 1–5','Slope/BW 1–5','Gain 1–5','Mix*','In Level*','Out Level*']),
  a('eq-mod','Modulatable Parametric','72–73','Quatre bandes en cloche dont fréquence, largeur et gain sont accessibles dans la matrice.',['Freq 1–4*','BW 1–4*','Gain 1–4*','Mix*','In Level*','Out Level*'])]}
];
export const modifiers = ['Alpha Mod', ...Array.from({length:8},(_,i)=>`Ext ${i+1}`),'Pitch Detector','Envelope 1','Envelope 2','ADSR 1','ADSR 2','LFO 1 Out 1','LFO 1 Out 2','LFO 2 Out 1','LFO 2 Out 2','Freeform','Function 1','Function 2'];
// Audio generators: produce sound without an audio input. Manual FR p.60: « Le bloc de synthé
// contient trois types de générateurs » (courbe, chaos, bruit); MODULE-IO-PROFILES.json marks
// exactly these three wetInput "none-generator". The internal ring modulator generates only
// its carrier and still processes its input, so it is not listed.
export const generatorAlgorithms = Object.freeze(['curve','chaos','noise']);
export const isGenerator = id => generatorAlgorithms.includes(id);
export const findAlgorithm = id => families.flatMap(f=>f.algorithms).find(a=>a.id===id);
export const findFamily = id => families.find(f=>f.algorithms.some(a=>a.id===id));
// Documented physical domains only. Initial values are UI examples, not factory defaults.
const number = (label,min,max,step,value,unit,page,comment,modulatable=false) => ({label,min,max,step,value,unit,page,comment,modulatable});
export function controlsFor(id) {
 const algorithm=findAlgorithm(id);
 const mix = number('Mix',0,100,1,35,'%', '26','Équilibre direct / effet ; valeur locale de démonstration.', algorithm.parameters.includes('Mix*'));
 if(id==='resonance') return [
  number('Locut Freq',20,5000,1,160,'Hz','53','Coupe les fréquences basses sous cette fréquence.',true),
  number('Hicut Freq',150,15000,1,7200,'Hz','53','Coupe les fréquences hautes au-dessus de cette fréquence.',true),mix];
 if(id==='reverb-simple') return [number('Decay Time',0.01,20,0.01,2.4,'s','69–70','Durée du déclin de la réverbération.'),number('Predelay',-50,50,1,0,'','70','Offset autour de la valeur choisie automatiquement selon le type ; ce ne sont pas des millisecondes.'),mix];
 if(id==='curve') return [number('Freq',2,2000,1,220,'Hz','60','Fréquence de l’oscillateur audio, utilisable comme porteuse.',true),mix];
 if(id==='chaos') return [number('Freq',1,1000,1,80,'Hz','60','Vitesse de la formule récurrente.',true),number('Chaos',0,100,1,40,'%','60','Complexité du signal fractal.',true),mix];
 if(id==='resonator') return [number('Voice 1 Resonance',55,1750,1,220,'Hz','55','Fréquence du premier résonateur.',true),mix];
 if(id==='ring-internal') return [number('Carrier',2,2000,1,440,'Hz','59','Fréquence de la porteuse sinusoïdale interne.',true),mix];
 if(id==='pitch-single'||id==='pitch-dual') return [number('Pitch 1',-2400,2400,1,700,'cents','61','Transposition de la première voix.',true),mix];
 if(id.startsWith('delay-')&&id!=='delay-reverse') {
  const max=id==='delay-stereo'||id==='delay-dual'?675:1350;
  const count=id==='delay-six'?6:id==='delay-dual-three'?6:id==='delay-dual'?2:1;
  return [...Array.from({length:count},(_,i)=>({...number(count===1?'Time':`Time ${i+1}`,0,max,1,Math.round(max*(id==='delay-dual-three'?i%3+1:i+1)/(id==='delay-dual-three'?8:count+2)),'ms',id==='delay-stereo'?'64':id==='delay-dual'?'65':id==='delay-six'?'67':'66',`Maximum documenté ${max} ms. Borne basse 0 et pas de 1 ms choisis pour l’esquisse, à confirmer sur l’appareil.`),rangeKind:'study-bounded'})),mix];
 }
 if(id==='eq-fixed'||id==='eq-mod')return [...Array.from({length:id==='eq-fixed'?5:4},(_,i)=>number(`Gain ${i+1}`,-12,12,.1,[0,2,-3,1,0][i],'dB',id==='eq-fixed'?'72':'73',`Gain de la bande ${i+1}. Le placement fréquentiel du dessin est illustratif.`,id==='eq-mod')),mix];
 return algorithm.parameters.some(p=>p==='Mix'||p==='Mix*')?[mix]:[];
}
