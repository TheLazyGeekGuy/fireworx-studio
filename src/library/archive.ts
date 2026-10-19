import {createFileAdapters,type FileAdapter} from './adapters'
import type {LibrarySource,LibraryStorage} from './storage'
import {validateMetadata,type LibraryMetadata} from './metadata'
export const archiveLimits={text:180*1024*1024,bytes:128*1024*1024,sources:2000} as const
export interface ArchivedSource {source:LibrarySource;bytes:Uint8Array}
export type ArchivedRecords=ArchivedSource[]&{metadata?:LibraryMetadata}
export async function sourceHash(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes))),b=>b.toString(16).padStart(2,'0')).join('')}
const encode=(bytes:Uint8Array)=>{let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text)}
function decode(text:string){
  if(text.length>Math.ceil(32*1024*1024/3)*4||text.length%4||/[^A-Za-z0-9+/=]/.test(text)||text.replace(/={1,2}$/,'').includes('='))throw Error('Invalid archive base64')
  const raw=atob(text),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(encode(bytes)!==text)throw Error('Noncanonical archive base64');return bytes
}
function keys(value:unknown,names:string[]):asserts value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!names.includes(key))||names.some(key=>!Object.hasOwn(value,key)))throw Error('Invalid library archive fields')
}
export async function exportLibraryArchive(storage:LibraryStorage):Promise<string>{
  const records=await storage.list(),sources=[];let total=0
  if(records.length>archiveLimits.sources)throw Error('Archive source limit')
  for(const source of records){const bytes=await storage.original(source.id);total+=bytes.length;if(total>archiveLimits.bytes)throw Error('Archive byte limit');if(await sourceHash(bytes)!==source.id)throw Error('Library original hash mismatch');sources.push({id:source.id,name:source.name,importedAt:source.importedAt,data:encode(bytes)})}
  const metadata=storage.metadata?await storage.metadata():undefined
  return JSON.stringify({format:'midi-studio-library',version:1,sources,...(metadata?{metadata}:{})})
}
export async function readLibraryArchive(text:string,definitions?:readonly FileAdapter[]):Promise<ArchivedRecords>{
  if(text.length>archiveLimits.text)throw Error('Archive text limit')
  const root:unknown=JSON.parse(text);keys(root,['format','version','sources',...(root&&typeof root==='object'&&Object.hasOwn(root,'metadata')?['metadata']:[])])
  if(root.format!=='midi-studio-library'||root.version!==1||!Array.isArray(root.sources)||root.sources.length>archiveLimits.sources)throw Error('Invalid library archive version or source count')
  const ids=new Set<string>(),result:ArchivedRecords=[];let total=0
  const adapters=createFileAdapters(definitions)
  for(const row of root.sources){
    keys(row,['id','name','importedAt','data'])
    if(typeof row.id!=='string'||!/^[0-9a-f]{64}$/.test(row.id)||ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>255||/[\u0000-\u001f\u007f]/.test(row.name)||typeof row.importedAt!=='string'||!Number.isFinite(Date.parse(row.importedAt))||new Date(row.importedAt).toISOString()!==row.importedAt||typeof row.data!=='string')throw Error('Invalid archive source metadata')
    ids.add(row.id);const bytes=decode(row.data);total+=bytes.length;if(total>archiveLimits.bytes)throw Error('Archive byte limit')
    if(await sourceHash(bytes)!==row.id)throw Error('Archive source hash mismatch')
    // Never trust imported projections: reconstruct from verified original bytes.
    const inventory=adapters.read(bytes)
    result.push({source:{id:row.id,name:row.name,importedAt:row.importedAt,size:bytes.length,inventory},bytes})
  }
  if(root.metadata!==undefined)result.metadata=validateMetadata(root.metadata,result.map(r=>r.source))
  return result
}
export async function restoreLibraryArchive(storage:LibraryStorage,text:string,definitions?:readonly FileAdapter[]){
  const records=await readLibraryArchive(text,definitions)
  if(!storage.merge)throw Error('Atomic library restore unavailable')
  return storage.merge(records,records.metadata)
}
