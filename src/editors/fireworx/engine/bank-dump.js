// FireworX User bank dump (ticket #76). F2 p.2: SYXTYPE_USERBANKREQUEST 0x40, USERBANKHEADER 0x10,
// USERBANKDATAPACKET 0x11; F2 p.1: nibble pairs MS-first, checksum (-sum(data bytes))&0x7F.
// Pure ES module: no DOM, no port, no import, no sender. Read path only: one 8-byte request builder,
// a passive assembler timed by its caller, and an offline hypothesis tool. It deliberately contains no
// encoder for 0x10/0x11 (MIDI→User erases every User preset, F1 p.48) nor for any other frame.
const TC=[0xf0,0x00,0x20,0x1f],MODEL=0x40,HEADER=0x10,PACKET=0x11,EOX=0xf7;
export const userBankOpcodes=Object.freeze({request:0x40,header:HEADER,packet:PACKET});
export const packetDataBytes=64;
// Layout chosen by total length only. F2 p.2 lists ONE Packet ID byte: 6+1+1+128+1+1 = 138 bytes.
// A 14-bit ID (Ih Il, like Nh Nl) would give 139: accepted only as a flagged hypothesis, never mixed.
export const packetLayouts=Object.freeze({138:Object.freeze({name:'id7',idBytes:1,documented:true}),139:Object.freeze({name:'id14',idBytes:2,documented:false})});
export const rolloverRule='Identifiant 7 bits et N > 128 : position absolue = rang d’arrivée k, admise seulement si chaque identifiant vaut k mod 128 (aucun trou, aucun désordre ; seule la répétition immédiate octet pour octet est écartée comme doublon). Toute autre séquence est refusée et conservée brute.';
const device=id=>{if(!Number.isInteger(id)||id<0||id>127)throw new Error('Device ID : entier 0–127 requis');return id;};
const fault=(code,message)=>Object.assign(new Error(message),{code});
const h2=v=>v.toString(16).padStart(2,'0').toUpperCase();
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function toBytes(input){
 if(input instanceof Uint8Array)return input.slice();
 if(Array.isArray(input)&&input.every(v=>Number.isInteger(v)&&v>=0&&v<=255))return new Uint8Array(input);
 throw new TypeError('Trame MIDI : tableau d’octets requis');
}
function sevenBit(bytes){
 if(bytes.at(-1)!==EOX)throw fault('eox','Fin de SysEx F7 absente');
 for(let i=1;i<bytes.length-1;i++)if(bytes[i]>127)throw fault('not-7bit','Octet de données non MIDI 7 bits');
}
export function requestUserBank(deviceId){return Uint8Array.from([...TC,device(deviceId),MODEL,0x40,EOX]);}
export function classifyFrame(bytes,deviceId){
 device(deviceId);if(!(bytes instanceof Uint8Array)||!bytes.length)return {kind:'invalid'};
 if(bytes[0]!==0xf0)return {kind:'not-sysex'};
 if(bytes.length<8||TC.some((b,i)=>bytes[i]!==b)||bytes[5]!==MODEL)return {kind:'other-sysex'};
 if(bytes[4]!==deviceId)return {kind:'foreign-device',device:bytes[4],opcode:bytes[6]};
 return bytes[6]===HEADER?{kind:'header'}:bytes[6]===PACKET?{kind:'packet'}:{kind:'fireworx-other',opcode:bytes[6]};
}
export function parseUserBankHeader(bytes,deviceId){
 if(classifyFrame(bytes,device(deviceId)).kind!=='header')throw fault('not-header','En-tête de banque User 0x10 attendu');
 if(bytes.length!==10)throw fault('length',`En-tête de banque : 10 octets attendus, ${bytes.length} reçus`);
 sevenBit(bytes);return {device:bytes[4],count:bytes[7]*128+bytes[8]};
}
// Checksum mismatch is reported (checksumOk=false), not thrown, so the caller can keep the raw frame and
// test the alternative "running sum over the whole dump" reading of F2 p.1 as a diagnostic only.
export function parseUserBankPacket(bytes,deviceId){
 if(classifyFrame(bytes,device(deviceId)).kind!=='packet')throw fault('not-packet','Paquet de banque User 0x11 attendu');
 const layout=packetLayouts[bytes.length];
 if(!layout)throw fault('length',`Paquet de banque : ${bytes.length} octets ; seules 138 (F2, identifiant d’un octet) ou 139 (hypothèse 14 bits) sont reconnues`);
 sevenBit(bytes);
 const id=layout.idBytes===1?bytes[7]:bytes[7]*128+bytes[8],start=7+layout.idBytes,data=new Uint8Array(packetDataBytes);let sum=0;
 for(let i=0;i<packetDataBytes;i++){const hi=bytes[start+2*i],lo=bytes[start+2*i+1];if(hi>15||lo>15)throw fault('nibble','Demi-octet supérieur à 0x0F');data[i]=hi*16+lo;sum+=data[i];}
 const checksum=bytes.at(-2),expectedChecksum=(-sum)&127;
 return {device:bytes[4],layout:layout.name,documented:layout.documented,id,data,sum,checksum,expectedChecksum,checksumOk:checksum===expectedChecksum};
}
// Streaming, caller-timed reassembly. accept() never answers the device and never returns bytes to send.
export function createUserBankAssembler({deviceId=0,startedAt=0,maxPackets=16383}={}){
 device(deviceId);if(!Number.isInteger(maxPackets)||maxPackets<0||maxPackets>16383)throw new Error('maxPackets : entier 0–16383 requis');
 const raw=[],ignored={},duplicates=[],rejected=[],early=[],accepted=[],byId=new Map();
 let header=null,layout=null,mode=null,broken=null,lastAt=null,firstBankAt=null,completeAt=null,reordered=false,maxId=-1,running=0,result=null;
 const complete=()=>!!header&&!broken&&accepted.length===header.count;
 const reject=(arrival,code,message,extra={})=>{const r={arrival,code,message,...extra};rejected.push(r);return {status:'rejected',...r};};
 function place(p,arrival,at,frame){
  if(layout&&p.layout!==layout)return reject(arrival,'layout-mixed',`Paquet ${p.layout} après des paquets ${layout} : disposition mélangée refusée`,{id:p.id});
  layout??=p.layout;mode??=layout==='id14'||header.count<=128?'absolute':'sequence';
  let rec;
  if(mode==='absolute'){
   if(p.id>=header.count)return reject(arrival,'id-range',`Identifiant ${p.id} hors de 0–${header.count-1}`,{id:p.id});
   const prior=byId.get(p.id);
   if(prior){if(same(prior.frame,frame)){duplicates.push({arrival,id:p.id,of:prior.arrival,identical:true});return {status:'duplicate',id:p.id};}return reject(arrival,'id-conflict',`Identifiant ${p.id} reçu deux fois avec des données différentes`,{id:p.id,of:prior.arrival});}
   if(p.id<maxId)reordered=true;maxId=Math.max(maxId,p.id);rec={index:p.id,id:p.id,arrival,at,data:p.data,frame};byId.set(p.id,rec);
  }else{
   if(broken)return reject(arrival,'sequence-broken','Séquence modulo 128 déjà rompue : position absolue indéterminable',{id:p.id});
   const k=accepted.length,last=accepted.at(-1);
   if(last&&p.id===last.id&&same(last.frame,frame)){duplicates.push({arrival,id:p.id,of:last.arrival,identical:true});return {status:'duplicate',id:p.id};}
   if(k>=header.count)return reject(arrival,'surplus',`Paquet au-delà des ${header.count} annoncés`,{id:p.id});
   if(p.id!==k%128){broken={arrival,position:k,expectedId:k%128,receivedId:p.id};return reject(arrival,'sequence-break',`Rebouclage : identifiant ${k%128} attendu en position ${k}, ${p.id} reçu`,{id:p.id});}
   rec={index:k,id:p.id,arrival,at,data:p.data,frame};
  }
  accepted.push(rec);if(complete())completeAt=at;
  return {status:'packet',index:rec.index,id:p.id,received:accepted.length,expected:header.count};
 }
 function accept(input,at=null){
  if(result)throw new Error('Assembleur de banque clos');
  const bytes=toBytes(input),arrival=raw.length,c=classifyFrame(bytes,deviceId);raw.push({arrival,at,kind:c.kind,bytes});lastAt=at;
  if(c.kind!=='header'&&c.kind!=='packet'){ignored[c.kind]=(ignored[c.kind]??0)+1;return {status:'ignored',kind:c.kind};}
  firstBankAt??=at;
  if(c.kind==='header'){
   let h;try{h=parseUserBankHeader(bytes,deviceId);}catch(e){return reject(arrival,e.code,e.message,{length:bytes.length});}
   if(header){if(h.count===header.count){duplicates.push({arrival,kind:'header',of:header.arrival,identical:true});return {status:'duplicate',kind:'header'};}return reject(arrival,'header-conflict',`Deuxième en-tête : ${h.count} paquets annoncés au lieu de ${header.count}`);}
   if(h.count>maxPackets)return reject(arrival,'count-range',`${h.count} paquets annoncés, limite ${maxPackets}`);
   header={count:h.count,arrival,at};if(!h.count)completeAt=at;
   let last=null;for(const e of early.splice(0)){const r=place(e.p,e.arrival,e.at,e.bytes);if(r.status==='rejected')last??=r;}
   if(complete())completeAt=at;
   return last??{status:'header',expected:h.count,received:accepted.length};
  }
  let p;try{p=parseUserBankPacket(bytes,deviceId);}catch(e){return reject(arrival,e.code,e.message,{length:bytes.length});}
  running+=p.sum;
  if(!p.checksumOk)return reject(arrival,'checksum',`Checksum de paquet invalide : 0x${h2(p.checksum)} reçu, 0x${h2(p.expectedChecksum)} attendu`,{id:p.id,runningSumRuleMatches:p.checksum===((-running)&127)});
  if(!header){early.push({p,arrival,at,bytes});return {status:'buffered',id:p.id};}
  return place(p,arrival,at,bytes);
 }
 function finish(stopReason='appelant'){
  if(result)return result;
  const N=header?.count??null,done=complete(),conflict=rejected.find(r=>['id-conflict','header-conflict','layout-mixed','sequence-break','count-range'].includes(r.code));
  let status,reason,missing=null;
  // A conflict refuses the assembly even if every id was eventually seen: the right copy is unknown.
  if(conflict){status='refused';reason=`Assemblage refusé : ${conflict.message}`;}
  else if(done){status='complete';reason=`${N} paquets reçus sur ${N} annoncés`;missing=[];}
  else if(!header){status='incomplete';reason=accepted.length+early.length?'Paquets reçus sans en-tête 0x10 : nombre annoncé inconnu':'Aucune trame de banque reçue';}
  else{status='incomplete';missing=mode==='sequence'?Array.from({length:N-accepted.length},(_,i)=>accepted.length+i):Array.from({length:N},(_,i)=>i).filter(i=>!byId.has(i));reason=`${accepted.length} paquets admis sur ${N} annoncés`;}
  const ordered=accepted.slice().sort((a,b)=>a.index-b.index);let decoded=null;
  if(status==='complete'){decoded=new Uint8Array(N*packetDataBytes);ordered.forEach(r=>decoded.set(r.data,r.index*packetDataBytes));}
  const bankFrames=raw.filter(r=>r.kind==='header'||r.kind==='packet'),bankSyx=new Uint8Array(bankFrames.reduce((n,r)=>n+r.bytes.length,0));
  bankFrames.reduce((o,r)=>{bankSyx.set(r.bytes,o);return o+r.bytes.length;},0);
  result=Object.freeze({status,reason,stopReason,deviceId,expected:N,layout,layoutDocumented:layout?layout==='id7':null,mode,
   rollover:{needed:N!==null&&N>128&&layout!=='id14',rule:rolloverRule,broken},
   received:ordered.map(r=>r.index),receivedCount:accepted.length,missing,duplicates,rejected,ignored,reordered,
   headerFirst:header?!raw.some(r=>r.kind==='packet'&&r.arrival<header.arrival):null,
   timing:{startedAt,firstBankAt,completeAt,lastAt},packets:accepted.map(({index,id,arrival,at})=>({index,id,arrival,at})),
   decoded,decodedBytes:decoded?.length??0,rawFrames:raw,bankSyx});
  return result;
 }
 return {accept,finish,
  get done(){return complete();},
  get failed(){return rejected.length>0;},
  silentFor:now=>now-(lastAt??startedAt),
  get state(){return {expected:header?.count??null,received:accepted.length,buffered:early.length,complete:complete(),rejected:rejected.length,duplicates:duplicates.length,layout,mode,lastAt};}};
}
// ---- Offline hypothesis tool. Nothing below is a manufacturer layout. ----
// Secondary, reverse-engineered source (sgorpi CtrlrX, doc/FireworX_packed_bank_format.md, commit f5db5406):
// stream magic FE ED 12 34, records whose first 44 bytes equal expanded offsets 0–43 (00 CE, internal index
// BE16 with User = 400–599, name 20, Alpha text 20), stored in device order. Our User 1 GET 0x45 capture
// carries 01 90 (= 400) at expanded @2–3, consistent with that reading. Everything here stays a proposal.
const printable=v=>v>=32&&v<=126;
const text=(b,s,n)=>Array.from(b.subarray(s,s+n),v=>printable(v)?String.fromCharCode(v):'·').join('').trimEnd();
export function scanPackedRecords(stream){
 if(!(stream instanceof Uint8Array))throw new TypeError('Flux compacté : Uint8Array requis');
 const records=[];
 for(let i=0;i+44<=stream.length;i++){
  if(stream[i]!==0x00||stream[i+1]!==0xce)continue;
  const index=stream[i+2]*256+stream[i+3];if(index<400||index>599)continue;
  if(!printable(stream[i+4])||stream[i+4]===32)continue;let ok=true;for(let j=4;j<24;j++)if(!printable(stream[i+j])){ok=false;break;}
  if(ok)records.push({offset:i,index,slot:index-399,name:text(stream,i+4,20),alpha:text(stream,i+24,20)});
 }
 return records;
}
// Header inventory only: the variable-length packed parameter bodies are not decoded.
// Ambiguous duplicate slots refuse the inventory instead of inventing preset boundaries.
export function userBankInventory(result){
 if(result?.status!=='complete'||!(result.decoded instanceof Uint8Array))throw Error('Dump User complet et vérifié requis');
 const p=result.decoded;if(p.length<64||![254,237,18,52].every((v,i)=>p[i]===v)||p[8]*256+p[9]!==200)throw Error('Conteneur User non reconnu ; original brut conservé');
 const records=scanPackedRecords(p).filter(r=>r.offset>=64),seen=new Set();
 for(const r of records){if(seen.has(r.slot))throw Error(`En-têtes ambigus pour User ${r.slot} ; aucune occupation déduite`);seen.add(r.slot);}
 return {kind:'fireworx-packed-user-headers',parametersDecoded:false,emptySlotsInferred:false,slotCount:200,records:records.map(r=>({...r,preset:2048+r.slot})),packedBytes:p.length,warning:'Noms et emplacements expérimentaux ; les paramètres sont lus par GET individuel. Une signature absente ne prouve pas un emplacement vide.'};
}
export function decodeUserBankFrames(frames,deviceId=0){
 const assembler=createUserBankAssembler({deviceId});for(const frame of frames)assembler.accept(Uint8Array.from(frame));const result=assembler.finish('offline-import');return {result,inventory:userBankInventory(result)};
}
function findAll(hay,needle){const hits=[];if(!needle.length)return hits;outer:for(let i=0;i+needle.length<=hay.length;i++){for(let j=0;j<needle.length;j++)if(hay[i+j]!==needle[j])continue outer;hits.push(i);}return hits;}
// A seed window must not be a constant run; sparse windows (a routing grid is mostly zeros) stay usable.
const informative=(b,s,n)=>new Set(b.subarray(s,s+n)).size>=2;
const windowKey=(b,s,n)=>String.fromCharCode(...b.subarray(s,s+n));
function correlatedRuns(payload,span,{window,minRun,maxHits,from}){
 const index=new Map(),seen=new Set(),runs=[];let saturated=0;
 for(let q=0;q+window<=span.length;q++){if(!informative(span,q,window))continue;const k=windowKey(span,q,window),list=index.get(k);if(!list)index.set(k,[q]);else if(list.length<=maxHits)list.push(q);}
 for(let o=from;o+window<=payload.length;o++){
  if(!informative(payload,o,window))continue;const list=index.get(windowKey(payload,o,window));if(!list)continue;if(list.length>maxHits){saturated++;continue;}
  for(const q of list){
   let a=o,b=q;while(a>from&&b>0&&payload[a-1]===span[b-1]){a--;b--;}
   if(seen.has(a+':'+b))continue;seen.add(a+':'+b);
   let n=0;while(a+n<payload.length&&b+n<span.length&&payload[a+n]===span[b+n])n++;
   if(n>=minRun)runs.push({expanded:a,packed:b,length:n});
  }
 }
 return {runs:runs.sort((x,y)=>x.packed-y.packed||x.expanded-y.expanded),saturated};
}
function covered(runs){const marks=new Set();for(const r of runs)for(let i=0;i<r.length;i++)marks.add(r.expanded+i);return marks.size;}
export function proposePresetSplit(stream,presets=[],{window=8,minRun=12,maxHits=64,maxRuns=64}={}){
 if(!(stream instanceof Uint8Array))throw new TypeError('Flux compacté : Uint8Array requis');
 if(!Array.isArray(presets))throw new TypeError('Presets étendus : tableau {slot,payload} requis');
 for(const p of presets)if(!Number.isInteger(p?.slot)||p.slot<1||p.slot>200||!(p.payload instanceof Uint8Array)||p.payload.length<44)throw new Error('Preset étendu : slot User 1–200 et payload d’au moins 44 octets requis');
 const records=scanPackedRecords(stream),magic=Array.from(stream.subarray(0,4),h2).join(' ');
 const matched=presets.map(p=>{
  const payload=p.payload,expectedIndex=399+p.slot,payloadIndex=payload[2]*256+payload[3],name=text(payload,4,20);
  const nameHits=findAll(stream,payload.subarray(4,24)),recordHits=records.filter(r=>r.slot===p.slot).map(r=>r.offset);
  const starts=[...new Set([...recordHits,...nameHits.map(h=>h-4).filter(s=>s>=0)])].sort((a,b)=>a-b);
  const scored=starts.map(s=>({start:s,headerMatch:Array.from({length:44},(_,i)=>stream[s+i]===payload[i]).filter(Boolean).length}));
  const best=Math.max(-1,...scored.map(s=>s.headerMatch)),top=scored.filter(s=>s.headerMatch===best);
  let confidence='absent';
  if(top.length>1)confidence='ambigu';
  else if(top.length===1)confidence=best===44?'en-tête-44-identique':recordHits.includes(top[0].start)?'signature-et-slot':'nom-seulement';
  return {slot:p.slot,name,payloadLength:payload.length,payloadIndex,indexMatchesSlot:payloadIndex===expectedIndex,nameHits,recordHits,
   start:top.length===1?top[0].start:null,headerMatch:best<0?null:best,confidence,payload};
 });
 const bounds=[...new Set([...records.map(r=>r.offset),...matched.filter(m=>m.start!==null).map(m=>m.start)])].sort((a,b)=>a-b);
 const result=matched.map(({payload,...m})=>{
  if(m.start===null)return {...m,end:null,length:null,runs:[],runCount:0,coverage:0,monotonic:null,saturatedWindows:0};
  const end=bounds.find(b=>b>m.start)??stream.length,span=stream.subarray(m.start,end),c=correlatedRuns(payload,span,{window,minRun,maxHits,from:44});
  const monotonic=c.runs.every((r,i)=>!i||r.expanded>=c.runs[i-1].expanded);
  return {...m,end,length:end-m.start,endsAtStreamEnd:end===stream.length,runs:c.runs.slice(0,maxRuns),runCount:c.runs.length,
   coverage:Number((covered(c.runs)/payload.length).toFixed(4)),monotonic,saturatedWindows:c.saturated,
   sharedStart:matched.some(o=>o.slot!==m.slot&&o.start===m.start)};
 });
 const placed=new Set(matched.map(m=>m.start));
 return {hypothesis:true,
  warning:'Outil d’hypothèse : découpage proposé du flux compacté par preset, à confirmer sur 200 lectures étendues 0x45 du même instant. Ni F2 ni ce découpage ne publient le format compacté.',
  assumptions:['Les 44 premiers octets d’un enregistrement compacté reprennent les offsets 0–43 du format étendu (source secondaire sgorpi, non constructeur).',
   'Index interne BE16 : User n = 399 + n (source secondaire ; vérifié localement sur User 1 seulement : 01 90).',
   'Fin d’un enregistrement = début du suivant dans le flux ; le dernier peut inclure de l’espace libre.',
   'Un run d’octets commun ne prouve pas une correspondance de champ ; il oriente la recherche.'],
  streamLength:stream.length,container:{magic,magicMatchesSecondary:magic==='FE ED 12 34',slotCountAt8:stream.length>=10?stream[8]*256+stream[9]:null,firstRecordOffset:records[0]?.offset??null},
  records:records.map(({offset,index,slot,name})=>({offset,index,slot,name})),storageOrder:records.map(r=>r.slot),
  unmatchedRecords:records.filter(r=>!placed.has(r.offset)).map(({offset,slot,name})=>({offset,slot,name})),
  presets:result,parameters:{window,minRun,maxHits,maxRuns}};
}
