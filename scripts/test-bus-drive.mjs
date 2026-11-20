import assert from 'node:assert/strict'
import { busStops, driveBus, toggleBusDoors } from '../src/activities/busDrive.ts'
const path=Array.from({length:36},(_,i)=>[i*10,0]), stops=busStops(path,0,0)
assert.equal(stops.length,3)
const run={car:{x:0,z:0,heading:Math.PI/2,speed:0,next:1,finished:false},stops,next:0,doors:false,wait:0,passengers:0,finished:false,elapsed:0,pickedUp:0,collisions:0,impactCooldown:0,pedestrianHits:0}
assert.equal(toggleBusDoors(run),'away')
;[run.car.x,run.car.z]=stops[0];run.car.speed=2
assert.equal(toggleBusDoors(run),'moving');run.car.speed=0
assert.equal(toggleBusDoors(run),'opened');assert.equal(toggleBusDoors(run),'opened')
for(let i=0;i<41;i++)driveBus(run,new Set(),.05,()=>false)
assert.equal(toggleBusDoors(run),'closed');assert.equal(run.next,1);assert.equal(run.passengers,3);assert.equal(run.pickedUp,3)
for(let j=1;j<stops.length;j++){[run.car.x,run.car.z]=stops[j];assert.equal(toggleBusDoors(run),'opened');for(let i=0;i<41;i++)driveBus(run,new Set(),.05,()=>false);toggleBusDoors(run)}
assert(run.finished);assert.equal(run.pickedUp,6)
const crash={...run,car:{...run.car,speed:3},finished:false,collisions:0,impactCooldown:0,pedestrianHits:0};driveBus(crash,new Set(['w']),.05,()=>true);assert.equal(crash.collisions,1);driveBus(crash,new Set(['w']),.05,()=>true);assert.equal(crash.collisions,1,'one impact should not be counted every frame')
console.log('Bus route, stopping, boarding delay, and route completion verified')
