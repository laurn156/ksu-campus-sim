/** Lightweight, reusable activity routing for indoor characters. Coordinates are metres. */
export type Point = [number,number]
export type Obstacle = [number,number,number,number]
export const diningTables = [-9,-5,5,9].flatMap(x=>[.5,4.6,8.7].map(z=>({x,z})))
export const diningCounters = [-9,-5,5,9]
export const diningWalls:Obstacle[]=[[-8,-8.4,12,.22],[8,-8.4,12,.22]]
export const diningObstacles:Obstacle[]=[...diningWalls,...diningCounters.map(x=>[x,-5.8,3.25,1.65] as Obstacle),...diningTables.map(({x,z})=>[x,z,3,2.7] as Obstacle),[-11.5,3,2.2,6],[11.5,3,2.2,6],[-12,9,1.4,1.4],[12,9,1.4,1.4],[-12,-3,1.4,1],[12,-3,1.4,1],[-10.2,-10.4,3.4,1],[9.6,-10.4,4.2,1]]
type Phase = 'enter'|'toQueue'|'queue'|'toCounter'|'pickup'|'toSeat'|'sit'|'eat'|'stand'|'leave'|'away'
export interface Diner { id:number;position:Point;heading:number;phase:Phase;timer:number;station:number;seat:number|null;route:Point[];blockedFor:number;walk:boolean;tray:boolean;seated:boolean;pathTarget:Point|null }
export interface Seat {table:Point;chair:Point;approach:Point;heading:number}
const unit=.5, xmin=-13, xmax=13, zmin=-11, zmax=11
const key=(x:number,z:number)=>`${x},${z}`
const snapped=(v:number)=>Math.round(v/unit)
export function clearPoint(x:number,z:number,obstacles:Obstacle[],radius=.38){return Math.abs(x)<=13.4&&Math.abs(z)<=11.3&&!obstacles.some(([a,b,w,d])=>Math.abs(x-a)<w/2+radius&&Math.abs(z-b)<d/2+radius)}
/** Grid routing with an optional list of temporary occupied positions. */
export function indoorPath(from:Point,to:Point,obstacles:Obstacle[],occupied:Point[]=[]):Point[] {
 const sx=snapped(from[0]),sz=snapped(from[1]),tx=snapped(to[0]),tz=snapped(to[1])
 const q:[[number,number]]=[[sx,sz]],parents=new Map<string,string|null>([[key(sx,sz),null]])
 const valid=(x:number,z:number)=>{const px=x*unit,pz=z*unit;return px>=xmin&&px<=xmax&&pz>=zmin&&pz<=zmax&&clearPoint(px,pz,obstacles)&&(!occupied.some(p=>Math.hypot(px-p[0],pz-p[1])<.72)||Math.hypot(px-to[0],pz-to[1])<.3)}
 for(let i=0;i<q.length;i++){const [x,z]=q[i];if(x===tx&&z===tz)break;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(!parents.has(k)&&valid(nx,nz)){parents.set(k,key(x,z));q.push([nx,nz])}}}
 if(!parents.has(key(tx,tz)))return []
 const path:Point[]=[];let k:string|null=key(tx,tz)
 while(k!==null&&k!==key(sx,sz)){const [x,z]=k.split(',').map(Number);path.unshift([x*unit,z*unit]);k=parents.get(k)??null}
 // Do not append a rounded goal if the exact point is blocked.
 if(clearPoint(to[0],to[1],obstacles))path.push([...to])
 return path
}
export class DiningSimulation {
 readonly agents:Diner[]
 readonly seats:Seat[]
 readonly events:string[]=[]
 private stationOwners:(number|null)[]=[null,null,null,null]
 private seatOwners:(number|null)[]
 private playerPosition:Point|null=null
 private seatCursor=0
 readonly obstacles:Obstacle[]
 constructor(obstacles:Obstacle[],tablePositions:Point[],count=5){
  this.obstacles=obstacles
  this.seats=tablePositions.filter(([x])=>Math.abs(x)===5).flatMap(([x,z]):Seat[]=>[{table:[x,z],chair:[x,z+1.1],approach:[x+(x<0?2.2:-2.2),z+1.1],heading:Math.PI},{table:[x,z],chair:[x,z-1.1],approach:[x+(x<0?2.2:-2.2),z-1.1],heading:0}]).filter(s=>clearPoint(...s.approach,obstacles))
  this.seatOwners=this.seats.map(()=>null)
  this.agents=Array.from({length:count},(_,i)=>({id:i,position:[0,10] as Point,heading:Math.PI,phase:'away' as Phase,timer:i*5,station:i%4,seat:null,route:[],blockedFor:0,walk:false,tray:false,seated:false,pathTarget:null}))
  // Start in the middle of ordinary routines so the room is already occupied on entry.
  for(let i=0;i<Math.min(2,this.agents.length,this.seats.length);i++){
   const index=this.seats.findIndex((s,j)=>this.seatOwners[j]===null&&(i===0?s.table[0]<0:s.table[0]>0))
   if(index<0)continue
   const a=this.agents[i],seat=this.seats[index]
   a.position=[...seat.chair];a.heading=seat.heading;a.phase='eat';a.timer=15+i*8;a.seat=index;a.tray=true;a.seated=true
   this.seatOwners[index]=a.id
  }
  if(this.agents[2]){
   const a=this.agents[2];a.station=1;a.position=[-5,-2.5];a.heading=Math.PI;a.phase='queue';a.timer=0
  }
  if(this.agents[3]){
   const a=this.agents[3],free=this.seatOwners.findIndex(owner=>owner===null)
   if(free>=0){a.station=1;a.position=[-5,-4];a.heading=Math.PI;a.phase='pickup';a.timer=3;a.seat=free;this.seatOwners[free]=a.id;this.stationOwners[a.station]=a.id}
  }
  if(this.agents[4]){
   const a=this.agents[4];a.station=2;a.position=[2,7];a.phase='toQueue';a.timer=0;this.plan(a,[5,-2.5])
  }
 }
 private freeSeat(){
  // Alternate sides and table rows as seats become available.
  const tables=[...new Set(this.seats.map(s=>`${s.table[0]},${s.table[1]}`))]
  for(let n=0;n<tables.length;n++){
   const table=tables[(this.seatCursor+n)%tables.length]
   const index=this.seats.findIndex((s,i)=>`${s.table[0]},${s.table[1]}`===table&&this.seatOwners[i]===null)
   if(index>=0){this.seatCursor=(this.seatCursor+n+Math.ceil(tables.length/2))%tables.length;return index}
  }
  return -1
 }
 private plan(a:Diner,target:Point){a.pathTarget=target;a.route=indoorPath(a.position,target,this.obstacles,[...this.agents.filter(b=>b.id!==a.id&&b.phase!=='away').map(b=>b.position),...(this.playerPosition?[this.playerPosition]:[])]);if(!a.route.length)a.route=indoorPath(a.position,target,this.obstacles)}
 private move(a:Diner,dt:number){
  if(!a.route.length){a.walk=false;const arrived=!a.pathTarget||Math.hypot(a.position[0]-a.pathTarget[0],a.position[1]-a.pathTarget[1])<.18;if(!arrived&&a.pathTarget&&(a.blockedFor+=dt)>1.2){this.plan(a,a.pathTarget);a.blockedFor=0}return arrived}
  const [x,z]=a.route[0],dx=x-a.position[0],dz=z-a.position[1],distance=Math.hypot(dx,dz),step=Math.min(distance,dt*1.45)
  if(distance<.04){a.route.shift();return false}
  const next:Point=[a.position[0]+dx/distance*step,a.position[1]+dz/distance*step]
  const crowd=this.agents.some(b=>b.id!==a.id&&b.phase!=='away'&&Math.hypot(next[0]-b.position[0],next[1]-b.position[1])<.68)||(this.playerPosition!==null&&Math.hypot(next[0]-this.playerPosition[0],next[1]-this.playerPosition[1])<.75)
  if(crowd){
   a.walk=false;a.blockedFor+=dt
   // Give way to lower-numbered moving diners by stepping sideways or back,
   // then recalculate the route. This breaks symmetric head-on stand-offs.
   const blocker=this.agents.find(b=>b.id!==a.id&&b.phase!=='away'&&Math.hypot(next[0]-b.position[0],next[1]-b.position[1])<.68)
   if(a.blockedFor>.35&&blocker&&a.id>blocker.id&&!['sit','eat','stand'].includes(blocker.phase)){
    for(const [vx,vz] of [[-dz/distance,dx/distance],[dz/distance,-dx/distance],[-dx/distance,-dz/distance]]){
     const candidate:Point=[a.position[0]+vx*step,a.position[1]+vz*step]
     const separated=Math.hypot(candidate[0]-blocker.position[0],candidate[1]-blocker.position[1])>=Math.hypot(a.position[0]-blocker.position[0],a.position[1]-blocker.position[1])-.001
     if(separated&&clearPoint(...candidate,this.obstacles)&&!this.agents.some(b=>b.id!==a.id&&b.phase!=='away'&&Math.hypot(candidate[0]-b.position[0],candidate[1]-b.position[1])<.68)&&(!this.playerPosition||Math.hypot(candidate[0]-this.playerPosition[0],candidate[1]-this.playerPosition[1])>=.75)){a.position=candidate;a.walk=true;a.heading=Math.atan2(vx,vz);break}
    }
   }
   if(a.blockedFor>1.2&&a.pathTarget){this.plan(a,a.pathTarget);a.blockedFor=0}return false
  }
  a.blockedFor=0;a.walk=true;a.position=next;a.heading=Math.atan2(dx,dz);return false
 }
 private direct(a:Diner,target:Point,dt:number){const dx=target[0]-a.position[0],dz=target[1]-a.position[1],d=Math.hypot(dx,dz);if(d<.04){a.position=[...target];a.walk=false;return true}const step=Math.min(d,dt*.65),next:Point=[a.position[0]+dx/d*step,a.position[1]+dz/d*step];if((this.playerPosition&&Math.hypot(next[0]-this.playerPosition[0],next[1]-this.playerPosition[1])<.75)||this.agents.some(b=>b.id!==a.id&&b.phase!=='away'&&Math.hypot(next[0]-b.position[0],next[1]-b.position[1])<.68)){a.walk=false;return false}a.position=next;a.walk=true;return false}
 step(dt:number,playerPosition:Point|null=null,pauseId:number|null=null,approaching=false){
  this.playerPosition=playerPosition
  if(this.events.length>512)this.events.splice(0,this.events.length-512)
  for(const a of this.agents){if(a.id===pauseId){a.walk=false;continue}a.timer-=dt
   const proximity=approaching&&playerPosition?Math.hypot(a.position[0]-playerPosition[0],a.position[1]-playerPosition[1]):Infinity
   const motionDt=dt*(proximity<1.5?0:proximity<3?.45:1)
   const stationX=[-9,-5,5,9][a.station],seat=a.seat===null?null:this.seats[a.seat]
   switch(a.phase){
    case 'away': if(a.timer<=0&&(!this.playerPosition||Math.hypot(this.playerPosition[0],this.playerPosition[1]-10.5)>=1)&&!this.agents.some(b=>b.id!==a.id&&b.phase!=='away'&&Math.hypot(b.position[0],b.position[1]-10.5)<1)){a.position=[0,10.5];a.phase='enter';this.events.push(`${a.id}:enter`);this.plan(a,[0,7])}break
    case 'enter':if(this.move(a,motionDt)){a.phase='toQueue';this.plan(a,[stationX,-2.5])}break
    case 'toQueue':if(this.move(a,motionDt)){a.phase='queue';a.heading=Math.PI;this.events.push(`${a.id}:queue`)}break
    case 'queue':{const available=this.stationOwners[a.station]===null;const free=available?this.freeSeat():-1;if(available&&free>=0){this.stationOwners[a.station]=a.id;this.seatOwners[free]=a.id;a.seat=free;a.phase='toCounter';this.plan(a,[stationX,-4])}break}
    case 'toCounter':if(this.move(a,motionDt)){a.phase='pickup';a.timer=2.4;a.heading=Math.PI;this.events.push(`${a.id}:counter`)}break
    case 'pickup':if(a.timer<=0&&a.seat!==null){a.tray=true;this.stationOwners[a.station]=null;a.phase='toSeat';this.events.push(`${a.id}:tray`);this.plan(a,this.seats[a.seat].approach)}break
    case 'toSeat':if(seat&&this.move(a,motionDt)){a.phase='sit';a.heading=seat.heading}break
    case 'sit':if(seat&&this.direct(a,seat.chair,motionDt)){a.phase='eat';a.seated=true;a.walk=false;a.timer=16+a.id*3;this.events.push(`${a.id}:eat`)}break
    case 'eat':a.walk=false;if(a.timer<=0){a.phase='stand';a.seated=false;this.events.push(`${a.id}:stand`)}break
    case 'stand':if(seat&&this.direct(a,seat.approach,motionDt)){this.seatOwners[a.seat!]=null;a.seat=null;a.tray=false;a.phase='leave';this.plan(a,[0,10.5])}break
    case 'leave':if(this.move(a,motionDt)){a.phase='away';a.walk=false;a.timer=8+a.id*3;this.events.push(`${a.id}:leave`)}break
   }
  }
 }
}
