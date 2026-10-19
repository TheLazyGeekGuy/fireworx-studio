export interface PresentationSettings {activeZoom:boolean;screenScale:number}
export type PresentationOverride=Partial<PresentationSettings>
export interface PresentationState {version:1;defaults:PresentationSettings;instances:Record<string,PresentationOverride>}
export function validatePresentation(value:unknown):PresentationState {
 const v=value as PresentationState
 const check=(p:PresentationOverride,partial=false)=>{
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['activeZoom','screenScale'].includes(k))||
   (!partial||p.activeZoom!==undefined)&&typeof p.activeZoom!=='boolean'||(!partial||p.screenScale!==undefined)&&
   (typeof p.screenScale!=='number'||!Number.isFinite(p.screenScale)||p.screenScale<1||p.screenScale>3))throw Error('Invalid presentation settings')
 }
 if(!v||v.version!==1||!v.instances||typeof v.instances!=='object'||Array.isArray(v.instances)||Object.keys(v.instances).length>32)throw Error('Invalid presentation state')
 check(v.defaults)
 for(const [id,override]of Object.entries(v.instances)){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid presentation instance');check(override,true)}
 return {version:1,defaults:{...v.defaults},instances:Object.fromEntries(Object.entries(v.instances).map(([id,p])=>[id,{...p}]))}
}
/** Independent workspace-owned preferences. No DOM, persistence, transport or import-time effects. */
export function createPresentationPreferences(initial?:unknown){
 let state=validatePresentation(initial??{version:1,defaults:{activeZoom:false,screenScale:1},instances:{}})
 Object.freeze(state.defaults)
 const globalListeners=new Set<()=>void>(),bindings=new Map<string,PresentationInstance>()
 const emit=()=>{for(const binding of bindings.values())binding.refresh();for(const fn of globalListeners)try{fn()}catch{/* isolate observers */}}
 const update=(next:unknown)=>{state=validatePresentation(next);Object.freeze(state.defaults);emit()}
 const override=(id:string)=>Object.hasOwn(state.instances,id)?state.instances[id]:undefined
 const setDefaults=(patch:PresentationOverride)=>update({...state,defaults:{...state.defaults,...patch}})
 const global:PresentationInstance={getSnapshot:()=>state.defaults,subscribe(fn){globalListeners.add(fn);return()=>{globalListeners.delete(fn)}},set:setDefaults,reset:()=>setDefaults({activeZoom:false,screenScale:1}),isInherited:()=>false,refresh(){},dispose(){}}
 return {
  serialize:()=>validatePresentation(state),
  subscribe(fn:()=>void){globalListeners.add(fn);return()=>{globalListeners.delete(fn)}},
  setDefaults,global:()=>global,
  restore(value:unknown){update(value)},
  release(id:string){bindings.get(id)?.dispose();bindings.delete(id);if(Object.hasOwn(state.instances,id)){const instances={...state.instances};delete instances[id];update({...state,instances})}},
  instance(id:string):PresentationInstance {
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid presentation instance')
   if(bindings.has(id))return bindings.get(id)!
   const listeners=new Set<()=>void>();let closed=false
   const resolve=()=>Object.freeze({...state.defaults,...override(id)})
   let cached=resolve()
   const binding:PresentationInstance={
    getSnapshot:()=>cached,subscribe(fn){if(closed)return()=>{};listeners.add(fn);return()=>{listeners.delete(fn)}},
    set(patch){if(closed)throw Error('Presentation instance disposed');update({...state,instances:{...state.instances,[id]:{...override(id),...patch}}})},
    reset(){if(closed)throw Error('Presentation instance disposed');const instances={...state.instances};delete instances[id];update({...state,instances})},
    isInherited:key=>override(id)?.[key]===undefined,
    refresh(){if(closed)return;const next=resolve();if(next.activeZoom===cached.activeZoom&&next.screenScale===cached.screenScale)return;cached=next;for(const fn of listeners)try{fn()}catch{/* isolate observers */}},
    dispose(){closed=true;listeners.clear()}
   }
   bindings.set(id,binding);return binding
  },
  dispose(){for(const binding of bindings.values())binding.dispose();bindings.clear();globalListeners.clear()}
 }
}
export interface PresentationInstance {
 getSnapshot():Readonly<PresentationSettings>;subscribe(fn:()=>void):()=>void
 set(patch:PresentationOverride):void;reset():void;isInherited(key:keyof PresentationSettings):boolean
 /** Host lifecycle, not a module operation. */
 refresh():void;dispose():void
}
