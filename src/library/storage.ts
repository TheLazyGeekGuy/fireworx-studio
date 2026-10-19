import {readSoundDiverLib} from './sounddiver'
import {createFileAdapters,type FileInventory} from './adapters'
import {emptyMetadata,validateMetadata,mergeMetadata,type LibraryMetadata} from './metadata'

export interface LibrarySource {id:string;name:string;size:number;importedAt:string;inventory:FileInventory}
export interface LibraryStorage {
  list():Promise<LibrarySource[]>
  original(id:string):Promise<Uint8Array>
  insert(source:LibrarySource,bytes:Uint8Array):Promise<boolean>
  merge?(records:readonly {source:LibrarySource;bytes:Uint8Array}[],metadata?:LibraryMetadata):Promise<number>
  metadata?():Promise<LibraryMetadata>
  setMetadata?(metadata:LibraryMetadata):Promise<void>
  /** Explicit user action; atomically removes source bytes and metadata refs. */
  removeSource?(id:string):Promise<void>
  close():void
}
export const libraryLimits={sources:2000,bytes:128*1024*1024,entries:200000} as const
export interface LibraryInstrument {id:string;name:string;count:number}
export function libraryInstruments(sources:readonly LibrarySource[]):LibraryInstrument[]{
  const groups=new Map<string,LibraryInstrument>()
  for(const source of sources)for(const entry of source.inventory.entries){
    let item=groups.get(entry.instrumentId)
    if(!item){item={id:entry.instrumentId,name:entry.instrumentName,count:0};groups.set(item.id,item)}
    item.count++
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name))
}
export async function importLibraryFile(storage:LibraryStorage,name:string,bytes:Uint8Array,read:(bytes:Uint8Array)=>FileInventory=createFileAdapters().read){
  // Copy before async hashing so caller mutation cannot change the stored source.
  const original=Uint8Array.from(bytes),inventory=read(original.slice())
  const digest=await crypto.subtle.digest('SHA-256',original)
  const id=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  const source:LibrarySource={id,name:name.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,255)||'library.lib',size:original.length,importedAt:new Date().toISOString(),inventory}
  return {source,inserted:await storage.insert(source,original)}
}
/** Compatibility wrapper retains the explicit LIB-only contract. */
export const importSoundDiver=(storage:LibraryStorage,name:string,bytes:Uint8Array)=>importLibraryFile(storage,name,bytes,readSoundDiverLib)
/** Explicit lazy factory: imports and unopened tools have no storage/MIDI side effects. */
export function openLibraryStorage(factory:IDBFactory=globalThis.indexedDB,name='midi-studio.library.v1'):Promise<LibraryStorage>{
  return new Promise((resolve,reject)=>{
    if(!factory){reject(Error('Local library storage unavailable'));return}
    const request=factory.open(name,2)
    let abandoned=false
    request.onblocked=()=>{abandoned=true;reject(Error('Library storage blocked; close older Studio tabs'))}
    request.onerror=()=>reject(request.error??Error('Cannot open local library'))
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('sources'))db.createObjectStore('sources',{keyPath:'id'});if(!db.objectStoreNames.contains('originals'))db.createObjectStore('originals');if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata')}
    request.onsuccess=()=>{
      const db=request.result
      if(abandoned){db.close();return}
      db.onversionchange=()=>db.close()
      const merge=(records:readonly {source:LibrarySource;bytes:Uint8Array}[],metadata?:LibraryMetadata):Promise<number>=>{
        // Copy at the call boundary, before IndexedDB's asynchronous request callbacks.
        const detached=structuredClone(records)
        return new Promise((ok,no)=>{
          const tx=db.transaction(['sources','originals','metadata'],'readwrite'),store=tx.objectStore('sources'),existing=store.getAll(),notes=tx.objectStore('metadata').get('library')
          let added=0,error:Error|null=null
          notes.onsuccess=()=>{
            try{
              const rows=existing.result as LibrarySource[],known=new Set(rows.map(s=>s.id)),pending=[]
              let count=rows.length,bytes=rows.reduce((n,s)=>n+s.size,0),entries=rows.reduce((n,s)=>n+s.inventory.entries.length,0)
              for(const row of detached){
                if(known.has(row.source.id))continue
                if(row.source.size!==row.bytes.length)throw Error('Library source size mismatch')
                known.add(row.source.id);count++;bytes+=row.bytes.length;entries+=row.source.inventory.entries.length;pending.push(row)
              }
              if(count>libraryLimits.sources||bytes>libraryLimits.bytes||entries>libraryLimits.entries)throw Error('Library storage budget exceeded')
              for(const row of pending){store.add(row.source);tx.objectStore('originals').add(row.bytes,row.source.id);added++}
              if(metadata){const all=[...rows,...pending.map(p=>p.source)],old=validateMetadata(notes.result??emptyMetadata(),rows),incoming=validateMetadata(metadata,all);tx.objectStore('metadata').put(validateMetadata(mergeMetadata(old,incoming),all),'library')}
            }catch(e){error=e instanceof Error?e:Error(String(e));tx.abort()}
          }
          tx.oncomplete=()=>ok(added);tx.onabort=()=>no(error??tx.error??Error('Library import rolled back'))
        })
      }
      resolve({
        removeSource:id=>new Promise((ok,no)=>{
          const tx=db.transaction(['sources','originals','metadata'],'readwrite'),store=tx.objectStore('sources'),rows=store.getAll(),notes=tx.objectStore('metadata').get('library');let error:unknown
          notes.onsuccess=()=>{try{
            const before=rows.result as LibrarySource[],metadata=validateMetadata(notes.result??emptyMetadata(),before),after=before.filter(s=>s.id!==id)
            const instruments=new Set(after.flatMap(s=>s.inventory.entries.map(e=>e.instrumentId)));metadata.aliases=metadata.aliases.filter(a=>instruments.has(a.instrumentId))
            metadata.annotations=metadata.annotations.filter(a=>a.ref.sourceId!==id)
            for(const bank of metadata.banks)bank.entries=bank.entries.filter(ref=>ref.sourceId!==id)
            tx.objectStore('metadata').put(validateMetadata(metadata,after),'library');store.delete(id);tx.objectStore('originals').delete(id)
          }catch(e){error=e;tx.abort()}}
          tx.oncomplete=()=>ok();tx.onabort=()=>no(error??tx.error??Error('Library source removal failed'))
        }),
        metadata:()=>new Promise((ok,no)=>{
          const tx=db.transaction(['sources','metadata'],'readonly'),sources=tx.objectStore('sources').getAll(),value=tx.objectStore('metadata').get('library')
          tx.oncomplete=()=>{try{ok(validateMetadata(value.result??emptyMetadata(),sources.result))}catch(e){no(e)}};tx.onabort=()=>no(tx.error??Error('Library metadata read failed'))
        }),
        setMetadata:value=>new Promise((ok,no)=>{
          const copy=structuredClone(value),tx=db.transaction(['sources','metadata'],'readwrite'),sources=tx.objectStore('sources').getAll();let error:unknown
          sources.onsuccess=()=>{try{tx.objectStore('metadata').put(validateMetadata(copy,sources.result),'library')}catch(e){error=e;tx.abort()}}
          tx.oncomplete=()=>ok();tx.onabort=()=>no(error??tx.error??Error('Library metadata write failed'))
        }),
        list:()=>new Promise((ok,no)=>{
          const tx=db.transaction('sources','readonly'),r=tx.objectStore('sources').getAll()
          tx.oncomplete=()=>ok(r.result as LibrarySource[]);tx.onabort=()=>no(tx.error??Error('Library read failed'))
        }),
        original:id=>new Promise((ok,no)=>{
          const tx=db.transaction('originals','readonly'),r=tx.objectStore('originals').get(id)
          tx.oncomplete=()=>r.result instanceof Uint8Array?ok(r.result):no(Error('Library source missing'))
          tx.onabort=()=>no(tx.error??Error('Library read failed'))
        }),
        insert:async(source,bytes)=>(await merge([{source,bytes}]))===1,
        merge,
        close:()=>db.close(),
      })
    }
  })
}
