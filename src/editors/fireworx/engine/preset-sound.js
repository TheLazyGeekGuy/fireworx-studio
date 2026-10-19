import {decodeDeviceBuffer,controlsForDevice,readField,deviceMap} from './device-codec.js';
import {readModulation} from './modulation-codec.js';
// Semantic comparison after native recall or packed storage. Unknown and
// inactive bytes are explicitly outside this proof; callers validate addresses.
export function verifyPresetSound(sourceFrame,receivedFrame){
 const source=decodeDeviceBuffer(sourceFrame),received=decodeDeviceBuffer(receivedFrame,source.device);
 const differences=[],checks=[];
 const check=(id,a,b)=>{checks.push(id);if(a!==b)differences.push(id);};
 check('name',source.name,received.name);check('alphaText',source.alphaText,received.alphaText);
 for(let i=4;i<44;i++)check('text@'+i,source.payload[i],received.payload[i]);
 for(let i=44;i<=173;i++)check('routing@'+i,source.payload[i],received.payload[i]);
 for(const f of deviceMap.fields.filter(f=>f.documentId==='common'&&f.editable&&/^common\.nodes\[\d+\]/.test(f.id)&&source.cells.some(c=>c.type===f.instanceIndex+3)))check(f.id,readField(source,f),readField(received,f));
 for(const n of source.nodes){
  const r=received.nodes.find(r=>r.id===n.id);check(n.id+'.algorithm',n.algorithm,r?.algorithm);check(n.id+'.muted',n.muted,r?.muted);if(!r)continue;
  for(const f of controlsForDevice(source,n).filter(f=>f.editable))check(f.id,readField(source,f),readField(received,f));
 }
 // Internal modifiers are preset data; preserve their mapped values. Curve samples
 // past num_samples are deliberately excluded from this semantic verification.
 for(const f of deviceMap.fields.filter(f=>f.documentId==='modifiers'&&f.editable&&(!f.condition||source.payload[f.condition.offset]===f.condition.value))){const i=/curve_samples\[(\d+)\]/.exec(f.id);if(i&&Number(i[1])>=source.payload[1081])continue;check(f.id,readField(source,f),readField(received,f));}
 const a=readModulation(source),b=readModulation(received);for(let i=0;i<20;i++){check(`link${i}.connected`,a[i].connected,b[i].connected);if(a[i].connected)for(const k of ['source','destination','low','mid','high','slope','glide'])check(`link${i}.${k}`,JSON.stringify(a[i][k]),JSON.stringify(b[i][k]));}
 if(differences.length)throw Error('Preset non conforme sur les champs actifs : '+differences.slice(0,8).join(', '));
 return {verified:true,scope:'mapped-active-fields',checked:checks.length,unknownAndInactiveBytesVerified:false};
}
