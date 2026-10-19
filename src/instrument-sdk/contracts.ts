/** Data contracts only: no browser, controller state, transport or executable file loading. */
export const instrumentContractVersion=1
export type EvidenceLevel='declared'|'fixture-tested'|'hardware-read'|'hardware-volatile-write'|'hardware-persistent-verified'
export type InstrumentEffect='receive'|'request'|'edit-buffer'|'persistent-store'|'audition-volatile'|'audition-scratch'
export interface ProtocolSource {id:string;kind:'manufacturer-manual'|'manufacturer-midi';url:string;edition:string;locator:string}
export interface InstrumentDataType {id:string;name:string;schemaVersion:number;maxBytes:number}
export interface InstrumentOperation {
 id:string;dataType:string;effect:InstrumentEffect;evidence:EvidenceLevel;sourceIds:readonly string[]
 /** A request can select programs; effect and side effects must both be disclosed. */
 sideEffects:readonly ('select-program'|'alter-routing'|'overwrite-memory')[]
 requiresDestination:boolean;requiresBackup:boolean
}
export interface InstrumentDefinition {
 version:typeof instrumentContractVersion;modelId:string;manufacturer:string;model:string
 dataTypes:readonly InstrumentDataType[];sources:readonly ProtocolSource[];operations:readonly InstrumentOperation[]
}
export interface PatchEnvelope {
 format:'midi-studio-patch';version:1;modelId:string;dataType:string;schemaVersion:number;codecVersion:string
 name:string;status:'opaque'|'partial'|'decoded';raw:readonly number[]
 /** Codec-specific JSON. Unknown bytes still remain in raw, even after decoding. */
 decoded:unknown;diagnostics:readonly string[]
}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(v)
const text=(v:unknown,max=200):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v)
const integer=(v:unknown,min:number,max:number)=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max
export function validateInstrumentDefinition(value:unknown):InstrumentDefinition{
 const v=value as InstrumentDefinition
 if(!v||v.version!==1||!id(v.modelId)||!text(v.manufacturer)||!text(v.model)||!Array.isArray(v.dataTypes)||v.dataTypes.length<1||v.dataTypes.length>128||!Array.isArray(v.sources)||v.sources.length>128||!Array.isArray(v.operations)||v.operations.length>256)throw Error('Invalid instrument definition')
 const unique=(items:readonly {id:string}[])=>{if(new Set(items.map(x=>x?.id)).size!==items.length)throw Error('Duplicate instrument descriptor')}
 unique(v.dataTypes);unique(v.sources);unique(v.operations)
 for(const d of v.dataTypes)if(!d||!id(d.id)||!text(d.name)||!integer(d.schemaVersion,1,65535)||!integer(d.maxBytes,1,4_194_304))throw Error('Invalid instrument data type')
 for(const s of v.sources){if(!s||!id(s.id)||!['manufacturer-manual','manufacturer-midi'].includes(s.kind)||!text(s.edition)||!text(s.locator,1000)||!text(s.url,2000)||!/^https:\/\//.test(s.url))throw Error('Invalid instrument source');const url=new URL(s.url);if(url.username||url.password)throw Error('Credentials forbidden in source URL')}
 for(const o of v.operations){
  if(!o||!id(o.id)||!v.dataTypes.some(d=>d.id===o.dataType)||!['receive','request','edit-buffer','persistent-store','audition-volatile','audition-scratch'].includes(o.effect)||!['declared','fixture-tested','hardware-read','hardware-volatile-write','hardware-persistent-verified'].includes(o.evidence)||!Array.isArray(o.sourceIds)||!o.sourceIds.length||o.sourceIds.some((s:string)=>!v.sources.some(source=>source.id===s))||!Array.isArray(o.sideEffects)||o.sideEffects.some((s:string)=>!['select-program','alter-routing','overwrite-memory'].includes(s))||typeof o.requiresBackup!=='boolean'||typeof o.requiresDestination!=='boolean')throw Error('Invalid instrument operation')
  if((o.effect==='persistent-store'||o.effect==='audition-scratch'||o.sideEffects.includes('overwrite-memory'))&&(!o.requiresDestination||!o.requiresBackup))throw Error('Persistent effects require a destination and backup policy')
 }
 // Detach descriptors; registry validation does not probe URLs or prove their authorship.
 const copy=JSON.parse(JSON.stringify(v))
 const freeze=(node:unknown):void=>{if(node&&typeof node==='object'){Object.values(node).forEach(freeze);Object.freeze(node)}}
 freeze(copy);return copy
}
function jsonData(value:unknown,depth=0,budget={nodes:0}):unknown{
 if(depth>32||++budget.nodes>100000)throw Error('Patch JSON budget exceeded')
 if(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=1_000_000||typeof value==='number'&&Number.isFinite(value))return value
 if(Array.isArray(value))return value.map(v=>jsonData(v,depth+1,budget))
 if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)){
  const entries=Object.entries(value)
  if(entries.some(([key])=>['__proto__','constructor','prototype'].includes(key)))throw Error('Unsafe patch key')
  return Object.fromEntries(entries.map(([key,v])=>[key,jsonData(v,depth+1,budget)]))
 }
 throw Error('Patch content must be plain JSON')
}
export function validatePatchEnvelope(value:unknown,definition:InstrumentDefinition):PatchEnvelope{
 const v=value as PatchEnvelope,d=definition.dataTypes.find(d=>d.id===v?.dataType)
 const keys=['format','version','modelId','dataType','schemaVersion','codecVersion','name','status','raw','decoded','diagnostics']
 if(!v||typeof v!=='object'||Object.keys(v).some(k=>!keys.includes(k))||v.format!=='midi-studio-patch'||v.version!==1||v.modelId!==definition.modelId||!d||v.schemaVersion!==d.schemaVersion||!text(v.codecVersion,80)||typeof v.name!=='string'||v.name.length>200||!['opaque','partial','decoded'].includes(v.status)||!Array.isArray(v.raw)||v.raw.length>d.maxBytes||v.raw.some(b=>!integer(b,0,255))||!Array.isArray(v.diagnostics)||v.diagnostics.length>100||v.diagnostics.some(s=>!text(s,1000)))throw Error('Invalid instrument patch')
 return {...v,raw:[...v.raw],decoded:jsonData(v.decoded),diagnostics:[...v.diagnostics]}
}
/** Full raw data stays attached. This helper changes only a codec projection, never hardware. */
export function revisePatch(patch:PatchEnvelope,decoded:unknown,definition:InstrumentDefinition){
 return validatePatchEnvelope({...patch,decoded},definition)
}
