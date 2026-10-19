declare module 'virtual:midi-studio-distribution' {
 export const generatedLazyEditors:readonly import('./editor-host/lazy-installation').LazyEditorDefinition[]
 export const distribution:{modules:readonly string[];mode:'standalone';library:boolean}
 export const loadWorkspace:undefined
 export const loadLegacy:undefined
 export const loadLibrary:undefined|(()=>Promise<{default:typeof import('./library/LibraryTool').LibraryTool}>)
}
