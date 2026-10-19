import type {EditorManifest,EditorModule} from './contracts'
import type {EditorPresentation,EditorViewRegistration} from './view-contract'
import {createEditorInstallation,type EditorInstallation} from './installation'

/** Build-selected imports, not arbitrary URLs or downloadable executable extensions. */
export interface LazyEditorDefinition {
  manifest:EditorManifest
  presentation:EditorPresentation
  load:()=>Promise<EditorInstallation>
}
export function createLazyEditorInstallation(definitions:readonly LazyEditorDefinition[]){
  const descriptors=new Map(definitions.map(d=>[d.manifest.id,d]))
  const loaded=new Map<string,EditorInstallation>(),pending=new Map<string,Promise<EditorInstallation>>()
  const uses=new Map<string,number>()
  const unavailable=()=>{throw Error('Load this editor before creating or restoring an instance')}
  const placeholders=createEditorInstallation(definitions.map(d=>({
    module:{manifest:d.manifest,validateState:unavailable,validateQuery:()=>false,create:unavailable},
    view:{moduleId:d.manifest.id,viewVersion:1,presentation:d.presentation,matchesPort:()=>false,create:unavailable},
  })))
  const same=(a:unknown,b:unknown):boolean=>{
    if(a===b)return true
    if(!a||!b||typeof a!=='object'||typeof b!=='object')return false
    const left=a as Record<string,unknown>,right=b as Record<string,unknown>
    return Object.keys(left).length===Object.keys(right).length&&Object.keys(left).every(k=>Object.hasOwn(right,k)&&same(left[k],right[k]))
  }
  const retain=<T extends {dispose:()=>void}>(id:string,factory:()=>T):T=>{
    const value=factory();uses.set(id,(uses.get(id)??0)+1)
    let disposed=false
    return {...value,dispose(){if(disposed)return;disposed=true;try{value.dispose()}finally{uses.set(id,(uses.get(id)??1)-1)}}}
  }
  const registry={list:placeholders.registry.list,get(id:string):EditorModule{return loaded.get(id)?.module??placeholders.registry.get(id)}}
  const views={list:()=>placeholders.views.list().map(v=>loaded.get(v.moduleId)?.view??v),get(id:string):EditorViewRegistration{return loaded.get(id)?.view??placeholders.views.get(id)}}
  return {registry,views,catalog:placeholders.catalog,
    async load(id:string):Promise<EditorInstallation>{
      const descriptor=descriptors.get(id);if(!descriptor)throw Error('Unknown editor module')
      const existing=loaded.get(id);if(existing)return existing
      const running=pending.get(id);if(running)return running
      const request=Promise.resolve().then(()=>descriptor.load()).then(pair=>{
        const checked=createEditorInstallation([pair]),module=checked.registry.get(id),view=checked.views.get(id)
        if(!same(module.manifest,descriptor.manifest)||!same(view.presentation,descriptor.presentation))throw Error('Lazy editor metadata/export mismatch')
        const wrapped:EditorInstallation={module:{...module,create:(...args)=>retain(id,()=>module.create(...args))},view:{...view,create:context=>retain(id,()=>view.create(context))}}
        loaded.set(id,wrapped);return wrapped
      }).finally(()=>pending.delete(id))
      pending.set(id,request);return request
    },
    /** Releases host references only. ECMAScript module code remains in the browser's module cache. */
    releaseUnused(){for(const id of loaded.keys())if(!uses.get(id)){loaded.delete(id);uses.delete(id)}},
    status(id:string){if(!descriptors.has(id))throw Error('Unknown editor module');return {state:loaded.has(id)?'loaded' as const:pending.has(id)?'loading' as const:'unloaded' as const,resources:uses.get(id)??0}},
    async prepareRestore(value:unknown){
      if(!value||typeof value!=='object')throw Error('Invalid editor workspace')
      const saved=value as {format?:unknown;version?:unknown;instances?:{moduleId?:unknown}[]}
      if(saved.format!=='studio-editor-workspace'||saved.version!==1||!Array.isArray(saved.instances)||saved.instances.length>32)throw Error('Invalid editor workspace')
      const ids=[...new Set(saved.instances.map(e=>e?.moduleId))]
      if(ids.some(id=>typeof id!=='string'||!descriptors.has(id)))throw Error('Unknown editor module')
      // Settle every import before handing control back: failure cannot orphan a late loaded pair.
      const results=await Promise.allSettled(ids.map(id=>this.load(id as string)))
      const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected'){this.releaseUnused();throw failed.reason}
    },
  }
}
