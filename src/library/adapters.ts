import {readSoundDiverLib,type LibInventory} from './sounddiver'
import {readSoundDiverPrf} from './sounddiver-prf'
import {readSyx,readSmf,validateSysEx,type MidiFileInventory,type MidiFileEntry} from './midi-files'
import {editorPresetInventory,isEditorPreset} from './editor-preset'
export type FileInventory=Omit<LibInventory,'format'>&{format:string;smf?:MidiFileInventory['smf']}
export interface FileAdapter {id:string;extensions:readonly string[];detect:(bytes:Uint8Array)=>boolean;read:(bytes:Uint8Array)=>FileInventory}
const prefix=(bytes:Uint8Array)=>String.fromCharCode(...bytes.subarray(0,4))
const soundDiverKind=(bytes:Uint8Array)=>prefix(bytes)==='MROF'?String.fromCharCode(...bytes.subarray(8,12)).split('').reverse().join(''):prefix(bytes)==='FORM'?String.fromCharCode(...bytes.subarray(8,12)):''
export const builtinFileAdapters:readonly FileAdapter[]=Object.freeze([
  {id:'editor-preset-json',extensions:['.json'],detect:isEditorPreset,read:editorPresetInventory},
  {id:'sounddiver-lib',extensions:['.lib'],detect:b=>soundDiverKind(b)==='SSLB',read:readSoundDiverLib},
  {id:'sounddiver-prf',extensions:['.prf'],detect:b=>soundDiverKind(b)==='SSCF',read:readSoundDiverPrf},
  {id:'midi-smf',extensions:['.mid','.midi'],detect:b=>prefix(b)==='MThd',read:readSmf},
  {id:'midi-syx',extensions:['.syx'],detect:b=>{const first=b.find(n=>n<248);return first===240},read:readSyx},
])
export function createFileAdapters(adapters:readonly FileAdapter[]=builtinFileAdapters){
  const ids=new Set<string>(),list=adapters.map(adapter=>{
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(adapter.id)||ids.has(adapter.id)||typeof adapter.detect!=='function'||typeof adapter.read!=='function'||!adapter.extensions.length||adapter.extensions.some(ext=>!/^\.[a-z0-9]{1,8}$/.test(ext)))throw Error('Invalid file adapter registration')
    ids.add(adapter.id);return Object.freeze({...adapter,extensions:Object.freeze([...adapter.extensions])})
  })
  return Object.freeze({
    list:()=>[...list],
    read(bytes:Uint8Array):FileInventory{
      if(!bytes.length||bytes.length>32*1024*1024)throw Error('Invalid library file size')
      const matches=list.filter(a=>a.detect(bytes))
      if(matches.length!==1)throw Error(matches.length?'Ambiguous library file format':'Unsupported library file format')
      return validateFileInventory(matches[0].read(bytes.slice()),bytes.length)
    },
  })
}
export function validateFileInventory(input:FileInventory,size:number):FileInventory{
  if(!input||input.version!==1||!/^[a-z][a-z0-9-]{0,63}$/.test(input.format)||!['little','big'].includes(input.endian)||!['contained','external'].includes(input.layout)||!Array.isArray(input.entries)||input.entries.length>50000||!Array.isArray(input.chunks)||input.chunks.length>100000||!Array.isArray(input.warnings)||input.warnings.length>50000)throw Error('Invalid adapter inventory')
  const range=(offset:number,length:number)=>{if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>size)throw Error('Invalid adapter source range')}
  for(const chunk of input.chunks){range(chunk.offset,chunk.size);if(typeof chunk.tag!=='string'||chunk.tag.length>64)throw Error('Invalid adapter chunk')}
  for(let index=0;index<input.entries.length;index++){
    const entry=input.entries[index] as MidiFileEntry;range(entry.offset,entry.size)
    if(entry.index!==index||['name','location','comment','instrumentId','instrumentName'].some(key=>typeof entry[key as keyof typeof entry]!=='string')||!entry.instrumentId||entry.instrumentId.length>160||!Array.isArray(entry.blocks)||entry.blocks.length>500000)throw Error('Invalid adapter entry')
    for(const block of entry.blocks)range(block.offset,block.size)
    if(entry.message)validateSysEx(entry.message)
  }
  if(input.warnings.some(w=>typeof w!=='string'||w.length>4096))throw Error('Invalid adapter diagnostic')
  return structuredClone(input)
}
export function extractEntry(source:Uint8Array,inventory:FileInventory,index:number):Uint8Array{
  const entry=inventory.entries[index]
  if(!Number.isInteger(index)||index<0||!entry||entry.offset<0||entry.size<0||entry.offset+entry.size>source.length)throw Error('Invalid entry source range')
  return source.slice(entry.offset,entry.offset+entry.size)
}
export function entryMessage(inventory:FileInventory,index:number):readonly number[]|null{
  const item=inventory.entries[index] as MidiFileEntry|undefined
  return item?.message?[...item.message]:null
}
