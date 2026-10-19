import type {EditorViewContext,EditorViewRuntime} from './view-contract'
import type {createViewRegistry} from './view-contract'
import type {createEditorWorkspace} from './workspace'

export interface ManagedEditorView {view:EditorViewRuntime|null;error:string|null;revision:number}
/** Lifecycle owner, independent of React render and controller models. */
export function createEditorViewManager(workspace:ReturnType<typeof createEditorWorkspace>,views:ReturnType<typeof createViewRegistry>,
  context:(id:string)=>Omit<EditorViewContext,'lifecycle'>) {
  const records=new Map<string,ManagedEditorView>(),cleanups=new Map<string,()=>void>(),listeners=new Set<()=>void>()
  let closed=false,syncing=false,revision=0,queued=false
  const notify=()=>{for(const fn of listeners)try{fn()}catch{/* observer isolation */}}
  const cleanup=(id:string)=>{const stop=cleanups.get(id);cleanups.delete(id);try{stop?.()}catch{/* one failing module cannot block peers */}}
  function construct(id:string,moduleId:string){
    const abort=new AbortController(),disposers=new Set<()=>void>();let view:EditorViewRuntime|null=null,stopped=false
    const stop=()=>{if(stopped)return;stopped=true;abort.abort();try{view?.dispose()}catch{/* cleanup continues */}for(const dispose of [...disposers].reverse())try{dispose()}catch{/* cleanup continues */}disposers.clear()}
    cleanups.set(id,stop)
    try {
      view=views.get(moduleId).create({...context(id),lifecycle:{signal:abort.signal,onDispose(fn){if(stopped){fn();return()=>{}}disposers.add(fn);return()=>{disposers.delete(fn)}}}})
      if(!view||typeof view.render!=='function'||typeof view.refresh!=='function'||typeof view.dispose!=='function')throw Error('Invalid editor view runtime')
      view.refresh()
      records.set(id,{view,error:null,revision:++revision})
    }catch(error){stop();try{workspace.getTransport(id).release()}catch{/* instance may have closed */}records.set(id,{view:null,error:String(error),revision:++revision})}
  }
  function sync(){
    if(closed||syncing)return
    syncing=true
    try{const entries=workspace.list(),ids=new Set(entries.map(e=>e.id))
      for(const id of records.keys())if(!ids.has(id)){cleanup(id);records.delete(id)}
      for(const entry of entries)if(!records.has(entry.id))construct(entry.id,entry.moduleId)
    }finally{syncing=false}
    notify()
  }
  // Defer workspace events: never construct views inside a React render/read of workspace state.
  const schedule=()=>{if(!queued&&!closed){queued=true;queueMicrotask(()=>{queued=false;sync()})}}
  const off=workspace.subscribeShell(schedule)
  const offClosing=workspace.subscribeClosing?.(id=>{cleanup(id);records.delete(id)})
  return {
    sync,get:(id:string)=>records.get(id),has:(id:string)=>records.has(id),
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},
    refresh(){for(const[id,record]of records)if(record.view)try{record.view.refresh()}catch(e){this.fail(id,e)}},
    fail(id:string,error:unknown){if(closed||!records.has(id))return;cleanup(id);try{workspace.getTransport(id).release()}catch{/* closed */}records.set(id,{view:null,error:String(error),revision:++revision});notify()},
    retry(id:string){if(closed)throw Error('Editor views disposed');const entry=workspace.list().find(e=>e.id===id);if(!entry)throw Error('Unknown editor instance');cleanup(id);construct(id,entry.moduleId);notify()},
    dispose(){if(closed)return;closed=true;off();offClosing?.();for(const id of cleanups.keys())cleanup(id);records.clear();listeners.clear()},
  }
}
