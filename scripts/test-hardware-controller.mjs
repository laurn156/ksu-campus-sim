import assert from 'node:assert/strict'
import { clearHardware, combinedKeys, hardware, validSample, daylightFromSensor } from '../src/hardware/controller.ts'
assert.equal(daylightFromSensor(300),0)
assert.equal(daylightFromSensor(400),0)
assert.equal(daylightFromSensor(500),0.5)
assert.equal(daylightFromSensor(600),1)
assert.equal(daylightFromSensor(800),1)
const sample={v:1,x:512,y:512,joy:0,b1:0,b2:0,cm:9.5,tilt:0,gyro:1,light:200}
assert(validSample(sample))
assert(!validSample({...sample,x:1024}))
assert(!validSample({...sample,tilt:NaN}))
assert(!validSample({...sample,v:2}))
hardware.enabled=true;hardware.updated=performance.now();hardware.keys.add('w')
assert(combinedKeys(new Set(['d'])).has('w'))
assert(combinedKeys(new Set(['d'])).has('d'))
hardware.updated=performance.now()-1000
assert(!combinedKeys(new Set(['d'])).has('w'),'stale data cannot hold movement')
hardware.keys.add('a');clearHardware()
assert(!combinedKeys(new Set()).has('a'),'disconnecting clears hardware')
console.log('Hardware frame validation, keyboard coexistence and input fail-safe passed')
