import {controlsForDevice} from './device-codec.js';
import {readModulation,modulationDestinations,destinationKey,linkLabels} from './modulation-codec.js';
import {performanceKinds,validatePerformanceProfile} from './performance-profile.js';
import {findAlgorithm,findFamily} from './catalog.js';
export const performanceKind=source=>source.cat===20&&source.sub===0?'alpha':source.cat===21&&source.sub>=0&&source.sub<8?`ext${source.sub+1}`:null;
export function performanceBindings(buffer,profile){
 validatePerformanceProfile(profile);const links=readModulation(buffer).filter(r=>r.connected),destinations=modulationDestinations(buffer);
 return buffer.nodes.filter(n=>n.row<buffer.rows).flatMap(n=>controlsForDevice(buffer,n).filter(f=>f.editable).map(f=>{
  const element=/\[(\d+)\]$/.exec(f.id),dest=destinations.find(d=>d.block===n.blockTypeId&&d.instance===n.instanceIndex&&d.field===f.fieldName&&(d.element==null?!element:d.element===Number(element?.[1]))),link=dest&&links.find(l=>destinationKey(l.destination)===destinationKey(dest)),kind=link&&performanceKind(link.source),cc=kind?profile[kind]??null:null;
  const ready=!!kind&&profile.confirmed===true&&cc!==null;
  return {field:f.id,label:`${findFamily(n.algorithm).name} ${n.instanceIndex+1} · ${findAlgorithm(n.algorithm).name} · ${f.displayLabel}`,destination:dest??null,link:link??null,kind:kind??null,cc,channel:profile.channel,ready,status:ready?'CC configuré · résultat audio à valider':kind?'Profil CTRL à renseigner / confirmer':link?'Modulateur interne ou source non CC':dest?'Modulable · aucun lien CC':'Valeur de base SysEx · destination continue non établie'};
 }));
}

// Source input, device CTRL destination and preset links are independent stages.
export function performanceTargets(buffer){
 const result=Object.fromEntries(performanceKinds.map(kind=>[kind,[]]));
 if(buffer)for(const link of readModulation(buffer).filter(r=>r.connected)){
  const kind=performanceKind(link.source);if(kind)result[kind].push({slot:link.slot,label:linkLabels(buffer,link).destination,decoded:!!link.destinationInfo});
 }
 return result;
}
