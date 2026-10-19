import {mkdirSync,writeFileSync} from 'node:fs'
import {frameWithPayload} from '../src/editors/fireworx/engine/live-protocol.js'
import {decodeDeviceBuffer,editDeviceText} from '../src/editors/fireworx/engine/device-codec.js'
import {addDeviceBlock} from '../src/editors/fireworx/engine/device-graph.js'
// Built from zero bytes and engine defaults, never from a hardware capture.
const payload=new Uint8Array(1366);payload[1]=206;payload[172]=4
const reference=new Uint8Array(2745);reference.set([240,0,32,31,0,64,32,0,0,10,86]);reference[2744]=247
let frame=frameWithPayload(reference,payload),buffer=decodeDeviceBuffer(frame)
for(const [col,algorithm]of ['delay-stereo','resochord','flanger-advanced'].entries())buffer=decodeDeviceBuffer(frameWithPayload(reference,addDeviceBlock(buffer,algorithm,{col,row:0})))
frame=frameWithPayload(reference,editDeviceText(buffer,{name:'Synthetic test',alphaText:'Example'}))
mkdirSync(new URL('generated/',import.meta.url),{recursive:true});writeFileSync(new URL('generated/synthetic-p0.syx',import.meta.url),frame)
export const syntheticP0=frame
