import type {MidiAccess,MidiPort} from '../web-midi'
import type {MidiLease,EndpointBinding} from './midi-broker'

/** Explicit user connection: await native port opening before publishing a binding.
 * Legacy injected ports without open() retain their synchronous bind behavior.
 * This performs no MIDI sends, does not request permissions and never retries.
 */
export async function openMidiBinding(lease:MidiLease,access:MidiAccess,binding:EndpointBinding,signal?:AbortSignal,timeoutMs=5000):Promise<void>{
 const input=access.inputs.get(binding.inputId),output=access.outputs.get(binding.outputId)
 if(!input||!output?.send||input.state!=='connected'||output.state!=='connected')throw Error('MIDI endpoints unavailable')
 if(signal?.aborted)throw Error('MIDI connection cancelled')
 if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)throw Error('Invalid MIDI opening budget')
 lease.release();const generation=lease.getState().generation
 const open=(port:MidiPort,direction:string)=>new Promise<void>((resolve,reject)=>{
  let done=false
  const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve()}
  const abort=()=>finish(Error('MIDI connection cancelled'))
  const timer=setTimeout(()=>finish(Error(`MIDI ${direction} did not open within ${timeoutMs/1000}s; no query sent. Reconnect the port or try another Web MIDI browser.`)),timeoutMs)
  signal?.addEventListener('abort',abort,{once:true})
  try{Promise.resolve(port.open?.()).then(()=>{if(port.state!=='connected'||port.connection&&port.connection!=='open')finish(Error(`MIDI ${direction} is ${port.connection??port.state}`));else finish()},finish)}catch(error){finish(error)}
 })
 await Promise.all([open(input,'input'),open(output,'output')])
 if(signal?.aborted||lease.getState().generation!==generation)throw Error('MIDI connection cancelled or superseded')
 if(access.inputs.get(binding.inputId)!==input||access.outputs.get(binding.outputId)!==output)throw Error('MIDI endpoints changed while opening')
 lease.bind(binding)
}
