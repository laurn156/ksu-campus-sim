import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nearbyInterior } from '../src/scene/nearbyInterior.ts'
const {buildings}=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))
const library=buildings.find(b=>b.code==='C')
const wing=buildings.find(b=>b.id==='589314485')
assert(library&&wing,'expected library and attached wing in the campus map')
// The outer, walkable edge of the glazed wing used to resolve to “Building”.
for(let i=0;i<11;i++){
 const a=wing.poly[i],b=wing.poly[i+1],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2
 assert.equal(nearbyInterior(buildings,x,z)?.id,library.id,`library wing edge ${i} resolved incorrectly`)
}
const math=buildings.find(b=>b.code==='D'),[a,b]=math.poly
assert.equal(nearbyInterior(buildings,(a[0]+b[0])/2,(a[1]+b[1])/2)?.id,math.id,'other buildings retain their own interior')
assert.equal(nearbyInterior(buildings,10000,10000),null,'distant locations should not select a building')
console.log('Library wing resolves to the library; other locations remain independent.')
