// Pure, independently implemented edit-buffer codec. No DOM, ports or file access.
import {deviceMap} from './device-map.js';
import {parseExpanded} from './protocol.js';
export {deviceMap};
export const fieldById=new Map(deviceMap.fields.map(f=>[f.id,f]));
const scalar=(p,f)=>{const o=f.offset,u=f.width===2?p[o]*256+p[o+1]:p[o];return f.type==='bits'?(p[o]>>f.bits[0])&((1<<(f.bits[1]-f.bits[0]+1))-1):f.type==='i8'&&u>=128?u-256:f.type==='i16be'&&u>=32768?u-65536:u;};
export const readField=(buffer,field)=>scalar(buffer.payload??buffer,field);
const active=(f,p)=>!f.condition||p[f.condition.offset]===f.condition.value;
export function decodeDeviceBuffer(frame,expectedDevice){
 const parsed=parseExpanded(frame,expectedDevice);
 if(parsed.type!=='expanded-envelope'||parsed.size!==1366||parsed.payload[0]!==0||parsed.payload[1]!==0xce)throw new Error('Format FireworX 1366 octets / 00 CE requis');
 const p=parsed.payload,cells=[],nodes=[],seen=new Set(),unknown=[];
 for(let col=0;col<8;col++)for(let row=0;row<8;row++){
  const offset=44+col*16+row*2,type=p[offset],instance=p[offset+1];
  const cell={col,row,type,instance};cells.push(cell);
  if(type<7||type>18){if(type>18)unknown.push(cell);continue;}
  const matches=Object.entries(deviceMap.algorithms).filter(([,a])=>{
   if(a.blockTypeId!==type)return false;
   if(!deviceMap.fields.some(f=>f.documentId===a.document&&f.instanceIndex===instance))return false;
   const selector=a.selector&&fieldById.get(a.selector.replace('.inst[0]',`.inst[${instance}]`));
   return a.variant===null||!!selector&&readField(p,selector)===a.variant;
  });
  const algorithm=matches.length===1?matches[0][0]:null,id=`hw-${type}-${instance}`;
  if(!algorithm){unknown.push(cell);continue;}
  cell.node=id;
  if(!seen.has(id)){seen.add(id);nodes.push({id,algorithm,blockTypeId:type,instanceIndex:instance,col,row,muted:!!(p[171+type]&(1<<instance)),values:{}});}
 }
 const text=(start,n)=>Array.from(p.slice(start,start+n),b=>b>=32&&b<127?String.fromCharCode(b):'�').join('').trimEnd();
 // Grid size hides dormant rows; their cells and engine records remain intact.
 const rows=Math.max(1,Math.min(8,p[172]));
 return {...parsed,frame:frame.slice(),name:text(4,20),alphaText:text(24,20),cells,nodes,rows,unknown};
}
export function controlsForDevice(buffer,node){
 if(node.scopePrefix)return deviceMap.fields.filter(f=>f.id.startsWith(node.scopePrefix)&&f.type!=='packed'&&f.sourceStatus==='verified'&&(f.range||f.values)).map(f=>({...f,displayLabel:f.label}));
 const a=deviceMap.algorithms[node.algorithm];
 return deviceMap.fields.filter(f=>f.documentId===a.document&&f.instanceIndex===node.instanceIndex&&!f.selector&&active(f,buffer.payload)&&f.type!=='packed'&&
  (f.editable||Object.hasOwn(a.labels,f.id.replace(/\.inst\[\d+\]/,'.inst[0]'))))
  .map(f=>({...f,displayLabel:a.labels[f.id.replace(/\.inst\[\d+\]/,'.inst[0]')]??f.label,
   editable:f.editable&&(!f.values||Object.keys(f.values).some(k=>/^\d+$/.test(k)))}));
}
// A received value is representable when it is in the field's domain or is its documented Off sentinel.
export const representableValue=(f,v)=>f.offValue!==null&&f.offValue!==undefined&&v===f.offValue||!(f.values&&!Object.hasOwn(f.values,String(v)))&&!(f.range&&(v<f.range[0]||v>f.range[1]));
export function formatDeviceValue(f,v){
 if(f.offValue!==null&&v===f.offValue)return f.enc==='loghz'?'Off':'Off / Flat';
 if(f.values&&Object.hasOwn(f.values,String(v)))return String(f.values[v]);
 const table=deviceMap.tables[f.table];if(table?.texts[v-table.index_range[0]]!==undefined)return table.texts[v-table.index_range[0]];
 const curve=deviceMap.curves[f.curve];
 if(curve?.steps_per_oct){const hz=curve.min_hz*2**(v/curve.steps_per_oct);return `${Number(hz.toPrecision(4))} Hz ≈`;}
 const divisor={'01db':10,'01ms':10,'01s':10,tenths:10,hundredths:100,octwidth:100,octbw:10}[f.enc];
 if(divisor)return `${v/divisor} ${f.unit??''}`.trim();
 if(f.enc==='pan_i8')return v===0?'Centre':`${v<0?'L':'R'}${Math.abs(v)}`;
 if(f.enc==='pan_uni')return v===50?'Centre':`${v<50?'L':'R'}${Math.abs(v-50)}`;
 if(f.enc==='pct_bipolar')return `${v*2-100} %`;
 if(f.enc==='tune_hz')return `${v+256} Hz`;
 if(['pct','db','ms','cents','raw','midi_note'].includes(f.enc))return `${v} ${f.unit??''}`.trim();
 return `${v} · valeur brute`;
}
export function editedPayload(buffer,changes){
 if(!(changes instanceof Map))throw new Error('Table de modifications requise');
 const p=buffer.payload.slice();
 for(const [id,v] of changes){
  const f=fieldById.get(id);
  if(!f?.editable||!active(f,buffer.payload)||!Number.isInteger(v)||v<f.range[0]||v>f.range[1]||f.values&&!Object.hasOwn(f.values,String(v)))throw new Error(`Champ ou valeur non autorisé : ${id}`);
  if(f.blockTypeId!==null&&!buffer.nodes.some(n=>n.blockTypeId===f.blockTypeId&&n.instanceIndex===f.instanceIndex))throw new Error('Instance absente du buffer reçu');
  const o=f.offset;
  if(f.type==='bits'){const [lo,hi]=f.bits,mask=((1<<(hi-lo+1))-1)<<lo;p[o]=(p[o]&~mask)|(v<<lo);}
  else if(f.width===2){p[o]=(v>>8)&255;p[o+1]=v&255;}
  else p[o]=v&255;
 }
 // No overlapping edits may silently overwrite another requested field.
 for(const [id,v] of changes)if(readField(p,fieldById.get(id))!==v)throw new Error('Modifications de champs incompatibles');
 return p;
}
export function encodeEditBuffer(buffer,changes){
 if(buffer.preset!==0)throw new Error('Seul le buffer temporaire P=0 peut être transmis');
 const p=editedPayload(buffer,changes),b=buffer.frame.slice();let sum=0;
 p.forEach((v,i)=>{b[11+2*i]=v>>4;b[12+2*i]=v&15;sum+=v;});b[b.length-2]=(-sum)&127;
 decodeDeviceBuffer(b,buffer.device);return b;
}
// Text lives in the temporary preset, separately from local library annotations.
export function editDeviceText(buffer,{name,alphaText}={}){
 const p=buffer.payload.slice();
 for(const [value,start] of [[name,4],[alphaText,24]]){
  if(value===undefined)continue;
  if(typeof value!=='string'||value.length>20||/[^\x20-\x7e]/.test(value))throw Error('Texte : 20 caractères ASCII imprimables maximum');
  p.set([...value.padEnd(20,' ')].map(c=>c.charCodeAt(0)),start);
 }
 return p;
}
export function samePayload(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
export function verifyEditReadback(buffer,changes,received){
 const expected=editedPayload(buffer,changes),diffs=[];
 received.payload.forEach((v,i)=>{if(v!==expected[i]&&!(i>=1131&&i<=1359&&(i-1131)%12===0))diffs.push(i);});
 if(received.device!==buffer.device||received.preset!==0||received.payload.length!==expected.length||diffs.length||[...changes].some(([id,v])=>readField(received,fieldById.get(id))!==v))throw new Error(`Relecture différente du résultat attendu${diffs.length?' @'+diffs.slice(0,8).join(','):''}`);
 return true;
}
