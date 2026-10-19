// Explicit mutation allowlist. No MIDI, selectors, E/S, gain, feedback or resource choices.
import {controlsForDevice,readField} from './device-codec.js';
import {readModulation} from './modulation-codec.js';
export const randomizerGroupsVersion='fireworx-groups-r1';
export const normalizedFieldId=id=>id.replace(/\.inst\[\d+\]/,'.inst[*]');
const rules={
 gate:[['envelope','Seuil et enveloppe',/^exp_(threshold|ratio|attack|release)$/]],
 'soft-compressor':[['compression','Compression',/^soft_(threshold|ratio|release|knee)$/]],
 'hard-compressor':[['compression','Compression',/^hard_(threshold|ratio|attack|release)$/]],
 resonance:[['spectrum','Fréquences et résonances',/^(lo_cut_freq|hi_cut_freq|lo_resonance|hi_resonance)$/]],
 bandpass:[['bands','Fréquences et largeurs des bandes',/^band_[lr]_(freq|width)$/]],
 phaser:[['motion','Mouvement',/^(speed|tempo|depth|range)$/]],
 resonator:[['spectrum','Fréquences et filtres des voix',/^voice_(freq|hicut|locut|filter_pos)$/]],
 resochord:[['chord','Accord et filtres',/^rc_(freq|chord|locut)$/]],
 formant:[['vowels','Trajectoire des voyelles',/^(start_vowel|thru_vowel|end_vowel|sweep)$/],['color','Couleur',/^(brightness|resonance)$/]],
 drive:[['color','Grain et couleur',/^(drive|brightness|body|smasher)$/]],
 cruncher:[['spectrum','Filtrage',/^(in|out)_(lo|hi)_cut$/]],
 vocoder:[['spectrum','Filtres des trois signaux',/^voc_(out|vox|car)_(locut|hicut)$/]],
 'ring-external':[['spectrum','Filtres des bandes',/^rme_(low|upp|in1|in2)_(locut|hicut)$/]],
 'ring-internal':[['spectrum','Filtres des bandes',/^rmi_(low|upp|in)_(locut|hicut)$/]],
 curve:[['spectrum','Fréquence et filtres',/^curve_(freq|pw|locut|hicut)$/]],
 chaos:[['spectrum','Fréquence et filtres',/^chaos_(freq|amount|locut|hicut_rel)$/]],
 noise:[['spectrum','Filtres du bruit',/^noise_(locut|hicut)$/]],
 'pitch-single':[['voices','Accord et délais des voix',/^(pitch|delay|delay_tempo)$/]],
 'pitch-dual':[['voices','Accord et délais des voix',/^(pitch|delay|delay_tempo)$/]],
 'chorus-classic':[['motion','Modulation',/^cc_(speed|tempo|depth)$/]],
 'chorus-advanced':[['motion','Modulation et délai',/^ac_(speed|tempo|depth|lfo_phase|delay)$/]],
 'flanger-classic':[['motion','Modulation',/^cf_(speed|tempo|depth)$/]],
 'flanger-advanced':[['motion','Modulation et délai',/^af_(speed|tempo|depth|lfo_phase|delay)$/]],
 'delay-stereo':[['time','Temps et tempo',/^st_(time|tempo)$/],['spectrum','Filtres',/^st_(locut|hicut)$/]],
 'delay-dual':[['time','Temps et tempos L/R',/^dual_(time|tempo)_[lr]$/],['spectrum','Filtres L/R',/^dual_(locut|hicut)_[lr]$/]],
 'delay-dual-three':[['time','Temps et tempos des taps',/^tt_(time|tempo)$/],['spectrum','Filtres des taps',/^tt_(locut|hicut)$/]],
 'delay-one':[['time','Temps et tempo',/^one_(time|tempo)$/],['spectrum','Filtres',/^one_(locut|hicut)$/]],
 'delay-six':[['time','Temps et tempos des taps',/^six_(time|tempo)$/],['spectrum','Filtres des taps',/^six_(locut|hicut)$/]],
 'delay-reverse':[['spectrum','Filtres',/^rev_(locut|hicut)$/]],
 'reverb-simple':[['tail','Déclin et couleur',/^sim_(decay|predelay|color)$/]],
 'reverb-advanced':[['tail','Déclin et diffusion',/^adv_(decay|high_color|high_factor|low_color|low_factor|decay_start|diffuse|color|color_factor|predelay)$/]],
 'tremolo-simple':[['motion','Mouvement',/^trem_(speed|tempo|depth)$/]],
 'tremolo-advanced':[['motion','Mouvement',/^atrem_(speed|tempo|depth|pulsewidth|phase)$/]],
 'panner-simple':[['motion','Mouvement',/^pan_(speed|tempo)$/]],
 'panner-surround':[['motion','Mouvement et largeur',/^surr_(speed|tempo|pulsewidth|phase|width|center)$/]],
 'eq-fixed':[['spectrum','Fréquences et largeurs',/^(fixed_freq|shelf_slope|bell_bw)$/]],
 'eq-mod':[['spectrum','Fréquences et largeurs',/^(mod_freq|mod_width)$/]],
 // Stereo Enhancer has only E/S fields: no parameter variation is invented.
 'stereo-enhancer':[]
};
export function randomizerGroups(buffer,node){
 const fields=controlsForDevice(buffer,node).filter(f=>f.editable&&f.range&&!f.selector&&f.type!=='bits');
 return (rules[node.algorithm]??[]).map(([id,label,pattern])=>({id,label,fields:fields.filter(f=>pattern.test(f.fieldName))})).filter(g=>g.fields.length);
}
export function linkedGroup(buffer,node,group){
 return readModulation(buffer).some(l=>{
  if(!l.connected||l.destination.block!==node.blockTypeId||l.destination.instance!==node.instanceIndex)return false;
  // Unresolved endpoint locks the engine; known linked fields lock their entire coherent group.
  if(!l.destinationInfo?.field)return true;
  return group.fields.some(f=>f.fieldName===l.destinationInfo.field);
 });
}
export function groupValues(buffer,group){return Object.fromEntries(group.fields.map(f=>[normalizedFieldId(f.id),readField(buffer,f)]));}
