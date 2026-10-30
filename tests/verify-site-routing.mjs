import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {build} from 'esbuild'
const result=await build({stdin:{contents:"export * from './src/deployment-base'",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'})
const module={exports:{}};new Function('module','exports',result.outputFiles[0].text)(module,module.exports)
for(const path of ['/editor/','/editor/index.html','/editor','/?editor=tc-electronic-fireworx-editor'])assert.equal(module.exports.deploymentBase('https://example.test'+path).href,'https://example.test/')
for(const path of ['/fireworx-studio/editor/','/fireworx-studio/editor/index.html','/fireworx-studio/editor?midi=manual'])assert.equal(module.exports.deploymentBase('https://example.test'+path).href,'https://example.test/fireworx-studio/')
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),site=read('index.html'),js=read('site/site.js'),editor=read('editor/index.html')
assert.ok(!site.includes('/src/main.tsx')&&!site.includes('id="root"'),'presentation does not mount the editor')
assert.ok(!/<style\b|\sstyle="/i.test(site),'presentation respects style-src self CSP')
assert.ok(!js.includes('requestMIDIAccess'),'presentation does not request MIDI')
assert.ok(site.includes('href="./editor/"'));assert.ok(editor.includes('/src/main.tsx'))
assert.ok(!site.includes('fonts.googleapis.com'),'no remote font dependency')
for(const m of site.matchAll(/(?:src|href)="\.\/site\/assets\/([^"#]+)"/g))assert.ok(existsSync(new URL('../public/site/assets/'+m[1],import.meta.url)),`Missing asset: ${m[1]}`)
for(const m of js.matchAll(/\.\/site\/assets\/([^"'#]+)/g))assert.ok(existsSync(new URL('../public/site/assets/'+m[1],import.meta.url)),`Missing JS i18n asset: ${m[1]}`)
assert.ok(read('build/offline.mts').includes("'editor/index.html'"));assert.ok(read('build/offline-worker.js').includes('editorNavigation'))
console.log('PASS site routing: presentation at root, editor entry at /editor/, legacy deep links preserved, root/subpath assets and separate offline navigation, no MIDI or remote fonts on landing page')
