import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parkingSpots, stepParking } from '../src/activities/parkingWars.ts'
const campus=JSON.parse(fs.readFileSync(new URL('../public/campus.json',import.meta.url))), spots=parkingSpots(campus)
assert.equal(spots.length,2)
const r={car:{x:spots[0][0],z:spots[0][1],heading:Math.PI/2,speed:0,next:1,finished:false},spots,time:120,parked:0,finished:false,failed:false,hold:0}
for(let i=0;i<25;i++)stepParking(r,new Set(),.05,()=>false)
assert(!r.finished,'sideways cars cannot park')
r.car.heading=0
for(let i=0;i<25;i++)stepParking(r,new Set(),.05,()=>false)
assert(r.finished,'a stationary aligned car in a space succeeds')
const competing={...r,car:{...r.car,x:0,z:0},finished:false,time:85,parked:0};stepParking(competing,new Set(),.05,()=>false);assert.equal(competing.parked,1,'a second space opens when the first is claimed')
const fail={...r,finished:false,time:.01};stepParking(fail,new Set(),.05,()=>false);assert(fail.failed)
console.log('Parking spaces, alignment, stopping and time limit verified')
