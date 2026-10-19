import {decodeDeviceBuffer} from './device-codec.js';
import {presetLocation} from './preset-library-model.js';
import {verifyPresetSound} from './preset-sound.js';
export function verifyRecalledPreset(sourceFrame,receivedFrame,address){
 const source=decodeDeviceBuffer(sourceFrame),received=decodeDeviceBuffer(receivedFrame,source.device),location=presetLocation(address);
 if(source.preset!==address||received.preset!==0||!['factory','user','card'].includes(location.bank))throw Error('Source archivée et relecture P0 correspondantes requises');
 return {...verifyPresetSound(sourceFrame,receivedFrame),bank:location.bank,slot:location.slot};
}
