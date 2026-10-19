import {manualTexts} from './manual-text.generated'
export const manualSectionIds=['start','connection','facade','chain','modulation','library','files','randomizer','sysex','storage','limitations'] as const
export type ManualSection=typeof manualSectionIds[number]
export function manualFor(language:string){
 const source=language==='fr'?manualTexts.fr:manualTexts.en,parts=source.trim().split(/^## /m),lead=parts.shift()!,title=lead.split('\n')[0].replace(/^# /,'')
 const sections=parts.map((part,i)=>{const lines=part.trim().split('\n');return {id:manualSectionIds[i],title:lines.shift()!,body:lines.join('\n').trim()}})
 return {source,title,edition:lead.split('\n').slice(1).join('\n').trim(),sections}
}
