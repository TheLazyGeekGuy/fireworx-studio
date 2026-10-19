// Incident containment, not a manufacturer transport capability declaration.
// Explicitly scoped scalar and full-editor transports may reopen. Legacy benches stay locked.
// #67: structuralSettle is the silent pause after any full Data20 image of P0 (structural
// edit or audition): cautious start value, at least 8 s, to be measured on hardware.
export const structuralSettleBounds=Object.freeze({min:8000,max:30000});
export const guardedLivePolicy=Object.freeze({profile:'guarded-scalars',settle:4500,structuralSettle:8000,minWriteInterval:3000,timeout:22000,initialReadGap:3000});
export const editorLivePolicy=Object.freeze({...guardedLivePolicy,profile:'verified-editor',writeClasses:Object.freeze({scalar:'DataPart21 17/19 o',structure:'Data20 P0 complet après GET de contrôle'})});
export const hardwareIncident = Object.freeze({
 id:'2026-10-17-panel-freeze',
 automaticConnection:true,
 message:'Éditeur réactivé dans le buffer temporaire P0. Paramètres éprouvés : écritures courtes. Blocs, routage, algorithmes et modulations : une image P0 complète (Data20) après un GET de contrôle, puis 8 s sans aucun message. Deux lectures initiales, un envoi à la fois et relecture obligatoire. Aucun STORE automatique. Une sauvegarde User / Carte distincte exige une préparation, les sauvegardes des originaux et une confirmation de destination ; persistance matérielle non validée.',
});
export function assertHardwareSessionAvailable(profile){if(![guardedLivePolicy.profile,editorLivePolicy.profile].includes(profile))throw new Error('Connexion matérielle suspendue pour les anciens transports et bancs de restauration ; utilisez un transport vérifié de l’éditeur.');}
