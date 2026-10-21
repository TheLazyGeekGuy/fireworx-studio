import {useEffect,useRef,useState,type ReactNode} from 'react'
import type {EditorInstallation} from './installation'
import type {NativePresenceProvider} from './native-presence'
import {createEditorInstallation} from './installation'
import {createEditorRuntime,type EditorRuntime} from './runtime'
import {automaticMidiAccess} from '../midi-permission'
import {EditorViewBoundary,EditorViewContent} from './EditorViewBoundary'
import {MidiConnectionIndicator} from '../MidiConnectionIndicator'
import {MidiSettingsButton} from './MidiSettingsButton'
import {translate,useLanguage,LanguagePicker} from '../i18n'
import {loadTheme,themes,themeStorageKey,type Theme} from '../themes'
import {validDisplayStyle,displayStyleKey,type DisplayStyle} from '../display-styles'
import type {PresetExchange} from './preset-exchange'
import {DocumentationProvider} from './DocumentationLink'

/** Mount any installed editor alone, with the same module/session/view and host policy as the workspace. */
export function StandaloneEditorApp({installation,nativePresence,tools,presetExchange,automaticMidi=true}:{installation:EditorInstallation;nativePresence?:NativePresenceProvider;tools?:ReactNode;presetExchange?:PresetExchange;automaticMidi?:boolean}){
  const [runtime,setRuntime]=useState<EditorRuntime|null>(null),[,render]=useState(0),[error,setError]=useState('')
  const [theme,setTheme]=useState<Theme>(loadTheme)
  const permission=useRef<ReturnType<typeof automaticMidiAccess>|null>(null),language=useLanguage(),t=(s:string)=>translate(s,language)
  useEffect(()=>{
    const selected=createEditorInstallation([installation])
    let display:DisplayStyle='ice';try{const saved=localStorage.getItem(displayStyleKey);if(validDisplayStyle(saved))display=saved}catch{/* optional appearance */}
    const host=createEditorRuntime({...selected,nativePresence,presetExchange,appearance:{theme:loadTheme(),displayStyle:display},autoDiscover:false,onNotice:setError,
      requestAccess:()=>{permission.current??=automaticMidiAccess();return permission.current.catch(e=>{permission.current=null;throw e})}})
    const hint=`bcr-studio.last-instance.${installation.module.manifest.modelId}`
    let id:string|undefined
    try{const saved=localStorage.getItem(hint);if(saved&&/^[a-zA-Z0-9_-]{1,100}$/.test(saved))id=saved}catch{/* optional recovery */}
    const created=host.workspace.create(installation.module.manifest.id,{id,restored:installation.view.loadInitial?.(id)})
    const presentationKey=`midi-studio.presentation.${installation.module.manifest.id}.v1`
    try{const saved=localStorage.getItem(presentationKey);if(saved){const value=JSON.parse(saved);if(Object.keys(value.instances??{}).some(key=>key!==created))throw Error('Foreign standalone presentation');host.presentation.restore(value)}}catch{/* optional preferences; preserve invalid source for manual recovery */}
    const offPresentation=host.presentation.subscribe(()=>{try{localStorage.setItem(presentationKey,JSON.stringify(host.presentation.serialize()))}catch{/* editing remains available */}})
    try{localStorage.setItem(hint,created)}catch{/* draft export remains available */}
    const off=host.workspace.subscribeShell(()=>render(n=>n+1)),offViews=host.views.subscribe(()=>render(n=>n+1))
    host.views.sync();setRuntime(host);if(automaticMidi)void host.request().catch(()=>{})
    return()=>{off();offViews();offPresentation();host.dispose()}
  },[installation,nativePresence,presetExchange,automaticMidi])
  useEffect(()=>{if(runtime&&!runtime.disposed)runtime.workspace.setDefaults({...runtime.workspace.exportState().defaults,theme})},[runtime,theme])
  const entry=runtime?.workspace.list()[0],record=entry&&runtime?.views.get(entry.id)
  const fallback=<div role="alert"><p>{t('Editor unavailable')}</p><button onClick={()=>{if(entry)runtime?.views.retry(entry.id)}}>{t('Retry editor')}</button></div>
  return <DocumentationProvider value={record?.view?.openDocumentation}><main className="studio standalone-editor" data-theme={theme}>
    {entry&&<header><strong>{entry.name}</strong> <MidiConnectionIndicator midi={runtime!.workspace.getTransport(entry.id)}/><MidiSettingsButton open={record?.view?.openMidiSettings}/><LanguagePicker/><label className="standalone-theme">{t('Global theme')}<select aria-label={t('Global theme')} value={theme} onChange={e=>{const value=e.currentTarget.value as Theme;setTheme(value);try{localStorage.setItem(themeStorageKey,value)}catch{/* optional preference */}}}>{themes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{tools}</header>}
    {entry&&record?.view?<EditorViewBoundary key={record.revision} fallback={fallback} onFault={e=>runtime!.views.fail(entry.id,e)}><EditorViewContent view={record.view} presentation={runtime!.presentation.instance(entry.id)} active locked={entry.snapshot.locked} appearance={runtime!.workspace.appearance(entry.id)} onAppearance={change=>runtime!.workspace.setAppearance(entry.id,{...entry.appearance,...change})} checkpoint={state=>{if(!runtime!.disposed&&runtime!.views.has(entry.id))runtime!.workspace.updateViewState(entry.id,state)}}/></EditorViewBoundary>:record?.error?fallback:<span>…</span>}
    {error&&<p role="status">{error}</p>}
  </main></DocumentationProvider>
}
