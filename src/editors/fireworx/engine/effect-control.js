export function effectControlState(display,family,familyFor){
 const nodes=display.nodes.filter(n=>n.row<display.rows&&familyFor(n.algorithm).id===family);
 return {nodes,present:!!nodes.length,enabled:nodes.some(n=>!n.muted),mixed:nodes.some(n=>n.muted)&&nodes.some(n=>!n.muted)};
}
// Selection is independent. Mixed state: mute all, then reactivate all.
export function effectControlAction(display,family,familyFor){
 const {nodes,enabled}=effectControlState(display,family,familyFor);
 return nodes.length?{kind:'toggle',ids:nodes.map(n=>n.id),muted:enabled}:{kind:'library'};
}
