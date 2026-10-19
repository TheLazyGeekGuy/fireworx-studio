import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdirSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
const bundle=await build({stdin:{contents:`export * from './src/editors/fireworx/module';export * from './src/editors/fireworx/model';export * from './src/editors/fireworx/protocol';export * from './src/editors/fireworx/engine/protocol.js';export * from './src/editors/fireworx/engine/live-protocol.js';export * from './src/editor-host/midi-broker';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',metafile:true})
assert.ok(!Object.keys(bundle.metafile.inputs).some(p=>p.includes('/page/')||p.endsWith('.tsx')||p.includes('node_modules')),'Headless module imported a view')
mkdirSync('output/test-fireworx',{recursive:true});writeFileSync('output/test-fireworx/core.mjs',bundle.outputFiles[0].text)
const m=await import(pathToFileURL(path.resolve('output/test-fireworx/core.mjs')).href)
function frame(preset=0,id=0){const payload=new Uint8Array(1366);payload[1]=206;payload[172]=4;payload[1300]=193;payload.set(new TextEncoder().encode('Synthetic test'.padEnd(20)),4);payload.fill(32,24,44);let sum=0;const bytes=[240,0,32,31,id,64,32,preset>>7,preset&127,10,86];for(const b of payload){bytes.push(b>>4,b&15);sum+=b}bytes.push(-sum&127,247);return bytes}
const p0=frame(),user=frame(2049),card=frame(4097),factory=frame(37)
assert.equal(p0.length,2745)
for(const [data,write,store]of [[p0,true,false],[user,false,true],[card,false,true],[factory,false,false]]){assert.equal(m.acceptsEditBuffer(data),write);assert.equal(m.acceptsPresetStore(data),store)}
for(const wrong of [p0.slice(1),p0.map((v,i)=>i===5?65:v),p0.map((v,i)=>i===11?16:v),p0.map((v,i)=>i===2743?(v+1)&127:v),[...p0,247],p0.map((v,i)=>i===7?15:v)]){assert.equal(m.acceptsEditBuffer(wrong),false);assert.equal(m.acceptsPresetStore(wrong),false)}
for(const preset of [0,1,37,400,2049,2248,4097,4896])assert.ok(m.acceptsQuery([...m.requestExpanded(127,preset)]))
assert.ok(m.acceptsQuery([240,0,32,31,0,64,64,247]))
for(const opcode of [32,33,70,72,80,127])assert.equal(m.acceptsQuery([240,0,32,31,0,64,opcode,247]),false)
const input={id:'in',state:'connected',onmidimessage:null},sent=[],output={id:'out',state:'connected',onmidimessage:null,send:b=>sent.push(b)}
const broker=m.createMidiBroker({sysexEnabled:true,inputs:new Map([['in',input]]),outputs:new Map([['out',output]]),onstatechange:null}),mod=m.fireworxModule
const lease=broker.createLease('fireworx',mod.validateQuery,undefined,undefined,undefined,mod.validateEditBufferWrite,mod.validatePresetStoreWrite),other=broker.createLease('legacy')
const a=mod.create({instanceId:'fireworx',midi:lease,now:()=>performance.now()},{kind:'midi-studio-fireworx-preset',schema:1,rawSysEx:factory}),b=mod.create({instanceId:'legacy',midi:other,now:()=>performance.now()})
assert.deepEqual(a.serialize().patch.rawSysEx,factory);assert.deepEqual(sent,[]);const before=JSON.stringify(b.serialize())
a.dispatch({type:'replace',state:{kind:'midi-studio-fireworx-preset',schema:1,rawSysEx:p0}});a.dispatch({type:'undo'});assert.deepEqual(a.serialize().patch.rawSysEx,factory);a.dispatch({type:'redo'});assert.deepEqual(a.serialize().patch.rawSysEx,p0);assert.equal(JSON.stringify(b.serialize()),before)
const detached=a.serialize();detached.patch.rawSysEx[4]=127;assert.equal(a.serialize().patch.rawSysEx[4],0)
a.setLocked(true);assert.throws(()=>a.dispatch({type:'replace',state:m.defaultState()}),/locked/);assert.throws(()=>a.assertWritable(),/locked/);a.setLocked(false)
const replies=new Set(),headlessWire=[];let transportClosed=false
const transaction=a.startLive({subscribe(fn){replies.add(fn);return()=>replies.delete(fn)},send(bytes){headlessWire.push([...bytes]);queueMicrotask(()=>{for(const fn of replies)fn(Uint8Array.from(p0))})},close(){transportClosed=true}},{})
await transaction.load();assert.equal(a.getSnapshot().sending,true)
a.dispatch({type:'replace',state:{kind:'midi-studio-fireworx-preset',schema:1,rawSysEx:factory}})
assert.equal(transportClosed,true);assert.equal(replies.size,0);assert.equal(a.getSnapshot().sending,false);assert.deepEqual(a.serialize().patch.rawSysEx,factory);assert.equal(headlessWire.length,1,'Local import must cancel its headless reader without writing')
lease.bind({inputId:'in',outputId:'out'});const grant=op=>broker.authorize('fireworx',op)
lease.send([[...m.requestExpanded(0)]],grant('query'));lease.send([p0],grant('edit-buffer'));lease.send([user],grant('preset-store'))
assert.throws(()=>lease.send([user],grant('edit-buffer')),/refused/);assert.throws(()=>lease.send([p0],grant('preset-store')),/refused/);assert.throws(()=>lease.send([factory],grant('preset-store')),/refused/)
assert.throws(()=>lease.send([p0],{operation:'edit-buffer'}),/foreign/)
const stale=grant('preset-store');lease.release();lease.bind({inputId:'in',outputId:'out'});assert.throws(()=>lease.send([user],stale),/Stale/)
const first=sent.length;for(let i=0;i<1800;i++)input.onmidimessage({data:Uint8Array.from([176,74,i%128])});assert.equal(sent.length,first,'Passive RX echoed')
lease.release();other.bind({inputId:'in',outputId:'out'});assert.throws(()=>other.send([user],broker.authorize('legacy','preset-store')),/refused/,'Old modules must default-deny persistent writes')
a.dispose();a.dispose();b.dispose();assert.throws(()=>a.dispatch({type:'undo'}),/disposed/);broker.close()
console.log('PASS FireworX module: inert headless imports, complete/archive/unknown-byte preservation, legacy JSON, isolated snapshots/history, lock/disposal, exact queries/P0/persistent bank validation, default deny, stale/forged grants and 1800 RX without echo')
