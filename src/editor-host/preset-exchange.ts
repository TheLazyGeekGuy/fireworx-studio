import {validateEditorPreset,editorPresetFormat,type EditorPresetDocument} from '../library/editor-preset'
export interface PresetEndpointInfo {id:string;moduleId:string;stateVersion:number;name:string;instanceName?:string}
export interface PresetEndpoint extends PresetEndpointInfo {
 capture:()=>{name:string;state:unknown};validate:(state:unknown)=>unknown;load:(state:unknown,name:string)=>void;isLocked:()=>boolean
}
/** One host's optional, local-only exchange. No storage, timers, transport or installed-module imports. */
export function createPresetExchange(){
 const endpoints=new Map<string,PresetEndpoint>(),instanceNames=new Map<string,string>(),listeners=new Set<()=>void>();let closed=false
 let snapshot:readonly PresetEndpointInfo[]=Object.freeze([])
 const changed=()=>{snapshot=Object.freeze([...endpoints.values()].map(({id,moduleId,stateVersion,name})=>Object.freeze({id,moduleId,stateVersion,name,...(instanceNames.has(id)?{instanceName:instanceNames.get(id)}:{})})));for(const fn of listeners)try{fn()}catch{/* observer isolation */}}
 const current=(id:string)=>{const e=endpoints.get(id);if(closed||!e)throw Error('Editor preset target unavailable');return e}
 return {
  getSnapshot:()=>snapshot,subscribe(fn:()=>void){if(closed)return()=>{};listeners.add(fn);return()=>{listeners.delete(fn)}},
  setInstanceName(id:string,name?:string){if(closed)return;if(name!==undefined&&(typeof name!=='string'||!name.trim()||name.length>80))throw Error('Invalid preset instance name');if(instanceNames.get(id)===name)return;if(name===undefined)instanceNames.delete(id);else instanceNames.set(id,name);if(endpoints.has(id))changed()},
  register(endpoint:PresetEndpoint){
   if(closed||endpoints.has(endpoint.id)||! /^[a-zA-Z0-9_-]{1,100}$/.test(endpoint.id)||! /^[a-z][a-z0-9-]{0,63}$/.test(endpoint.moduleId)||!Number.isSafeInteger(endpoint.stateVersion)||endpoint.stateVersion<1||typeof endpoint.name!=='string'||!endpoint.name.trim()||endpoint.name.length>100||['capture','validate','load','isLocked'].some(k=>typeof endpoint[k as keyof PresetEndpoint]!=='function'))throw Error('Invalid editor preset endpoint')
   // Copy descriptor: callers cannot change identity/handlers after registration.
   const owned={...endpoint};endpoints.set(owned.id,owned);changed()
   return()=>{if(endpoints.get(owned.id)===owned){endpoints.delete(owned.id);changed()}}
  },
  capture(id:string):EditorPresetDocument{const e=current(id),value=e.capture();return validateEditorPreset({format:editorPresetFormat,version:1,moduleId:e.moduleId,stateVersion:e.stateVersion,name:value.name,editorName:e.name,state:e.validate(value.state)})},
  target(id:string){
   const endpoint=current(id)
   return {load(value:unknown){
    if(current(id)!==endpoint)throw Error('Editor preset target replaced during operation')
    const doc=validateEditorPreset(value)
    if(doc.moduleId!==endpoint.moduleId||doc.stateVersion!==endpoint.stateVersion)throw Error('Incompatible editor preset target')
    if(endpoint.isLocked())throw Error('Editor configuration locked')
    const state=endpoint.validate(doc.state)
    if(current(id)!==endpoint||endpoint.isLocked())throw Error('Editor preset target changed during validation')
    endpoint.load(state,doc.name)
   }}
  },
  dispose(){if(closed)return;closed=true;endpoints.clear();instanceNames.clear();changed();listeners.clear()},
 }
}
export type PresetExchange=ReturnType<typeof createPresetExchange>
