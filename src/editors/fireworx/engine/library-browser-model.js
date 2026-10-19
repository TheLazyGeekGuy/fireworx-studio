// Pure local librarian operations. Metadata changes never alter preset bytes.
export const libraryRef=r=>`${r.sourceId}:${r.index}`;
const normalize=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function browsePresetRows(rows,{query='',favorite=false,source='',tag='',algorithm='',sort='original',duplicates='show',note=()=>null}={}){
 const q=normalize(query.trim()),seen=new Set();
 let result=rows.filter(r=>{const n=note(r);return(!favorite||n?.favorite)&&(!source||r.sourceId===source)&&(!tag||n?.tags?.includes(tag))&&(!algorithm||r.nodes?.some(n=>n.algorithm===algorithm))&&(!q||normalize([n?.name||r.name,r.factoryName,r.description,r.label,r.preset,r.alphaText,r.sourceName,n?.tags?.join(' '),...r.nodes?.map(n=>n.algorithm)??[]].join(' ')).includes(q));});
 // Filter the view only. Do not remove bank references or original sources.
 result=result.filter(r=>{const k=duplicates==='name'?normalize(note(r)?.name||r.name):duplicates==='content'?r.contentHash:null;if(!k||r.status==='unread')return true;if(seen.has(k))return false;seen.add(k);return true;});
 if(sort!=='original')result=result.toSorted((a,b)=>(sort==='recent'?String(b.at??'').localeCompare(String(a.at??'')):sort==='source'?String(a.sourceName??'').localeCompare(String(b.sourceName??'')):normalize(note(a)?.name||a.name).localeCompare(normalize(note(b)?.name||b.name)))||libraryRef(a).localeCompare(libraryRef(b)));
 return result;
}
export const libraryDragType='application/x-midi-studio-preset';
export function parseLibraryDrag(text){
 const value=JSON.parse(text);
 if(!value||!/^([0-9a-f]{64})$/.test(value.sourceId)||!Number.isInteger(value.index)||value.index<0)throw Error('Référence de preset invalide');
 if(value.bankId!==undefined&&(typeof value.bankId!=='string'||!(/^[a-zA-Z0-9_-]{1,100}$/).test(value.bankId)))throw Error('Banque source invalide');
 if(value.bankIndex!==undefined&&(!Number.isInteger(value.bankIndex)||value.bankIndex<0))throw Error('Position de banque invalide');
 return value;
}
export function reorderLibraryBank(bank,from,to,ref){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=bank.entries.length||to<0||to>=bank.entries.length)throw Error('Position de banque invalide');
 if(libraryRef(bank.entries[from])!==libraryRef(ref))throw Error('La banque a changé ; sélectionnez à nouveau le preset');
 const next=bank.entries.slice(),[item]=next.splice(from,1);next.splice(to,0,item);return next;
}
