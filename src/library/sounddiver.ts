/** Read-only SoundDiver library inventory. No adaptation execution or MIDI conversion. */
export const libLimits = {bytes:32*1024*1024,chunks:100000,entries:50000,blocks:500000} as const
export interface LibBlock {kind:number;offset:number;size:number}
export interface LibEntry {
  index:number;offset:number;size:number;name:string;location:string;comment:string
  module:number|null;model:number|null;instrumentId:string;instrumentName:string
  blocks:LibBlock[];opaque:boolean
  uses?:{slot:number;index:number;resolved:boolean}[]
}
export interface LibInventory {
  format:'sounddiver-lib';version:1;endian:'little'|'big';layout:'contained'|'external'
  chunks:{tag:string;offset:number;size:number}[];entries:LibEntry[];warnings:string[]
}
const models:Record<string,string>={'2:0':'Yamaha SY77','2:1':'Yamaha TG77','9:0':'Korg M1','15:0':'Roland D-50','20:0':'Roland JV-80','41:0':'Alesis DM Pro','42:0':'Line 6 POD','42:1':'Line 6 Flextone II','42:2':'Line 6 POD Pro','42:3':'Line 6 POD 2.0','43:0':'Yamaha FS1R','59:1':'Line 6 Bass POD','59:2':'Line 6 Bass POD Pro'}
const hex=(n:number)=>n.toString(16).padStart(2,'0').toUpperCase()
// One-byte projection, not an assertion of a platform-specific string encoding.
function text(bytes:Uint8Array){return Array.from(bytes,b=>String.fromCharCode(b)).join('').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim()}
export function readSoundDiverLib(bytes:Uint8Array):LibInventory {
  if(bytes.length<12||bytes.length>libLimits.bytes)throw Error('Invalid LIB size')
  const ascii=(start:number,n:number)=>String.fromCharCode(...bytes.subarray(start,start+n))
  const little=ascii(0,4)==='MROF'
  if(!little&&ascii(0,4)!=='FORM')throw Error('Not a SoundDiver LIB container')
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const u32=(at:number)=>view.getUint32(at,little)
  const tag=(at:number)=>little?ascii(at,4).split('').reverse().join(''):ascii(at,4)
  if(tag(8)!=='SSLB')throw Error('Not a SoundDiver LIB library (SSLB)')
  const size=u32(4),external=size===4&&bytes.length>12
  if(size<4||(!external&&size+8!==bytes.length))throw Error('Invalid LIB container length')
  const result:LibInventory={format:'sounddiver-lib',version:1,endian:little?'little':'big',layout:external?'external':'contained',chunks:[],entries:[],warnings:[]}
  let pos=12,blockCount=0,shortEntries=0,unknownBlocks=0
  while(pos<bytes.length){
    if(result.chunks.length>=libLimits.chunks||pos+8>bytes.length)throw Error('Invalid LIB chunk header or chunk limit')
    const kind=tag(pos),length=u32(pos+4),start=pos+8,end=start+length
    if(end>bytes.length)throw Error('Truncated LIB chunk')
    result.chunks.push({tag:kind,offset:start,size:length})
    if(kind==='LENT'){
      if(result.entries.length>=libLimits.entries)throw Error('LIB entry limit exceeded')
      const index=result.entries.length
      const entry:LibEntry={index,offset:start,size:length,name:'',location:'',comment:'',module:null,model:null,instrumentId:'sd:unknown',instrumentName:'SoundDiver · unknown',blocks:[],opaque:true}
      if(length<12){shortEntries++}else{
        const module=bytes[start+1],model=bytes[start+2],key=`${module}:${model}`
        entry.module=module;entry.model=model;entry.instrumentId=`sd:${hex(module)}:${hex(model)}`
        entry.instrumentName=models[key]??`SoundDiver ${hex(module)} / ${hex(model)}`
        let cursor=start+12
        while(cursor<end){
          const id=bytes[cursor++]
          if(id===0)break // Remaining bytes are retained, never guessed as more blocks.
          if(++blockCount>libLimits.blocks||cursor>=end)throw Error('Invalid LIB block header or block limit')
          let count=bytes[cursor++]
          if(count&128){if(cursor>=end)throw Error('Truncated LIB long block');count=((count&127)<<7)+bytes[cursor++]}
          if(cursor+count>end)throw Error('Truncated LIB block')
          entry.blocks.push({kind:id,offset:cursor,size:count})
          if(id===1)entry.name=text(bytes.subarray(cursor,cursor+count))
          else if(id===2)entry.location=text(bytes.subarray(cursor,cursor+count))
          else if(id===6)entry.comment=text(bytes.subarray(cursor,cursor+count))
          else if(id===4){
            if(count%6)result.warnings.push(`Entry ${index+1}: incomplete uses block retained.`)
            else {entry.uses??=[];for(let p=cursor;p<cursor+count;p+=6)entry.uses.push({slot:view.getUint16(p,little),index:view.getUint32(p+2,little),resolved:false})}
          }
          else if(id!==3&&id!==4&&id!==5)unknownBlocks++
          if(id===3&&module===255){
            // UNI carries its adaptation name as a NUL-terminated ASCII prefix.
            const prefix=bytes.subarray(cursor,cursor+Math.min(count,81)),nul=prefix.indexOf(0)
            if(nul>0&&nul<=80&&prefix.subarray(0,nul).every(b=>b>=32&&b<=126)){
              const name=ascii(cursor,nul).trim()
              if(name){entry.instrumentId=`sd:uni:${name}`;entry.instrumentName=name}
            }
          }
          cursor+=count
        }
      }
      entry.name ||= `Entry ${index+1}`
      result.entries.push(entry)
    }
    pos=end // SoundDiver chunks are NOT word aligned.
  }
  if(!result.chunks.some(c=>c.tag==='LHDR'))result.warnings.push('Missing LHDR; original retained.')
  for(const entry of result.entries)for(const use of entry.uses??[])use.resolved=use.index<result.entries.length
  if(shortEntries)result.warnings.push(`${shortEntries} short entries retained as opaque.`)
  const unknown=result.chunks.filter(c=>!['LHDR','WSEQ','LENT'].includes(c.tag)).length
  if(unknown)result.warnings.push(`${unknown} unknown chunks retained.`)
  if(unknownBlocks)result.warnings.push(`${unknownBlocks} unknown blocks retained.`)
  result.warnings.push('Instrument identity is file metadata, not hardware detection. Patch data is opaque; no SysEx conversion.')
  return result
}
