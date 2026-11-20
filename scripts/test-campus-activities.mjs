import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Collider,pointInPoly} from '../src/campus.ts'
import {huntPositions, discTee,letters,nearestBasket,stepDisc,stepDiscLanding,makeDiscWind} from '../src/activities/campusActivities.ts'
const campus=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))
const positions=huntPositions(campus),collider=new Collider(campus.buildings)
assert.equal(positions.length,letters.length)
for(const [x,z] of positions){assert(pointInPoly(x,z,campus.boundary));assert(!collider.blocked(x,z,1.5))}
const basket=nearestBasket(campus,positions[0][0],positions[0][1]);assert(basket)
const start=[basket[0]+4,basket[1]];const tees=Array.from({length:5},(_,i)=>discTee(campus,basket,i,start));for(let i=0;i<5;i++)assert(Math.abs(Math.hypot(tees[i][0]-basket[0],tees[i][1]-basket[1])-(8+i*4))<.01,'tee distances increase')
const calm=stepDisc({x:0,y:1,z:0,vx:4,vy:4,vz:0},.05),windy=stepDisc({x:0,y:1,z:0,vx:4,vy:4,vz:0},.05,[1,0]);assert(windy.vx>calm.vx,'wind affects disc flight')
let flight={x:0,y:1,z:0,vx:4,vy:4,vz:0};for(let i=0;i<100;i++)flight=stepDisc(flight,.02)
assert(flight.x>0&&flight.y<0&&flight.vx<4,'flight should move forward, slow down, and fall')
let landing={x:0,y:.16,z:0,vx:5,vy:1,vz:0};for(let i=0;i<150;i++)landing=stepDiscLanding(landing,.02);assert(landing.x>0&&Math.hypot(landing.vx,landing.vz)<.1&&landing.y>=.16,'disc should bounce, travel, and settle')
for(let i=0;i<50;i++){const wind=makeDiscWind();assert(Math.hypot(...wind)>=1.2&&Math.hypot(...wind)<=3.2,'wind stays within the stronger range')}
console.log('Hunt letters have outdoor positions; disc flight advances, slows, and falls.')
