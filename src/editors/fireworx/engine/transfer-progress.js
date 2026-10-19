// Display only: the live session owns every message, timeout and verification.
export function p0ProgressText(phase){return {loading:'Lecture de la référence P0…',queued:'Variation en attente du transport…',compare:'GET de contrôle de la référence P0…',sending:'Envoi de la variation P0…','structural-settle':'Image P0 envoyée · pause DSP sans MIDI…',verify:'Relecture du FireworX…',verified:'Variation P0 relue et vérifiée · aucun STORE'}[phase]??phase;}
export function watchP0Progress(session,onStatus){
 let last=null;const paint=()=>{const phase=session.diagnostics.phase;if(phase!==last){last=phase;onStatus(p0ProgressText(phase));}};
 paint();const timer=setInterval(paint,40);return ()=>clearInterval(timer);
}
