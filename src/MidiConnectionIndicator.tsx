import {useEffect,useRef,useState} from 'react'
import type {MidiLease} from './editor-host/midi-broker'
import {translate,useLanguage} from './i18n'

/** Shared host indicator: no session snapshots or shell renders on the MIDI hot path. */
export function MidiConnectionIndicator({midi,connected=false,label=true,activity}:{midi?:MidiLease;connected?:boolean;label?:boolean;activity?:{serial:number;source:string}}) {
  const language=useLanguage(),[online,setOnline]=useState(()=>midi?.getState().connected??connected)
  const [presence,setPresence]=useState(()=>midi?.getPresence()??null)
  const dot=useRef<HTMLSpanElement>(null)
  const pulse=useRef<(timestamp:number)=>void>(()=>{})
  useEffect(()=>{
    let animation:Animation|undefined,lastPulse=-Infinity
    const clear=()=>{animation?.cancel();animation=undefined;lastPulse=-Infinity}
    pulse.current=timestamp=>{
      if(timestamp-lastPulse<100)return
      lastPulse=timestamp
      animation?.cancel()
      animation=dot.current?.animate?.([{opacity:1},{opacity:.5}],{duration:160})
    }
    const update=()=>{setOnline(midi?.getState().connected??connected);clear()}
    const offState=midi?.onState(update)
    const offPresence=midi?.onPresence(setPresence)
    const offActivity=midi?.onActivity(event=>pulse.current(event.timestamp))
    update()
    setPresence(midi?.getPresence()??null)
    return()=>{offState?.();offPresence?.();offActivity?.();clear();pulse.current=()=>{}}
  },[midi,connected])
  useEffect(()=>{if(!midi&&connected&&activity?.serial&&activity.source!=='local')pulse.current(performance.now())},[midi,connected,activity?.serial])
  const text=translate(!online||presence==='offline'?'Offline':presence==='checking'?'Waiting for MIDI':'Connected',language)
  return <span className="midi-connection" data-connected={online&&presence!=='offline'&&presence!=='checking'} title={text}>
    <span ref={dot} className="midi-connection-dot" aria-hidden="true" />
    {label?<span>{text}</span>:<span className="midi-connection-sr">{text}</span>}
  </span>
}
