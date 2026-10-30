import {StrictMode,Suspense,lazy,Component,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {generatedLazyEditors,loadLibrary} from 'virtual:midi-studio-distribution'
import {createLazyEditorInstallation} from './editor-host/lazy-installation'
import {DocumentationLink} from './editor-host/DocumentationLink'
import {I18nProvider,useLanguage,translate} from './i18n'
import {createPresetExchange} from './editor-host/preset-exchange'
import {startOffline} from './offline'
import {deploymentBase} from './deployment-base'
import './styles.css'
import './offline.css'
import './editor-host/midi-connection.css'
const installation=createLazyEditorInstallation(generatedLazyEditors),exchange=createPresetExchange()
const LibraryTool=loadLibrary?lazy(loadLibrary):null
const tools=<><DocumentationLink/>{LibraryTool&&<Suspense fallback={<span>…</span>}><LibraryTool exchange={exchange}/></Suspense>}</>
const Editor=lazy(async()=>{const [selected,{StandaloneEditorApp}]=await Promise.all([installation.load('tc-electronic-fireworx-editor'),import('./editor-host/StandaloneEditorApp')]);return {default:()=> <StandaloneEditorApp automaticMidi={new URLSearchParams(location.search).get('midi')!=='manual'} installation={selected} tools={tools} presetExchange={exchange}/>}})
function Unavailable(){const language=useLanguage();return <div role="alert"><p>{translate('Editor unavailable',language)}</p><button onClick={()=>location.reload()}>{translate('Retry editor',language)}</button></div>}
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<Unavailable/>:this.props.children}}
startOffline(deploymentBase(),import.meta.env.PROD)
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root
root.render(<StrictMode><I18nProvider><Boundary><Suspense fallback={<p role="status">…</p>}><Editor/></Suspense></Boundary></I18nProvider></StrictMode>)
