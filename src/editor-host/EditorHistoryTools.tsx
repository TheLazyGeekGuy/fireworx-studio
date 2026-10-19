import {useEffect,useMemo,useRef} from 'react'
import type {EditorSession,EditorSnapshot} from './contracts'
import {bindHistoryShortcuts,createHistoryTool} from './history-tools'
import {translate,useLanguage} from '../i18n'

/** Parent supplies its existing snapshot: no additional per-packet session subscription. */
export function EditorHistoryTools({session,snapshot,active=false,onError}:{
  session:EditorSession;snapshot:EditorSnapshot;active?:boolean;onError?:(error:unknown)=>void
}){
  const tool=useMemo(()=>createHistoryTool(session),[session]),error=useRef(onError)
  error.current=onError
  const language=useLanguage(),t=(s:string)=>translate(s,language)
  useEffect(()=>{
    if(!active)return
    return bindHistoryShortcuts(window,tool,e=>{if(error.current)error.current(e);else throw e})
  },[active,tool])
  const run=(direction:'undo'|'redo')=>{try{tool.run(direction)}catch(e){if(error.current)error.current(e);else throw e}}
  return <>{(['undo','redo'] as const).map(direction=><button key={direction} type="button"
    title={t(direction==='undo'?'Undo':'Redo')} aria-label={t(direction==='undo'?'Undo':'Redo')}
    disabled={snapshot.locked||!snapshot.history[direction]} onClick={()=>run(direction)}>{direction==='undo'?'↶':'↷'}</button>)}</>
}
