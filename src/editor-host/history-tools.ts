import type {EditorSession} from './contracts'

export type HistoryDirection='undo'|'redo'
export interface EditorHistoryTool {
  canRun:(direction:HistoryDirection)=>boolean
  run:(direction:HistoryDirection)=>boolean
}
/** No subscription or second state store; commands always consult the authoritative session. */
export function createHistoryTool(session:Pick<EditorSession,'getSnapshot'|'dispatch'>):EditorHistoryTool {
  const canRun=(direction:HistoryDirection)=>{
    const snapshot=session.getSnapshot()
    return !snapshot.locked&&snapshot.history[direction]>0
  }
  return {canRun,run(direction){if(!canRun(direction))return false;session.dispatch({type:direction});return true}}
}
export function historyShortcut(event:Pick<KeyboardEvent,'defaultPrevented'|'isComposing'|'altKey'|'metaKey'|'ctrlKey'|'key'|'shiftKey'|'target'>):HistoryDirection|null {
  if(event.defaultPrevented||event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=='z')return null
  const target=event.target as {closest?:(selector:string)=>unknown;isContentEditable?:boolean}|null
  if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return null
  return event.shiftKey?'redo':'undo'
}
export function bindHistoryShortcuts(target:Pick<Window,'addEventListener'|'removeEventListener'>,tool:EditorHistoryTool,onError?:(error:unknown)=>void):()=>void {
  const key=(event:KeyboardEvent)=>{
    const direction=historyShortcut(event)
    if(!direction||!tool.canRun(direction))return
    event.preventDefault()
    try{tool.run(direction)}catch(error){if(onError)onError(error);else throw error}
  }
  target.addEventListener('keydown',key)
  return ()=>target.removeEventListener('keydown',key)
}
