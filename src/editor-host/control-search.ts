/** Opaque keys and labels: no profile shape, physical address or device selection here. */
export interface EditorControlOption {key:string;title:string;detail?:string;search?:string}
export const normalizeControlSearch=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
export function filterEditorControls<T extends EditorControlOption>(options:readonly T[],query:string):T[]{
  const terms=normalizeControlSearch(query).trim().split(/\s+/).filter(Boolean)
  if(!terms.length)return [...options]
  return options.filter(option=>{const text=normalizeControlSearch(`${option.key} ${option.title} ${option.detail??''} ${option.search??''}`);return terms.every(term=>text.includes(term))})
}
