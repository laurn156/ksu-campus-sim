import assert from 'node:assert/strict'
import {discTrajectory,stepDisc} from '../src/activities/campusActivities.ts'
import {busPenetration,crossingPosition,crossingsForStops} from '../src/activities/busHazards.ts'
import {busScore} from '../src/activities/busDrive.ts'
const path=discTrajectory([0,0],0,.65,[.4,-.2]);assert(path.length>4)
let f={x:0,y:1,z:0,vx:0,vy:5.1,vz:14.45};for(let i=0;i<4;i++)f=stepDisc(f,.05,[.4,-.2]);assert(Math.abs(path[1].x-f.x)<1e-9,'preview follows actual wind physics')
assert(busPenetration(0,0,0,0,4,.5)>0);assert.equal(busPenetration(0,0,0,10,10,.5),0)
const crossings=crossingsForStops(Array.from({length:15},(_,i)=>[i*10,0]),[[100,0]]);assert.equal(crossings.length,2);assert.notDeepEqual(crossingPosition(crossings[0],1),crossingPosition(crossings[0],2))
const score={pickedUp:5,collisions:1,pedestrianHits:0,elapsed:20,lateStops:0};assert.equal(busScore(score)-busScore({...score,collisions:2,pedestrianHits:1}),50)
console.log('Trajectory preview, shuttle footprints, moving crossings and penalty verified')
