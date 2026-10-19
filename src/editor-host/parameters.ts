/** Optional shared parameter service. No translator, controller or UI dependency. */
export interface ParameterEndpoint {id:string;name:string;minimum:number;maximum:number;setLocal:(value:number,trace:string[])=>void}
export interface ParameterEvent {id:string;value:number;trace:string[]}
export function createParameterBus(){
  const endpoints=new Map<string,ParameterEndpoint>(),listeners=new Set<(event:ParameterEvent)=>void>(),catalogListeners=new Set<(id:string)=>void>()
  const changed=(id:string)=>{for(const fn of catalogListeners)fn(id)}
  return {list:()=>[...endpoints.values()].map(({id,name,minimum,maximum})=>({id,name,minimum,maximum})),
    register(endpoint:ParameterEndpoint){if(endpoints.has(endpoint.id)||!endpoint.id||!Number.isInteger(endpoint.minimum)||!Number.isInteger(endpoint.maximum)||endpoint.minimum>endpoint.maximum)throw Error('Invalid parameter endpoint');endpoints.set(endpoint.id,endpoint);changed(endpoint.id);return()=>{if(endpoints.get(endpoint.id)===endpoint){endpoints.delete(endpoint.id);changed(endpoint.id)}}},
    publish(id:string,value:number,trace:string[]=[]){const p=endpoints.get(id);if(!p||!Number.isInteger(value)||value<p.minimum||value>p.maximum||trace.length>8)throw Error('Invalid parameter event');for(const fn of listeners)fn({id,value,trace:[...trace]})},
    setLocal(id:string,value:number,trace:string[]){const p=endpoints.get(id);if(!p||!Number.isInteger(value)||value<p.minimum||value>p.maximum||trace.length>8)throw Error('Invalid parameter target');p.setLocal(value,[...trace])},
    subscribe(fn:(event:ParameterEvent)=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},
    onEndpointChange(fn:(id:string)=>void){catalogListeners.add(fn);return()=>{catalogListeners.delete(fn)}},
    clear(){for(const id of [...endpoints.keys()]){endpoints.delete(id);changed(id)}listeners.clear();catalogListeners.clear()}}
}
export type ParameterBus=ReturnType<typeof createParameterBus>
