// Build donors from the user's imported/read copies. No bundled private Factory dumps or research URLs.
import {decodeDeviceBuffer} from './device-codec.js';
import {randomizerGroups,groupValues,randomizerGroupsVersion} from './randomizer-groups.js';
import {deviceDspEstimate} from './dsp-model.js';
import {sha256} from './randomizer.js';
export async function localCorpus(frames,signal){
 const donors=[],presets=[],seen=new Set();
 for(const frame of frames.slice(0,400)){
  signal?.throwIfAborted();let b;try{b=decodeDeviceBuffer(Uint8Array.from(frame));}catch{continue;}
  const hash=await sha256(Uint8Array.from(frame));if(seen.has(hash))continue;seen.add(hash);
  const preset=presets.length+1;presets.push({preset,name:b.name,sha256:hash,frame:Array.from(frame),estimatedDSP:deviceDspEstimate(b).estimated});
  for(const node of b.nodes.filter(n=>n.row<b.rows))for(const group of randomizerGroups(b,node))donors.push({id:`${hash}|${node.id}|${group.id}`,preset,presetSha256:hash,algorithm:node.algorithm,instance:node.instanceIndex,group:group.id,values:groupValues(b,group)});
 }
 const hash=await sha256(new TextEncoder().encode(JSON.stringify(presets.map(p=>p.sha256))));
 const corpus={kind:'fireworx-randomizer-donors',schema:1,groupsVersion:randomizerGroupsVersion,captureManifestSha256:hash,corpusProfileSha256:hash,sourceHashes:{},presets,donors};
 return {...corpus,indexSha256:await sha256(new TextEncoder().encode(JSON.stringify(corpus)))};
}
