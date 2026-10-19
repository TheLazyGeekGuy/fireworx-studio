// Pure bridge from a visible field to an established modulation destination.
import {controlsForDevice} from './device-codec.js';
import {modulationDestinations,readModulation,destinationKey,sourceKey,modulationSources,createModulation,assignModulation} from './modulation-codec.js';
export function destinationForField(buffer,node,field){
 if(!node?.algorithm||!field?.editable)return null;
 const id=field.id.replace(/\.(inst|variant)\[\d+\]/g,''),indices=[...id.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1])),element=indices.length?indices.at(-1):null;
 const ds=modulationDestinations(buffer).filter(d=>d.block===node.blockTypeId&&d.instance===node.instanceIndex&&d.field===field.fieldName&&(d.element??null)===element);
 return ds.length===1?ds[0]:null; // never guess ambiguous aliases, modifier/global targets or unsupported fields
}
export function fieldTargets(buffer,node){return controlsForDevice(buffer,node).flatMap(f=>{const d=destinationForField(buffer,node,f);return d?[{field:f,destination:d}]:[];});}
export const modulationBasis=buffer=>Array.from(buffer.payload).join(',');
export function modulationDescriptor(buffer,{source,slot}={}){
 if(slot!==undefined){const r=readModulation(buffer)[slot];if(!r?.connected||!r.sourceInfo||!r.destinationInfo)throw Error('Lien non décodé : conservez-le ou choisissez une source connue');return {schema:1,kind:'link',slot,basis:modulationBasis(buffer)};}
 const s=modulationSources.find(s=>sourceKey(s)===source);if(!s)throw Error('Source de modulation inconnue');return {schema:1,kind:'source',source,basis:modulationBasis(buffer)};
}
export function applyModulationTarget(buffer,descriptor,key){
 if(buffer.preset!==0)throw Error('Copie P0 requise pour affecter une modulation');
 if(descriptor?.schema!==1||descriptor.basis!==modulationBasis(buffer))throw Error('Le preset a changé pendant l’affectation ; recommencez');
 const dest=modulationDestinations(buffer).find(d=>destinationKey(d)===key);if(!dest)throw Error('Paramètre non assignable dans cette variante');
 if(descriptor.kind==='link'){
  const r=readModulation(buffer)[descriptor.slot];if(!r?.connected||!r.sourceInfo||!r.destinationInfo)throw Error('Lien indisponible');
  if(destinationKey(r.destinationInfo)===key)return buffer.payload.slice();
  return assignModulation(buffer,descriptor.slot,r.source,dest); // source + Low/Mid/High/Slope/Glide retained; ordinal rebuilt by device
 }
 if(descriptor.kind!=='source')throw Error('Affectation invalide');
 const source=modulationSources.find(s=>sourceKey(s)===descriptor.source);if(!source)throw Error('Source inconnue');
 const prior=readModulation(buffer).find(r=>r.connected&&(r.destinationInfo?destinationKey(r.destinationInfo):destinationKey(r.destination))===key);
 if(prior){if(sourceKey(prior.source)===descriptor.source)return buffer.payload.slice();return assignModulation(buffer,prior.slot,source,dest);}
 return createModulation(buffer,source,dest);
}
