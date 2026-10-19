import type {EditorModule} from './contracts'
import {createEditorRegistry} from './registry'
import {createViewRegistry,type EditorViewRegistration} from './view-contract'
import {createEditorCatalog} from './catalog'
export interface EditorInstallation {module:EditorModule;view:EditorViewRegistration}
export type EditorHostInstallation=ReturnType<typeof createEditorInstallation>&{
  load?:(id:string)=>Promise<EditorInstallation>
  prepareRestore?:(value:unknown)=>Promise<void>
  releaseUnused?:()=>void
}
/** One matched unit for embedded/standalone composition. No factories, permission requests or browser reads. */
export function createEditorInstallation(installations:readonly EditorInstallation[]){
  for(const entry of installations)if(entry.module.manifest.id!==entry.view.moduleId)throw Error('Editor installation mismatch')
  const registry=createEditorRegistry(installations.map(e=>e.module)),views=createViewRegistry(installations.map(e=>e.view))
  return {registry,views,catalog:createEditorCatalog(registry,views)}
}
