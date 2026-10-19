export interface OfflineState {supported:boolean;ready:boolean;online:boolean;waiting:boolean;failed:boolean}
let state:OfflineState={supported:false,ready:false,online:true,waiting:false,failed:false}
const listeners=new Set<()=>void>()
export const getOfflineState=()=>({...state})
export const subscribeOffline=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}}
const update=(patch:Partial<OfflineState>)=>{state={...state,...patch};for(const fn of listeners)try{fn()}catch{/* observer isolation */}}
let started=false
export function startOffline(base:URL,enabled:boolean){
  // Local previews are rebuilt in place. Pinning them to an offline build hides fixes
  // even after a reload with the HTTP cache disabled. Published offline apps retain
  // the existing session-safe update policy.
  if(['localhost','127.0.0.1','[::1]'].includes(base.hostname))return
  if(started||!enabled||!window.isSecureContext||!('serviceWorker'in navigator))return
  started=true;update({supported:true,online:navigator.onLine})
  let registration:ServiceWorkerRegistration|undefined,busy=false
  const observed=new WeakSet<ServiceWorkerRegistration>()
  const inspect=async(repair=false)=>{
    const worker=registration?.active;if(!worker)return
    const channel=new MessageChannel()
    const used=(globalThis.performance?.getEntriesByType?.('resource')??[]).map(entry=>entry.name).filter(url=>url.startsWith(base.href)).slice(-512)
    const result=await new Promise<boolean>(resolve=>{const timer=setTimeout(()=>{channel.port1.close();resolve(false)},30000);channel.port1.onmessage=event=>{if(event.data?.type!=='OFFLINE_STATUS')return;clearTimeout(timer);channel.port1.close();resolve(event.data.ready===true)};try{worker.postMessage({type:repair?'PREPARE':'STATUS',used},[channel.port2])}catch{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(false)}})
    update({ready:result,failed:!result,waiting:!!registration?.waiting})
  }
  const register=async()=>{
    if(busy)return;busy=true
    try{
      // A cold offline navigation may reject register()'s network update check even though our worker is active.
      const existing=await navigator.serviceWorker.getRegistration(base.href)
      if(existing?.scope===base.href){registration=existing;update({waiting:!!existing.waiting});if(existing.active)await inspect();if(!navigator.onLine)return}
      registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'})
      const watch=(worker:ServiceWorker|null)=>worker?.addEventListener('statechange',()=>{update({waiting:!!registration?.waiting});if(worker.state==='activated')void inspect();if(worker.state==='redundant'&&!registration?.active)update({failed:true})})
      if(!observed.has(registration)){observed.add(registration);watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration?.installing??null))}
      update({waiting:!!registration.waiting});if(registration.active){await inspect();if(!state.ready&&navigator.onLine)await inspect(true)}
    }catch{update({failed:true})}finally{busy=false}
  }
  window.addEventListener('offline',()=>update({online:false}))
  window.addEventListener('online',()=>{update({online:true});void register()})
  navigator.serviceWorker.addEventListener('controllerchange',()=>{void inspect()})
  void register()
}
