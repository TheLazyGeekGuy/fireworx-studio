// #72 Local MIDI session journal: bounded ring of TX/RX frames at the Web MIDI boundary,
// plus session phases, errors, refusals and the timing profile. Persisted in this
// origin's IndexedDB (injectable storage) until an explicit clear. Never sent anywhere.
// Export: one JSON (events in order, full bytes as hex, SHA-256) + one .syx of the SysEx frames.
export const journalLimits=Object.freeze({maxEvents:2000,maxBytes:8*1024*1024});
const overhead=160;
const pad=(n,w)=>n.toString(36).padStart(w,'0');
// Header decode only: a few index reads per frame, no allocation besides the record.
export function describeFrame(b){
 const d={length:b.length,status:b[0]};
 if(b[0]===240){
  if(b[1]===0&&b[2]===32&&b[3]===31&&b[5]===64&&b.length>=8){
   d.device=b[4];d.opcode=b[6];
   if((d.opcode===69||d.opcode===32||d.opcode===40)&&b.length>=10)d.preset=b[7]*128+b[8];
   if(d.opcode===32&&b.length>=11)d.size=b[9]*128+b[10];
   if(d.opcode===33&&b.length>=13){d.preset=b[7]*128+b[8];d.address=b[9]*128+b[10];d.size=b[11]*128+b[12];}
  }else d.opcode=null;
 }else if(b[0]>=128&&b[0]<240){d.channel=(b[0]&15)+1;d.type=b[0]>>4;if(b.length>1)d.data1=b[1];if(b.length>2)d.data2=b[2];}
 return d;
}
// Compact SHA-256 fallback for non-secure contexts (crypto.subtle absent).
const K=[],H0=[];
{let n=2,found=0;const frac=x=>(x-Math.floor(x))*4294967296|0;while(found<64){let prime=true;for(let i=2;i*i<=n;i++)if(n%i===0){prime=false;break;}if(prime){if(found<8)H0[found]=frac(n**(1/2));K[found++]=frac(n**(1/3));}n++;}}
export function sha256Hex(bytes){
 const len=bytes.length,total=((len+9+63)>>6)<<6,m=new Uint8Array(total);m.set(bytes);m[len]=128;
 const bits=len*8;for(let i=0;i<8;i++)m[total-1-i]=Math.floor(bits/2**(8*i))&255;
 const h=H0.slice(),w=new Int32Array(64),r=(x,n)=>x>>>n|x<<(32-n);
 for(let o=0;o<total;o+=64){
  for(let i=0;i<16;i++)w[i]=m[o+4*i]<<24|m[o+4*i+1]<<16|m[o+4*i+2]<<8|m[o+4*i+3];
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(r(a,7)^r(a,18)^a>>>3)+w[i-16]+(r(b,17)^r(b,19)^b>>>10)+w[i-7]|0;}
  let [a,b,c,d,e,f,g,hh]=h;
  for(let i=0;i<64;i++){const t1=hh+(r(e,6)^r(e,11)^r(e,25))+(e&f^~e&g)+K[i]+w[i]|0,t2=(r(a,2)^r(a,13)^r(a,22))+(a&b^a&c^b&c)|0;hh=g;g=f;f=e;e=d+t1|0;d=c;c=b;b=a;a=t1+t2|0;}
  h[0]=h[0]+a|0;h[1]=h[1]+b|0;h[2]=h[2]+c|0;h[3]=h[3]+d|0;h[4]=h[4]+e|0;h[5]=h[5]+f|0;h[6]=h[6]+g|0;h[7]=h[7]+hh|0;
 }
 return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
