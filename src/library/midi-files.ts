/** Local file codecs only. No transport, browser handles or executable adaptations. */
import type {LibEntry} from './sounddiver'
export const midiFileLimits={bytes:32*1024*1024,packets:50000,events:1000000,tracks:1024} as const
export interface MidiFileEntry extends LibEntry {message?:number[];track?:number;tick?:number}
export interface MidiFileInventory {
  format:'midi-syx'|'midi-smf';version:1;endian:'big';layout:'contained'
  chunks:{tag:string;offset:number;size:number}[];entries:MidiFileEntry[];warnings:string[]
  smf?:{format:number;division:number;tracks:number}
}
function fail(message:string):never{throw Error(message)}
const bounded=(bytes:Uint8Array)=>{if(!bytes.length||bytes.length>midiFileLimits.bytes)fail('Invalid MIDI file size')}
const hex=(b:number)=>b.toString(16).padStart(2,'0').toUpperCase()
export function manufacturerIdentity(message:readonly number[]){
  validateSysEx(message)
  const first=message[1]
  if(first===0){if(message.length<5)fail('Truncated extended manufacturer ID');const key=`00 ${hex(message[2])} ${hex(message[3])}`;return {id:`sysex:${key}`,name:`Manufacturer ${key}`}}
  const key=hex(first),name=first===0x7d?'Educational / development':first===0x7e?'Universal non-realtime':first===0x7f?'Universal realtime':`Manufacturer ${key}`
  return {id:`sysex:${key}`,name}
}
export function validateSysEx(message:readonly number[]){
  if(!message||message.length<3||message.length>midiFileLimits.bytes||message[0]!==240||message.at(-1)!==247||message[1]===0&&message.length<5)fail('Invalid framed SysEx packet')
  for(let i=0;i<message.length;i++){const b=message[i];if(!Number.isInteger(b)||b<0||b>255||(i>0&&i<message.length-1&&b>127))fail('Invalid framed SysEx packet')}
}
function entry(message:number[],index:number,offset:number,size:number,track?:number,tick?:number):MidiFileEntry{
  const identity=manufacturerIdentity(message)
  return {index,offset,size,name:`SysEx ${index+1}`,location:track===undefined?'':`Track ${track+1} · tick ${tick}`,comment:'',module:null,model:null,instrumentId:identity.id,instrumentName:identity.name,blocks:[],opaque:true,message,track,tick}
}
export function readSyx(bytes:Uint8Array):MidiFileInventory{
  bounded(bytes)
  const entries:MidiFileEntry[]=[],warnings:string[]=[]
  let packet:number[]|null=null,start=0,realtime=0
  for(let pos=0;pos<bytes.length;pos++){
    const b=bytes[pos]
    if(b>=248){realtime++;continue}
    if(b===240){if(packet)fail('Nested SysEx start');packet=[240];start=pos}
    else if(b===247){if(!packet)fail('Unexpected SysEx end');packet.push(247);entries.push(entry(packet,entries.length,start,pos-start+1));packet=null;if(entries.length>midiFileLimits.packets)fail('MIDI packet limit')}
    else {if(!packet||b>=128)fail('Non-SysEx data in SYX');packet.push(b)}
  }
  if(packet)fail('Truncated SysEx packet')
  if(!entries.length)fail('No SysEx packets')
  if(realtime)warnings.push(`${realtime} realtime bytes retained in original; excluded from packet projections.`)
  return {format:'midi-syx',version:1,endian:'big',layout:'contained',chunks:[{tag:'SYX',offset:0,size:bytes.length}],entries,warnings}
}
export function readSmf(bytes:Uint8Array):MidiFileInventory{
  bounded(bytes)
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(at:number)=>String.fromCharCode(...bytes.subarray(at,at+4))
  if(bytes.length<14||text(0)!=='MThd')fail('Not a Standard MIDI File')
  const length=view.getUint32(4),format=view.getUint16(8),tracks=view.getUint16(10),division=view.getUint16(12)
  if(length<6||length+8>bytes.length||format>2||!tracks||tracks>midiFileLimits.tracks||format===0&&tracks!==1||!division)fail('Invalid SMF header')
  if(division&0x8000){if(![232,231,227,226].includes(division>>8)||!(division&255))fail('Invalid SMPTE division')}
  const result:MidiFileInventory={format:'midi-smf',version:1,endian:'big',layout:'contained',chunks:[{tag:'MThd',offset:8,size:length}],entries:[],warnings:[],smf:{format,division,tracks}}
  let pos=8+length,track=0,events=0,escapes=0,channelEvents=0
  while(pos<bytes.length){
    if(pos+8>bytes.length)fail('Truncated SMF chunk')
    const tag=text(pos),size=view.getUint32(pos+4),start=pos+8,end=start+size
    if(end>bytes.length)fail('Truncated SMF track')
    result.chunks.push({tag,offset:start,size})
    if(tag!=='MTrk'){pos=end;continue}
    if(track>=tracks)fail('Extra SMF track')
    let cursor=start,running=0,tick=0,ended=false,pending:number[]|null=null,pendingStart=0,pendingTick=0
    const byte=()=>cursor<end?bytes[cursor++]:fail('Truncated SMF event')
    const vlq=()=>{let n=0;for(let i=0;i<4;i++){const b=byte();n=n*128+(b&127);if(!(b&128))return n}return fail('Invalid SMF VLQ')}
    while(cursor<end){
      if(++events>midiFileLimits.events)fail('SMF event limit')
      tick+=vlq();if(!Number.isSafeInteger(tick))fail('SMF tick overflow')
      const eventStart=cursor;let status=byte()
      if(status<128){if(!running)fail('SMF running status without channel event');cursor--;status=running}
      if(status<240){
        if(pending)fail('Channel event interrupts split SysEx')
        running=status;const count=status>>4===12||status>>4===13?1:2
        for(let i=0;i<count;i++)if(byte()>127)fail('Invalid MIDI channel data')
        channelEvents++
      }else{
        running=0
        if(status===255){
          const type=byte(),count=vlq();if(type>127||cursor+count>end)fail('Invalid SMF meta event')
          if(type===47){if(count||cursor!==end||pending)fail('Invalid SMF end-of-track');ended=true}
          cursor+=count
        }else if(status===240||status===247){
          const count=vlq(),dataStart=cursor;if(cursor+count>end)fail('Truncated SMF SysEx event')
          cursor+=count
          if(status===240){if(pending)fail('Nested SMF SysEx');pending=[240];pendingStart=eventStart;pendingTick=tick}
          if(pending){
            for(let i=dataStart;i<cursor;i++){const b=bytes[i];if(b>127&&!(b===247&&i===cursor-1))fail('Invalid SMF SysEx data');pending.push(b)}
            if(pending.at(-1)===247){result.entries.push(entry(pending,result.entries.length,pendingStart,cursor-pendingStart,track,pendingTick));pending=null;if(result.entries.length>midiFileLimits.packets)fail('MIDI packet limit')}
          }else {escapes++} // F7 without a preceding F0 is an opaque escape, not a new SysEx packet.
        }else fail('Invalid SMF event status')
      }
      if(ended)break
    }
    if(pending)fail('Unterminated SMF SysEx')
    if(!ended)fail('Missing SMF end-of-track')
    track++;pos=end
  }
  if(track!==tracks)fail('Missing SMF track')
  if(escapes)result.warnings.push(`${escapes} F7 escape events retained as opaque source bytes.`)
  if(channelEvents)result.warnings.push(`${channelEvents} channel events retained in original; not exposed as patches.`)
  if(format===2)result.warnings.push('SMF format 2 tracks have independent timelines; no global merge.')
  result.warnings.push('SysEx framing is not proof of a supported model or safe device operation.')
  return result
}
function vlqBytes(value:number){if(!Number.isInteger(value)||value<0||value>0x0fffffff)fail('Invalid SMF delta');const bytes=[value&127];while((value=Math.floor(value/128)))bytes.unshift((value&127)|128);return bytes}
export function writeSmf(messages:readonly (readonly number[])[],delta=0):Uint8Array{
  vlqBytes(delta);if(messages.length>midiFileLimits.packets)fail('MIDI packet limit')
  const track:number[]=[]
  for(const message of messages){validateSysEx(message);const prefix=[...vlqBytes(delta),240,...vlqBytes(message.length-1)];if(track.length+prefix.length+message.length+26>midiFileLimits.bytes)fail('MIDI file size limit');track.push(...prefix);for(let i=1;i<message.length;i++)track.push(message[i])}
  track.push(0,255,47,0)
  const result=new Uint8Array(22+track.length);result.set([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107]);new DataView(result.buffer).setUint32(18,track.length);result.set(track,22);return result
}
