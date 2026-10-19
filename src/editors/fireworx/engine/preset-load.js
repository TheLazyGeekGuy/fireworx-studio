// Backup before auditioning a local copy or recalling a native memory.
// Front-panel Recall opts into guarded Recall44; local copies never STORE or PC.
import {inspectPreset,localEditFrame} from './preset-library-model.js';
export async function loadPresetCopy(frame,{session,getSession,getCurrentFrame,openLocal,saveBackup,nativeRecall=false,check=()=>{},onStatus=()=>{}}){
 const source=inspectPreset(frame);if(source.status!=='decoded')throw Error('Copie de preset décodée requise');check();
 if(session&&!session.canAudition)throw Error('Attendez la relecture des modifications avant de charger un preset');
 const original=session?.reference?.frame??getCurrentFrame();
 if(session&&!original)throw Error('Buffer matériel relu requis avant chargement');
 if(original)await saveBackup(original.slice());check();
 if(session!==getSession())throw Error('Connexion remplacée ; aucun chargement envoyé');
 const next=localEditFrame(frame);
 if(session){
  if(nativeRecall){if(typeof session.recall!=='function')throw Error('Rappel natif indisponible dans cette session');onStatus(`Rappel ${source.bank.toUpperCase()} ${source.slot} et relecture…`);await session.recall(frame);}
  else{next[4]=session.deviceId;onStatus('Chargement de P0 et relecture…');await session.audition(next,{presetSource:{bank:source.bank,slot:source.slot}});}
  check();
 }
 else{check();openLocal(next);}
 return source;
}
