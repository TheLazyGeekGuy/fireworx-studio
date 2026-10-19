import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {LanguagePicker} from '../../i18n'
import {manualFor,type ManualSection} from './manual-content'
import {manualImages} from './manual-images.generated'
import {exportManualHtml} from './manual-export'
import './manual.css'
function inline(text:string):ReactNode[]{return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part,i)=>part.startsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part)}
/** Small safe renderer for the bundled manual dialect; never evaluates HTML. */
function prose(source:string){
 const lines=source.split('\n'),nodes:ReactNode[]=[];let i=0
 while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue}
  const figure=/^!\[([^\]]+)\]\((screenshots\/[a-z-]+\.png)\)$/.exec(line)
  if(figure){const image=manualImages[figure[2] as keyof typeof manualImages];i++;if(image)nodes.push(<figure key={i}><a href={image.src} target="_blank" rel="noopener noreferrer"><img src={image.src} alt={figure[1]} width={image.width} height={image.height} loading="lazy"/></a><figcaption>{figure[1]}</figcaption></figure>);continue}
  if(line.startsWith('```')){const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;nodes.push(<pre key={i}><code>{code.join('\n')}</code></pre>);continue}
  if(line.startsWith('- ')){const items=[];while(i<lines.length&&lines[i].startsWith('- '))items.push(lines[i++].slice(2));nodes.push(<ul key={i}>{items.map((item,j)=><li key={j}>{inline(item)}</li>)}</ul>);continue}
  const paragraph=[];while(i<lines.length&&lines[i].trim()&&!lines[i].startsWith('```')&&!lines[i].startsWith('- ')&&!lines[i].startsWith('!['))paragraph.push(lines[i++]);if(paragraph.length)nodes.push(<p key={i}>{inline(paragraph.join(' '))}</p>);else i++
 }
 return nodes
}
export function UserManual({language,section,onClose,themeSource}:{language:string;section:ManualSection;onClose():void;themeSource?:HTMLElement|null}){
 const dialog=useRef<HTMLDialogElement>(null),article=useRef<HTMLElement>(null),manual=useMemo(()=>manualFor(language),[language]),fr=language==='fr'
 const exportAbort=useRef<AbortController|null>(null),[exporting,setExporting]=useState(false),[exportError,setExportError]=useState(false)
 useEffect(()=>{const d=dialog.current!;d.showModal();return()=>{exportAbort.current?.abort();if(d.open)d.close()}},[])
 const downloadIllustrated=async()=>{
  if(exportAbort.current)return;const controller=new AbortController();exportAbort.current=controller;setExporting(true);setExportError(false)
  try{const blob=await exportManualHtml(article.current!,manual.title,language,getComputedStyle(dialog.current!),controller.signal);controller.signal.throwIfAborted();const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`FireworX-manual-${fr?'fr':'en'}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  catch{if(!controller.signal.aborted)setExportError(true)}finally{exportAbort.current=null;if(!controller.signal.aborted)setExporting(false)}
 }
 useEffect(()=>{
  if(!themeSource)return
  const sync=()=>{const style=getComputedStyle(themeSource),d=dialog.current!;for(const [target,source] of Object.entries({bg:'bg',surface:'surface',panel:'surface',input:'surface',button:'surface',text:'text',muted:'muted',line:'line',accent:'accent',selected:'selected',hover:'hover'})){const value=style.getPropertyValue('--'+source).trim();if(value)d.style.setProperty('--theme-'+target,value)}d.style.colorScheme=style.colorScheme}
  sync();const observer=new MutationObserver(sync);observer.observe(themeSource,{attributes:true,attributeFilter:['style','data-local-theme','data-local-scheme']});return()=>observer.disconnect()
 },[themeSource])
 useEffect(()=>{const id=requestAnimationFrame(()=>article.current?.querySelector(`[data-manual-section="${section}"]`)?.scrollIntoView({block:'start'}));return()=>cancelAnimationFrame(id)},[section,language])
 return <dialog ref={dialog} className="fireworx-manual" aria-labelledby="fireworx-manual-title" lang={fr?'fr':'en'} onCancel={onClose}>
  <header><div><small>FIREWORX · OS 2</small><h2 id="fireworx-manual-title">{manual.title}</h2></div><LanguagePicker/><button onClick={onClose} aria-label={fr?'Fermer le manuel':'Close manual'}>×</button></header>
  <div className="fireworx-manual-body"><nav aria-label={fr?'Sommaire':'Contents'}>{manual.sections.map(item=><button key={item.id} onClick={()=>article.current?.querySelector(`[data-manual-section="${item.id}"]`)?.scrollIntoView({block:'start'})}>{item.title}</button>)}<button data-manual-download="illustrated" disabled={exporting} onClick={()=>void downloadIllustrated()}>{exporting?(fr?'Préparation…':'Preparing…'):(fr?'↓ Manuel illustré (.html)':'↓ Illustrated manual (.html)')}</button>{exportError&&<p role="alert">{fr?'Téléchargement impossible. Réessayez.':'Download failed. Please try again.'}</p>}<a download={`FireworX-manual-${fr?'fr':'en'}.md`} href={'data:text/markdown;charset=utf-8,'+encodeURIComponent(manual.source)}>{fr?'↓ Texte Markdown':'↓ Markdown text'}</a></nav>
   <article ref={article}><p className="fireworx-manual-edition">{manual.edition}</p>{manual.sections.map(item=><section key={item.id} data-manual-section={item.id}><h3>{item.title}</h3>{prose(item.body)}</section>)}</article>
  </div>
 </dialog>
}
