// Deterministic build integration, never runtime executable loading.
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url)),source=JSON.parse(readFileSync(resolve(root,'src/editor-modules.json'),'utf8'))
const metadata=JSON.parse(readFileSync(resolve(root,'src/editor-catalog.json'),'utf8'))
export function generateRegistrations(entries){
 if(!Array.isArray(entries)||entries.length>1024)throw Error('Invalid editor module declarations')
 const ids=new Set()
 for(const e of entries){
  if(!e||!/^[-a-z0-9]+-editor$/.test(e.id)||ids.has(e.id)||e.enabled!==undefined&&typeof e.enabled!=='boolean')throw Error('Invalid editor module ID')
  ids.add(e.id)
  for(const kind of ['module','view']){const v=e[kind];if(!v||!/^\.\.\/(?:editors|instruments)\/[A-Za-z0-9_/-]+$/.test(v.path)||v.path.split('/').slice(1).includes('..')||!/^[$A-Z_a-z][$\w]*$/.test(v.export)||v.index!==undefined&&(!Number.isInteger(v.index)||v.index<0||v.index>255))throw Error('Invalid editor source reference')}
 }
 const enabled=entries.filter(e=>e.enabled!==false)
 return Object.fromEntries(['module','view'].map(kind=>{
  const imports=enabled.map((e,i)=>`import {${e[kind].export} as entry${i}} from '${e[kind].path}'`).join('\n')
  const values=enabled.map((e,i)=>`entry${i}${e[kind].index===undefined?'':`[${e[kind].index}]`}`).join(', ')
  const name=kind==='module'?'generatedModules':'generatedViews',type=kind==='module'?'EditorModule':'EditorViewRegistration',typeFile=kind==='module'?'contracts':'view-contract',member=kind==='module'?'manifest.id':'moduleId'
  return [kind,`// Generated from src/editor-modules.json. Run npm run modules:generate; do not edit.\nimport type {${type}} from './${typeFile}'\n${imports}\nexport const ${name}:readonly ${type}[]=Object.freeze([${values}])\nconst declaredIds=${JSON.stringify(enabled.map(e=>e.id))}\nif(${name}.some((entry,index)=>entry?.${member}!==declaredIds[index]))throw Error('Editor declaration/export mismatch')\n`]
 }))
}
export function generateLazyRegistrations(entries,catalog=metadata,sourcePath=path=>path,javascript=false){
 generateRegistrations(entries) // Validate source references before emitting executable imports.
 const enabled=entries.filter(e=>e.enabled!==false)
 const lines=enabled.map(e=>{
  const descriptor=catalog[e.id];if(!descriptor||descriptor.manifest?.id!==e.id)throw Error('Missing lazy editor metadata')
  const ref=(kind,index)=>`entries[${index}].${e[kind].export}${e[kind].index===undefined?'':`[${e[kind].index}]`}`
  return `{...${JSON.stringify(descriptor)},load:async()=>{const entries=await Promise.all([import(${JSON.stringify(sourcePath(e.module.path))}),import(${JSON.stringify(sourcePath(e.view.path))})]);return {module:${ref('module',0)},view:${ref('view',1)}}}}`
 })
 return `// Generated from editor-modules.json and editor-catalog.json; do not edit.\n${javascript?'':"import type {LazyEditorDefinition} from './lazy-installation'\n"}export const generatedLazyEditors${javascript?'':':readonly LazyEditorDefinition[]'}=[\n${lines.join(',\n')}\n]\n`
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const generated=generateRegistrations(source)
 for(const kind of ['module','view']){
  const target=resolve(root,`src/editor-host/generated-${kind}s.ts`),text=generated[kind]
  if(process.argv.includes('--check')){if(!existsSync(target)||readFileSync(target,'utf8')!==text)throw Error('Stale editor registrations: npm run modules:generate')}
  else writeFileSync(target,text)
 }
 const lazyTarget=resolve(root,'src/editor-host/generated-lazy-editors.ts'),lazyText=generateLazyRegistrations(source)
 if(process.argv.includes('--check')){if(!existsSync(lazyTarget)||readFileSync(lazyTarget,'utf8')!==lazyText)throw Error('Stale lazy editor registrations')}
 else writeFileSync(lazyTarget,lazyText)
 console.log(`PASS editor declarations: ${source.filter(e=>e.enabled!==false).length} installed units`)
}
