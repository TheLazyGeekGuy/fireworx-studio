// Page languages for editors whose views are authored in one language and shown in English by a DOM pass (FireworX,
// M3000/M2000): a per-language table translates that English text (exact strings, then fragment rules that keep
// numbers and names). Tables are loaded on demand, one module per language.
export interface LanguageTable {exact:Readonly<Record<string,string>>;fragments:readonly (readonly [string,string])[]}
export interface CompiledLanguage {exact:Readonly<Record<string,string>>;fragments:readonly [RegExp,string][]}
export const PAGE_LANGUAGES=['it','de','ja','es','ru','zh'] as const
export function compileLanguage(table:LanguageTable):CompiledLanguage{
 const fragments:[RegExp,string][]=[]
 for(const [source,replacement] of table.fragments){try{fragments.push([new RegExp(source,'g'),replacement])}catch{/* an invalid rule is skipped, never fatal */}}
 return {exact:table.exact,fragments}
}
const flat=(s:string)=>s.replace(/\s+/g,' ').trim()
/** English text → target language: whole exact string first, else the fragment rules, keeping the outer spaces. */
export function applyLanguage(table:CompiledLanguage|null,english:string,{fragments=true}:{fragments?:boolean}={}):string{
 if(!table)return english
 const text=english.trim();if(!text)return english
 const exact=table.exact[flat(text)];if(exact)return english.replace(text,exact)
 if(!fragments)return english
 let out=english;for(const [pattern,replacement] of table.fragments)out=out.replace(pattern,replacement);return out
}
export type LanguageLoaders=Readonly<Record<string,()=>Promise<{default:LanguageTable}>>>
/** Loads and compiles the table of `language` (null for French/English or an unknown language). */
export async function loadLanguage(loaders:LanguageLoaders,language:string):Promise<CompiledLanguage|null>{
 const load=loaders[language];if(!load)return null
 try{return compileLanguage((await load()).default)}catch{return null}
}
