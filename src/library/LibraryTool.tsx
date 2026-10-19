import {useState,lazy,Suspense} from 'react'
import {Icon} from '../Icon'
import {translate,useLanguage} from '../i18n'
import type {LibraryStorage} from './storage'
import type {LibraryParser} from './parser'
import type {FileAdapter} from './adapters'
import type {PresetExchange} from '../editor-host/preset-exchange'
import './library.css'
const LibraryPanel=lazy(()=>import('./LibraryPanel').then(m=>({default:m.LibraryPanel})))

/** Shared local tool, composed by the application; no editor/session/transport dependency. */
export function LibraryTool({storageFactory,parser,adapters,exchange}:{storageFactory?:()=>Promise<LibraryStorage>;parser?:LibraryParser;adapters?:readonly FileAdapter[];exchange?:PresetExchange}={}){
  const [open,setOpen]=useState(false),language=useLanguage(),t=(s:string)=>translate(s,language)
  return <><button className="library-launch" title={t('Instrument library')} aria-label={t('Instrument library')} onClick={()=>setOpen(true)}><Icon name="folder"/><span>{t('Instrument library')}</span></button>{open&&<Suspense fallback={<p role="status">…</p>}><LibraryPanel close={()=>setOpen(false)} storageFactory={storageFactory} parser={parser} adapters={adapters} exchange={exchange}/></Suspense>}</>
}
