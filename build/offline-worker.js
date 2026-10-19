/* Build replaces these constants with the exact emitted asset inventory and content hashes. */
const ENTRIES = /*__ENTRIES__*/[]
const PRECACHE = /*__PRECACHE__*/null
const BUILD_ID = /*__VERSION__*/"development"
const SCOPE = new URL(self.registration.scope)
const PREFIX = 'bcr-studio-offline:' + encodeURIComponent(SCOPE.pathname) + ':'
const CACHE = PREFIX + BUILD_ID
const URLS = new Set(ENTRIES.map(entry => new URL(entry.url, SCOPE).href))
const REQUIRED = PRECACHE === null ? ENTRIES : ENTRIES.filter(entry => PRECACHE.includes(entry.url))
const INDEX = new URL('index.html', SCOPE).href
let preparing = null

async function ready() {
  const cache = await caches.open(CACHE)
  return (await Promise.all(REQUIRED.map(entry => cache.match(new URL(entry.url, SCOPE).href)))).every(Boolean)
}
async function prepare() {
  if (preparing) return preparing
  preparing = (async () => {
    if (await ready()) return
    const cache = await caches.open(CACHE)
    await Promise.all(REQUIRED.map(async entry => {
      const request = new Request(new URL(entry.url, SCOPE), { cache: 'reload', credentials: 'same-origin', integrity: entry.integrity })
      const response = await fetch(request)
      if (!response.ok || response.type === 'opaque') throw Error('Offline asset unavailable: ' + entry.url)
      await cache.put(new URL(entry.url, SCOPE).href, response)
    }))
    if (!await ready()) throw Error('Offline cache incomplete')
  })().finally(() => { preparing = null })
  return preparing
}
self.addEventListener('install', event => {
  // No skipWaiting: a new build must not take over an editor/USB MIDI session in progress.
  event.waitUntil(prepare().catch(async error => { await caches.delete(CACHE); throw error }))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})
self.addEventListener('message', event => {
  if (!['STATUS', 'PREPARE'].includes(event.data?.type)) return
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'PREPARE') await prepare()
      // First installation happens after the page has already fetched its chunks. Warm only those
      // exact same-build assets, never the whole catalog or a caller-supplied arbitrary URL.
      if(Array.isArray(event.data.used)&&event.data.used.length<=512){
        const used=new Set(event.data.used),cache=await caches.open(CACHE)
        await Promise.all(ENTRIES.filter(entry=>used.has(new URL(entry.url,SCOPE).href)).map(async entry=>{
          const url=new URL(entry.url,SCOPE).href;if(await cache.match(url))return
          const response=await fetch(new Request(url,{credentials:'same-origin',integrity:entry.integrity}))
          if(!response.ok||response.type==='opaque')throw Error('Used asset unavailable')
          await cache.put(url,response)
        }))
      }
      event.ports[0]?.postMessage({type:'OFFLINE_STATUS',ready:await ready(),build:BUILD_ID})
    } catch { event.ports[0]?.postMessage({type:'OFFLINE_STATUS',ready:false,build:BUILD_ID}) }
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== SCOPE.origin) return
  const navigation = request.mode === 'navigate' && [SCOPE.pathname, new URL(INDEX).pathname].includes(url.pathname)
  if (!navigation && !URLS.has(url.href)) return // Never cache APIs, arbitrary requests, uploads or external sites.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), cached = await cache.match(navigation ? INDEX : url.href)
    if (cached) return cached // Pin HTML and used chunks to this build, online as well as offline.
    const entry=ENTRIES.find(entry=>new URL(entry.url,SCOPE).href===(navigation?INDEX:url.href))
    const response=await fetch(new Request(navigation?INDEX:url.href,{credentials:'same-origin',integrity:entry.integrity}))
    if(response.ok&&response.type!=='opaque')await cache.put(navigation?INDEX:url.href,response.clone())
    return response
  })())
})
