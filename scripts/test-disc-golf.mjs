import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Collider, distToSeg, pointInPoly } from '../src/campus.ts'
import { discGolfSpots, discGolfTreesToRemove } from '../src/scene/discGolf.ts'
const campus=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))
const lawn=campus.areas.find(a=>a.kind==='pitch:disc_golf'),spots=discGolfSpots(campus),collider=new Collider(campus.buildings)
assert(lawn)
assert.equal(spots.length,15,'expected fifteen disc golf baskets')
for(const [i,[x,z]] of spots.entries()){
 assert(pointInPoly(x,z,lawn.poly),'basket should be on the wooded lawn')
 assert(!collider.blocked(x,z,2),'basket should be clear of buildings')
 assert(campus.trees.every(t=>Math.hypot(t[0]-x,t[1]-z)>=4),'basket should be clear of trees')
 assert([...campus.paths,...campus.roads].every(p=>p.pts.every((q,j)=>j===0||distToSeg(x,z,p.pts[j-1],q)>=p.w/2+2.5)),'basket should be clear of paths and roads')
 assert(spots.slice(0,i).every(p=>Math.hypot(p[0]-x,p[1]-z)>=12),'baskets should be spaced apart')
}
assert.deepEqual(discGolfSpots({...campus,areas:[]}),[],'missing lawn should not create floating landmarks')
const renderedTrees=campus.trees.filter(([x,z])=>pointInPoly(x,z,lawn.poly)).slice(0,8).map(([x,z])=>[x,z,1])
const removed=discGolfTreesToRemove(campus,renderedTrees,spots)
assert.equal(removed.length,2,'exactly two course trees should be removed when available')
assert.equal(new Set(removed).size,2,'tree removals should be distinct')
assert.deepEqual(discGolfTreesToRemove({...campus,areas:[]},renderedTrees,spots),[],'no trees should be removed if the course is missing')
console.log('Fifteen disc golf baskets fit clear of paths and buildings; two course trees are selected for removal.')
