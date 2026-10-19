// Generated from src/editor-modules.json. Run npm run modules:generate; do not edit.
import type {EditorModule} from './contracts'
import {fireworxModule as entry0} from '../editors/fireworx/module'
export const generatedModules:readonly EditorModule[]=Object.freeze([entry0])
const declaredIds=["tc-electronic-fireworx-editor"]
if(generatedModules.some((entry,index)=>entry?.manifest.id!==declaredIds[index]))throw Error('Editor declaration/export mismatch')
