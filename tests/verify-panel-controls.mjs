import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeDeviceBuffer,deviceMap,controlsForDevice,readField,editedPayload,editDeviceText} from '../src/editors/fireworx/engine/device-codec.js';
import {frameWithPayload} from '../src/editors/fireworx/engine/live-protocol.js';
import {addDeviceBlock,moveDeviceBlock,setDeviceBlocksMuted} from '../src/editors/fireworx/engine/device-graph.js';
import {findFamily,findAlgorithm,families} from '../src/editors/fireworx/engine/catalog.js';
import {effectControlState,effectControlAction} from '../src/editors/fireworx/engine/effect-control.js';
import {renderLCD,renderPresetLCD,renderAlphaLCD} from '../src/editors/fireworx/engine/lcd.js';
import {createModulation,modulationDestinations,readModulation} from '../src/editors/fireworx/engine/modulation-codec.js';
const fixture=decodeDeviceBuffer(new Uint8Array(fs.readFileSync(new URL('generated/synthetic-p0.syx',import.meta.url))));
const decode=p=>decodeDeviceBuffer(frameWithPayload(fixture.frame,p));
const p=fixture.payload.slice();p.fill(0,44,172);p[172]=3;
let b=decode(p);for(const [i,a] of ['delay-stereo','delay-dual','bandpass'].entries())b=decode(addDeviceBlock(b,a,{col:i,row:0}));
const initial=b.payload.slice(),allDelays=b.nodes.filter(n=>findFamily(n.algorithm).id==='delay');assert.equal(allDelays.length,2);
let action=effectControlAction(b,'delay',findFamily);assert.equal(action.kind,'toggle');assert.equal(action.muted,true);assert.equal(action.ids.length,2);
const changed=setDeviceBlocksMuted(b,action.ids,action.muted),offset=171+allDelays[0].blockTypeId;
assert.deepEqual([...changed].filter((_,i)=>i!==offset),[...initial].filter((_,i)=>i!==offset));assert.deepEqual(b.payload,initial);
b=decode(changed);assert.ok(allDelays.every(n=>b.nodes.find(x=>x.id===n.id).muted));assert.equal(effectControlState(b,'delay',findFamily).enabled,false);assert.equal(effectControlState(b,'filter',findFamily).enabled,true);
action=effectControlAction(b,'delay',findFamily);assert.equal(action.muted,false);assert.deepEqual(setDeviceBlocksMuted(b,action.ids,false),initial);
b=decode(setDeviceBlocksMuted(b,[allDelays[0].id],false));assert.equal(effectControlState(b,'delay',findFamily).mixed,true);assert.equal(effectControlAction(b,'delay',findFamily).muted,true);
assert.deepEqual(effectControlAction(b,'reverb',findFamily),{kind:'library'});
// LCD feedback must reflect Mute whether the engine is selected or not.
for(const selected of [allDelays[0].id,allDelays[1].id]){
 const nodes=b.nodes.map(n=>({...n,muted:n.id===allDelays[0].id})),state={...b,nodes,selected};
 const lcd=renderLCD(state,findFamily,findAlgorithm);
 assert.ok(lcd.includes(`data-lcd-node="${allDelays[0].id}" data-lcd-muted="true"`));
 assert.ok(lcd.includes('data-lcd-mute-mark'));
 assert.equal(lcd.includes('MUTE · DELAY'),selected===allDelays[0].id);
 assert.ok(!renderLCD({...state,nodes:nodes.map(n=>({...n,muted:false}))},findFamily,findAlgorithm).includes('data-lcd-mute-mark'));
}
// Selection never changes enable state; dormant rows never enter the family action.
for(const n of b.nodes){b.selected=n.id;assert.equal(effectControlState(b,'filter',findFamily).enabled,true);}
b=decode(moveDeviceBlock(b,allDelays[1].id,{col:0,row:2}));const hidden=b.payload.slice();hidden[172]=2;b=decode(hidden);assert.equal(effectControlAction(b,'delay',findFamily).ids.length,1);
assert.throws(()=>setDeviceBlocksMuted(b,[b.nodes.find(n=>n.row===2).id],true),/introuvable/);
assert.throws(()=>setDeviceBlocksMuted(b,['missing'],true),/introuvable/);
// Packed Alpha mode/response share a byte; preserve each other's fields and high bits.
let alphaBuffer=decode(initial),alphaFields=controlsForDevice(alphaBuffer,{scopePrefix:'modifiers.alpha_mod[0].'});
assert.equal(alphaFields.length,7);assert.ok(alphaFields.every(f=>f.editable));
const bits=alphaFields.filter(f=>f.type==='bits');assert.equal(bits.length,2);
const altered=alphaBuffer.payload.slice();altered[1032]=0xc0;alphaBuffer=decode(altered);
for(const mode of [0,1])for(const response of [0,1]){const next=editedPayload(alphaBuffer,new Map([[bits.find(f=>f.fieldName==='mode').id,mode],[bits.find(f=>f.fieldName==='response').id,response]]));assert.equal(next[1032],0xc0|mode|(response<<4));}
const unknown=renderPresetLCD({presetName:'Prices Falling'});assert.ok(unknown.includes('BANK:'));assert.ok(unknown.includes('FILTER: OFF'));assert.ok(unknown.includes('LIST'));assert.ok(unknown.includes('inconnus'));assert.ok(!unknown.includes('FACTORY'));
const known=renderPresetLCD({presetName:'Prices Falling',presetSource:{bank:'factory',slot:69},alphaText:'Tone & amp'});assert.ok(known.includes('FACTORY'));assert.ok(known.includes('>69</text>'));assert.ok(known.includes('Tone &amp; amp'));
const unverified=renderPresetLCD({presetName:'LFO VCF',presetSource:{bank:'factory',slot:37,confirmation:'unverified'}});assert.ok(unverified.includes('>37</text>'));assert.ok(unverified.includes('data-preset-confirmation="unverified"'));assert.ok(unverified.includes('non confirmé'));
assert.ok(renderAlphaLCD({}).includes('AUCUN LIEN ALPHA'));assert.ok(!renderAlphaLCD({}).includes('NaN'));
const text=editDeviceText(fixture,{name:'Native Home',alphaText:'Morph / Filter'});assert.equal(decode(text).alphaText,'Morph / Filter');assert.deepEqual(text.slice(44),fixture.payload.slice(44));assert.deepEqual(text.slice(0,4),fixture.payload.slice(0,4));assert.throws(()=>editDeviceText(fixture,{alphaText:'é'}),/ASCII/);assert.throws(()=>editDeviceText(fixture,{name:'a'.repeat(21)}),/ASCII/);
const census={algorithms:Object.keys(deviceMap.algorithms).length,families:families.length,fields:deviceMap.fields.length,alphaEditableFields:alphaFields.length};
console.log(JSON.stringify({status:'passed',physicalMidiUsed:false,familyMute:'one action, all visible engines, mixed and dormant states, byte-exact preservation',alphaPackedBits:true,recallLayout:true,census}));
