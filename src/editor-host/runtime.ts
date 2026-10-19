import type {MidiAccess} from '../web-midi'
import type {Appearance} from './contracts'
import type {EditorRegistry} from './registry'
import {createEditorWorkspace} from './workspace'
import {createMidiBroker} from './midi-broker'
import {createEditorViewManager} from './view-lifecycle'
import {uniqueViewPorts,type createViewRegistry} from './view-contract'
import {automaticMidiAccess} from '../midi-permission'
import {createParameterBus} from './parameters'
import {watchMidiTopology} from './midi-topology'
import type {NativePresenceProvider} from './native-presence'
import {createPresentationPreferences} from './presentation-preferences'
import {createPresetExchange,type PresetExchange} from './preset-exchange'

/** Shared application-independent host. Construction is offline; no registry, model, React or permission side effect. */
export function createEditorRuntime(options:{registry:EditorRegistry;views:ReturnType<typeof createViewRegistry>;appearance?:Appearance;
  requestAccess?:typeof automaticMidiAccess;recover?:(moduleId:string)=>{id?:string;restored?:unknown};
  autoDiscover?:boolean;onNotice?:(message:string)=>void;nativePresence?:NativePresenceProvider;presetExchange?:PresetExchange}){
  const access:MidiAccess={sysexEnabled:false,inputs:new Map(),outputs:new Map(),onstatechange:null}
  const presentation=createPresentationPreferences()
  const presets=options.presetExchange??createPresetExchange()
  const broker=createMidiBroker(access),workspace=createEditorWorkspace(options.registry,broker,{appearance:options.appearance,presentation}),parameters=createParameterBus()
  let disposed=false,request:ReturnType<typeof automaticMidiAccess>|null=null,detach=()=>{},discovering=false
  const views=createEditorViewManager(workspace,options.views,id=>{
    const entry=workspace.list().find(e=>e.id===id);if(!entry)throw Error('Unknown editor instance')
    presets.setInstanceName(id,entry.name)
    return {id,initial:entry.snapshot.state,session:workspace.getSession(id),lease:workspace.getTransport(id),broker,access,parameters,presets,request:requestMidi,setDisplayName:(name:string)=>{if(!disposed&&workspace.list().some(e=>e.id===id))workspace.rename(id,name)}}
  })
  const offPresetNames=workspace.subscribeShell(()=>{for(const entry of workspace.list())presets.setInstanceName(entry.id,entry.name)})
  const offPresetClosing=workspace.subscribeClosing(id=>presets.setInstanceName(id,undefined))
  function sync(){
    if(disposed)return
    broker.refresh();views.refresh()
    if(options.autoDiscover!==false&&!discovering){discovering=true
      try{for(const manifest of options.registry.list()){
        const pair=uniqueViewPorts(access,options.views.get(manifest.id).matchesPort)
        if(workspace.isEnabled(manifest.id)&&!workspace.list().some(e=>e.moduleId===manifest.id)&&pair.input&&pair.output)
          workspace.create(manifest.id,options.recover?.(manifest.id))
      }}finally{discovering=false}
    }
    views.sync()
  }
  function requestMidi(){
    if(disposed)return Promise.reject(Error('Editor runtime disposed'))
    if(request)return request
    request=(options.requestAccess??automaticMidiAccess)().then(result=>{
      if(disposed)return result
      detach()
      let nativeWarning=false
      const topology=watchMidiTopology(result.access,access,sync,{nativePresence:options.nativePresence,onNativeStatus:status=>{
        if(status==='available'&&nativeWarning){nativeWarning=false;options.onNotice?.('Native MIDI presence recovered.')}
        if(status==='unavailable'||status==='lost')nativeWarning=true
        if(status==='unavailable')options.onNotice?.('Native MIDI presence unavailable; using browser port state.')
        if(status==='lost')options.onNotice?.('Native MIDI presence lost; connections suspended until recovery.')
      }});detach=topology.dispose
      if(result.sysexError)options.onNotice?.(result.sysexError)
      return {access,sysexError:result.sysexError}
    }).catch(error=>{request=null;if(!disposed)options.onNotice?.(String(error));throw error})
    return request
  }
  return {access,broker,workspace,views,parameters,presentation,presets,request:requestMidi,sync,
    get disposed(){return disposed},
    dispose(){if(disposed)return;disposed=true;detach();offPresetNames();offPresetClosing();for(const entry of workspace.list())presets.setInstanceName(entry.id,undefined);views.dispose();workspace.dispose();broker.close();parameters.clear();presentation.dispose();if(!options.presetExchange)presets.dispose()},
  }
}
export type EditorRuntime=ReturnType<typeof createEditorRuntime>
