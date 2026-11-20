import assert from 'node:assert/strict'
import fs from 'node:fs'
import { bathtubCourse, newRace, driveRace, addCoinBoost } from '../src/activities/bathtubRace.ts'
import { Collider, pointInPoly } from '../src/campus.ts'
const campus=JSON.parse(fs.readFileSync(new URL('../public/campus.json',import.meta.url)))
const course=bathtubCourse(campus), field=campus.areas.find(a=>a.name==='New Alumni Field'), collider=new Collider(campus.buildings)
assert.equal(course.length,8)
for(const [x,z] of course){assert(pointInPoly(x,z,field.poly));assert(!collider.blocked(x,z,2))}
const car=newRace(course)
driveRace(car,new Set(['w']),.05,course,()=>false)
assert(car.speed>0)
const heading=car.heading;driveRace(car,new Set(['w','d']),.05,course,()=>false);assert(car.heading<heading,'right turns to the driver’s right')
const x=car.x,z=car.z
driveRace(car,new Set(['w']),.05,course,()=>true)
assert.equal(car.speed,0);assert.equal(car.x,x);assert.equal(car.z,z)
car.x=course[2][0];car.z=course[2][1];driveRace(car,new Set(),.05,course,()=>false)
assert.equal(car.next,1,'checkpoints cannot be skipped')
for(let i=1;i<=course.length*2;i++){[car.x,car.z]=course[i%course.length];driveRace(car,new Set(),.05,course,()=>false,2);if(i===course.length)assert(!car.finished,'first lap must not finish the race')}
assert(car.finished,'last checkpoint finishes race')
assert.deepEqual(addCoinBoost(0,2,0),{remaining:0,boosts:0},'two coins do not trigger a boost')
assert.deepEqual(addCoinBoost(2,1,0),{remaining:2,boosts:1},'third coin triggers a two-second boost')
assert.deepEqual(addCoinBoost(2,4,1),{remaining:5,boosts:2},'collecting across two thresholds grants both boosts')
assert.equal(addCoinBoost(2,9,5).remaining,6,'stacked boosts are capped')
const normal=newRace(course),turbo=newRace(course);normal.speed=11;turbo.speed=11
driveRace(normal,new Set(['w']),.05,course,()=>false,2)
driveRace(turbo,new Set(['w']),.05,course,()=>false,2,true)
assert(turbo.speed>normal.speed,'boost increases the top speed')
const stopX=turbo.x,stopZ=turbo.z;driveRace(turbo,new Set(['w']),.05,course,()=>true,2,true)
assert.equal(turbo.speed,0,'boost cannot push through collisions');assert.equal(turbo.x,stopX);assert.equal(turbo.z,stopZ)
console.log('Bathtub race course, controls, collisions and ordered finish verified')
