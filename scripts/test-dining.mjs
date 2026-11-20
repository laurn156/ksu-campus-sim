import assert from 'node:assert/strict'
import { DiningSimulation, clearPoint, diningObstacles, diningTables } from '../src/scene/diningSimulation.ts'
const simulation=new DiningSimulation(diningObstacles,diningTables.map(({x,z})=>[x,z]),5)
const phases=new Set(), occupied=new Set()
let sharedTable=false
for(let frame=0;frame<12000;frame++){
 const previous=simulation.agents.map(a=>({position:[...a.position],phase:a.phase}))
 simulation.step(.05)
 for(const agent of simulation.agents){
  phases.add(agent.phase)
  if(previous[agent.id].phase!=='away')assert(Math.hypot(agent.position[0]-previous[agent.id].position[0],agent.position[1]-previous[agent.id].position[1])<.08,'diner teleported')
  if(agent.seat!==null){assert(!occupied.has(agent.seat),'two diners reserved the same chair');occupied.add(agent.seat)}
  if(!['sit','eat','stand','away'].includes(agent.phase))assert(clearPoint(...agent.position,diningObstacles),`diner walked into an obstacle in ${agent.phase}`)
 }
 for(let i=0;i<simulation.agents.length;i++)for(let j=i+1;j<simulation.agents.length;j++){
  const a=simulation.agents[i],b=simulation.agents[j];if(a.phase==='away'||b.phase==='away')continue
  assert(Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1])>=.60,`diners ${i} and ${j} overlap`)
 }
 const seated=simulation.agents.filter(a=>a.phase==='eat'&&a.seat!==null)
 for(const a of seated)for(const b of seated)if(a.id!==b.id){const p=simulation.seats[a.seat].table,q=simulation.seats[b.seat].table;if(p[0]===q[0]&&p[1]===q[1])sharedTable=true}
 occupied.clear()
}
assert(sharedTable,'diners never shared a table')
for(const phase of ['enter','toQueue','queue','toCounter','pickup','toSeat','sit','eat','stand','leave'])assert(phases.has(phase),`missing phase: ${phase}`)
for(const agent of simulation.agents)for(const event of ['enter','queue','counter','tray','eat','stand','leave'])assert(simulation.events.includes(`${agent.id}:${event}`),`diner ${agent.id} never reached ${event}`)
console.log('Dining routines, seat reservations, obstacle avoidance, and departures passed.')
const withPlayer=new DiningSimulation(diningObstacles,diningTables.map(({x,z})=>[x,z]),5)
for(let frame=0;frame<12000;frame++){
 withPlayer.step(.05,[0,9])
 for(const diner of withPlayer.agents)if(diner.phase!=='away')assert(Math.hypot(diner.position[0],diner.position[1]-9)>=.74,'diner overlapped player')
}
for(const diner of withPlayer.agents)assert(withPlayer.events.includes(`${diner.id}:leave`),`diner ${diner.id} failed to leave with a player in the aisle`)
console.log('Dining routines also complete while avoiding a stationary player.')
