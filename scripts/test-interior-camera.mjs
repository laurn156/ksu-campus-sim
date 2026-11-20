import assert from 'node:assert/strict'
import {turnInteriorCamera,zoomInteriorCamera,panInteriorCamera} from '../src/scene/interiorCamera.ts'
const orbit={yaw:0,pitch:.6,distance:13}
turnInteriorCamera(orbit,100,100);assert(orbit.yaw<0&&orbit.pitch>1)
turnInteriorCamera(orbit,-100,-10000);assert.equal(orbit.pitch,.3)
turnInteriorCamera(orbit,0,10000);assert.equal(orbit.pitch,1.22)
zoomInteriorCamera(orbit,-100000);assert.equal(orbit.distance,5)
zoomInteriorCamera(orbit,100000);assert.equal(orbit.distance,22)
console.log('Indoor orbit direction, pitch limits, and zoom limits passed.')

const pan={x:0,y:0}, facing={yaw:0,pitch:.6,distance:13}
panInteriorCamera(pan,facing,100,50)
assert(pan.x<0&&pan.y<0,'middle drag pans with the scene')
const before={...pan};facing.yaw=Math.PI/2;panInteriorCamera(pan,facing,100,0)
assert(pan.y>before.y,'pan direction follows camera rotation')
panInteriorCamera(pan,facing,100000,100000);assert(Math.abs(pan.x)<=20&&Math.abs(pan.y)<=20)
console.log('Indoor panning follows camera direction and stays bounded.')
