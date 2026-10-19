import {useEffect,useRef} from 'react'
import type {PresetExchange,PresetEndpoint} from './editor-host/preset-exchange'
/** View-owned callback adapter; no extra session subscription or re-registration per MIDI packet. */
export function usePresetExchange(exchange:PresetExchange|undefined,endpoint:PresetEndpoint,signal?:AbortSignal){
 const current=useRef(endpoint);current.current=endpoint
 useEffect(()=>{
  if(signal?.aborted)return
  const off=exchange?.register({id:endpoint.id,moduleId:endpoint.moduleId,stateVersion:endpoint.stateVersion,name:endpoint.name,
   capture:()=>current.current.capture(),validate:value=>current.current.validate(value),load:(value,name)=>current.current.load(value,name),isLocked:()=>current.current.isLocked()})
  const stop=()=>off?.();signal?.addEventListener('abort',stop,{once:true})
  return()=>{signal?.removeEventListener('abort',stop);stop()}
 },[exchange,endpoint.id,endpoint.moduleId,endpoint.stateVersion,endpoint.name,signal])
}
