import {createFileAdapters} from './adapters'
const worker=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void}
worker.onmessage=event=>{
  const {bytes}=event.data??{}
  try{if(!(bytes instanceof Uint8Array))throw Error('Invalid parser worker input');worker.postMessage({inventory:createFileAdapters().read(bytes)})}
  catch(e){worker.postMessage({error:e instanceof Error?e.message:String(e)})}
}
