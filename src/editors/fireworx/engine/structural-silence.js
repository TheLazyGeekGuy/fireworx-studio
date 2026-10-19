// A transport may close while the DSP is still settling. The browser boundary
// persists this deadline by physical output, independently of editor instances.
// Storage failures retain the deadline for the lifetime of this boundary.
export function createStructuralSilence({read=()=>null,write=()=>{},now=()=>performance.now(),wallNow=()=>Date.now()}={}){
 let deadline=0;
 return {
  get until(){let saved;try{saved=Number(read());}catch{}if(Number.isFinite(saved)&&saved>deadline&&saved-wallNow()<=31000)deadline=saved;return deadline?now()+deadline-wallNow():-Infinity;},
  set until(value){deadline=Math.max(deadline,wallNow()+Math.max(0,value-now()));try{write(String(deadline));}catch{/* keep local deadline */}}
 };
}
