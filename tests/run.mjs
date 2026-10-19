import './fixture.mjs'
import {spawnSync} from 'node:child_process'
for(const file of ['module.mjs','verify-live.mjs','verify-guarded-transport.mjs','verify-panel-controls.mjs','verify-panel-indicators.mjs','verify-recall.mjs','verify-structural-data20.mjs']){
 const result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)
}
console.log('PASS all offline suites; no physical MIDI ports')
