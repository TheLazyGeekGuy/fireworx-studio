import type {EditorRegistry} from './registry'
import type {EditorPresentation} from './view-contract'
import {freezeLocalAppearance} from './local-appearance'

export const editorDragType='application/x-studio-editor-module'
export interface CatalogItem {id:string;name:string;modelId:string;presentation:EditorPresentation}
// Pure build-registration check. Never calls view/session factories or requests MIDI.
export function createEditorCatalog(registry:EditorRegistry,views:{list:()=>readonly {moduleId:string;presentation:EditorPresentation}[]}){
  const registered=views.list(),modules=registry.list()
  if(registered.length!==modules.length||new Set(registered.map(v=>v.moduleId)).size!==registered.length)throw Error('Module/view catalog mismatch')
  const entries=modules.map(m=>{
    const p=registered.find(v=>v.moduleId===m.id)?.presentation
    if(!p||[p.manufacturer,p.model].some(v=>typeof v!=='string'||!v.trim()||v.length>80||/[\x00-\x1f\x7f]/.test(v))||
      !p.preview||!/^\/editor-previews\/[a-z0-9-]+\.svg$/.test(p.preview.src)||
      !Number.isInteger(p.preview.width)||p.preview.width<1||p.preview.width>4096||!Number.isInteger(p.preview.height)||p.preview.height<1||p.preview.height>4096||
      !['schematic','reference-aligned'].includes(p.preview.kind))throw Error('Invalid editor presentation')
    return Object.freeze({id:m.id,name:m.name,modelId:m.modelId,presentation:Object.freeze({...p,preview:Object.freeze({...p.preview}),...(p.localAppearance!==undefined?{localAppearance:freezeLocalAppearance(p.localAppearance)}:{})})})
  })
  return Object.freeze(entries)
}
// A drag is a registered model ID, never serialized instance state, executable code, a URL or MIDI data.
export function droppedEditorId(types:readonly string[],payload:string,items:readonly CatalogItem[]):string|null{
  if(!types.includes(editorDragType)||payload.length>64)return null
  return items.some(item=>item.id===payload)?payload:null
}
export function nextInstanceName(base:string,names:readonly string[]){
  const used=new Set(names)
  if(!used.has(base)&&!used.has(`${base} 1`))return base
  let index=2
  const candidate=()=>`${base.slice(0,79-String(index).length).trimEnd()} ${index}`
  while(used.has(candidate()))index++
  return candidate()
}

/** A click navigates; only a drop explicitly requests another independent instance. */
export function catalogIntent(moduleId:string,gesture:'click'|'drop',entries:readonly {id:string;moduleId:string}[],activeId?:string|null){
  const existing=entries.find(e=>e.moduleId===moduleId&&e.id===activeId)??entries.find(e=>e.moduleId===moduleId)
  return gesture==='click'&&existing?{type:'activate' as const,id:existing.id}:{type:'create' as const,moduleId}
}
