// Generated from src/editor-modules.json. Run npm run modules:generate; do not edit.
import type {EditorViewRegistration} from './view-contract'
import {fireworxView as entry0} from '../editors/fireworx/registration'
export const generatedViews:readonly EditorViewRegistration[]=Object.freeze([entry0])
const declaredIds=["tc-electronic-fireworx-editor"]
if(generatedViews.some((entry,index)=>entry?.moduleId!==declaredIds[index]))throw Error('Editor declaration/export mismatch')
