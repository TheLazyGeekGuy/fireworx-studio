// P0-only partial FireworX transfers. Independent implementation of the documented
// container; opcode ambiguity resolved separately on the local hardware bench.
const prefix=id=>{if(!Number.isInteger(id)||id<0||id>127)throw new Error('Device ID invalide');return [240,0,32,31,id,64];};
const u14=v=>[v>>7,v&127];
function span(address,size){if(!Number.isInteger(address)||!Number.isInteger(size)||address<0||size<1||address+size>1366)throw new Error('Tranche hors du buffer FireworX');}
export function requestBufferPart(id,address,size){span(address,size);return Uint8Array.from([...prefix(id),70,0,0,...u14(address),...u14(size),247]);}
export function writeBufferPart(id,address,data){if(!(data instanceof Uint8Array))throw new Error('Octets requis');span(address,data.length);let sum=0;const encoded=[];for(const v of data){encoded.push(v>>4,v&15);sum+=v;}return Uint8Array.from([...prefix(id),33,0,0,...u14(address),...u14(data.length),...encoded,(-sum)&127,247]);}
export function parseBufferPart(bytes,expectedId){
 if(!(bytes instanceof Uint8Array)||bytes.length<17||bytes[0]!==240||bytes[1]!==0||bytes[2]!==32||bytes[3]!==31||bytes[5]!==64||bytes[6]!==33||bytes[7]!==0||bytes[8]!==0||bytes.at(-1)!==247)throw new Error('Réponse partielle P0 invalide');
 if(expectedId!==undefined&&bytes[4]!==expectedId)throw new Error('Device ID différent');
 if(bytes.slice(1,-1).some(v=>v>127))throw new Error('Octet MIDI invalide');
 const address=bytes[9]*128+bytes[10],size=bytes[11]*128+bytes[12];span(address,size);if(bytes.length!==15+2*size)throw new Error('Taille partielle incohérente');
 const data=new Uint8Array(size);let sum=0;for(let i=0;i<size;i++){const hi=bytes[13+2*i],lo=bytes[14+2*i];if(hi>15||lo>15)throw new Error('Demi-octet invalide');data[i]=hi*16+lo;sum+=data[i];}
 if(bytes.at(-2)!==((-sum)&127))throw new Error('Checksum partiel invalide');return {device:bytes[4],preset:0,address,size,data};
}
export function frameWithPayload(reference,payload){
 if(!(payload instanceof Uint8Array)||payload.length!==1366||reference.length!==2745||reference[6]!==32||reference[7]!==0||reference[8]!==0)throw new Error('Référence P0 complète requise');
 const frame=reference.slice();let sum=0;payload.forEach((v,i)=>{frame[11+2*i]=v>>4;frame[12+2*i]=v&15;sum+=v;});frame[frame.length-2]=(-sum)&127;return frame;
}
export function changedSpan(before,after){if(before.length!==after.length)throw new Error('Tailles différentes');let first=-1,last=-1;for(let i=0;i<before.length;i++)if(before[i]!==after[i]){if(first<0)first=i;last=i;}return first<0?null:{address:first,data:after.slice(first,last+1)};}
