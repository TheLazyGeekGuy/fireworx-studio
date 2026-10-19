import {createFileAdapters,type FileInventory} from './adapters'
export type LibraryParser=(bytes:Uint8Array,signal?:AbortSignal)=>Promise<FileInventory>
export const parseInline:LibraryParser=async(bytes,signal)=>{signal?.throwIfAborted();const value=createFileAdapters().read(bytes);signal?.throwIfAborted();return value}
/** Factory is lazy and injectable; each in-flight parse owns its worker and abort listener. */
export function createLibraryParser(factory?:()=>Worker):LibraryParser{
  return (bytes,signal)=>{
    if(!factory&&typeof Worker==='undefined')return parseInline(bytes,signal)
    return new Promise((ok,no)=>{
      if(signal?.aborted){no(signal.reason);return}
      let worker:Worker
      try{worker=factory?factory():new Worker(new URL('./parse-worker.ts',import.meta.url),{type:'module'})}catch(e){no(e);return}
      let settled=false
      const finish=(value?:FileInventory,error?:unknown)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);worker.terminate();error?no(error):ok(value!)}
      const abort=()=>finish(undefined,signal?.reason??new DOMException('Import cancelled','AbortError'))
      signal?.addEventListener('abort',abort,{once:true})
      worker.onmessage=event=>event.data?.error?finish(undefined,Error(String(event.data.error))):event.data?.inventory?finish(event.data.inventory):finish(undefined,Error('Invalid parser worker response'))
      worker.onerror=()=>finish(undefined,Error('Library parser worker failed'))
      worker.onmessageerror=()=>finish(undefined,Error('Library parser worker response failed'))
      try{const copy=Uint8Array.from(bytes);worker.postMessage({bytes:copy},[copy.buffer])}catch(e){finish(undefined,e)}
    })
  }
}
