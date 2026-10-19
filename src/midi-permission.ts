import type {MidiAccess} from './web-midi'
type MidiNavigator=Navigator&{requestMIDIAccess?:(options:{sysex:boolean})=>Promise<MidiAccess>}
export const supportsWebMidi=()=>typeof navigator!=='undefined'&&typeof (navigator as MidiNavigator).requestMIDIAccess==='function'
export async function requestMidiAccess(sysex=false){
  const request=(navigator as MidiNavigator).requestMIDIAccess
  if(!request)throw Error('Web MIDI is unavailable in this browser.')
  return request.call(navigator,{sysex})
}
export async function automaticMidiAccess(request=requestMidiAccess){
  try{return {access:await request(true),sysexError:null}}
  catch(error){return {access:await request(false),sysexError:error instanceof Error?error.message:String(error)}}
}
