import {readFileSync,readdirSync,rmSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {generateLazyRegistrations} from '../scripts/generate-editor-registrations.mjs'

const root=new URL('../',import.meta.url)
export const declarations=JSON.parse(readFileSync(new URL('src/editor-modules.json',root),'utf8'))
const catalog=JSON.parse(readFileSync(new URL('src/editor-catalog.json',root),'utf8'))
const version=JSON.parse(readFileSync(new URL('package.json',root),'utf8')).version
const enabled=declarations.filter(e=>e.enabled!==false)
export const profiles=Object.freeze({
 full:{modules:enabled.map(e=>e.id),mode:'legacy',library:true},
 'xtouch-mini':{modules:['xtouch-mini-editor'],mode:'standalone',library:false},
 'xtouch-one':{modules:['xtouch-one-editor'],mode:'standalone',library:false},
 'xtouch-family':{modules:enabled.filter(e=>e.id.startsWith('xtouch-')).map(e=>e.id),mode:'workspace',library:true},
})
/** Distribution selection is build input, not session state or arbitrary executable module paths. */
export function resolveDistribution(input=profiles.full){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['modules','mode','library'].includes(k)))throw Error('Invalid distribution configuration')
 const modules=input.modules
 if(!Array.isArray(modules)||modules.length<1||modules.length>1024||new Set(modules).size!==modules.length||modules.some(id=>typeof id!=='string'||!enabled.some(e=>e.id===id)))throw Error('Unknown, disabled or duplicate distribution module')
 const mode=input.mode===undefined?(modules.length===1?'standalone':'workspace'):input.mode,library=input.library===undefined?false:input.library
 if(!['legacy','standalone','workspace'].includes(mode)||typeof library!=='boolean'||mode==='standalone'&&modules.length!==1)throw Error('Invalid distribution mode/library')
 if(mode==='legacy'&&(modules.length!==enabled.length||enabled.some(e=>!modules.includes(e.id))))throw Error('Legacy route is reserved for the full distribution')
 return Object.freeze({modules:Object.freeze([...modules]),mode,library})
}
export function distributionSource(configuration,metadata=catalog){
 const selected=resolveDistribution(configuration),entries=selected.modules.map(id=>enabled.find(e=>e.id===id))
 const lazy=generateLazyRegistrations(entries,metadata,path=>'/src/'+path.slice(3),true)
 return lazy+`\nexport const distribution=${JSON.stringify(selected)}\n`+
  `export const loadWorkspace=${selected.mode==='standalone'?'undefined':"()=>import('/src/editor-host/WorkspaceApp')"}\n`+
  `export const loadLegacy=${selected.mode==='legacy'?"()=>import('/src/App')":'undefined'}\n`+
  `export const loadLibrary=${selected.library?"()=>import('/src/library/LibraryTool').then(m=>({default:m.LibraryTool}))":'undefined'}\n`
}
/** Dedicated builds keep selected previews and only reference artwork actually mentioned by emitted code. */
export function excludedPublicAssets(files,configuration,code,metadata=catalog){
 if(configuration.mode==='legacy')return []
 const previews=new Set(configuration.modules.map(id=>metadata[id].presentation.preview.src.replace(/^\//,'')))
 return files.filter(file=>file==='local-preview.html'||file.startsWith('editor-previews/')&&!previews.has(file)||file.startsWith('reference/')&&!code.includes(file))
}
export function distributionPlugin(){
 const raw=process.env.MIDI_STUDIO_DISTRIBUTION
 const configuration=resolveDistribution(raw===undefined?profiles.full:JSON.parse(raw))
 let source=distributionSource(configuration),excluded=[]
 const id='\0virtual:midi-studio-distribution',catalogFile=fileURLToPath(new URL('src/editor-catalog.json',root))
 return {name:'midi-studio-distribution',resolveId(name){if(name==='virtual:midi-studio-distribution')return id},load(name){if(name===id){
  // Watch the actual metadata input: a running dev server must not compare new views against a frozen catalog.
  this.addWatchFile?.(catalogFile)
  source=distributionSource(configuration,JSON.parse(readFileSync(catalogFile,'utf8')))
  return source
 }},generateBundle(_options,bundle){
  const includedSources=[...new Set(Object.values(bundle).filter(e=>e.type==='chunk').flatMap(e=>e.moduleIds).filter(id=>!id.startsWith('\0')).map(id=>path.relative(fileURLToPath(root),id.split('?')[0]).split(path.sep).join('/')).filter(id=>id.startsWith('src/')))].sort()
  const publicRoot=fileURLToPath(new URL('public/',root)),files=[]
  const walk=directory=>{for(const entry of readdirSync(path.join(publicRoot,directory),{withFileTypes:true})){const file=directory?directory+'/'+entry.name:entry.name;if(entry.isDirectory())walk(file);else files.push(file)}};walk('')
  excluded=excludedPublicAssets(files,configuration,Object.values(bundle).filter(e=>e.type==='chunk').map(e=>e.code).join('\n'))
  this.emitFile({type:'asset',fileName:'midi-studio-build.json',source:JSON.stringify({format:'midi-studio-distribution',version:1,applicationVersion:version,...configuration,registrationSha256:createHash('sha256').update(source).digest('hex'),includedSources,excludedPublicAssets:excluded},null,2)})
 },writeBundle:{order:'pre',handler(options){if(!options.dir)return;for(const file of excluded)rmSync(path.join(options.dir,file),{force:true})}}}
}
