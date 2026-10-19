import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {Icon} from '../Icon'
import {translate,useLanguage} from '../i18n'
import {libraryInstruments,openLibraryStorage,importLibraryFile,type LibrarySource,type LibraryStorage} from './storage'
import {emptyMetadata,annotate,queryLibrary,entryKey,type LibraryMetadata,type EntryRef,type Annotation} from './metadata'
import {exportLibraryArchive,restoreLibraryArchive,archiveLimits} from './archive'
import {extractEntry,entryMessage,createFileAdapters,type FileAdapter} from './adapters'
import {writeSmf} from './midi-files'
import {createLibraryParser,type LibraryParser} from './parser'
import {runImportJob,type ImportProgress} from './import-job'
import {editorPresetFormat,readEditorPreset,writeEditorPreset} from './editor-preset'
import type {PresetExchange,PresetEndpointInfo} from '../editor-host/preset-exchange'
const emptyEndpoints:readonly PresetEndpointInfo[]=Object.freeze([]),noEndpoints=()=>emptyEndpoints,noSubscribe=()=>()=>{}

function download(bytes:BlobPart|Uint8Array,name:string,type='application/octet-stream'){
  const payload=bytes instanceof Uint8Array?new Uint8Array(bytes):bytes
  const url=URL.createObjectURL(new Blob([payload],{type})),link=document.createElement('a')
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function LibraryPanel({close,storageFactory,parser,adapters,exchange}:{close:()=>void;storageFactory?:()=>Promise<LibraryStorage>;parser?:LibraryParser;adapters?:readonly FileAdapter[];exchange?:PresetExchange}){
  const language=useLanguage(),t=(s:string)=>translate(s,language),dialog=useRef<HTMLDialogElement>(null)
  const storage=useRef<LibraryStorage|null>(null),alive=useRef(true),job=useRef<AbortController|null>(null)
  const [sources,setSources]=useState<LibrarySource[]>([]),[metadata,setMetadata]=useState<LibraryMetadata>(emptyMetadata)
  const [selected,setSelected]=useState(''),[query,setQuery]=useState(''),[instrumentQuery,setInstrumentQuery]=useState(''),[page,setPage]=useState(0),[favorites,setFavorites]=useState(false),[sort,setSort]=useState<'name'|'source'|'original'>('name')
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reports,setReports]=useState<ImportProgress[]>([])
  const [importRunning,setImportRunning]=useState(false)
  const [focus,setFocus]=useState<EntryRef|null>(null),[draft,setDraft]=useState<Omit<Annotation,'at'>>({name:'',tags:[],favorite:false}),[preview,setPreview]=useState('')
  const [bankName,setBankName]=useState(''),[bankRefs,setBankRefs]=useState<EntryRef[]>([]),[bankId,setBankId]=useState('')
  const endpoints=useSyncExternalStore(exchange?.subscribe??noSubscribe,exchange?.getSnapshot??noEndpoints,exchange?.getSnapshot??noEndpoints),[targetId,setTargetId]=useState(''),[exchangeNotice,setExchangeNotice]=useState('')
  const target=endpoints.find(e=>e.id===targetId)
  const refresh=async(db:LibraryStorage)=>{const [rows,notes]=await Promise.all([db.list(),db.metadata?.()??emptyMetadata()]);if(alive.current){setSources(rows);setMetadata(notes)}}
  useEffect(()=>{
    alive.current=true;dialog.current?.showModal();let local:LibraryStorage|null=null,cancelled=false
    void (storageFactory??openLibraryStorage)().then(async db=>{if(cancelled){db.close();return}local=db;storage.current=db;await refresh(db);if(!cancelled)setReady(true)}).catch(e=>{if(!cancelled)setError(String(e))})
    return()=>{cancelled=true;alive.current=false;job.current?.abort();job.current=null;storage.current=null;local?.close()}
  },[storageFactory])
  const run=async(fn:(db:LibraryStorage)=>Promise<void>)=>{const db=storage.current;if(!db||job.current)return false;setError('');setBusy(true);const controller=new AbortController();job.current=controller;try{await fn(db);return true}catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));return false}finally{if(job.current===controller)job.current=null;if(alive.current){setBusy(false);setImportRunning(false)}}}
  const saveMetadata=async(next:LibraryMetadata)=>run(async db=>{if(!db.setMetadata)throw Error('Library metadata unavailable');await db.setMetadata(next);if(alive.current)setMetadata(next)})
  const saveAnnotation=()=>{if(!focus)return;try{void saveMetadata(annotate(metadata,sources,focus,draft))}catch(e){setError(e instanceof Error?e.message:String(e))}}
  const createBank=()=>{const next=structuredClone(metadata),id=crypto.randomUUID();next.banks.push({id,name:bankName.trim(),entries:[...bankRefs]});void saveMetadata(next).then(saved=>{if(saved&&alive.current){setBankId(id);setBankRefs([]);setBankName('')}})}
  const instruments=useMemo(()=>libraryInstruments(sources).map(i=>({...i,name:metadata.aliases.find(a=>a.instrumentId===i.id)?.name??i.name})),[sources,metadata.aliases])
  const instrument=instruments.find(i=>i.id===selected)??instruments[0],bank=metadata.banks.find(b=>b.id===bankId)
  const entries=useMemo(()=>{
    const rows=queryLibrary(sources,metadata,{instrumentId:bank?undefined:instrument?.id,query,favorites,sort})
    if(!bank)return rows
    const byKey=new Map(rows.map(row=>[entryKey({sourceId:row.source.id,index:row.entry.index}),row]))
    return bank.entries.flatMap(ref=>{const row=byKey.get(entryKey(ref));return row?[row]:[]})
  },[sources,metadata,instrument?.id,query,favorites,sort,bank])
  const lastPage=Math.max(0,Math.ceil(entries.length/100)-1),visiblePage=Math.min(page,lastPage)
  const focusedSource=focus&&sources.find(s=>s.id===focus.sourceId),focused=focusedSource&&focus?focusedSource.inventory.entries[focus.index]:null
  const revisions=focus?metadata.annotations.find(a=>entryKey(a.ref)===entryKey(focus))?.revisions??[]:[]
  const captureEditor=()=>void run(async db=>{
    if(!exchange||!target)throw Error('Editor preset target unavailable')
    const doc=exchange.capture(targetId),bytes=writeEditorPreset(doc),signal=job.current!.signal
    signal.throwIfAborted()
    await importLibraryFile(db,`${doc.name.replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,70)||'preset'}.editor.json`,bytes,createFileAdapters(adapters).read)
    await refresh(db);if(alive.current)setExchangeNotice('Editor preset saved in the local library.')
  })
  const loadEditor=()=>{
    if(!exchange||!target||!focus||!focusedSource||focusedSource.inventory.format!==editorPresetFormat)return
    if(!window.confirm(t('Load this preset into the selected editor?')))return
    // Capture the exact registration before awaiting storage; a reopened same-ID instance is not this target.
    const source=focusedSource,index=focus.index
    void run(async db=>{const destination=exchange.target(targetId),signal=job.current!.signal,bytes=await db.original(source.id);signal.throwIfAborted();destination.load(readEditorPreset(extractEntry(bytes,source.inventory,index)));if(alive.current)setExchangeNotice('Library preset loaded locally; hardware sending disabled.')})
  }
  const selectEntry=(ref:EntryRef)=>{const source=sources.find(s=>s.id===ref.sourceId),entry=source?.inventory.entries[ref.index];if(!entry)return;setFocus(ref);const note=metadata.annotations.find(a=>entryKey(a.ref)===entryKey(ref))?.revisions.at(-1);setDraft(note?{name:note.name,tags:[...note.tags],favorite:note.favorite}:{name:entry.name,tags:[],favorite:false});setPreview('')}
  const importFiles=(files:File[])=>run(async db=>{
    setImportRunning(true)
    setReports([]);const rows:ImportProgress[]=[]
    const parse=parser??(adapters?async(bytes:Uint8Array,signal?:AbortSignal)=>{signal?.throwIfAborted();return createFileAdapters(adapters).read(bytes)}:createLibraryParser())
    await runImportJob(db,files,{signal:job.current!.signal,parse,progress:value=>{rows.push(value);if(alive.current)setReports([...rows])}})
    await refresh(db);if(alive.current)setPage(0)
  })
  const alias=(name:string)=>{if(!instrument||(metadata.aliases.find(a=>a.instrumentId===instrument.id)?.name??'')===name.trim())return;const next=structuredClone(metadata);next.aliases=next.aliases.filter(a=>a.instrumentId!==instrument.id);if(name.trim())next.aliases.push({instrumentId:instrument.id,name:name.trim()});void saveMetadata(next)}
  const bankMove=(index:number,offset:number)=>{if(!bank)return;const next=structuredClone(metadata),list=next.banks.find(b=>b.id===bank.id)!.entries,target=index+offset;if(target<0||target>=list.length)return;[list[index],list[target]]=[list[target],list[index]];void saveMetadata(next)}
  const status=(s:ImportProgress['status'])=>t(s==='imported'?'Imported':s==='duplicate'?'Already imported':s==='cancelled'?'Cancelled':'Import rejected')
  return <dialog ref={dialog} className="library-dialog" aria-labelledby="library-title" onCancel={close}>
    <header><div><h2 id="library-title">{t('Instrument library')}</h2><small>LIB · PRF · SYX · SMF · {t('Local only · no MIDI transmission')}</small></div><button aria-label={t('Close')} onClick={close}><Icon name="close"/></button></header>
    <div className="library-actions">
      <label>{t('Import sound files')}<input aria-label={t('Import sound files')} type="file" accept={createFileAdapters(adapters).list().flatMap(a=>a.extensions).join(',')} multiple disabled={!ready||busy} onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void importFiles(files)}}/></label>
      <button disabled={!ready||busy||!sources.length} onClick={()=>void run(async db=>download(await exportLibraryArchive(db),'midi-studio-library.json','application/json'))}>{t('Backup library')}</button>
      <label>{t('Restore library')}<input aria-label={t('Restore library')} type="file" accept=".json" disabled={!ready||busy} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void run(async db=>{if(file.size>archiveLimits.text)throw Error('Archive text limit');await restoreLibraryArchive(db,await file.text(),adapters);await refresh(db)})}}/></label>
      {importRunning&&<button onClick={()=>job.current?.abort()}>{t('Cancel import')}</button>}
      <span role="status">{busy?t(importRunning?'Importing…':'Working…'):`${instruments.length} ${t('Instruments')} · ${sources.length} ${t('Files')}`}</span>
    </div>
    {error&&<p className="library-error" role="alert">{error}</p>}
    {exchange&&<section className="library-editor-exchange" aria-label={t('Editor presets')}>
      <label>{t('Editor instance')}<select aria-label={t('Editor instance')} value={target?targetId:''} disabled={busy} onChange={e=>{setTargetId(e.target.value);setExchangeNotice('')}}><option value="">{t('Choose…')}</option>{endpoints.map(e=><option key={e.id} value={e.id}>{e.instanceName??e.name} · {e.id.slice(0,8)}</option>)}</select></label>
      <button disabled={!ready||busy||!target} onClick={captureEditor}>{t('Save editor preset to library')}</button>
      <button disabled={!ready||busy||!target||!focusedSource||focusedSource.inventory.format!==editorPresetFormat||focused?.instrumentId!==`editor:${target.moduleId}`} onClick={loadEditor}>{t('Load entry into editor')}</button>
      {!focusedSource||focusedSource.inventory.format!==editorPresetFormat?<small>{t('Opaque entries require a model-specific decoder.')}</small>:null}
      {exchangeNotice&&<p role="status">{t(exchangeNotice)}</p>}
    </section>}
    <div className="library-body"><nav aria-label={t('Instruments')}><label>{t('Search instruments')}<input type="search" value={instrumentQuery} onChange={e=>setInstrumentQuery(e.target.value)}/></label>
      {instruments.filter(i=>i.name.toLowerCase().includes(instrumentQuery.toLowerCase())).slice(0,100).map(i=><button key={i.id} aria-pressed={!bank&&i.id===instrument?.id} onClick={()=>{setSelected(i.id);setBankId('');setQuery('');setPage(0);setFocus(null)}}><strong>{i.name}</strong><small>{i.count}</small></button>)}
      {metadata.banks.length>0&&<h3>{t('Local banks')}</h3>}{metadata.banks.map(b=><button key={b.id} aria-pressed={bankId===b.id} onClick={()=>{setBankId(b.id);setPage(0);setFocus(null)}}>{b.name}<small>{b.entries.length}</small></button>)}
    </nav>
    <section className="library-entries"><h3>{bank?.name??instrument?.name??t('No instruments yet')}</h3>
      {!bank&&instrument&&<label>{t('Instrument alias')}<input key={instrument.id+instrument.name} aria-label={t('Instrument alias')} maxLength={80} disabled={busy} defaultValue={metadata.aliases.find(a=>a.instrumentId===instrument.id)?.name??''} placeholder={instrument.name} onBlur={e=>alias(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>}
      <div className="library-filters"><label>{t('Search library')}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></label><label className="library-check"><input type="checkbox" checked={favorites} onChange={e=>{setFavorites(e.target.checked);setPage(0)}}/>{t('Favorites only')}</label><label>{t('Sort library')}<select value={sort} disabled={!!bank} onChange={e=>setSort(e.target.value as typeof sort)}><option value="name">{t('Patch name')}</option><option value="source">{t('Source')}</option><option value="original">{t('Original order')}</option></select></label></div>
      <div className="library-table"><table><thead><tr><th>{t('Select')}</th><th>{t('Patch name')}</th><th>{t('Location')}</th><th>{t('Source')}</th></tr></thead><tbody>{entries.slice(visiblePage*100,visiblePage*100+100).map(({source,entry,note},position)=>{const ref={sourceId:source.id,index:entry.index},key=entryKey(ref);return <tr key={`${key}:${position}`} data-selected={focus&&entryKey(focus)===key||undefined}>
        <td><input aria-label={`${t('Select')} ${entry.name}`} type="checkbox" checked={bankRefs.some(r=>entryKey(r)===key)} onChange={e=>setBankRefs(list=>e.target.checked?[...list,ref]:list.filter(r=>entryKey(r)!==key))}/></td>
        <td><button className="library-entry-name" onClick={()=>selectEntry(ref)}>{note?.favorite?'★ ':''}{note?.name||entry.name}</button>{note?.name&&note.name!==entry.name&&<small>{entry.name}</small>}{note?.tags.length?<small>{note.tags.join(' · ')}</small>:null}</td><td>{entry.location||'—'}</td><td title={source.id}>{source.name}<small>{t(entry.opaque?'Opaque data':'Structured data')} · {entry.size} B</small></td></tr>})}</tbody></table></div>
      {!sources.length&&<p>{t('Import LIB files to add their instruments automatically.')}</p>}
      <div className="library-pages"><button disabled={visiblePage===0} onClick={()=>setPage(visiblePage-1)}>{t('Previous')}</button><output>{visiblePage+1} / {lastPage+1} · {entries.length}</output><button disabled={visiblePage===lastPage} onClick={()=>setPage(visiblePage+1)}>{t('Next')}</button></div>
      <details className="library-bank-tools"><summary>{t('Local banks')} · {bankRefs.length}</summary><div className="library-bank-row"><input aria-label={t('Bank name')} value={bankName} maxLength={80} onChange={e=>setBankName(e.target.value)}/><button disabled={busy||!bankName.trim()||!bankRefs.length} onClick={createBank}>{t('Create local bank')}</button></div>{bank&&<ol>{bank.entries.map((ref,index)=><li key={index}>{sources.find(s=>s.id===ref.sourceId)?.inventory.entries[ref.index]?.name}<button disabled={busy||index===0} aria-label={`${t('Move up')} ${index+1}`} onClick={()=>bankMove(index,-1)}>↑</button><button disabled={busy||index===bank.entries.length-1} aria-label={`${t('Move down')} ${index+1}`} onClick={()=>bankMove(index,1)}>↓</button></li>)}</ol>}</details>
      {focused&&focus&&focusedSource&&<details open className="library-inspector"><summary>{t('Entry details')} · {focused.name}</summary><div className="library-note-fields"><label>{t('Local patch name')}<input value={draft.name} maxLength={255} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label><label>{t('Tags')}<input value={draft.tags.join(', ')} onChange={e=>setDraft(d=>({...d,tags:[...new Set(e.target.value.split(',').map(t=>t.trim()).filter(Boolean))]}))}/></label><label className="library-check"><input type="checkbox" checked={draft.favorite} onChange={e=>setDraft(d=>({...d,favorite:e.target.checked}))}/>{t('Favorite')}</label><button disabled={busy} onClick={saveAnnotation}>{t('Save annotation')}</button>
        {revisions.length>0&&<label>{t('Annotation revision')}<select defaultValue="" onChange={e=>{const revision=revisions[Number(e.target.value)];if(revision)setDraft({name:revision.name,tags:revision.tags,favorite:revision.favorite})}}><option value="">—</option>{revisions.map((revision,index)=><option key={index} value={index}>{index+1} · {revision.name}</option>)}</select></label>}
      </div><div className="library-bank-row"><button disabled={busy} onClick={()=>void run(async db=>{const bytes=await db.original(focusedSource.id),slice=extractEntry(bytes,focusedSource.inventory,focus.index);setPreview(Array.from(slice.subarray(0,256),b=>b.toString(16).padStart(2,'0')).join(' '))})}>{t('Inspect bytes')}</button><button disabled={busy} onClick={()=>void run(async db=>download(new Uint8Array(extractEntry(await db.original(focusedSource.id),focusedSource.inventory,focus.index)),`entry-${focus.index+1}.bin`))}>{t('Export raw entry')}</button>{entryMessage(focusedSource.inventory,focus.index)&&<button disabled={busy} onClick={()=>download(writeSmf([entryMessage(focusedSource.inventory,focus.index)!]),`entry-${focus.index+1}.mid`)}>{t('Export MIDI file')}</button>}</div><pre>{preview}</pre><pre>{JSON.stringify({offset:focused.offset,size:focused.size,blocks:focused.blocks,uses:focused.uses??[]},null,2)}</pre></details>}
    </section></div>
    <footer><details><summary>{t('Sources and import reports')} · {sources.length}</summary>{sources.map(source=><section key={source.id}><strong>{source.name}</strong><span>{source.inventory.format} · {source.inventory.entries.length} · {source.size} B</span><button disabled={busy} onClick={()=>void run(async db=>download(new Uint8Array(await db.original(source.id)),source.name))}>{t('Export original')}</button><button onClick={()=>download(JSON.stringify(source,null,2),`${source.name}.report.json`,'application/json')}>{t('Export report')}</button><pre>{source.inventory.warnings.join('\n')}</pre></section>)}</details>{reports.length>0&&<output role="status">{reports.map(r=>`${r.completed}/${r.total} ${r.file} · ${status(r.status)} · ${r.entries}${r.error?' · '+r.error:''}`).join('\n')}</output>}</footer>
  </dialog>
}
