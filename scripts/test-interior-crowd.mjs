import assert from 'node:assert/strict'
import { InteriorCrowd } from '../src/scene/interiorCrowd.ts'
import { specialObstacles } from '../src/scene/specialLayouts.ts'
import { adminObstacles, mathObstacles, libraryObstacles } from '../src/scene/academicLayouts.ts'
import { clearPoint } from '../src/scene/diningSimulation.ts'
const partition=[[-8,-2,12,.25],[8,-2,12,.25]]
const obstacles={
 ...Object.fromEntries(['crawford','engineering','academic','design1','design2','atrium','civil','soils','textile','architecture'].map(kind=>[kind,specialObstacles(kind)])),
 student:[[-5,-1,.3,8],[-5,8.1,.3,3.8],[5,-5,.3,7],[5,5.6,.3,8.8],[-11,-8,4,1.5],[-11,-3.8,4,1.5],[-11,.5,4,1.5],[-10,5,2,2],[-10,9,2,2],[0,-6,3,2],[0,-1,3,2],[0,4,3,2],[9,-6,3,2],[9,-1,3,2],[10,5,2,1.5],[-2,9,2.5,1],[-8.7,7,1.3,1.3],[12,8,1,1]],
 classroom:[...[-4,-1,2,5].flatMap(z=>[-8,-4,0,4,8].map(x=>[x,z,1.4,1.1])),[0,-9,8,1]],
 library:libraryObstacles,
 admin:adminObstacles,
 math:mathObstacles,
 dorm:[...partition,...[-8,8].flatMap(x=>[[x,-8,2,3],[x-2,-10,1.5,1],[x,-5,1.7,1.2]]),[-8,5,3,1.2],[-8,7,1.5,1],[-5,6,1.5,1.5],[10,5,1.5,1.5],[8,5,1.5,1.5]],
 lab:[...partition,...[-9,-5,5,9].map(x=>[x,-7,2,1.5]),...[-8,0,8].map(x=>[x,3,2,1.5]),[-12,-9,1.5,1.5],[12,-9,1.5,1.5]],
 garage:[...partition,[-7,-7,5,3],[-11,-4,1,1],...[6,10].map(x=>[x,-7,2,1.5]),[-8,5,2,1.5],[11,7,1.5,1.5],[5,5,2,1.5]],
 greenhouse:[...[-7,7].map(x=>[x,7,2,1.5]),...[-9,-5,5,9].map(x=>[x,-7,2,1.5]),...[-8,0,8].map(x=>[x,3,2,1.5]),[-11,8,1.5,1.5],[11,8,1.5,1.5]],
 recreation:[...[4,7,10].map(x=>[x,-6,1.3,2.3]),...[4,7].map(x=>[x,5,2,1.2]),[11,4,.5,8]],
 office:[...partition,...[-9,-5,5,9].map(x=>[x,-7,2,1.4]),[-8,5,2.2,1.5],[7,5,2.5,1.5],[7,7,1.6,1.2],[11,9,1.5,1.5]],
 bus:[...[-1.5,1.5].flatMap(x=>[-8,0,8].map(z=>[x,z,.12,.12])),...[-3.25,3.25].map(x=>[x,0,.4,24]),...[-7,-3,1,5].flatMap(z=>[-2.85,2.85].map(x=>[x,z,.55,1.15])),[-2.25,-10,1.5,2]],
 uits:[...[-10.5,10.5].map(x=>[x,0,.18,20]),[0,-9.8,21,.2],...[-6,0].map(x=>[x,-6.6,4,1.2]),[7,-7.5,4,1.3],[9,-3.2,1.5,1.2],[9,1,1.5,1.2]],
 parking:[...[-9,-4,4,9].map(x=>[x+1.8,-6,2,4]),[2,5,1,1]],
}
for(const [kind,rects] of Object.entries(obstacles)){
 const sim=new InteriorCrowd(rects,kind,kind==='classroom'?8:kind==='student'?9:kind==='bus'?8:kind==='uits'?7:kind==='math'?12:kind==='admin'?8:kind==='library'?8:['crawford','engineering','academic','design1','design2','atrium','civil','soils','textile','architecture'].includes(kind)?6:5)
 const player=kind==='uits'?[0,6]:[0,9]
 assert(sim.agents.length>=4,`${kind}: insufficient people on entry`)
 assert(sim.agents.some(a=>a.position[0]<0)&&sim.agents.some(a=>a.position[0]>0),`${kind}: people not spread out`)
 const visited=sim.agents.map(a=>new Set([a.activity]))
 const lastRole=sim.agents.map(a=>sim.activities[a.activity].role),roleTransitions=new Set()
 let carriedWater=false,carriedLaptop=false,carriedBook=false,busReturned=false
 const busExited=new Set()
 for(let frame=0;frame<3600;frame++){
  const previous=sim.agents.map(a=>[...a.position]);sim.step(.05,player)
  for(const a of sim.agents){if(kind==='bus'&&a.out)busExited.add(a.id);if(kind==='bus'&&busExited.has(a.id)&&!a.out&&a.walk)busReturned=true;if(a.out)continue;if(a.carry==='water'&&a.walk)carriedWater=true;if(a.carry==='laptop'&&a.walk)carriedLaptop=true;if(a.carry==='book'&&a.walk)carriedBook=true;if(Math.hypot(a.position[0]-sim.activities[a.activity].position[0],a.position[1]-sim.activities[a.activity].position[1])<.18){visited[a.id].add(a.activity);const role=sim.activities[a.activity].role;if(role&&lastRole[a.id]!==role){roleTransitions.add(`${lastRole[a.id]}:${role}`);lastRole[a.id]=role}};assert(clearPoint(...a.position,rects),`${kind}: walked into furniture`);assert(Math.hypot(a.position[0]-previous[a.id][0],a.position[1]-previous[a.id][1])<.08,`${kind}: teleported`);assert(Math.hypot(a.position[0]-player[0],a.position[1]-player[1])>=.74,`${kind}: hit player`)}
  for(let i=0;i<sim.agents.length;i++)for(let j=i+1;j<sim.agents.length;j++){assert.notEqual(sim.agents[i].activity,sim.agents[j].activity,`${kind}: duplicated activity reservation`);if(!sim.agents[i].out&&!sim.agents[j].out)assert(Math.hypot(sim.agents[i].position[0]-sim.agents[j].position[0],sim.agents[i].position[1]-sim.agents[j].position[1])>=.60,`${kind}: characters overlap`)}
 }
 assert(visited.every(s=>s.size>=2),`${kind}: an agent never changed activity`)
 const expected={crawford:'research:study',engineering:'robot:study',academic:'write:study',design1:'cad:print',design2:'build:test',atrium:'write:study',civil:'research:test',soils:'research:fabricate',textile:'fabricate:build',architecture:'cad:build'}
 if(expected[kind])assert(roleTransitions.has(expected[kind]),`${kind}: expected station sequence ${expected[kind]} did not complete`)
 if(kind==='library')assert(carriedBook,'library: nobody carried a book from a shelf')
 if(kind==='greenhouse')assert(carriedWater,'greenhouse: nobody carried a watering can between stations')
 if(kind==='uits')assert(carriedLaptop,'UITS: nobody carried a laptop to the help desk')
 if(kind==='bus')assert(busExited.size>0&&busReturned,'bus passengers did not leave and re-enter')
 console.log(`${kind}: populated, distributed, and moving safely`)
}
// Reproduce two people meeting head-on; both must eventually get past one another.
const headOn=new InteriorCrowd([],'student',2)
headOn.activities[0]={position:[2,0]};headOn.activities[1]={position:[-2,0]}
for(const [i,a] of headOn.agents.entries()){
 a.position=[i===0?-2:2,0];a.activity=i;a.route=[[i===0?2:-2,0]];a.blocked=0;a.stuckFor=0;a.seated=false
}
let crossed=[false,false]
for(let frame=0;frame<800;frame++){
 headOn.step(.05,[0,9])
 for(const a of headOn.agents)if(a.id===0?a.position[0]>1.5:a.position[0]<-1.5)crossed[a.id]=true
 assert(Math.hypot(headOn.agents[0].position[0]-headOn.agents[1].position[0],headOn.agents[0].position[1]-headOn.agents[1].position[1])>=.6,'head-on students overlap')
}
assert(crossed.every(Boolean),'head-on students failed to get past each other')
console.log('Head-on students continue past one another without overlapping.')
