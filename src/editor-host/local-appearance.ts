/** Optional, inert module-owned UI description. No CSS, URLs or MIDI payloads. */
export interface LocalTheme {
  id:string
  name:string
  scheme:'light'|'dark'
  colors:{background:string;surface:string;text:string;muted:string;accent:string;line:string}
}
export interface LocalAppearance {
  themes:readonly LocalTheme[]
  layouts:readonly {id:string;name:string;description:string}[]
  surfaces:readonly ('hardware'|'modern')[]
  renders?:readonly ('flat'|'rich')[]
  defaults:{theme:string;layout:string;surface:'hardware'|'modern';render?:'flat'|'rich'}
}

/** Validate, detach and freeze metadata without allocating a view or opening MIDI. */
export function freezeLocalAppearance(value:LocalAppearance):LocalAppearance {
  const fail=()=>{throw Error('Invalid editor local appearance')}
  const label=(s:unknown,max=80)=>typeof s==='string'&&!!s.trim()&&s.length<=max&&!/[\x00-\x1f\x7f]/.test(s)
  const id=(s:unknown)=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(s)
  const unique=(xs:readonly {id:string}[])=>new Set(xs.map(x=>x.id)).size===xs.length
  if(!value||!Array.isArray(value.themes)||!value.themes.length||value.themes.length>16||
    !Array.isArray(value.layouts)||!value.layouts.length||value.layouts.length>8||
    !Array.isArray(value.surfaces)||!value.surfaces.length||value.surfaces.length>2||
    value.surfaces.some(s=>!['hardware','modern'].includes(s))||new Set(value.surfaces).size!==value.surfaces.length)fail()
  if(value.renders!==undefined&&(!Array.isArray(value.renders)||!value.renders.length||value.renders.length>2||value.renders.some(r=>!['flat','rich'].includes(r))||new Set(value.renders).size!==value.renders.length))fail()
  if(value.defaults?.render!==undefined&&!value.renders?.includes(value.defaults.render))fail()
  if(value.renders&&!value.defaults?.render)fail()
  for(const t of value.themes){
    if(!t||!id(t.id)||!label(t.name)||!['light','dark'].includes(t.scheme)||!t.colors||
      Object.keys(t.colors).length!==6||['background','surface','text','muted','accent','line'].some(k=>!/^#[0-9a-f]{6}$/i.test((t.colors as Record<string,string>)[k]??'')))fail()
  }
  for(const l of value.layouts)if(!l||!id(l.id)||!label(l.name)||!label(l.description,240))fail()
  if(!unique(value.themes)||!unique(value.layouts)||!value.defaults||
    !value.themes.some(t=>t.id===value.defaults.theme)||!value.layouts.some(l=>l.id===value.defaults.layout)||!value.surfaces.includes(value.defaults.surface))fail()
  return Object.freeze({themes:Object.freeze(value.themes.map(t=>Object.freeze({id:t.id,name:t.name,scheme:t.scheme,colors:Object.freeze({...t.colors})}))),
    layouts:Object.freeze(value.layouts.map(l=>Object.freeze({id:l.id,name:l.name,description:l.description}))),
    surfaces:Object.freeze([...value.surfaces]),...(value.renders?{renders:Object.freeze([...value.renders])}:{}),defaults:Object.freeze({...value.defaults})})
}
