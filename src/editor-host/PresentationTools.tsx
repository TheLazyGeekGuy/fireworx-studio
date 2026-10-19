import {useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import type {ControlActivity} from './interaction-feedback'
import {createPresentationPreferences,type PresentationInstance} from './presentation-preferences'
import {floatingScreenSupported,openFloatingScreen,validateScreenSize,type FloatingScreen,type ScreenRenderer} from './floating-screen'
import {translate,useLanguage} from '../i18n'
import './presentation.css'
export interface EditorScreen extends ScreenRenderer {id:string;label:string}
export function usePresentationSettings(store?:PresentationInstance){
 const fallback=useMemo(()=>createPresentationPreferences().instance('local'),[])
 const preferences=store??fallback
 const settings=useSyncExternalStore(preferences.subscribe,preferences.getSnapshot,preferences.getSnapshot)
 return {preferences,settings}
}
/** Non-overlapping activity band and optional inline/floating screens. Never sends MIDI. */
export function PresentationTools({preferences,activity,screens=[],readoutClassName=''}:{preferences?:PresentationInstance;activity?:ControlActivity|null;screens?:readonly EditorScreen[];readoutClassName?:string}){
 const {preferences:store,settings}=usePresentationSettings(preferences),language=useLanguage(),t=(s:string)=>translate(s,language)
 const [expanded,setExpanded]=useState(false),[screenId,setScreenId]=useState(''),[error,setError]=useState(''),[floating,setFloating]=useState(false)
 const canvas=useRef<HTMLCanvasElement>(null),screen= screens.find(s=>s.id===screenId)??screens[0]
 const latest=useRef(screen);latest.current=screen
 const float=useRef<FloatingScreen|null>(null),pending=useRef<AbortController|null>(null)
 const alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();float.current?.close()}},[])
 useEffect(()=>{pending.current?.abort();float.current?.close();float.current=null;setFloating(false)},[screen?.id,screen?.width,screen?.height])
 useLayoutEffect(()=>{
  if(!screen)return
  try{validateScreenSize(screen);if(canvas.current){const ctx=canvas.current.getContext('2d');if(ctx)screen.draw(ctx)}float.current?.redraw()}catch(e){setError(String(e))}
 },[screen,expanded,settings.screenScale])
 const toggle=async()=>{
  if(float.current||pending.current){pending.current?.abort();float.current?.close();return}
  if(!screen)return
  const controller=new AbortController();pending.current=controller;setError('')
  try{
   const opened=await openFloatingScreen({...screen,draw:ctx=>latest.current?.draw(ctx)},()=>{float.current=null;if(alive.current&&!controller.signal.aborted)setFloating(false)},controller.signal)
   if(controller.signal.aborted||!alive.current)opened.close();else{float.current=opened;setFloating(true)}
  }catch(e){if(alive.current&&!controller.signal.aborted)setError(String(e))}finally{if(pending.current===controller)pending.current=null}
 }
 return <section className="sp-tools">
  {activity&&<div className={`sp-activity ${readoutClassName}`} data-zoom={settings.activeZoom&&activity.source!=='selection'||undefined} aria-live="off"><span>{activity.label}</span><output>{activity.value??'—'}</output><small>{activity.source}</small></div>}
  <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary>{t('Presentation')}</summary>
   <div className="sp-options"><label><input type="checkbox" checked={settings.activeZoom} onChange={e=>store.set({activeZoom:e.target.checked})}/>{t('Zoom while adjusting')}</label><button onClick={()=>store.reset()}>{t('Use global presentation')}</button>
   {!!screens.length&&<><label>{t('Screen')}<select aria-label={t('Screen')} value={screen?.id??''} onChange={e=>setScreenId(e.target.value)}>{screens.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>{t('Screen scale')}<input aria-label={t('Screen scale')} type="range" min="1" max="3" step="0.25" value={settings.screenScale} onChange={e=>store.set({screenScale:Number(e.target.value)})}/>{settings.screenScale}×</label><button disabled={!floatingScreenSupported()} onClick={()=>void toggle()} title={!floatingScreenSupported()?t('Floating screen unavailable in this browser'):undefined}>{t(floating?'Close floating display':'Floating display')}</button></>}
   </div>{expanded&&screen&&<canvas className="sp-screen" ref={canvas} width={screen.width} height={screen.height} style={{width:`${screen.width*settings.screenScale}px`}} role="img" aria-label={screen.label}/>}
   {error&&<p role="status">{error}</p>}
  </details>
 </section>
}
