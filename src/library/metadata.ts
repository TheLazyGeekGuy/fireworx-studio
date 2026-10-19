import type {LibrarySource} from './storage'
export interface EntryRef {sourceId:string;index:number}
export interface Annotation {at:string;name:string;tags:string[];favorite:boolean}
export interface LibraryMetadata {
  version:1
  aliases:{instrumentId:string;name:string}[]
  annotations:{ref:EntryRef;revisions:Annotation[]}[]
  banks:{id:string;name:string;entries:EntryRef[]}[]
}
export const emptyMetadata=():LibraryMetadata=>({version:1,aliases:[],annotations:[],banks:[]})
export const entryKey=(ref:EntryRef)=>`${ref.sourceId}:${ref.index}`
function object(value:unknown,fields:string[]):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(f=>!Object.hasOwn(value,f)))throw Error('Invalid library metadata fields')}
function text(value:unknown,max=255):asserts value is string{if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error('Invalid library metadata text')}
export function validateMetadata(input:unknown,sources:readonly LibrarySource[]):LibraryMetadata{
  object(input,['version','aliases','annotations','banks'])
  if(input.version!==1||!Array.isArray(input.aliases)||input.aliases.length>2000||!Array.isArray(input.annotations)||input.annotations.length>200000||!Array.isArray(input.banks)||input.banks.length>1000)throw Error('Invalid library metadata limits')
  const known=new Map(sources.map(s=>[s.id,s])),instruments=new Set(sources.flatMap(s=>s.inventory.entries.map(e=>e.instrumentId)))
  const ref=(value:unknown)=>{object(value,['sourceId','index']);if(typeof value.sourceId!=='string'||typeof value.index!=='number'||!Number.isInteger(value.index)||value.index<0||!known.get(value.sourceId)?.inventory.entries[value.index])throw Error('Unknown library entry reference')}
  const aliases=new Set<string>(),annotations=new Set<string>(),banks=new Set<string>()
  for(const alias of input.aliases){object(alias,['instrumentId','name']);text(alias.instrumentId,160);text(alias.name,80);if(!alias.name.trim()||!instruments.has(alias.instrumentId)||aliases.has(alias.instrumentId))throw Error('Invalid library instrument alias');aliases.add(alias.instrumentId)}
  for(const item of input.annotations){
    object(item,['ref','revisions']);ref(item.ref);const key=entryKey(item.ref as unknown as EntryRef)
    if(annotations.has(key)||!Array.isArray(item.revisions)||!item.revisions.length||item.revisions.length>20)throw Error('Invalid annotation revisions')
    annotations.add(key)
    for(const revision of item.revisions){object(revision,['at','name','tags','favorite']);text(revision.name);if(typeof revision.at!=='string'||!Number.isFinite(Date.parse(revision.at))||new Date(revision.at).toISOString()!==revision.at||typeof revision.favorite!=='boolean'||!Array.isArray(revision.tags)||revision.tags.length>32)throw Error('Invalid annotation');revision.tags.forEach(tag=>text(tag,32));if(new Set(revision.tags).size!==revision.tags.length)throw Error('Duplicate annotation tag')}
  }
  for(const bank of input.banks){object(bank,['id','name','entries']);text(bank.name,80);if(typeof bank.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(bank.id)||banks.has(bank.id)||!bank.name.trim()||!Array.isArray(bank.entries)||bank.entries.length>10000)throw Error('Invalid local bank');banks.add(bank.id);bank.entries.forEach(ref)}
  if(JSON.stringify(input).length>16*1024*1024)throw Error('Library metadata byte limit')
  return structuredClone(input) as unknown as LibraryMetadata
}
export function annotate(metadata:LibraryMetadata,sources:readonly LibrarySource[],ref:EntryRef,value:Omit<Annotation,'at'>):LibraryMetadata{
  const next=structuredClone(metadata),key=entryKey(ref),item=next.annotations.find(a=>entryKey(a.ref)===key),revision={...value,at:new Date().toISOString()}
  if(item)item.revisions=[...item.revisions,revision].slice(-20);else next.annotations.push({ref:structuredClone(ref),revisions:[revision]})
  return validateMetadata(next,sources)
}
export function mergeMetadata(existing:LibraryMetadata,incoming:LibraryMetadata):LibraryMetadata{
  const combine=<T>(a:T[],b:T[],key:(item:T)=>string)=>{const known=new Set(a.map(key));return [...a,...b.filter(item=>!known.has(key(item)))]}
  return {version:1,aliases:combine(existing.aliases,incoming.aliases,a=>a.instrumentId),annotations:combine(existing.annotations,incoming.annotations,a=>entryKey(a.ref)),banks:combine(existing.banks,incoming.banks,b=>b.id)}
}
export function queryLibrary(sources:readonly LibrarySource[],metadata:LibraryMetadata,{instrumentId,query='',favorites=false,sort='name'}:{instrumentId?:string;query?:string;favorites?:boolean;sort?:'name'|'source'|'original'}){
  const notes=new Map(metadata.annotations.map(a=>[entryKey(a.ref),a.revisions.at(-1)!])),needle=query.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
  const result=sources.flatMap(source=>source.inventory.entries.filter(entry=>!instrumentId||entry.instrumentId===instrumentId).map(entry=>({source,entry,note:notes.get(entryKey({sourceId:source.id,index:entry.index}))}))).filter(({source,entry,note})=>(!favorites||note?.favorite)&&`${entry.name} ${note?.name??''} ${note?.tags.join(' ')??''} ${entry.location} ${entry.comment} ${source.name}`.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(needle))
  if(sort!=='original')result.sort((a,b)=>(sort==='source'?a.source.name.localeCompare(b.source.name):(a.note?.name||a.entry.name).localeCompare(b.note?.name||b.entry.name))||a.source.id.localeCompare(b.source.id)||a.entry.index-b.entry.index)
  return result
}
