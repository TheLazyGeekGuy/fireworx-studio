import type {MidiPort} from '../web-midi'
export interface NativeInventory {format:'midi-studio-native-ports';version:1;complete:true;observedAt:number;platform:string;inputs:string[];outputs:string[]}
export type NativePresenceProvider=(signal:AbortSignal)=>Promise<NativeInventory>
export function validateNativeInventory(raw:unknown,now=Date.now()):NativeInventory{
  if(!raw||typeof raw!=='object')throw Error('Invalid native MIDI inventory')
  const s=raw as NativeInventory
  if(s.format!=='midi-studio-native-ports'||s.version!==1||s.complete!==true||!Number.isFinite(s.observedAt)||Math.abs(now-s.observedAt)>5000||
    !['darwin','win32','linux'].includes(s.platform)||![s.inputs,s.outputs].every(list=>Array.isArray(list)&&list.length<=1024&&list.every(name=>typeof name==='string'&&!!name.trim()&&name.length<=512&&!/[\x00-\x1f\x7f]/.test(name))))throw Error('Invalid native MIDI inventory')
  return {...s,inputs:[...s.inputs],outputs:[...s.outputs]}
}
export function canonicalPortName(name:string){
  let result=name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')
  // CoreMIDI can append the endpoint name to an identical device name.
  const words=result.split(' ');if(words.length%2===0){const half=words.length/2;if(words.slice(0,half).join(' ')===words.slice(half).join(' '))result=words.slice(0,half).join(' ')}
  return result
}
export function nativePortAvailable(inventory:NativeInventory,direction:'input'|'output',port:MidiPort){
  if(!port.name?.trim())return true // Missing browser identity is unknown, never proof of absence.
  const names=direction==='input'?inventory.inputs:inventory.outputs,name=canonicalPortName(port.name)
  return names.some(candidate=>canonicalPortName(candidate)===name)
}
export function createNativePresenceClient(url:URL,fetcher:typeof fetch=fetch):NativePresenceProvider{
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/__midi-studio/native-ports')throw Error('Invalid native presence URL')
  return async signal=>{
    const abort=new AbortController(),stop=()=>abort.abort();signal.addEventListener('abort',stop,{once:true})
    if(signal.aborted)abort.abort()
    const timeout=setTimeout(()=>abort.abort(),1500)
    try{const response=await fetcher(url.href,{signal:abort.signal,cache:'no-store',credentials:'omit',redirect:'error'});if(!response.ok)throw Error('Native MIDI inventory unavailable');const body=await response.text();if(body.length>1200000)throw Error('Native MIDI inventory too large');return validateNativeInventory(JSON.parse(body))}
    finally{clearTimeout(timeout);signal.removeEventListener('abort',stop)}
  }
}
