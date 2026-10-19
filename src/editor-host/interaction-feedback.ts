/** Shared vocabulary: an editor supplies labels/values, never raw MIDI to another editor. */
export interface ControlActivity {
  controlId:string
  label:string
  value:number|null
  source:'ui'|'hardware'|'local'|'selection'
}
export function activityDisplay(activity:ControlActivity,width=7){
  const ascii=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?').slice(0,width)
  return {top:ascii(activity.label),bottom:activity.value===null?'N/A':ascii(String(activity.value))}
}

/** Latest-wins task queue for stateful feedback (display/motor), not ordered button edges.
 * No MIDI dependency, global state, timers at construction, or work after cancellation/disposal.
 * The adapter rechecks its current lease, protocol and touch state inside each task.
 */
export function createFeedbackTasks(options:{delay?:number;failed:(error:unknown)=>void;setTimer?:(fn:()=>void,ms:number)=>unknown;clearTimer?:(timer:unknown)=>void}){
  let timer:unknown=null,epoch=0,closed=false
  const tasks=new Map<string,()=>void>()
  const setTimer=options.setTimer??((fn,ms)=>setTimeout(fn,ms)),clearTimer=options.clearTimer??(id=>clearTimeout(id as ReturnType<typeof setTimeout>))
  const cancel=()=>{epoch++;if(timer!==null)clearTimer(timer);timer=null;tasks.clear()}
  return {
    offer(key:string,task:()=>void){
      if(closed)return
      if(!key||key.length>100||!tasks.has(key)&&tasks.size>=32)throw Error('Feedback task budget exceeded')
      tasks.set(key,task)
      if(timer===null){const revision=epoch;timer=setTimer(()=>{
        timer=null;const batch=[...tasks.values()];tasks.clear()
        for(const run of batch){if(closed||revision!==epoch)return;try{run()}catch(e){cancel();options.failed(e);return}}
      },options.delay??60)}
    },
    discard(key:string){tasks.delete(key)},
    cancel,
    dispose(){cancel();closed=true},
  }
}
