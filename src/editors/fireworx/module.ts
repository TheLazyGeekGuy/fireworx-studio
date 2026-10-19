import type {EditorModule,EditorSession,EditorSnapshot} from '../../editor-host/contracts'
import type {MidiMonitor} from '../../midi-monitor'
import {createMonitor} from '../../midi-monitor'
import {defaultState,validateState,type FireworxState} from './model'
import {acceptsQuery,acceptsEditBuffer,acceptsPresetStore} from './protocol'
import {createLiveSession} from './engine/live-session.js'
import {archivePreset} from './engine/preset-json.js'
import {decodeDeviceBuffer,editedPayload,controlsForDevice} from './engine/device-codec.js'
import {frameWithPayload} from './engine/live-protocol.js'

export interface PageController {
 capture():unknown;load(value:unknown):void;undo():void;redo():void;stop():void
 readonly sending:boolean;readonly history:{undo:number;redo:number}
 selectParameter?(id:string):void
}
export interface FireworxSession extends EditorSession {
 monitor:MidiMonitor
 attach(page:PageController):()=>void
 changed():void
 assertWritable():void
 startLive(transport:any,options:any):any
 controls():{key:string;title:string;detail:string}[]
 readonly disposed:boolean
}
/** Registration/import allocates no ports, DOM, storage or active transaction. */
export const fireworxModule:EditorModule={
 manifest:{id:'tc-electronic-fireworx-editor',modelId:'tc-electronic-fireworx',name:'TC Electronic FireworX',version:'0.1.0',sdkVersion:1,stateSchemaVersion:1,capabilities:['patch-sysex','volatile-edit-buffer','preset-library','randomizer','isolated-midi-lease']},
 validateState,validateQuery:acceptsQuery,validateEditBufferWrite:acceptsEditBuffer,validatePresetStoreWrite:acceptsPresetStore,
 create(context,restored):FireworxSession {
  let state=restored===undefined?defaultState():validateState(restored),locked=false,disposed=false,page:PageController|null=null,error:string|null=null,live:any=null
  let history={undo:0,redo:0},loading=false,selection:string|null=null;const past:FireworxState[]=[],future:FireworxState[]=[],listeners=new Set<()=>void>()
  const monitor=createMonitor({clock:context.now}),offRx=context.midi.subscribe(p=>monitor.push('in',p.bytes))
  let snapshot:EditorSnapshot<FireworxState>=makeSnapshot()
  function sending(){return !locked&&(page?!!page.sending:!!live?.reference&&!live?.paused)}
  function makeSnapshot(){return Object.freeze({state:structuredClone(state),selection,locked,sending:sending(),history:Object.freeze({...history}),lastError:error})}
  function notify(){if(disposed)return;snapshot=makeSnapshot();for(const fn of listeners)fn()}
  function ensure(){if(disposed)throw Error('FireworX session disposed')}
  function loadPage(){loading=true;try{page?.load(state.patch);if(page)state=validateState({...state,patch:page.capture()})}finally{loading=false}}
  function remember(){past.push(state);if(past.length>50)past.shift();future.length=0}
  function replace(value:unknown,record=true){ensure();if(locked)throw Error('Editor locked');const next=validateState(value);live?.dispose();if(record)remember();state=next;loadPage();history={undo:past.length,redo:future.length};notify()}
  const session:FireworxSession={
   monitor,get disposed(){return disposed},getSnapshot:()=>snapshot,subscribe(fn){ensure();listeners.add(fn);return()=>{listeners.delete(fn)}},
   serialize(){ensure();return structuredClone(state)},
   assertWritable(){ensure();if(locked)throw Error('Editor locked')},
   controls(){if(!Array.isArray(state.patch.rawSysEx))return [];const b=decodeDeviceBuffer(Uint8Array.from(state.patch.rawSysEx as number[]));return b.nodes.flatMap((node:any)=>controlsForDevice(b,node).map((field:any)=>({key:field.id,title:field.displayLabel??field.label,detail:node.algorithm+' · '+(node.instanceIndex+1)})))},
   startLive(transport,options){session.assertWritable();if(live)throw Error('FireworX transaction session already open')
    const owner=createLiveSession(transport,{...options,onImage(next:any,event:any){
     if(disposed)return;state=validateState({...state,patch:archivePreset(next.frame)});options.onImage?.(next,event);notify()
    },onState(value:any){if(disposed)return;error=value.error??null;if(live)history={undo:value.canUndo?1:0,redo:value.canRedo?1:0};options.onState?.(value);notify()}})
    const stop=owner.dispose.bind(owner);owner.dispose=()=>{if(live===owner)live=null;const result=stop();notify();return result};live=owner;return owner
   },
   attach(controller){ensure();if(page)throw Error('FireworX page already mounted');page=controller;loadPage();notify();return()=>{if(page!==controller)return;state=validateState({...state,patch:page.capture()});page=null;history={undo:past.length,redo:future.length};notify()}},
   changed(){if(disposed||!page||loading)return;try{const next=validateState({...state,patch:page.capture()}),different=JSON.stringify(next)!==JSON.stringify(state);if(different){if(!page.sending)remember();state=next}history=page.sending?page.history:{undo:past.length,redo:future.length};error=null;if(different||snapshot.sending!==page.sending||JSON.stringify(snapshot.history)!==JSON.stringify(history))notify()}catch(e){error=String(e);notify()}},
   dispatch(action){ensure();const a=action as {type:string;state?:unknown;id?:string;value?:number};if(locked)throw Error('Editor locked');if(a.type==='replace')return replace(a.state)
    if(a.type==='focus'){if(!a.id||!session.controls().some(c=>c.key===a.id))throw Error('Unknown parameter');selection=a.id;page?.selectParameter?.(a.id);notify();return}
    if(a.type==='parameter'){
     const b=decodeDeviceBuffer(Uint8Array.from(state.patch.rawSysEx as number[])),payload=editedPayload(b,new Map([[a.id,a.value]]))
     if(live){live.replace(payload,{history:true,historyGroup:a.id});return}
     return replace({...state,patch:archivePreset(frameWithPayload(b.frame,payload))})
    }
    if(a.type==='undo'||a.type==='redo'){
     if(live){live[a.type]();session.changed();return}
     const source=a.type==='undo'?past:future,target=a.type==='undo'?future:past;if(source.length){target.push(state);state=source.pop()!;loadPage();history={undo:past.length,redo:future.length};notify()}return
    }throw Error('Unsupported FireworX action')
   },
   setLocked(value){ensure();locked=value;if(value){page?.stop();live?.dispose();context.midi.release()}notify()},
   setSending(enabled){ensure();if(enabled)throw Error('Use explicit FireworX connection and verified P0 reads');page?.stop();live?.dispose();notify()},
   dispose(){if(disposed)return;page?.stop();live?.dispose();page=null;disposed=true;offRx();context.midi.release();monitor.dispose();listeners.clear();past.length=future.length=0}
  }
  return session
 }
}
