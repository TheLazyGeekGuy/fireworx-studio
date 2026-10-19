import type {LibraryStorage} from './storage'
import {importLibraryFile} from './storage'
import {parseInline,type LibraryParser} from './parser'
export interface ImportFile {name:string;size:number;arrayBuffer:()=>Promise<ArrayBuffer>}
export interface ImportProgress {completed:number;total:number;file:string;status:'imported'|'duplicate'|'rejected'|'cancelled';entries:number;error?:string}
export async function runImportJob(storage:LibraryStorage,files:readonly ImportFile[],options:{signal?:AbortSignal;parse?:LibraryParser;progress?:(value:ImportProgress)=>void}={}){
  if(files.length>64||files.some(f=>!Number.isSafeInteger(f.size)||f.size<0||f.size>32*1024*1024)||files.reduce((n,f)=>n+f.size,0)>128*1024*1024)throw Error('Import batch budget exceeded')
  const reports:ImportProgress[]=[]
  for(const file of files){
    if(options.signal?.aborted)break
    let report:ImportProgress
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size)throw Error('Import file size changed')
      const inventory=await (options.parse??parseInline)(bytes,options.signal);options.signal?.throwIfAborted()
      const result=await importLibraryFile(storage,file.name,bytes,()=>inventory)
      // If abort arrives during a committed transaction, report that committed file truthfully, then stop.
      report={completed:reports.length+1,total:files.length,file:file.name,status:result.inserted?'imported':'duplicate',entries:inventory.entries.length}
    }catch(e){report={completed:reports.length+1,total:files.length,file:file.name,status:options.signal?.aborted?'cancelled':'rejected',entries:0,error:e instanceof Error?e.message:String(e)}}
    reports.push(report);options.progress?.(report)
  }
  return {reports,cancelled:!!options.signal?.aborted}
}
