import {parseExpanded,requestExpanded,recallPreset} from './engine/protocol.js'
import {decodeDeviceBuffer,deviceMap} from './engine/device-codec.js'
import {parseBufferPart} from './engine/live-protocol.js'

const valid=(b:readonly number[])=>b.length>=8&&b[0]===240&&b.at(-1)===247&&b.slice(1,-1).every(x=>Number.isInteger(x)&&x>=0&&x<=127)&&b[1]===0&&b[2]===32&&b[3]===31&&b[5]===64
export function acceptsQuery(bytes:readonly number[]):boolean {
 try{if(!valid(bytes))return false
  if(bytes.length===8)return bytes[6]===64
  return bytes.length===10&&bytes.every((b,i)=>b===requestExpanded(bytes[4],bytes[7]*128+bytes[8])[i])
 }catch{return false}
}
export function acceptsEditBuffer(bytes:readonly number[]):boolean {
 try{if(!valid(bytes))return false
  if(bytes.length===10)return bytes.every((b,i)=>b===recallPreset(bytes[4],bytes[7]*128+bytes[8])[i])
  if(bytes.length===2745)return decodeDeviceBuffer(Uint8Array.from(bytes)).preset===0
  if(![17,19].includes(bytes.length))return false
  const part=parseBufferPart(Uint8Array.from(bytes))
  return deviceMap.fields.some((f:{editable:boolean;locallyTrialled:boolean;sourceStatus:string;selector:boolean;offset:number;width:number;blockTypeId:number;type:string})=>f.editable&&f.locallyTrialled&&f.sourceStatus==='verified'&&!f.selector&&f.blockTypeId>=7&&f.blockTypeId<=18&&f.type!=='bits'&&f.offset===part.address&&f.width===part.size)
 }catch{return false}
}
/** Persistent writes use their own operation, after destination review in the guarded session. */
export function acceptsPresetStore(bytes:readonly number[]):boolean {
 try{if(!valid(bytes)||bytes.length!==2745)return false
  const parsed=parseExpanded(Uint8Array.from(bytes)),p=parsed.preset
  decodeDeviceBuffer(Uint8Array.from(bytes))
  return p>=2049&&p<=2248||p>=4097&&p<=4896
 }catch{return false}
}
