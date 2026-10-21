import type {EditorViewRegistration} from '../../editor-host/view-contract'
import {fireworxModule} from './module'
import {FireworxView} from './view'
import {isFireworxPortName} from './engine/port-discovery.js'
import {localAppearance} from './appearance'
export const fireworxView:EditorViewRegistration={
 moduleId:fireworxModule.manifest.id,viewVersion:1,
 presentation:{manufacturer:'FireworX',model:'Editor',preview:{src:'/editor-previews/tc-electronic-fireworx.svg',width:1900,height:176,kind:'reference-aligned'},localAppearance},
 matchesPort:port=>port.state==='connected'&&isFireworxPortName(port.name),
 loadInitial(id){if(!id)return;try{const saved=localStorage.getItem(`midi-studio.fireworx.state.${id}.v1`);if(saved)return fireworxModule.validateState(JSON.parse(saved))}catch{/* preserve invalid source; explicit import remains available */}},
 create(context){
  let openManual:(()=>void)|undefined,openMidi:(()=>void)|undefined
  const bindDocumentation=(open:(()=>void)|undefined)=>{openManual=open},bindMidiSettings=(open:(()=>void)|undefined)=>{openMidi=open}
  const abort=new AbortController(),cleanups=new Set<()=>void>();let disposed=false
  const dispose=()=>{if(disposed)return;disposed=true;abort.abort();for(const fn of [...cleanups])fn();cleanups.clear()}
  const topology=new Set<()=>void>()
  const local={...context,onTopology:(fn:()=>void)=>{topology.add(fn);return()=>{topology.delete(fn)}},lifecycle:{signal:abort.signal,onDispose(fn:()=>void){if(disposed){fn();return()=>{}}cleanups.add(fn);return()=>{cleanups.delete(fn)}}}}
  const off=context.lifecycle?.onDispose(dispose)
  return {render:props=><FireworxView context={local} {...props} onDocumentationReady={bindDocumentation} onMidiSettingsReady={bindMidiSettings}/>,openDocumentation:()=>openManual?.(),openMidiSettings:()=>openMidi?.(),refresh(){for(const fn of [...topology])try{fn()}catch{/* page observer isolation */}},dispose(){openManual=undefined;openMidi=undefined;off?.();dispose()}}
 }
}
