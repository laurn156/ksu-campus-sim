import assert from 'node:assert/strict'
import { approachSpeed } from '../src/scene/approachBehavior.ts'
import { DiningSimulation, diningObstacles, diningTables } from '../src/scene/diningSimulation.ts'
import { InteriorCrowd } from '../src/scene/interiorCrowd.ts'
assert.equal(approachSpeed(20,0,0,0,Math.PI/2,true,true,5,15),1,'distant people keep walking')
assert.equal(approachSpeed(4,0,0,0,Math.PI/2,true,true,5,15),0,'nearby people stop')
assert(approachSpeed(9,0,0,0,Math.PI/2,true,true,5,15)<1,'people slow when approached')
assert.equal(approachSpeed(9,0,0,0,-Math.PI/2,true,true,5,15),1,'walking away does not slow others')
assert.equal(approachSpeed(4,0,0,0,0,false,false,5,15),1,'indoor and activity scenes do not stop outdoor walkers')
const dining=new DiningSimulation(diningObstacles,diningTables.map(({x,z})=>[x,z]),5),diner=dining.agents[0],before=[...diner.position],phase=diner.phase,time=diner.timer
for(let i=0;i<30;i++)dining.step(.05,[0,0],diner.id,true)
assert.deepEqual(diner.position,before);assert.equal(diner.phase,phase);assert.equal(diner.timer,time,'a conversation pauses a dining character')
const crowd=new InteriorCrowd([],'classroom',8),student=crowd.agents[0],at=[...student.position],timer=student.timer
for(let i=0;i<30;i++)crowd.step(.05,[0,9],student.id,true)
assert.deepEqual(student.position,at);assert.equal(student.timer,timer,'a conversation pauses an interior character')
console.log('Approach slowing, stopping and conversation pauses verified')
