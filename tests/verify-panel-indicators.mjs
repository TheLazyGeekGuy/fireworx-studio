import assert from 'node:assert/strict';
import {createPanelIndicators,payloadEdited} from '../src/editors/fireworx/engine/panel-indicators.js';
let time=0;const model=createPanelIndicators({now:()=>time});
assert.equal(model.snapshot.tempo,true);assert.equal(model.snapshot.midi,false);time=100;assert.equal(model.snapshot.tempo,false);time=500;assert.equal(model.snapshot.tempo,true);
model.configure({bpm:60,source:'internal'});time=1000;assert.equal(model.snapshot.tempo,false);time=1500;assert.equal(model.snapshot.tempo,true);
model.activity('rx',[144,60,127]);assert.equal(model.snapshot.midi,true);time+=101;assert.equal(model.snapshot.midi,false);assert.equal(model.snapshot.tempoSource,'internal');
model.configure({bpm:120,source:'auto'});
for(let i=0;i<=24;i++){time=2000+i*60000/(120*24);model.activity('rx',[248]);}
assert.equal(model.snapshot.tempo,true);assert.equal(model.snapshot.tempoSource,'midi-rx');assert.equal(model.snapshot.bpm,120);time+=101;assert.equal(model.snapshot.tempo,false);
time+=1000;assert.equal(model.snapshot.tempoSource,'internal');model.configure({source:'midi'});assert.equal(model.snapshot.tempoSource,'waiting');assert.equal(model.snapshot.tempo,false);
model.activity('tx',[248],time+20);assert.equal(model.snapshot.tempoSource,'midi-tx');assert.equal(model.snapshot.tempo,false);time+=20;assert.equal(model.snapshot.tempo,true);
model.clearActivity();assert.equal(model.snapshot.midi,false);assert.equal(model.snapshot.tempoSource,'waiting');
const base=new Uint8Array(1366),same=base.slice();same[1131]=1;assert.equal(payloadEdited(base,same),false);same[469]=1;assert.equal(payloadEdited(base,same),true);same[469]=0;assert.equal(payloadEdited(base,same),false);
console.log(JSON.stringify({status:'passed',physicalMidiUsed:false,internalBeat:true,clock24PPQN:true,receivedAndTransmittedClock:true,timeoutAndFallback:true,midiPulse:true,editedComparison:true,derivedIgnored:true}));
