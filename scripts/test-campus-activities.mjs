import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Collider,pointInPoly} from '../src/campus.ts'
import {huntPositions,letters,nearestBasket,stepDisc} from '../src/activities/campusActivities.ts'
const campus=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))
const positions=huntPositions(campus),collider=new Collider(campus.buildings)
assert.equal(positions.length,letters.length)
for(const [x,z] of positions){assert(pointInPoly(x,z,campus.boundary));assert(!collider.blocked(x,z,1.5))}
const basket=nearestBasket(campus,positions[0][0],positions[0][1]);assert(basket)
let flight={x:0,y:1,z:0,vx:4,vy:4,vz:0};for(let i=0;i<100;i++)flight=stepDisc(flight,.02)
assert(flight.x>0&&flight.y<0&&flight.vx<4,'flight should move forward, slow down, and fall')
console.log('Hunt letters have outdoor positions; disc flight advances, slows, and falls.')
