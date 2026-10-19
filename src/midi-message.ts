/** Structural MIDI 1 validation only: it cannot classify an arbitrary device command as safe. */
export function validMidiMessage(b:readonly number[]):boolean {
  if(!b.length||b.length>16384||b.some(v=>!Number.isInteger(v)||v<0||v>255))return false
  if(b[0]===240)return b.length>=3&&b.at(-1)===247&&b.slice(1,-1).every(v=>v<128)
  const type=b[0]&240,length=type>=128&&type<=224?([192,208].includes(type)?2:3):({241:2,242:3,243:2,246:1,248:1,250:1,251:1,252:1,254:1,255:1} as Record<number,number>)[b[0]]
  return b.length===length&&b.slice(1).every(v=>v<128)
}
