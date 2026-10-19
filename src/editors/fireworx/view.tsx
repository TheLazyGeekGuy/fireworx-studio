import {useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import type {EditorViewContext,EditorViewProps} from '../../editor-host/view-contract'
import {useLanguage} from '../../i18n'
import {usePresetExchange} from '../../use-preset-exchange'
import {EditorMidiMonitor} from '../../EditorMidiMonitor'
import {EditorHistoryTools} from '../../editor-host/EditorHistoryTools'
import {EditorControlSearch} from '../../EditorControlSearch'
import {filterEditorControls} from '../../editor-host/control-search'
import {PresentationTools} from '../../editor-host/PresentationTools'
import type {FireworxSession} from './module'
import {fireworxModule} from './module'
import {validateState,patchName} from './model'
import {createBrowserEnvironment} from './browser-environment'
import {createPageLocale,french} from './locales'
import {inheritedColors} from './appearance'
import {UserManual} from './UserManual'
import type {ManualSection} from './manual-content'
import {mountPage} from './page/mount.js'
import template from './page/template.html?raw'
import baseStyle from './page/style.css?raw'
import appearanceStyle from './page/appearance.css?raw'
import settingsStyle from './page/settings.css?raw'
import matrixStyle from './page/matrix-viewport.css?raw'
import randomizerStyle from './page/randomizer.css?raw'
import modulationStyle from './page/settings-modulation.css?raw'
import dspStyle from './page/dsp-budget.css?raw'
import richStyle from './page/rich-render.css?raw'
const styles=[baseStyle,appearanceStyle,settingsStyle,matrixStyle,randomizerStyle,modulationStyle,dspStyle,richStyle].join('\n')+`
 :host{display:block;min-width:0;width:100%;contain:layout style}.fw-root{font-size:14px;position:relative;min-width:0;max-width:100%;overflow:auto;height:calc(100dvh - 100px);min-height:600px}
 .fw-root main{max-width:none}.fw-root .tabs[hidden]{display:none!important}.fw-root #protocol,.fw-root #modulation{display:none!important}
 .fw-root .appearance-tools{margin:0;padding:5px 10px;min-height:36px}.fw-root .mono-status>span{display:none}.fw-root .module-inherit{font-size:11px;padding:5px 8px}
 .fw-root .rack-caption{display:none}.fw-root .notice{margin:0 8px;padding:5px 8px}.fw-root.monobloc-mode main{height:100%;min-height:0}
 @media(max-width:850px){.fw-root{height:auto;min-height:700px}.fw-root.monobloc-mode main{height:auto;min-height:700px}}
`
type Mounted={environment:ReturnType<typeof createBrowserEnvironment>;page:any;locale:ReturnType<typeof createPageLocale>;root:HTMLElement}
export function FireworxView({context,onDocumentationReady,...props}:EditorViewProps&{context:EditorViewContext;onDocumentationReady?:(open:(()=>void)|undefined)=>void}){
 const session=context.session as FireworxSession,language=useLanguage(),host=useRef<HTMLDivElement>(null),mounted=useRef<Mounted|null>(null)
 const latest=useRef({props,language});latest.current={props,language}
 const [error,setError]=useState(''),[monitor,setMonitor]=useState(false),[manual,setManual]=useState<ManualSection|null>(null),[screenRevision,setScreenRevision]=useState(0)
 useEffect(()=>{onDocumentationReady?.(()=>setManual('start'));return()=>onDocumentationReady?.(undefined)},[onDocumentationReady])
 const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot)
 const t=(key:string)=>language==='fr'?(french[key]??key):key
 usePresetExchange(context.presets,{id:context.id,moduleId:fireworxModule.manifest.id,stateVersion:1,name:'TC Electronic FireworX',isLocked:()=>session.getSnapshot().locked,capture:()=>({name:patchName(validateState(session.serialize())),state:session.serialize()}),validate:validateState,load:value=>session.dispatch({type:'replace',state:value})},context.lifecycle?.signal)
 useLayoutEffect(()=>{
  const element=host.current!;const shadow=element.shadowRoot??element.attachShadow({mode:'open'}),sheet=new CSSStyleSheet(),root=document.createElement('div')
  // Constructed CSS and CSSOM setters work under style-src 'self'; no inline
  // <style> node, HTML style attribute, nonce or weakened deployment CSP.
  sheet.replaceSync(styles);shadow.adoptedStyleSheets=[sheet];root.className='fw-root';root.innerHTML=template;shadow.replaceChildren(root)
  const hydrateStyles=()=>{for(const el of root.querySelectorAll<HTMLElement|SVGElement>('[data-fw-style]')){const value=el.getAttribute('data-fw-style')!;el.removeAttribute('data-fw-style');el.style.cssText=value}}
  hydrateStyles();const styleObserver=new MutationObserver(hydrateStyles);styleObserver.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-fw-style']})
  const environment=createBrowserEnvironment(root,context,session);environment.setActive(latest.current.props.active);environment.setColors(inheritedColors(latest.current.props.appearance))
  let page:any,detach:()=>void=()=>{},locale:ReturnType<typeof createPageLocale>|undefined
  try{
   page=mountPage(environment);detach=session.attach(page);if(environment.autoConnect)page.startAutoConnect()
   // Dialogs are created on demand. Delegate rather than patching only the
   // links present at mount, so MIDI / Buffer never navigates to source files.
   root.addEventListener('click',event=>{
    const anchor=(event.target as Element).closest?.('a[href^="../../docs/"]')
    if(anchor){event.preventDefault();setManual('limitations')}
   })
   locale=createPageLocale(root,latest.current.language,()=>{const state=session.getSnapshot().state as {patch?:{readOnlyView?:{name?:string}}};return state.patch?.readOnlyView?.name?[state.patch.readOnlyView.name]:[]});mounted.current={environment,page,locale,root}
   let publishing=false
   environment.setOnState(()=>{if(publishing)return;publishing=true;try{session.changed()}finally{publishing=false}})
   const publish=()=>queueMicrotask(()=>{if(!session.disposed&&mounted.current?.environment===environment)session.changed()})
   root.addEventListener('change',publish);root.addEventListener('input',publish);root.addEventListener('click',publish)
   const tools=root.querySelector('.appearance-tools')!,inherit=document.createElement('button');inherit.className='module-inherit';inherit.textContent='Use host appearance';inherit.onclick=()=>page.appearance.inherit();tools.append(inherit)
   locale.paint()
   environment.setActive(latest.current.props.active);root.inert=latest.current.props.locked
  }catch(e){console.error('FireworX mount failed',e);setError(String(e));environment.dispose();styleObserver.disconnect()}
  let cleaned=false
  const cleanup=()=>{if(cleaned)return;cleaned=true
   environment.setOnState(()=>{});mounted.current=null;locale?.dispose();detach();page?.dispose();environment.dispose();styleObserver.disconnect();shadow.replaceChildren();shadow.adoptedStyleSheets=[]
  }
  const off=context.lifecycle?.onDispose(cleanup)
  return()=>{off?.();cleanup()}
 },[context,session])
 useEffect(()=>{const current=mounted.current;if(!current)return;current.environment.setColors(inheritedColors(props.appearance));current.page.appearance.refresh()},[props.appearance])
 useEffect(()=>{const root=mounted.current?.root;if(root){(root.querySelector('#undo') as HTMLButtonElement).disabled=snapshot.history.undo===0;(root.querySelector('#redo') as HTMLButtonElement).disabled=snapshot.history.redo===0}},[snapshot.history])
 useEffect(()=>{const current=mounted.current;if(current){current.environment.setActive(props.active);current.root.inert=props.locked}},[props.active,props.locked])
 useEffect(()=>{mounted.current?.locale.set(language)},[language])
 const checkpoint=useRef(props.checkpoint);checkpoint.current=props.checkpoint
 useEffect(()=>{checkpoint.current(snapshot.state);try{localStorage.setItem(`midi-studio.fireworx.state.${context.id}.v1`,JSON.stringify(snapshot.state))}catch{/* explicit JSON export remains available */}},[snapshot.state,context.id])
 // Project the exact current LCD SVG into the shared inline/floating screen service.
 const image=useRef<HTMLImageElement|null>(null),screenSource=useRef('')
 useEffect(()=>{
  const current=mounted.current;if(!current)return;const {root,environment}=current,rack=root.querySelector('#rack')!;let alive=true,pending=0,picture:HTMLImageElement|null=null
  const refresh=()=>{pending=0;const svg=rack.querySelector('svg[viewBox="0 0 262 124"]');if(!svg||!alive)return
   const style=getComputedStyle(root),source=new XMLSerializer().serializeToString(svg).replace(/var\((--[a-z-]+)\)/g,(_all,key:string)=>style.getPropertyValue(key).trim()||'#111111')
   if(source===screenSource.current)return;screenSource.current=source;if(picture)picture.onload=null;picture=new Image();const next=picture;next.onload=()=>{if(alive){image.current=next;setScreenRevision(n=>n+1)}};next.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source)
  }
  const observer=new MutationObserver(records=>{if(pending)return;const lcd=rack.querySelector('svg[viewBox="0 0 262 124"]');if(records.some(r=>r.type==='childList'||lcd?.contains(r.target)))pending=environment.requestAnimationFrame(refresh)})
  observer.observe(rack,{subtree:true,childList:true,attributes:true,characterData:true});refresh()
  const cleanup=()=>{alive=false;observer.disconnect();environment.cancelAnimationFrame(pending);if(picture)picture.onload=null;image.current=null;screenSource.current=''}
  const off=context.lifecycle?.onDispose(cleanup);return()=>{off?.();cleanup()}
 },[context])
 const screens=useMemo(()=>[{id:'fireworx-lcd',label:'FireworX LCD',width:524,height:248,draw:(canvas:CanvasRenderingContext2D)=>{canvas.fillStyle='#aecb55';canvas.fillRect(0,0,524,248);if(image.current)canvas.drawImage(image.current,0,0,524,248)}}],[screenRevision])
 return <section className="fireworx-module" style={{minWidth:0,width:'100%'}}>
  <div ref={host} data-fireworx-instance={context.id}/>
  {error&&<p role="alert">{error} <button onClick={()=>setError('')}>{t('Close')}</button></p>}
  <footer className="fireworx-utilities">
   <details className="module-midi-monitor" onToggle={e=>setMonitor(e.currentTarget.open)}><summary>{t('MIDI monitor')}</summary>{monitor&&<EditorMidiMonitor source={session.monitor}/>}</details>
   <button onClick={()=>setManual('start')}>{t('User manual')}</button><button onClick={()=>setManual('storage')}>{t('Local data')}</button>
   <details className="module-editor-tools"><summary>{t('Editor tools')}</summary><EditorControlSearch getOptions={query=>filterEditorControls(session.controls(),query)} selectedKey={String(snapshot.selection??'')} select={id=>session.dispatch({type:'focus',id})} ariaLabel="FireworX parameter search"/><EditorHistoryTools session={session} snapshot={snapshot} active={props.active} onError={e=>setError(String(e))}/><PresentationTools preferences={props.presentation} screens={screens}/></details>
  </footer>
  {manual&&<UserManual language={language} section={manual} themeSource={mounted.current?.root} onClose={()=>setManual(null)}/>}

 </section>
}
