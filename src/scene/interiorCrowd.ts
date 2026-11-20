import { specialStations, seatedStation, type SpecialKind } from './specialLayouts.ts'
import { clearPoint, indoorPath, type Obstacle, type Point } from './diningSimulation.ts'

export type CrowdKind = 'student'|'classroom'|'library'|'dorm'|'garage'|'greenhouse'|'recreation'|'lab'|'office'|'parking'|'bus'|'uits'|'admin'|'math'|'crawford'|'engineering'|'academic'|'design1'|'design2'|'atrium'|'civil'|'soils'|'textile'|'architecture'
export interface Activity { position:Point; seated?:boolean; heading?:number; duration?:number; role?:'queue'|'pool'|'ping'|'eat'|'tools'|'water'|'plant'|'notes'|'help'|'staff'|'repair'|'seat'|'hold'|'exit'|'study'|'browse'|'read'|'teach'|'meeting'|'write'|'research'|'robot'|'electronics'|'fabricate'|'cad'|'print'|'build'|'test' }
export interface IndoorAgent {id:number; position:Point; heading:number; seated:boolean; walk:boolean; activity:number; timer:number; route:Point[]; blocked:number; stuckFor:number; carry:'water'|'laptop'|'book'|'part'|null; out:boolean; track:'staff'|'visitor'|'student'|'professor'|null}
// Activity points sit beside the actual furniture, leaving circulation routes open.
export const indoorActivities:Record<CrowdKind,Activity[]>={
 ...Object.fromEntries((['crawford','engineering','academic','design1','design2','atrium','civil','soils','textile','architecture'] as SpecialKind[]).map(kind=>[kind,[...((kind==='academic'||kind==='atrium')?[{position:[-7,-9.7] as Point,role:'teach' as const,heading:0,duration:45},{position:[7,-9.7] as Point,role:'teach' as const,heading:0,duration:45}]:[]),...specialStations[kind].map(station=>({position:[station.x,station.z+1.4] as Point,seated:seatedStation(station.kind),heading:Math.PI,role:({microscope:'research',research:'research',computer:'study',robot:'robot',electronics:'electronics',mechanical:'fabricate',desk:'write',study:'meeting',cad:'cad',printer:'print',prototype:'build',cnc:'fabricate',laser:'fabricate',assembly:'build',testing:'test',storage:'tools',chess:'meeting',sandwich:'help',survey:'research',structure:'test',bridge:'build',soil:'research',sieve:'fabricate',press:'test',sewing:'fabricate',loom:'build',fabric:'tools',draft:'cad',model:'build',materials:'tools'} as const)[station.kind],duration:22})),...(kind==='atrium'?[{position:[7,2.6] as Point,seated:true,heading:0,role:'meeting' as const,duration:35}]:[]),{position:[-2,6] as Point,role:'notes' as const,duration:12},{position:[2,6] as Point,role:'notes' as const,duration:12},...(kind==='academic'?[{position:[-9,6] as Point,role:'teach' as const,duration:20},{position:[0,3] as Point,role:'teach' as const,duration:20}]:[]),...((kind==='engineering'||kind==='design2')?[{position:[0,4.6] as Point,role:'test' as const,duration:18}]:[])]])) as Record<SpecialKind,Activity[]>,
 student:[
  {position:[-8.4,-8],heading:-Math.PI/2,role:'queue'},{position:[-7.4,-8],heading:-Math.PI/2,role:'queue'},{position:[-8.4,-3.8],heading:-Math.PI/2,role:'queue'},
  {position:[1.95,-6],seated:true,heading:-Math.PI/2,role:'eat'},{position:[-1.95,-1],seated:true,heading:Math.PI/2,role:'eat'},
  {position:[7,-6],heading:Math.PI/2,role:'pool'},{position:[11,-6],heading:-Math.PI/2,role:'pool'},
  {position:[7,-1],heading:Math.PI/2,role:'ping'},{position:[11,-1],heading:-Math.PI/2,role:'ping'},
  {position:[8,7]},{position:[-7,8]},{position:[7,2]},{position:[10.5,2]},
  {position:[1.95,4],seated:true,heading:-Math.PI/2,role:'eat'},{position:[-1.95,4],seated:true,heading:Math.PI/2,role:'eat'},{position:[-7,4]},{position:[-9,-2.1]}
 ],
 classroom:[{position:[-6,-8],heading:0},...[-4,-1,2,5].flatMap(z=>[-8,-4,0,4,8].map(x=>({position:[x,z+1.25] as Point,seated:true,heading:Math.PI})))],
 library:[
  ...[-9,-5,5,9].map(x=>({position:[x,-3.5] as Point,seated:true,heading:Math.PI,role:'study' as const,duration:45})),
  ...[-8,0].map(x=>({position:[x,4.5] as Point,seated:true,heading:Math.PI,role:'study' as const,duration:45})),
  {position:[-10,-7],heading:Math.PI,role:'browse',duration:18},{position:[-10,6.5],role:'staff',duration:35},
  {position:[8,4.5],seated:true,heading:Math.PI,role:'study',duration:45},{position:[5.7,8.4],seated:true,heading:Math.PI,role:'read',duration:45},
  {position:[6,-7],heading:Math.PI,role:'browse',duration:18},{position:[-8.5,6.5],role:'staff',duration:35},{position:[-8,8],role:'help',duration:18},{position:[4.3,8.4],seated:true,heading:Math.PI,role:'study',duration:45},{position:[-5.7,8.4],seated:true,heading:Math.PI,role:'read',duration:45}
 ],
 admin:[{position:[-7,3.6],seated:true,heading:0,role:'staff',duration:35},{position:[-7,6.4],heading:Math.PI,role:'help'},
  {position:[-10,-5.5],seated:true,heading:Math.PI,role:'staff',duration:35},{position:[-5,-5.5],seated:true,heading:Math.PI,role:'staff',duration:35},
  {position:[5.6,-4.5],seated:true,heading:Math.PI,role:'meeting',duration:40},{position:[7,-4.5],seated:true,heading:Math.PI,role:'meeting',duration:40},{position:[8.4,-4.5],seated:true,heading:Math.PI,role:'meeting',duration:40},
  {position:[8,7.5],seated:true,heading:Math.PI,role:'seat',duration:30},{position:[-7,8],heading:Math.PI,role:'queue'},{position:[-3,7],role:'exit'},{position:[-12,-5.5],role:'notes'},{position:[3,-5],role:'teach'}],
 math:[{position:[-7,-9.8],heading:0,role:'teach',duration:50},{position:[7,-9.8],heading:0,role:'teach',duration:50},
  ...[-10,-7,-4,4,7,10].flatMap(x=>[-7,-4].map(z=>({position:[x,z+1.25] as Point,seated:true,heading:Math.PI,role:'write' as const,duration:50}))),
  {position:[-8,6.5],seated:true,heading:Math.PI,role:'study',duration:35},{position:[7,6.5],seated:true,heading:Math.PI,role:'study',duration:35},
  {position:[-10,6.5],heading:Math.PI/2,role:'teach',duration:20},{position:[5,6.5],heading:Math.PI/2,role:'teach',duration:20},{position:[11,6],role:'staff',duration:30},{position:[-2,6],role:'queue'},
  {position:[-4.5,6.9],seated:true,heading:0,role:'seat',duration:30},{position:[4.5,6.9],seated:true,heading:0,role:'seat',duration:30}],
 dorm:[{position:[-8,-3.8],seated:true,heading:Math.PI},{position:[8,-3.8],seated:true,heading:Math.PI},{position:[-8,6.3],seated:true},{position:[-3,7]},{position:[8,7]},{position:[0,5]},{position:[0,-6]},{position:[10,0]}],
 garage:[{position:[-7,-4.5]},{position:[-11,-6]},{position:[6,-5.3]},{position:[10,-5.3]},{position:[-8,6.6]},{position:[5,6.7]}],
 greenhouse:[{position:[-11,6],role:'tools'},{position:[-9,-5.3],role:'water'},{position:[-5,-5.3],role:'plant'},{position:[5,-5.3],role:'notes'},{position:[9,-5.3],role:'water'},{position:[-8,4.8],role:'plant'},{position:[0,4.8],role:'notes'},{position:[8,4.8],role:'water'},{position:[-3,7]},{position:[3,7]}],
 recreation:[{position:[-8,-6]},{position:[-3,-2]},{position:[-9,1]},{position:[4,-4.1]},{position:[7,-4.1]},{position:[9,6.5]},{position:[9,1]}],
 lab:[...[-9,-5,5,9].map(x=>({position:[x,-5.4] as Point,seated:true,heading:Math.PI})),...[-8,0,8].map(x=>({position:[x,4.7] as Point}))],
 office:[...[-9,-5,5,9].map(x=>({position:[x,-5.5] as Point,seated:true,heading:Math.PI})),{position:[-8,6.8]},{position:[7,8.4],seated:true},{position:[3,5]}],
 bus:[{position:[-2,-7],seated:true,heading:Math.PI,role:'seat'},{position:[2,-7],seated:true,heading:Math.PI,role:'seat'},{position:[-2,-3],seated:true,heading:Math.PI,role:'seat'},{position:[2,-3],seated:true,heading:Math.PI,role:'seat'},{position:[-2,1],seated:true,heading:Math.PI,role:'seat'},{position:[2,1],seated:true,heading:Math.PI,role:'seat'},{position:[-1,4],role:'hold'},{position:[1,7],role:'hold'},{position:[0,-5]},{position:[-1.5,10],role:'exit'},{position:[-2,5],seated:true,heading:Math.PI,role:'seat'},{position:[2,5],seated:true,heading:Math.PI,role:'seat'}],
 uits:[{position:[-6,-8],role:'staff'},{position:[0,-8],role:'staff'},{position:[-6,-2.5],role:'help'},{position:[0,-2.5],role:'help'},{position:[7,-6],role:'repair'},{position:[-8,3.1],seated:true,heading:Math.PI,role:'seat'},{position:[-5,3.1],seated:true,heading:Math.PI,role:'seat'},{position:[0,3],role:'queue'},{position:[3,5],role:'queue'},{position:[8,1],role:'repair'},{position:[-3,7],role:'exit'},{position:[4,8],role:'exit'}],
 parking:[{position:[-11,3]},{position:[-5,2]},{position:[4,4]},{position:[10,3]},{position:[0,-3]},{position:[-7,7]},{position:[7,7]}],
}
function roleTrack(kind:CrowdKind,role:Activity['role']):IndoorAgent['track'] {
 if(kind==='admin')return role==='staff'||role==='meeting'||role==='notes'||role==='teach'?'staff':'visitor'
 if(kind==='math'||kind==='academic'||kind==='atrium')return role==='teach'||role==='staff'?'professor':'student'
 if(kind==='library')return role==='staff'?'staff':'student'
 return null
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
  this.agents=Array.from({length:n},(_,id)=>{const academicSeeds=[0,1,2,3,4,6,8,10,14,15,16,17];const specialAcademicSeeds=[0,1,2,5,10,14];const activity=kind==='atrium'?([0,2,4,6,8,9,10,12][id]??id):kind==='academic'?(specialAcademicSeeds[id]??id):kind==='math'?(academicSeeds[id]??id):(kind==='student'||kind==='bus'||kind==='uits'||kind==='greenhouse'||kind==='library'||kind==='admin')?id:Math.floor(id*this.activities.length/n),a=this.activities[activity];return {id,position:[...a.position] as Point,heading:a.heading??Math.PI,seated:!!a.seated,walk:false,activity,timer:a.duration??8+id*3,route:[],blocked:0,stuckFor:0,carry:null,out:false,track:roleTrack(kind,a.role)}})
 }
 private chooseAnother(a:IndoorAgent,player:Point){
  const used=new Set(this.agents.filter(b=>b!==a).map(b=>b.activity))
  for(let offset=1;offset<=this.activities.length;offset++){
   const index=(a.activity+offset+a.id)%this.activities.length
   if(index===a.activity||used.has(index)||(a.track&&roleTrack(this.kind,this.activities[index].role)!==a.track))continue
   const route=indoorPath(a.position,this.activities[index].position,this.obstacles,[player,...this.agents.filter(b=>b!==a&&!b.out).map(b=>b.position)])
   if(route.length){a.activity=index;a.route=route;a.timer=this.activities[index].duration??10+a.id*2;a.stuckFor=0;return}
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
    const role=this.activities[a.activity].role;if(this.kind==='library'&&role==='browse')a.carry='book';if(this.kind==='library'&&role==='read')a.carry=null;if(role==='tools')a.carry=this.kind==='greenhouse'?'water':'part';if(role==='water'||role==='build'||role==='robot'||role==='research')a.carry=null;if(this.kind==='uits'&&role==='queue')a.carry='laptop';if(this.kind==='uits'&&role==='help')a.carry=null;const specialSequence:Partial<Record<CrowdKind,Partial<Record<NonNullable<Activity['role']>,Activity['role']>>>>={crawford:{research:'study',study:'research',tools:'research'},engineering:{study:'robot',robot:'study',electronics:'test',test:'study',tools:'robot'},academic:{teach:'teach',write:'study',study:'write',meeting:'study'},design1:{cad:'print',print:'cad',build:'cad',tools:'build'},design2:{tools:'build',build:'test',test:'build',fabricate:'build'},atrium:{teach:'teach',study:'meeting',meeting:'study',help:'study',write:'study'},civil:{research:'test',test:'build',build:'research'},soils:{research:'fabricate',fabricate:'test',test:'research'},textile:{tools:'fabricate',fabricate:'build',build:'tools'},architecture:{cad:'build',build:'cad',tools:'build'}};const linked=specialSequence[this.kind]?.[role??'notes'];const preferred=linked??(this.kind==='library'&&role==='browse'?'read':this.kind==='library'&&role==='read'?'study':this.kind==='library'&&role==='study'?'browse':role==='tools'?(this.kind==='greenhouse'?'water':'build'):role==='water'?'tools':role==='help'?'seat':role==='queue'?'help':role==='repair'?'staff':(this.kind==='uits'||this.kind==='bus'||this.kind==='admin')&&role==='seat'?'exit':(this.kind==='uits'||this.kind==='admin')&&role==='exit'?'queue':undefined)
    let next=preferred?this.activities.findIndex((p,i)=>p.role===preferred&&i!==a.activity&&!used.has(i)&&(!a.track||roleTrack(this.kind,p.role)===a.track)):-1;for(let offset=1;next<0&&offset<=this.activities.length;offset++){const i=(a.activity+offset+a.id)%this.activities.length;if(i!==a.activity&&!used.has(i)&&(!a.track||roleTrack(this.kind,this.activities[i].role)===a.track)){next=i;break}}
    if(next<0){a.timer=5;continue}a.activity=next;a.seated=false;a.timer=this.activities[next].duration??10+a.id*2;this.path(a,player);continue
   }
   const [x,z]=a.route[0],dx=x-a.position[0],dz=z-a.position[1],distance=Math.hypot(dx,dz)
   if(distance<.04){a.route.shift();continue}
   const step=Math.min(distance,dt*1.25),next:Point=[a.position[0]+dx/distance*step,a.position[1]+dz/distance*step]
   if(!clearPoint(...next,this.obstacles)){a.walk=false;a.stuckFor+=dt;if(a.stuckFor>1)this.chooseAnother(a,player);continue}
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
