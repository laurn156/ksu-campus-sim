import { bbox, Collider, distToSeg, pointInPoly, type Campus, type Pt } from '../campus.ts'

/** A compact loop on the existing Alumni Field; no permanent change to the map. */
export function bathtubCourse(campus: Campus): Pt[] {
 const field=campus.areas.find(a=>a.name==='New Alumni Field')
 if(!field)return []
 const [minX,minZ,maxX,maxZ]=bbox(field.poly), collider=new Collider(campus.buildings)
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2
 for(const scale of [.27,.25,.23,.21,.19,.17,.15,.13]) for(const ox of [0,-8,8,-16,16]) for(const oz of [0,-8,8,-16,16]) {
  const rx=(maxX-minX)*scale,rz=(maxZ-minZ)*scale
  const points:Pt[]=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return [centerX+ox+Math.sin(a)*rx,centerZ+oz+Math.cos(a)*rz]})
  const safe=points.every((p,i)=>{const q=points[(i+1)%points.length];return Array.from({length:11},(_,j)=>{const t=j/10,x=p[0]+(q[0]-p[0])*t,z=p[1]+(q[1]-p[1])*t;return pointInPoly(x,z,field.poly)&&!collider.blocked(x,z,2)}).every(Boolean)})
  const clearTrees=campus.trees.every(t=>points.every((p,i)=>distToSeg(t[0],t[1],p,points[(i+1)%points.length])>4))
  if(safe&&clearTrees)return points
 }
 return []
}
export type RaceCar={x:number;z:number;heading:number;speed:number;next:number;finished:boolean}
export function newRace(course:Pt[]):RaceCar { const a=course[0],b=course[1];return {x:a[0],z:a[1],heading:Math.atan2(b[0]-a[0],b[1]-a[1]),speed:0,next:1,finished:false} }
/** Arcade acceleration, steering, and building/boundary collision. */
export function driveRace(car:RaceCar,keys:Set<string>,dt:number,course:Pt[],blocked:(x:number,z:number)=>boolean,laps=1,boosting=false) {
 dt=Math.min(dt,.05)
 const forward=keys.has('w')||keys.has('arrowup'),reverse=keys.has('s')||keys.has('arrowdown')
 car.speed=Math.max(-4,Math.min(boosting?16:11,car.speed+((forward?(boosting?18:10):0)-(reverse?12:0))*dt))
 if(!forward&&!reverse)car.speed*=Math.exp(-1.4*dt)
 const steer=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)
 car.heading-=steer*dt*1.7*Math.min(1,Math.abs(car.speed)/3)*Math.sign(car.speed)
 const x=car.x+Math.sin(car.heading)*car.speed*dt,z=car.z+Math.cos(car.heading)*car.speed*dt
 if(blocked(x,z))car.speed=0;else {car.x=x;car.z=z}
 const target=course[car.next%course.length]
 if(Math.hypot(car.x-target[0],car.z-target[1])<4){car.next++;if(car.next>course.length*laps){car.finished=true;car.speed=0}}
}
/** Two coins per segment, kept on the track and collected separately each lap. */
export function raceCoinPositions(course:Pt[]):Pt[]{
 return course.flatMap((a,i)=>{const b=course[(i+1)%course.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1
  return [1/3,2/3].map((t,j):Pt=>[a[0]+dx*t+dz/len*(j?-.75:.75),a[1]+dz*t-dx/len*(j?-.75:.75)])})
}
/** Segment-based pickup avoids skipping coins at high frame rates or speeds. */
export function collectRaceCoins(positions:Pt[],collected:boolean[],from:Pt,to:Pt,radius=1.65){
 const found:number[]=[];positions.forEach(([x,z],i)=>{if(!collected[i]&&distToSeg(x,z,from,to)<radius){collected[i]=true;found.push(i)}});return found
}

/** Every three collected coins immediately grants two seconds of speed boost. */
export function addCoinBoost(totalBefore:number,added:number,remaining:number){
 const boosts=Math.floor((totalBefore+added)/3)-Math.floor(totalBefore/3)
 return {remaining:Math.min(6,Math.max(0,remaining)+boosts*2),boosts}
}
