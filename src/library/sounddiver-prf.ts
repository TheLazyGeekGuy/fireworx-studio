import {libLimits,type LibEntry} from './sounddiver'

/** Container inventory only. ITEM payloads are not assumed to be wire SysEx. */
export function readSoundDiverPrf(bytes:Uint8Array){
  if(bytes.length<12||bytes.length>libLimits.bytes)throw Error('Invalid PRF size')
  const ascii=(at:number,length:number)=>String.fromCharCode(...bytes.subarray(at,at+length))
  const little=ascii(0,4)==='MROF'
  if(!little&&ascii(0,4)!=='FORM')throw Error('Not a SoundDiver PRF container')
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const u32=(at:number)=>view.getUint32(at,little)
  const tag=(at:number)=>little?[...ascii(at,4)].reverse().join(''):ascii(at,4)
  if(tag(8)!=='SSCF')throw Error('Not a SoundDiver PRF studio (SSCF)')
  const size=u32(4),external=size===4&&bytes.length>12
  if(size<4||(!external&&size+8!==bytes.length))throw Error('Invalid PRF container length')
  const chunks:{tag:string;offset:number;size:number}[]=[],entries:LibEntry[]=[]
  let pos=12,device=0,item=0
  while(pos<bytes.length){
    if(chunks.length>=libLimits.chunks||pos+8>bytes.length)throw Error('Invalid PRF chunk header or limit')
    const kind=tag(pos),length=u32(pos+4),start=pos+8,end=start+length
    if(end>bytes.length)throw Error('Truncated PRF chunk')
    chunks.push({tag:kind,offset:start,size:length})
    if(kind==='DEV '){device++;item=0}
    if(['DEV ','ITEM','ITNM'].includes(kind)){
      if(entries.length>=libLimits.entries)throw Error('PRF entry limit exceeded')
      const group=device?`Studio device ${device}`:'Unassociated studio data'
      // Ordinals are file-local groups, not inferred manufacturer/module identities.
      entries.push({index:entries.length,offset:start,size:length,
        name:kind==='DEV '?group:`${kind} ${++item}`,location:group,
        comment:`Opaque ${kind.trim()} container block; not decoded MIDI.`,module:null,model:null,
        instrumentId:'sd:prf:unidentified',instrumentName:'SoundDiver PRF · unidentified studio data',
        blocks:[],opaque:true})
    }
    pos=end // Observed PRF chunks are byte-packed, not IFF word-padded.
  }
  return {format:'sounddiver-prf',version:1 as const,endian:little?'little' as const:'big' as const,
    layout:external?'external' as const:'contained' as const,chunks,entries,
    warnings:[
      'PRF studio inventory only: DEV, ITEM and ITNM blocks remain opaque; ordinal groups are file-local, not hardware identity.',
      'PORT, MODU, MODL, TYPE, icons, settings and unknown chunks are retained in the original, not applied or executed.',
      'No studio reconstruction, patch-name decoding, port binding, adaptation loading or SysEx conversion. ITEM data is not assumed to be MIDI.',
    ]}
}
