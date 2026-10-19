// Pure offline tools. Intentionally no MIDI access or sender.
const header = [0xf0,0,0x20,0x1f];
function int(n,min,max,name) { if(!Number.isInteger(n)||n<min||n>max) throw new Error(`${name}: entier ${min}–${max} requis`); return n; }
const u14 = n => [n>>7,n&127];
export function validPreset(n) { return Number.isInteger(n)&&(n===0||(n>=1&&n<=400)||(n>=2049&&n<=2248)||(n>=4097&&n<=4896)); }
export function requestExpanded(deviceId,preset=0) {
 int(deviceId,0,127,'Device ID');
 if(!validPreset(preset)) throw new Error('Adresse de preset hors des plages documentées');
 return Uint8Array.from([...header,deviceId,0x40,0x45,...u14(preset),0xf7]);
}
// TC Electronic MIDI specification V1.00 (SW2.00+), p.3: changes the running
// preset and physical Recall selection; never a query or persistent STORE.
export function recallPreset(deviceId,preset) {
 const frame=requestExpanded(deviceId,preset);if(preset===0)throw Error('Mémoire Factory, User ou Carte requise');frame[6]=0x44;return frame;
}
export const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
export function parseExpanded(bytes,expectedDevice) {
 if(!(bytes instanceof Uint8Array)||bytes.length<8||bytes.length>32782) throw new Error('Taille de trame invalide');
 if(header.some((b,i)=>bytes[i]!==b)||bytes[5]!==0x40||bytes.at(-1)!==0xf7) throw new Error('En-tête FireworX invalide');
 if(Array.from(bytes.slice(1,-1)).some(b=>b>127)) throw new Error('Octet de données non MIDI 7 bits');
 if(expectedDevice!==undefined) {int(expectedDevice,0,127,'Device ID');if(bytes[4]!==expectedDevice)throw new Error('Device ID différent');}
 const type=bytes[6];
 if(bytes.length<10) throw new Error('Trame tronquée');
 const preset=bytes[7]*128+bytes[8];
 if(!validPreset(preset))throw new Error('Adresse de preset invalide');
 if(type===0x28) {
  if(bytes.length!==12)throw new Error('Longueur de réponse vide invalide');
  const count=bytes[9]*128+bytes[10], last=preset+Math.max(1,count)-1;
  if(!validPreset(last)|| (preset===0&&last!==0) || (preset<=400&&last>400) || (preset>=2049&&preset<=2248&&last>2248))throw new Error('Plage vide hors banque');
  return {type:'empty',device:bytes[4],preset,count};
 }
 if(type!==0x20)throw new Error(`Type 0x${type.toString(16)} non décodé : variantes contradictoires conservées brutes`);
 if(bytes.length<13)throw new Error('Données tronquées');
 const size=bytes[9]*128+bytes[10];
 if(bytes.length!==13+2*size)throw new Error('Longueur incohérente avec Size');
 const payload=new Uint8Array(size); let sum=0;
 for(let i=0;i<size;i++) {const hi=bytes[11+2*i],lo=bytes[12+2*i];if(hi>15||lo>15)throw new Error('Demi-octet invalide');payload[i]=hi*16+lo;sum+=payload[i];}
 if(bytes.at(-2)!==((-sum)&127))throw new Error('Checksum invalide');
 return {type:'expanded-envelope',device:bytes[4],preset,size,payload,
  warning:'Enveloppe valide. Offsets des paramètres et structure du routage inconnus ; aucun paramètre extrait.'};
}
