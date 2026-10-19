import {useEffect,useId,useRef,useState} from 'react'
import type {EditorControlOption} from './editor-host/control-search'
import {translate,useLanguage} from './i18n'

export function EditorControlSearch({getOptions,selectedKey,select,ariaLabel='Control search',translateTitles=false}:{
  getOptions:(query:string)=>readonly EditorControlOption[];selectedKey:string;select:(key:string)=>void
  ariaLabel?:string;translateTitles?:boolean
}){
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0)
  const language=useLanguage(),t=(text:string)=>translate(text,language),title=(text:string)=>translateTitles?t(text):text
  const listId=useId(),list=useRef<HTMLDivElement>(null),all=getOptions('')
  const options=open?(query?getOptions(query):all):[],current=all.find(option=>option.key===selectedKey)
  const index=Math.min(active,Math.max(0,options.length-1))
  useEffect(()=>{if(open)list.current?.children[index]?.scrollIntoView({block:'nearest'})},[index,open])
  const choose=(option:EditorControlOption)=>{select(option.key);setOpen(false);setQuery('');setActive(0)}
  return <div className="control-search">
    <label>{t('Control')}<input type="text" role="combobox" aria-label={t(ariaLabel)} aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open&&options.length?`${listId}-${index}`:undefined} autoComplete="off" placeholder={t('Search name, number, CC…')} value={open?query:title(current?.title??selectedKey)}
      onFocus={()=>{setQuery('');setActive(0);setOpen(true)}} onClick={()=>setOpen(true)} onBlur={()=>{setOpen(false);setQuery('')}}
      onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true)}}
      onKeyDown={e=>{
        if(e.nativeEvent.isComposing)return
        if(e.key==='Escape'&&open){e.stopPropagation();e.preventDefault();setOpen(false);setQuery('')}
        else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(options.length-1,n+(e.key==='ArrowDown'?1:-1))))}
        else if(e.key==='Enter'&&open){e.preventDefault();if(options[index])choose(options[index])}
      }}/></label>
    {open&&<div className="control-search-results" id={listId} role="listbox" aria-label={t('Control results')} ref={list}>
      {options.map((option,i)=><button key={option.key} id={`${listId}-${i}`} type="button" role="option" aria-selected={i===index} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(option)}><span>{title(option.title)}</span>{option.detail&&<small>{option.detail}</small>}</button>)}
      {!options.length&&<p role="status">{t('No results')}</p>}
    </div>}
  </div>
}
