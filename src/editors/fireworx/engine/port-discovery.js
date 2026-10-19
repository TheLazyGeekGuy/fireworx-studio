// A user-assigned port name may contain extra labels, either spelling and case.
// A name is only a candidate: two P0 reads and the existing lock still validate it.
export const isFireworxPortName=name=>/firewor(?:x|ks)/i.test(String(name??'').normalize('NFKC'));
export function fireworxPortPair(access){
 const candidates=ports=>[...ports.values()].filter(p=>p.state==='connected'&&isFireworxPortName(p.name));
 const inputs=candidates(access.inputs),outputs=candidates(access.outputs);
 return {input:inputs.length===1?inputs[0]:null,output:outputs.length===1?outputs[0]:null,ambiguous:inputs.length>1||outputs.length>1,ready:inputs.length===1&&outputs.length===1};
}
