/** Neutral local-file envelope, not a device dump, executable module or MIDI command. */
export const editorPresetFormat='midi-studio-editor-preset' as const
export const editorPresetLimit=4*1024*1024
export function isEditorPreset(bytes:Uint8Array){
 if(bytes.length>editorPresetLimit)return false
 let i=bytes[0]===239&&bytes[1]===187&&bytes[2]===191?3:0
 while([9,10,13,32].includes(bytes[i]))i++
 if(bytes[i]!==123)return false // Do not decode every binary library merely to reject it as JSON.
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))?.format===editorPresetFormat}catch{return false}
}
export interface EditorPresetDocument {format:typeof editorPresetFormat;version:1;moduleId:string;stateVersion:number;name:string;editorName?:string;state:unknown}
export function validateEditorPreset(value:unknown):EditorPresetDocument{
 const p=value as EditorPresetDocument
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['format','version','moduleId','stateVersion','name','editorName','state'].includes(k))||p.format!==editorPresetFormat||p.version!==1||typeof p.moduleId!=='string'||! /^[a-z][a-z0-9-]{0,63}$/.test(p.moduleId)||!Number.isSafeInteger(p.stateVersion)||p.stateVersion<1||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||/[\u0000-\u001f\u007f]/.test(p.name)||p.editorName!==undefined&&(typeof p.editorName!=='string'||!p.editorName.trim()||p.editorName.length>100||/[\u0000-\u001f\u007f]/.test(p.editorName))||!Object.hasOwn(p,'state'))throw Error('Invalid editor preset document')
 const json=JSON.stringify(p)
 if(new TextEncoder().encode(json).length>editorPresetLimit)throw Error('Editor preset size limit')
 return JSON.parse(json) as EditorPresetDocument
}
export function readEditorPreset(bytes:Uint8Array):EditorPresetDocument{
 if(!bytes.length||bytes.length>editorPresetLimit)throw Error('Editor preset size limit')
 return validateEditorPreset(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))
}
export const writeEditorPreset=(value:unknown)=>new TextEncoder().encode(JSON.stringify(validateEditorPreset(value)))
export function editorPresetInventory(bytes:Uint8Array){
 const p=readEditorPreset(bytes)
 return {format:editorPresetFormat,version:1 as const,endian:'big' as const,layout:'contained' as const,chunks:[],warnings:[],entries:[{index:0,offset:0,size:bytes.length,name:p.name,location:p.moduleId,comment:'Local editor state; no hardware transmission',module:null,model:null,instrumentId:`editor:${p.moduleId}`,instrumentName:p.editorName??p.moduleId,blocks:[],opaque:false}]}
}
