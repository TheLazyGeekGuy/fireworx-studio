// Factory documentation describes the shipped bank, never the current P0 state.
import {factoryPresets} from './factory-presets.generated.js';
export function factoryPresetInfo(record){return record?.bank==='factory'&&Number.isInteger(record.slot)&&record.slot>=1&&record.slot<=400?factoryPresets[record.slot-1]:null;}
export function describeFactoryPreset(record){
 const info=factoryPresetInfo(record);if(!info)return record;
 return {...record,...(['unread','failed'].includes(record.status)?{name:info.name,catalogueName:true}:{}),factoryName:info.name,description:info.description,descriptionPage:info.page,nameSource:info.nameSource};
}
