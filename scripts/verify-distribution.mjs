import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveDistribution,declarations} from '../build/distribution.mjs'
export function verifyDistribution(directory){
 const manifest=JSON.parse(readFileSync(path.join(directory,'midi-studio-build.json'),'utf8'))
 assert.equal(manifest.format,'midi-studio-distribution');assert.equal(manifest.version,1)
 const selection=resolveDistribution({modules:manifest.modules,mode:manifest.mode,library:manifest.library})
 assert.match(manifest.registrationSha256,/^[a-f0-9]{64}$/);assert.ok(existsSync(path.join(directory,'index.html')))
 assert.ok(Array.isArray(manifest.includedSources)&&manifest.includedSources.length>0)
 const sources=new Set(manifest.includedSources)
 assert.ok([...sources].every(s=>typeof s==='string'&&s.startsWith('src/')&&!s.includes('..')))
 const reference=e=>'src/'+e.module.path.slice(3)
 const entries=new Set(declarations.filter(e=>selection.modules.includes(e.id)).map(reference))
 const hasEntry=entry=>[...sources].some(s=>s.replace(/\.tsx?$/,'')===entry)
 for(const entry of entries)assert.ok(hasEntry(entry),`Selected implementation missing: ${entry}`)
 for(const entry of declarations.filter(e=>!selection.modules.includes(e.id)).map(reference))if(!entries.has(entry))assert.equal(hasEntry(entry),false,`Excluded implementation bundled: ${entry}`)
 if(selection.mode==='standalone')assert.equal(sources.has('src/editor-host/WorkspaceApp.tsx'),false)
 if(selection.mode!=='legacy'&&!selection.modules.some(id=>['bcr32-editor','bcr2000-editor','bcf2000-editor'].includes(id)))assert.equal(sources.has('src/App.tsx'),false)
 if(!selection.library)assert.equal(sources.has('src/library/LibraryPanel.tsx'),false)
 for(const model of ['mini','compact','classic','extender']){
  const included=selection.modules.includes(`xtouch-${model}-editor`)
  assert.equal(sources.has(`src/editors/xtouch-family/data/${model}.json`),included,`Unexpected family inventory: ${model}`)
 }
 for(const aggregate of ['model.ts','module.ts','registration.tsx','session.ts','protocol.ts','view.tsx','panel.tsx'])
  assert.equal(sources.has(`src/editors/xtouch-family/${aggregate}`),false,`Compatibility aggregate bundled: ${aggregate}`)
 return {modules:selection.modules,mode:selection.mode,sourceFiles:sources.size,sharedFamilies:'Selected X-TOUCH inventories enforced; common helpers and public assets may remain'}
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{console.log('PASS distribution artifact: '+JSON.stringify(verifyDistribution(process.argv[2]??'dist')))}catch(e){console.error(e.message);process.exitCode=1}
