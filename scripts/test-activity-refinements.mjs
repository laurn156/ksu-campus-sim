import assert from 'node:assert/strict'
import {discTrajectory,stepDisc,discAim,discLaunch,discBasketContact} from '../src/activities/campusActivities.ts'
import {busPenetration,busObstacleBlocks,crossingPosition,crossingsForStops} from '../src/activities/busHazards.ts'
import {busScore} from '../src/activities/busDrive.ts'
import {trafficStopAction} from '../src/scene/trafficSafety.ts'
const path=discTrajectory([0,0],0,.65,[.4,-.2]);assert(path.length>4)
let f={x:0,y:1,z:0,vx:0,vy:5.1,vz:14.45};for(let i=0;i<4;i++)f=stepDisc(f,.05,[.4,-.2]);assert(Math.abs(path[1].x-f.x)<1e-9,'preview follows actual wind physics')
assert(busPenetration(0,0,0,0,4,.5)>0);assert.equal(busPenetration(0,0,0,10,10,.5),0)
const crossings=crossingsForStops(Array.from({length:15},(_,i)=>[i*10,0]),[[100,0]]);assert.equal(crossings.length,2);assert.notDeepEqual(crossingPosition(crossings[0],1),crossingPosition(crossings[0],2))
const score={pickedUp:5,collisions:1,pedestrianHits:0,elapsed:20,lateStops:0};assert.equal(busScore(score)-busScore({...score,collisions:2,pedestrianHits:1}),50)
assert.equal(trafficStopAction(true,20,15),'hold');assert.equal(trafficStopAction(true,8,9),'clear');assert.equal(trafficStopAction(false,8,9),'move')
console.log('Trajectory preview, shuttle footprints, moving crossings and penalty verified')

// A bus may reverse out of an overlap, but cannot drive deeper into it.
assert(busObstacleBlocks([0,0],[0,.2],0,[0,5.8],.5))
assert(!busObstacleBlocks([0,.2],[0,0],0,[0,5.8],.5))
assert(!busObstacleBlocks([0,0],[0,.2],0,[30,30],.5))
for(const distance of [8,12,16,20,24]){
 const aim=discAim([0,0],[0,distance]);let disc=discLaunch([0,0],aim.angle,aim.power)
 for(let i=0;i<120;i++){disc=stepDisc(disc,.05);if(disc.vy<0&&disc.y<=1.3)break}
 assert(Math.abs(disc.z-distance)<.8,`screen aim reaches ${distance}m without wind`)
}

assert.equal(discBasketContact({x:.8,y:1.3,z:-1},{x:.8,y:1.3,z:1},[0,0]),null,'near misses do not snap into the basket')
const contact=discBasketContact({x:0,y:1.3,z:-1},{x:0,y:1.3,z:1},[0,0])
assert(contact && contact.z<0 && contact.z>-.4,'a fast throw contacts the visible chains without teleporting to the center')
assert.equal(discBasketContact({x:0,y:2.3,z:-1},{x:0,y:2.3,z:1},[0,0]),null,'throws above the basket do not count')

for(const wind of [[2,0],[-2,1],[0,-2]])for(const distance of [8,16,24]){
 const aim=discAim([0,0],[0,distance],wind);let disc=discLaunch([0,0],aim.angle,aim.power),hit=false
 for(let i=0;i<120;i++){const next=stepDisc(disc,.02,wind);if(discBasketContact(disc,next,[0,distance])){hit=true;break}disc=next;if(disc.y<.15)break}
 assert(hit,`aiming at the basket should reach the chains at ${distance}m in wind ${wind}`)
}
