import assert from 'node:assert/strict'
import fs from 'node:fs'
import { bathtubCourse, newRace, driveRace } from '../src/activities/bathtubRace.ts'
import { Collider, pointInPoly } from '../src/campus.ts'
const campus=JSON.parse(fs.readFileSync(new URL('../public/campus.json',import.meta.url)))
const course=bathtubCourse(campus), field=campus.areas.find(a=>a.name==='New Alumni Field'), collider=new Collider(campus.buildings)
assert.equal(course.length,8)
for(const [x,z] of course){assert(pointInPoly(x,z,field.poly));assert(!collider.blocked(x,z,2))}
const car=newRace(course)
driveRace(car,new Set(['w']),.05,course,()=>false)
assert(car.speed>0)
const x=car.x,z=car.z
driveRace(car,new Set(['w']),.05,course,()=>true)
assert.equal(car.speed,0);assert.equal(car.x,x);assert.equal(car.z,z)
car.x=course[2][0];car.z=course[2][1];driveRace(car,new Set(),.05,course,()=>false)
assert.equal(car.next,1,'checkpoints cannot be skipped')
for(let i=1;i<=course.length;i++){[car.x,car.z]=course[i%course.length];driveRace(car,new Set(),.05,course,()=>false)}
assert(car.finished,'last checkpoint finishes race')
console.log('Bathtub race course, controls, collisions and ordered finish verified')