const toHex=b=>{let s='';for(const v of b)s+=(v<16?'0':'')+v.toString(16);return s;};
async function digest(bytes){
 const subtle=globalThis.crypto?.subtle;
 if(subtle)try{return toHex(new Uint8Array(await subtle.digest('SHA-256',bytes)));}catch{}
 return sha256Hex(bytes);
}
// Storage contract: load() → records sorted or not; write(records,{below}) upserts and
// deletes keys < below; clear(). Keys sort lexicographically in recording order.
export function memoryJournalStorage(){
 const map=new Map(),copy=e=>({...e,data:e.data?.slice()});
 return {map,async load(){return [...map.values()].map(copy);},async write(records,{below}={}){for(const e of records)map.set(e.key,copy(e));if(below)for(const k of [...map.keys()])if(k<below)map.delete(k);},async clear(){map.clear();}};
}
export function indexedDbJournalStorage({name='fireworx-midi-journal',indexedDB=globalThis.indexedDB,KeyRange=globalThis.IDBKeyRange}={}){
 if(!indexedDB||!KeyRange)throw Error('IndexedDB indisponible dans ce navigateur');
 let opening=null;
 const open=()=>opening??=new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('events'))r.result.createObjectStore('events',{keyPath:'key'});};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{opening=null;reject(r.error);};r.onblocked=()=>reject(Error('Journal MIDI bloqué par un autre onglet'));});
 const run=(mode,fn)=>open().then(db=>new Promise((resolve,reject)=>{const t=db.transaction('events',mode),store=t.objectStore('events');let out;fn(store,v=>{out=v;});t.oncomplete=()=>resolve(out);t.onerror=t.onabort=()=>reject(t.error??Error('Transaction IndexedDB interrompue'));}));
 return {
  load:()=>run('readonly',(store,set)=>{const r=store.getAll();r.onsuccess=()=>set(r.result);}),
  write:(records,{below}={})=>run('readwrite',store=>{for(const e of records)store.put(e);if(below)store.delete(KeyRange.upperBound(below,true));}),
  clear:()=>run('readwrite',store=>store.clear()),
  close(){void opening?.then(db=>db.close(),()=>{});opening=null;}
 };
}
export function createMidiJournal({storage=null,limits=journalLimits,now=()=>performance.now(),wall=()=>Date.now(),flushDelay=150,onChange=()=>{}}={}){
 const maxEvents=limits.maxEvents,maxBytes=limits.maxBytes;
 if(!Number.isInteger(maxEvents)||maxEvents<1||!Number.isFinite(maxBytes)||maxBytes<1024)throw Error('Limites du journal MIDI invalides');
 const page=pad(wall(),9)+'-'+Math.random().toString(36).slice(2,6).padEnd(4,'0');
 let seq=0,ring=[],head=0,bytes=0,evicted=0,timer=null,chain=Promise.resolve(),persistError=null,loaded=false,disposed=false;
 const dirty=new Map();
 const live=()=>ring.length-head;
 function trim(){
  while(live()>maxEvents||bytes>maxBytes&&live()>1){const old=ring[head];ring[head++]=undefined;bytes-=old.cost;evicted++;dirty.delete(old.key);}
  if(head>1024&&head*2>ring.length){ring=ring.slice(head);head=0;}
 }
 function schedule(){if(!storage||timer!==null||disposed)return;timer=setTimeout(()=>{timer=null;void flush();},flushDelay);}
 function push(entry){entry.key=page+':'+pad(++seq,6);entry.page=page;entry.cost=(entry.data?.length??0)+overhead;ring.push(entry);bytes+=entry.cost;dirty.set(entry.key,entry);trim();schedule();return entry;}
 function flush(){
  if(!storage)return Promise.resolve();
  const records=[...dirty.values()];dirty.clear();const below=ring[head]?.key;
  chain=chain.then(()=>storage.write(records,{below})).then(()=>{persistError=null;},e=>{persistError=e.message||String(e);for(const r of records)if(!dirty.has(r.key)&&ring.includes(r))dirty.set(r.key,r);}).then(()=>{try{onChange();}catch{}});
  return chain;
 }
 // Earlier pages first (keys sort by page start), then this page's events in order.
 const ready=(storage?storage.load():Promise.resolve([])).then(previous=>{
  if(disposed)return;
  const mine=ring.slice(head),old=previous.filter(e=>e?.key&&e.page!==page).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  ring=[...old,...mine];head=0;bytes=ring.reduce((n,e)=>n+(e.cost??overhead),0);trim();loaded=true;schedule();try{onChange();}catch{}
 },e=>{persistError=e.message||String(e);loaded=true;try{onChange();}catch{}});
 const api={
  get page(){return page;},
  get ready(){return ready;},
  get size(){return live();},
  get stats(){let tx=0,rx=0;for(let i=head;i<ring.length;i++){const e=ring[i];if(e.kind==='midi')e.direction==='tx'?tx++:rx++;}return {events:live(),bytes,evicted,tx,rx,persistent:!!storage&&!persistError,persistError,loaded,limits:{maxEvents,maxBytes}};},
  get events(){return ring.slice(head);},
  // Hot path: copy the frame, decode a few header bytes, append. Realtime bytes
  // (Clock, Active Sensing) are folded into one run per direction and status.
  record(direction,frame){
   if(disposed||direction!=='tx'&&direction!=='rx'||!frame?.length)return;
   const t=now(),w=wall();
   if(frame.length===1&&frame[0]>=248){
    const last=ring[ring.length-1];
    if(ring.length>head&&last.kind==='realtime-run'&&last.direction===direction&&last.status===frame[0]){last.count++;last.lastPerfMs=t;last.lastWallMs=w;dirty.set(last.key,last);schedule();return;}
    push({kind:'realtime-run',direction,status:frame[0],count:1,perfMs:t,wallMs:w,lastPerfMs:t,lastWallMs:w});return;
   }
   push({kind:'midi',direction,perfMs:t,wallMs:w,...describeFrame(frame),data:Uint8Array.from(frame)});
  },
  mark(kind,detail={}){if(disposed)return;let safe;try{safe=JSON.parse(JSON.stringify(detail??{}));}catch{safe={note:String(detail)};}push({kind:String(kind),perfMs:now(),wallMs:wall(),detail:safe});},
  flush,
  async clear(){
   await ready;clearTimeout(timer);timer=null;dirty.clear();ring=[];head=0;bytes=0;evicted=0;
   if(storage)await (chain=chain.then(()=>storage.clear()));
   api.mark('journal-cleared',{reason:'explicit'});await flush();
  },
  async exportFiles({date=new Date(wall())}={}){
   await ready;const list=ring.slice(head),frames=[],events=[];let offset=0;
   for(const [index,e] of list.entries()){
    const out={seq:index+1,key:e.key,page:e.page,kind:e.kind,at:new Date(e.wallMs).toISOString(),perfMs:Math.round(e.perfMs*1000)/1000};
    if(e.kind==='midi'){
     e.sha256??=await digest(e.data);
     Object.assign(out,{direction:e.direction,bytes:e.length,status:e.status,opcode:e.opcode,preset:e.preset,address:e.address,size:e.size,device:e.device,channel:e.channel,type:e.type,data1:e.data1,data2:e.data2,sha256:e.sha256,hex:toHex(e.data)});
     if(e.data[0]===240){out.syxOffset=offset;frames.push(e.data);offset+=e.data.length;}
    }else if(e.kind==='realtime-run')Object.assign(out,{direction:e.direction,status:e.status,count:e.count,lastAt:new Date(e.lastWallMs).toISOString(),lastPerfMs:Math.round(e.lastPerfMs*1000)/1000});
    else out.detail=e.detail;
    events.push(JSON.parse(JSON.stringify(out)));
   }
   const syx=new Uint8Array(offset);offset=0;for(const f of frames){syx.set(f,offset);offset+=f.length;}
   const stamp=date.toISOString().replace(/[:.]/g,'-'),name=`fireworx-midi-journal-${stamp}`,s=api.stats;
   const json={format:'fireworx-midi-journal',version:1,exportedAt:date.toISOString(),note:'Journal local du navigateur ; aucune donnée envoyée hors du navigateur. bytes = longueur, hex = trame complète, syxOffset = position dans le .syx.',limits:{maxEvents,maxBytes},counts:{events:events.length,tx:s.tx,rx:s.rx,sysex:frames.length,evicted:s.evicted},syx:{file:name+'.syx',bytes:syx.length,sha256:await digest(syx)},events};
   return {name,json:JSON.stringify(json,null,1)+'\n',syx,summary:json.counts};
  },
  dispose(){if(disposed)return;void flush();disposed=true;clearTimeout(timer);timer=null;}
 };
 return api;
}
