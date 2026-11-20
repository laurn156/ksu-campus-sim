import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Collider, distToSeg, pointInPoly } from '../src/campus.ts'
import { discGolfSpots } from '../src/scene/discGolf.ts'
const campus=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))
const lawn=campus.areas.find(a=>a.kind==='pitch:disc_golf'),spots=discGolfSpots(campus),collider=new Collider(campus.buildings)
assert(lawn)
assert.equal(spots.length,3,'expected three disc golf baskets')
for(const [i,[x,z]] of spots.entries()){
 assert(pointInPoly(x,z,lawn.poly),'basket should be on the wooded lawn')
 assert(!collider.blocked(x,z,2),'basket should be clear of buildings')
 assert(campus.trees.every(t=>Math.hypot(t[0]-x,t[1]-z)>=4),'basket should be clear of trees')
 assert([...campus.paths,...campus.roads].every(p=>p.pts.every((q,j)=>j===0||distToSeg(x,z,p.pts[j-1],q)>=p.w/2+2.5)),'basket should be clear of paths and roads')
 assert(spots.slice(0,i).every(p=>Math.hypot(p[0]-x,p[1]-z)>=20),'baskets should be spaced apart')
}
assert.deepEqual(discGolfSpots({...campus,areas:[]}),[],'missing lawn should not create floating landmarks')
console.log('Three disc golf baskets fit on the wooded lawn, clear of trees, buildings, and paths.')
