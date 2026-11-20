import { clearPoint, indoorPath, type Obstacle, type Point } from './diningSimulation.ts'

export type CrowdKind = 'student'|'classroom'|'library'|'dorm'|'garage'|'greenhouse'|'recreation'|'lab'|'office'|'parking'|'bus'|'uits'
export interface Activity { position:Point; seated?:boolean; heading?:number; duration?:number; role?:'queue'|'pool'|'ping'|'eat'|'tools'|'water'|'plant'|'notes'|'help'|'staff'|'repair'|'seat'|'hold'|'exit' }
export interface IndoorAgent {id:number; position:Point; heading:number; seated:boolean; walk:boolean; activity:number; timer:number; route:Point[]; blocked:number; stuckFor:number; carry:'water'|'laptop'|null; out:boolean}
// Activity points sit beside the actual furniture, leaving circulation routes open.
export const indoorActivities:Record<CrowdKind,Activity[]>={
 student:[
  {position:[-8.4,-8],heading:-Math.PI/2,role:'queue'},{position:[-7.4,-8],heading:-Math.PI/2,role:'queue'},{position:[-8.4,-3.8],heading:-Math.PI/2,role:'queue'},
  {position:[1.95,-6],seated:true,heading:-Math.PI/2,role:'eat'},{position:[-1.95,-1],seated:true,heading:Math.PI/2,role:'eat'},
  {position:[7,-6],heading:Math.PI/2,role:'pool'},{position:[11,-6],heading:-Math.PI/2,role:'pool'},
  {position:[7,-1],heading:Math.PI/2,role:'ping'},{position:[11,-1],heading:-Math.PI/2,role:'ping'},
  {position:[8,7]},{position:[-7,8]},{position:[7,2]},{position:[10.5,2]},
  {position:[1.95,4],seated:true,heading:-Math.PI/2,role:'eat'},{position:[-1.95,4],seated:true,heading:Math.PI/2,role:'eat'},{position:[-7,4]},{position:[-9,-2.1]}
 ],
 classroom:[{position:[-6,-8],heading:0},...[-4,-1,2,5].flatMap(z=>[-8,-4,0,4,8].map(x=>({position:[x,z+1.25] as Point,seated:true,heading:Math.PI})))],
 library:[...[-9,-5,5,9].map(x=>({position:[x,-3.5] as Point,seated:true,heading:Math.PI})),...[-8,0,8].map(x=>({position:[x,4.5] as Point,seated:true,heading:Math.PI})),{position:[-11,-7]},{position:[6,-7]}],
 dorm:[{position:[-8,-3.8],seated:true,heading:Math.PI},{position:[8,-3.8],seated:true,heading:Math.PI},{position:[-8,6.3],seated:true},{position:[-3,7]},{position:[8,7]},{position:[0,5]},{position:[0,-6]},{position:[10,0]}],
 garage:[{position:[-7,-4.5]},{position:[-11,-6]},{position:[6,-5.3]},{position:[10,-5.3]},{position:[-8,6.6]},{position:[5,6.7]}],
 greenhouse:[{position:[-11,6],role:'tools'},{position:[-9,-5.3],role:'water'},{position:[-5,-5.3],role:'plant'},{position:[5,-5.3],role:'notes'},{position:[9,-5.3],role:'water'},{position:[-8,4.8],role:'plant'},{position:[0,4.8],role:'notes'},{position:[8,4.8],role:'water'},{position:[-3,7]},{position:[3,7]}],
 recreation:[{position:[-8,-6]},{position:[-3,-2]},{position:[-9,1]},{position:[4,-4.1]},{position:[7,-4.1]},{position:[9,6.5]},{position:[9,1]}],
 lab:[...[-9,-5,5,9].map(x=>({position:[x,-5.4] as Point,seated:true,heading:Math.PI})),...[-8,0,8].map(x=>({position:[x,4.7] as Point}))],
 office:[...[-9,-5,5,9].map(x=>({position:[x,-5.5] as Point,seated:true,heading:Math.PI})),{position:[-8,6.8]},{position:[7,8.4],seated:true},{position:[3,5]}],
 bus:[{position:[-2,-7],seated:true,heading:Math.PI,role:'seat'},{position:[2,-7],seated:true,heading:Math.PI,role:'seat'},{position:[-2,-3],seated:true,heading:Math.PI,role:'seat'},{position:[2,-3],seated:true,heading:Math.PI,role:'seat'},{position:[-2,1],seated:true,heading:Math.PI,role:'seat'},{position:[2,1],seated:true,heading:Math.PI,role:'seat'},{position:[-1,4],role:'hold'},{position:[1,7],role:'hold'},{position:[0,-5]},{position:[-1.5,10],role:'exit'},{position:[-2,5],seated:true,heading:Math.PI,role:'seat'},{position:[2,5],seated:true,heading:Math.PI,role:'seat'}],
 uits:[{position:[-6,-8],role:'staff'},{position:[0,-8],role:'staff'},{position:[-6,-2.5],role:'help'},{position:[0,-2.5],role:'help'},{position:[7,-6],role:'repair'},{position:[-8,3.1],seated:true,role:'seat'},{position:[-5,3.1],seated:true,role:'seat'},{position:[0,3],role:'queue'},{position:[3,5],role:'queue'},{position:[8,1],role:'repair'},{position:[-3,7],role:'exit'},{position:[4,8],role:'exit'}],
 parking:[{position:[-11,3]},{position:[-5,2]},{position:[4,4]},{position:[10,3]},{position:[0,-3]},{position:[-7,7]},{position:[7,7]}],
}
/** Small local routines: reserve activity spots, walk around furniture, then pause. */
export class InteriorCrowd {
 readonly agents:IndoorAgent[]
 readonly activities:Activity[]
 readonly obstacles:Obstacle[]
 readonly kind:CrowdKind
 constructor(obstacles:Obstacle[],kind:CrowdKind,count=5){
  this.obstacles=obstacles
  this.kind=kind
  this.activities=indoorActivities[kind].filter(a=>clearPoint(...a.position,obstacles)&&Math.hypot(a.position[0],a.position[1]-9)>1.2)
  const n=Math.min(count,this.activities.length)
  this.agents=Array.from({length:n},(_,id)=>{const activity=(kind==='student'||kind==='bus'||kind==='uits'||kind==='greenhouse')?id:Math.floor(id*this.activities.length/n),a=this.activities[activity];return {id,position:[...a.position] as Point,heading:a.heading??Math.PI,seated:!!a.seated,walk:false,activity,timer:8+id*3,route:[],blocked:0,stuckFor:0,carry:null,out:false}})
 }
 private chooseAnother(a:IndoorAgent,player:Point){
  const used=new Set(this.agents.filter(b=>b!==a).map(b=>b.activity))
  for(let offset=1;offset<=this.activities.length;offset++){
   const index=(a.activity+offset+a.id)%this.activities.length
   if(used.has(index))continue
   const route=indoorPath(a.position,this.activities[index].position,this.obstacles,[player,...this.agents.filter(b=>b!==a&&!b.out).map(b=>b.position)])
   if(route.length){a.activity=index;a.route=route;a.timer=10+a.id*2;a.stuckFor=0;return}
  }
  a.stuckFor=0
 }
 private path(a:IndoorAgent,player:Point){const goal=this.activities[a.activity].position;const occupied=[player,...this.agents.filter(b=>b!==a&&!b.out).map(b=>b.position)];a.route=indoorPath(a.position,goal,this.obstacles,occupied);if(!a.route.length)a.route=indoorPath(a.position,goal,this.obstacles)}
 step(dt:number,player:Point){
  for(const a of this.agents){
   if(a.out){
    a.timer-=dt
    if(a.timer>0||Math.hypot(a.position[0]-player[0],a.position[1]-player[1])<.9||this.agents.some(b=>b!==a&&!b.out&&Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1])<.8))continue
    a.out=false;this.chooseAnother(a,player);continue
   }
   if(!a.route.length){
    const goal=this.activities[a.activity],distance=Math.hypot(a.position[0]-goal.position[0],a.position[1]-goal.position[1])
    if(distance>.18){a.seated=false;a.walk=false;a.stuckFor+=dt;if(a.stuckFor>4){this.chooseAnother(a,player);continue}if((a.blocked+=dt)>1){a.blocked=0;this.path(a,player)}continue}
    a.seated=!!goal.seated;a.walk=false;a.heading=goal.heading??a.heading;a.timer-=dt
    if(a.timer>0)continue
    if(this.kind==='bus'&&goal.role==='exit'){a.out=true;a.walk=false;a.timer=5+a.id;continue}
    const used=new Set(this.agents.filter(b=>b!==a).map(b=>b.activity))
    const role=this.activities[a.activity].role;if(role==='tools')a.carry='water';if(role==='water')a.carry=null;if(this.kind==='uits'&&role==='queue')a.carry='laptop';if(this.kind==='uits'&&role==='help')a.carry=null;const preferred=role==='tools'?'water':role==='water'?'tools':role==='help'?'seat':role==='queue'?'help':role==='repair'?'staff':(this.kind==='uits'||this.kind==='bus')&&role==='seat'?'exit':this.kind==='uits'&&role==='exit'?'queue':undefined
    let next=preferred?this.activities.findIndex((p,i)=>p.role===preferred&&!used.has(i)):-1;for(let offset=1;next<0&&offset<=this.activities.length;offset++){const i=(a.activity+offset+a.id)%this.activities.length;if(!used.has(i)){next=i;break}}
    if(next<0){a.timer=5;continue}a.activity=next;a.seated=false;a.timer=10+a.id*2;this.path(a,player);continue
   }
   const [x,z]=a.route[0],dx=x-a.position[0],dz=z-a.position[1],distance=Math.hypot(dx,dz)
   if(distance<.04){a.route.shift();continue}
   const step=Math.min(distance,dt*1.25),next:Point=[a.position[0]+dx/distance*step,a.position[1]+dz/distance*step]
   const blocker=this.agents.find(b=>b!==a&&!b.out&&Math.hypot(next[0]-b.position[0],next[1]-b.position[1])<.68)
   if(blocker||Math.hypot(next[0]-player[0],next[1]-player[1])<.75){
    a.walk=false;a.blocked+=dt;a.stuckFor+=dt
    if(a.stuckFor>4){this.chooseAnother(a,player);continue}
    if(blocker&&a.id>blocker.id&&a.blocked>.35){for(const [vx,vz] of [[-dz/distance,dx/distance],[dz/distance,-dx/distance],[-dx/distance,-dz/distance]]){const p:Point=[a.position[0]+vx*step,a.position[1]+vz*step];if(clearPoint(...p,this.obstacles)&&Math.hypot(p[0]-player[0],p[1]-player[1])>=.75&&!this.agents.some(b=>b!==a&&!b.out&&Math.hypot(p[0]-b.position[0],p[1]-b.position[1])<.68)){a.position=p;a.heading=Math.atan2(vx,vz);a.walk=true;break}}}
    if(a.blocked>1.2){a.blocked=0;this.path(a,player)}continue
   }
   a.position=next;a.heading=Math.atan2(dx,dz);a.walk=true;a.blocked=0;a.stuckFor=0
  }
 }
}
