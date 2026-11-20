import assert from 'node:assert/strict'
import {turnInteriorCamera,zoomInteriorCamera} from '../src/scene/interiorCamera.ts'
const orbit={yaw:0,pitch:.6,distance:13}
turnInteriorCamera(orbit,100,100);assert(orbit.yaw<0&&orbit.pitch>1)
turnInteriorCamera(orbit,-100,-10000);assert.equal(orbit.pitch,.3)
turnInteriorCamera(orbit,0,10000);assert.equal(orbit.pitch,1.22)
zoomInteriorCamera(orbit,-100000);assert.equal(orbit.distance,5)
zoomInteriorCamera(orbit,100000);assert.equal(orbit.distance,22)
console.log('Indoor orbit direction, pitch limits, and zoom limits passed.')
