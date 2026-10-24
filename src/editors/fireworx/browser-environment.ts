import type {EditorViewContext} from '../../editor-host/view-contract'
import type {MidiOperation} from '../../editor-host/midi-broker'
import type {FireworxSession} from './module'
import {openMidiBinding} from '../../editor-host/open-midi-binding'
import {createStructuralSilence} from './engine/structural-silence.js'
import {createGuardedTransport} from './engine/guarded-transport.js'
import {editorLivePolicy} from './engine/hardware-policy.js'

/** Browser services owned by one mounted page. No global DOM/theme mutation or second MIDI sender. */
export function createBrowserEnvironment(root:HTMLElement,context:EditorViewContext&{onTopology?:(fn:()=>void)=>()=>void},session:FireworxSession){
 const win=root.ownerDocument.defaultView!,shadow=root.getRootNode() as ShadowRoot
 const cleanups=new Set<()=>void>(),timeouts=new Set<number>(),intervals=new Set<number>(),frames=new Map<number,FrameRequestCallback>(),nativeFrames=new Map<number,number>(),observers=new Set<ResizeObserver>(),urls=new Set<string>()
 const lifetime=new AbortController(),pageEvents=new EventTarget(),preferences=new Map<string,string>(),prefix=`midi-studio.fireworx.${context.id}.`
 let disposed=false,active=true,inherit=true,nextFrame=0,onState=()=>{},colors:Record<string,string>|null=null
 const storage={getItem(key:string){try{return win.localStorage.getItem(prefix+key)??preferences.get(key)??null}catch{return preferences.get(key)??null}},setItem(key:string,value:string){preferences.set(key,String(value));try{win.localStorage.setItem(prefix+key,String(value))}catch{/* session preference fallback */}},removeItem(key:string){preferences.delete(key);try{win.localStorage.removeItem(prefix+key)}catch{/* optional */}}}
 const listen=(target:EventTarget,type:string,fn:EventListenerOrEventListenerObject,options?:AddEventListenerOptions|boolean)=>{target.addEventListener(type,fn,options);const off=()=>target.removeEventListener(type,fn,options);cleanups.add(off);return off}
 const eventTarget=(type:string)=>['pagehide','pageshow','storage'].includes(type)?pageEvents:['keydown','keyup','scroll'].includes(type)?root:win
 const documentScope=new Proxy(root.ownerDocument,{get(target,key){
  if(key==='body'||key==='documentElement'||key==='head')return root
  if(key==='activeElement')return shadow.activeElement
  if(key==='getElementById')return (id:string)=>root.querySelector(`[id="${CSS.escape(id)}"]`)
  if(key==='querySelector')return (selector:string)=>root.matches(selector)?root:root.querySelector(selector)
  if(key==='querySelectorAll')return root.querySelectorAll.bind(root)
  if(key==='elementFromPoint')return shadow.elementFromPoint?.bind(shadow)??target.elementFromPoint.bind(target)
  if(key==='elementsFromPoint')return shadow.elementsFromPoint?.bind(shadow)??target.elementsFromPoint.bind(target)
  if(key==='addEventListener')return (type:string,fn:EventListenerOrEventListenerObject,options?:AddEventListenerOptions|boolean)=>listen(root,type,fn,options)
  if(key==='removeEventListener')return root.removeEventListener.bind(root)
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value
 }})
 const setTimeoutOwned=(fn:()=>void,ms?:number)=>{if(disposed)return 0;const id=win.setTimeout(()=>{timeouts.delete(id);if(!disposed)fn()},ms);timeouts.add(id);return id}
 const clearTimeoutOwned=(id:number)=>{win.clearTimeout(id);timeouts.delete(id)}
 const scheduleFrame=(key:number)=>{nativeFrames.set(key,win.requestAnimationFrame(time=>{nativeFrames.delete(key);const cb=frames.get(key);if(!cb||disposed||!active)return;frames.delete(key);cb(time)}))}
 const requestFrame=(fn:FrameRequestCallback)=>{if(disposed)return 0;const key=++nextFrame;frames.set(key,fn);if(active)scheduleFrame(key);return key}
 const windowScope=new Proxy(win,{get(target,key){
  if(key==='localStorage')return storage
  if(key==='addEventListener')return (type:string,fn:EventListenerOrEventListenerObject,options?:AddEventListenerOptions|boolean)=>listen(eventTarget(type),type,fn,options)
  if(key==='removeEventListener')return (type:string,fn:EventListenerOrEventListenerObject,options?:EventListenerOptions|boolean)=>eventTarget(type).removeEventListener(type,fn,options)
  if(key==='scrollTo')return ()=>root.scrollTo(0,0)
  if(key==='innerWidth')return Math.min(win.innerWidth,root.clientWidth||win.innerWidth)
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value
 }})
 // Observe extra controller/clock inputs through the host broker. The view gets no physical output.send().
 const portCache=new Map<string,any>();let routeIndex=0
 function inputFacade(port:any){
  const prior=portCache.get(port.id);if(prior?.physical===port)return prior.facade
  const events=new EventTarget();let route:ReturnType<EditorViewContext['broker']['createRoutingClient']>|null=null,opening=0
  const facade={get id(){return port.id},get name(){return port.name},get manufacturer(){return port.manufacturer},get state(){return port.state},type:'input',get connection(){return port.connection},
   async open(){const epoch=++opening;if(disposed)throw Error('FireworX page closed');await port.open?.();if(disposed||epoch!==opening)return facade
    route?.close();route=context.broker.createRoutingClient((context.id.slice(0,55)+'-fw-in-'+(++routeIndex)),()=>events.dispatchEvent(new Event('statechange')))
    route.arm([port.id],[],false,(_id,bytes)=>{session.monitor.push('in',bytes,'External controller / clock input');const event=new Event('midimessage');Object.assign(event,{data:Uint8Array.from(bytes)});events.dispatchEvent(event)})
    return facade
   },async close(){opening++;route?.close();route=null;return facade},
   addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)}
  cleanups.add(()=>{opening++;route?.close();route=null});portCache.set(port.id,{physical:port,facade});return facade
 }
 const accessEvents=new EventTarget(),offPorts=context.broker.subscribe(()=>accessEvents.dispatchEvent(new Event('statechange')));cleanups.add(offPorts)
 // Port arrivals and departures reach the page too (owner report 2026-10-21): the broker only notifies lease changes,
 // so ports published after the first MIDI request (native presence check) stayed hidden until a second click.
 const offTopology=context.onTopology?.(()=>accessEvents.dispatchEvent(new Event('statechange')));if(offTopology)cleanups.add(offTopology)
 const access={get sysexEnabled(){return context.access.sysexEnabled},get inputs(){return new Map([...context.access.inputs].map(([id,p])=>[id,inputFacade(p)]))},get outputs(){return new Map([...context.access.outputs].map(([id,p])=>[id,{id,name:p.name,type:'output',state:p.state}]))},addEventListener:accessEvents.addEventListener.bind(accessEvents),removeEventListener:accessEvents.removeEventListener.bind(accessEvents)}
 // Preserve the prototype's same-origin, physical-pair Web Lock as well as the host lease.
 // Its callback/release stays owned by device-view; reconnect awaits its release before reacquisition.
 const navigatorScope={requestMIDIAccess:async()=>{await context.request();if(disposed)throw Error('FireworX page closed');return access},locks:win.navigator.locks}
 async function openTransport(input:any,output:any,onDisconnect:()=>void,options:any){
  session.assertWritable();if(disposed)throw Error('FireworX page closed')
  await openMidiBinding(context.lease,context.access,{inputId:input.id,outputId:output.id},lifetime.signal)
  if(disposed||session.getSnapshot().locked){context.lease.release();throw Error('FireworX connection cancelled')}
  const generation=context.lease.getState().generation,listeners=new Set<(bytes:Uint8Array)=>void>();let closed=false
  const off=context.lease.subscribe(packet=>{if(closed||packet.generation!==generation)return;const bytes=Uint8Array.from(packet.bytes);options.journal?.record('rx',bytes);options.onActivity?.('rx',bytes);for(const fn of listeners)fn(bytes)})
  const offState=context.lease.onState(state=>{if(!closed&&(!state.connected||state.generation!==generation))onDisconnect()})
  const close=()=>{if(closed)return;closed=true;off();offState();listeners.clear();if(context.lease.getState().generation===generation)context.lease.release();cleanups.delete(close)};cleanups.add(close)
  const raw={subscribe(fn:(bytes:Uint8Array)=>void){listeners.add(fn);return()=>listeners.delete(fn)},send(bytes:Uint8Array){
   session.assertWritable();if(closed||disposed||context.lease.getState().generation!==generation)throw Error('Stale FireworX MIDI binding')
   const data=Array.from(bytes);let operation:MidiOperation
   if(bytes[0]===240)operation=[64,69].includes(bytes[6])?'query':bytes[6]===32&&(bytes[7]||bytes[8])?'preset-store':'edit-buffer'
   else{if(bytes.length!==3||(bytes[0]&240)!==176||bytes[1]>119)throw Error('Only configured performance CCs may be sent');operation='value'}
   const grant=context.broker.authorize(context.id,operation)
   try{context.lease.send([data],grant);session.monitor.push('out',bytes);options.journal?.record('tx',bytes);options.onActivity?.('tx',bytes)}finally{context.broker.revoke(grant)}
  },close}
  const silenceKey='fireworx:silence:'+output.id+':'+options.deviceId
  const silence=createStructuralSilence({read:()=>win.localStorage.getItem(silenceKey),write:(value:string)=>win.localStorage.setItem(silenceKey,value)})
  const guarded=createGuardedTransport(raw,{silence,deviceId:options.deviceId,editor:true,settle:editorLivePolicy.settle,structuralSettle:editorLivePolicy.structuralSettle})
  cleanups.delete(close);cleanups.add(()=>guarded.close());return guarded
 }
 class OwnedURL extends URL{static createObjectURL(blob:Blob){if(disposed)throw Error('FireworX page closed');const url=URL.createObjectURL(blob);urls.add(url);return url}static revokeObjectURL(url:string){urls.delete(url);URL.revokeObjectURL(url)}}
 const environment={get autoConnect(){return !context.recovered&&active&&!disposed&&!session.getSnapshot().locked&&storage.getItem('fireworx-auto-connect-v1')!=='false'},installStyle(css:string){const sheet=new CSSStyleSheet();sheet.replaceSync(css);shadow.adoptedStyleSheets=[...shadow.adoptedStyleSheets,sheet];cleanups.add(()=>{shadow.adoptedStyleSheets=shadow.adoptedStyleSheets.filter(s=>s!==sheet)})},URL:OwnedURL,document:documentScope,window:windowScope,localStorage:storage,navigator:navigatorScope,location:{hash:'#monobloc',pathname:'fireworx-module'},
  undo:()=>session.dispatch({type:'undo'}),redo:()=>session.dispatch({type:'redo'}),storageName:prefix,openTransport,startLive:(transport:any,options:any)=>session.startLive(transport,options),fetch:undefined,onState:()=>onState(),inheritedColors:()=>inherit?colors:null,setInherit:(value:boolean)=>{inherit=value;storage.setItem('inherit',String(value))},
  matchMedia:(query:string)=>{const m=win.matchMedia(query);return {get matches(){return m.matches},addEventListener:(type:string,fn:EventListener)=>listen(m,type,fn),removeEventListener:m.removeEventListener.bind(m)}},
  setTimeout:setTimeoutOwned,clearTimeout:clearTimeoutOwned,setInterval:(fn:()=>void,ms:number)=>{const id=win.setInterval(()=>{if(!disposed&&active)fn()},ms);intervals.add(id);return id},clearInterval:(id:number)=>{win.clearInterval(id);intervals.delete(id)},
  requestAnimationFrame:requestFrame,cancelAnimationFrame:(id:number)=>{frames.delete(id);const native=nativeFrames.get(id);if(native!==undefined)win.cancelAnimationFrame(native);nativeFrames.delete(id)},
  ResizeObserver:class extends ResizeObserver{constructor(fn:ResizeObserverCallback){super((...args)=>{if(!disposed)fn(...args)});observers.add(this)}},
  setOnState(fn:()=>void){onState=fn},setColors(value:Record<string,string>){colors=value},
  setActive(value:boolean){if(active===value)return;active=value;if(value){for(const key of frames.keys())scheduleFrame(key)}else{nativeFrames.forEach(id=>win.cancelAnimationFrame(id));nativeFrames.clear();root.querySelectorAll('dialog[open]').forEach(d=>(d as HTMLDialogElement).close())}},
  diagnostics:()=>({disposed,listeners:cleanups.size,timeouts:timeouts.size,intervals:intervals.size,frames:frames.size,nativeFrames:nativeFrames.size,observers:observers.size,urls:urls.size}),
  dispose(){if(disposed)return;pageEvents.dispatchEvent(new Event('pagehide'));disposed=true;lifetime.abort();for(const off of [...cleanups])try{off()}catch{/* finish other resources */}cleanups.clear();timeouts.forEach(id=>win.clearTimeout(id));intervals.forEach(id=>win.clearInterval(id));timeouts.clear();intervals.clear();frames.clear();nativeFrames.forEach(id=>win.cancelAnimationFrame(id));nativeFrames.clear();observers.forEach(o=>o.disconnect());observers.clear();urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();portCache.clear();root.replaceChildren()}
 }
 const savedInheritance=storage.getItem('inherit');inherit=savedInheritance===null?storage.getItem('midi-studio:fireworx:appearance:v1')!==null:savedInheritance!=='false'
 return environment
}
