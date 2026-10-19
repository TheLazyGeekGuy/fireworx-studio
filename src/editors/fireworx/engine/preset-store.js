import {validatePresetValues} from './preset-validation.js';
// Explicit per-slot persistent operation. Never uploads whole-bank 0x10/0x11 data.
import {decodeDeviceBuffer} from './device-codec.js';
import {presetAddress,presetLocation} from './preset-library-model.js';
import {verifyPresetSound} from './preset-sound.js';
export function archiveStoreFrame(sourceFrame,bank,slot){
 if(!['user','card'].includes(bank))throw Error('Sauvegarde limitée à une destination User ou Carte explicite');
 const source=decodeDeviceBuffer(sourceFrame);if(source.preset!==0)throw Error('Source P0 requise');validatePresetValues(source,{reference:source});
 const address=presetAddress(bank,slot),frame=sourceFrame.slice();frame[7]=address>>7;frame[8]=address&127;
 decodeDeviceBuffer(frame,source.device);return frame;
}
// Packed storage can discard unused engine/variant bytes and derive ordinals.
// Verify the mapped active sound, not a false promise of raw byte preservation.
export function verifyStoredPreset(sourceFrame,receivedFrame,address){
 const source=decodeDeviceBuffer(sourceFrame),received=decodeDeviceBuffer(receivedFrame,source.device),location=presetLocation(address);
 if(!['user','card'].includes(location.bank)||received.preset!==address)throw Error('Relecture à une autre destination de sauvegarde');
 const verification=verifyPresetSound(sourceFrame,receivedFrame);
 return {...verification,bank:location.bank,slot:location.slot};
}
