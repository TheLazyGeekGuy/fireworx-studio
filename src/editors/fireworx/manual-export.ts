/** One offline document: no scripts, remote images, application state or MIDI. */
export async function exportManualHtml(article:HTMLElement,title:string,language:string,style:CSSStyleDeclaration,signal:AbortSignal){
 const copy=article.cloneNode(true) as HTMLElement
 await Promise.all([...copy.querySelectorAll<HTMLImageElement>('img')].map(async img=>{
  const response=await fetch(img.src,{signal});if(!response.ok)throw Error('Manual image unavailable')
  const blob=await response.blob(),data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})
  signal.throwIfAborted();img.src=data;img.removeAttribute('loading');const anchor=img.closest('a');if(anchor)anchor.replaceWith(img)
 }))
 signal.throwIfAborted()
 const doc=document.implementation.createHTMLDocument(title);doc.documentElement.lang=language==='fr'?'fr':'en'
 const charset=doc.createElement('meta');charset.setAttribute('charset','utf-8');doc.head.append(charset)
 const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1';doc.head.append(meta)
 const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";doc.head.prepend(policy)
 // Serialize CSS as text: never attach an inline stylesheet to the live app.
 const css=`body{font:16px/1.65 system-ui,sans-serif;max-width:1000px;margin:auto;padding:24px;background:${style.backgroundColor};color:${style.color}}h1{line-height:1.2}h2,h3{margin-top:2em;line-height:1.3}figure{margin:24px 0}img{display:block;max-width:100%;height:auto}figcaption{font-size:13px;color:${style.getPropertyValue('--theme-muted')}}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border:1px solid ${style.getPropertyValue('--theme-line')}}code{overflow-wrap:anywhere}@media(max-width:600px){body{padding:14px}}`
 const heading=doc.createElement('h1');heading.textContent=title;doc.body.append(heading,copy)
 return new Blob(['<!doctype html>\n',doc.documentElement.outerHTML.replace('</head>','<style>'+css+'</style></head>')],{type:'text/html;charset=utf-8'})
}
