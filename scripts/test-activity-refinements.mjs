import assert from 'node:assert/strict'
import fs from 'node:fs'
import {bathtubCourse,raceOpponent} from '../src/activities/bathtubRace.ts'
import {discTrajectory,stepDisc} from '../src/activities/campusActivities.ts'
import {busPenetration,crossingPosition,crossingsForStops} from '../src/activities/busHazards.ts'
import {busScore} from '../src/activities/busDrive.ts'
const campus=JSON.parse(fs.readFileSync(new URL('../public/campus.json',import.meta.url))),course=bathtubCourse(campus)
const start=raceOpponent(course,0),ahead=raceOpponent(course,20),end=raceOpponent(course,1e6)
assert(Math.hypot(start.x-ahead.x,start.z-ahead.z)>5);assert(end.finished);assert(!start.finished)
const path=discTrajectory([0,0],0,.65,[.4,-.2]);assert(path.length>4)
let f={x:0,y:1,z:0,vx:0,vy:5.1,vz:14.45};for(let i=0;i<4;i++)f=stepDisc(f,.05,[.4,-.2]);assert(Math.abs(path[1].x-f.x)<1e-9,'preview follows actual wind physics')
assert(busPenetration(0,0,0,0,4,.5)>0);assert.equal(busPenetration(0,0,0,10,10,.5),0)
const crossings=crossingsForStops(Array.from({length:15},(_,i)=>[i*10,0]),[[100,0]]);assert.equal(crossings.length,1);assert.notDeepEqual(crossingPosition(crossings[0],3),crossingPosition(crossings[0],5))
const score={pickedUp:5,collisions:1,pedestrianHits:0,elapsed:20};assert.equal(busScore(score)-busScore({...score,collisions:2,pedestrianHits:1}),50)
console.log('Ghost rival, trajectory preview, shuttle footprints, moving crossings and penalty verified')
