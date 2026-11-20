import { centroid, Collider, pointInPoly, type Campus, type Pt } from '../campus.ts'
import { discGolfSpots } from '../scene/discGolf.ts'

export const letters=['H','O','O','T','Y','H','O','O'] as const
/** Find reachable outdoor positions near existing landmarks, never inside footprints. */
export function huntPositions(campus:Campus):Pt[]{
 const codes=['A','C','D','E','J','N','S1','X'],collider=new Collider(campus.buildings)
 return codes.flatMap(code=>{
  const building=campus.buildings.find(b=>b.code===code);if(!building)return []
  const [cx,cz]=centroid(building.poly)
  for(let r=8;r<180;r+=3)for(let i=0;i<24;i++){
   const a=i*Math.PI/12,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r
   if(pointInPoly(x,z,campus.boundary)&&!collider.blocked(x,z,1.5))return [[x,z] as Pt]
  }
  return []
 })
}
export function nearestBasket(campus:Campus,x:number,z:number):Pt|null{
 const baskets=discGolfSpots(campus)
 return baskets.reduce<Pt|null>((best,p)=>!best||Math.hypot(p[0]-x,p[1]-z)<Math.hypot(best[0]-x,best[1]-z)?p:best,null)
}
/** Simple ballistic flight, independent of rendering and AI. */
export function stepDisc(state:{x:number;y:number;z:number;vx:number;vy:number;vz:number},dt:number,wind:Pt=[0,0]){
 const next={...state};next.x+=next.vx*dt;next.y+=next.vy*dt;next.z+=next.vz*dt;const speed=Math.hypot(next.vx,next.vz);next.vy-=Math.max(3.5,5.5-speed*.10)*dt
 next.vx+=wind[0]*dt;next.vz+=wind[1]*dt
 const drag=Math.exp(-.25*dt);next.vx*=drag;next.vz*=drag
 return next
}

/** Choose a clear starting position farther from the basket on successive throws. */
export function discTee(campus:Campus,basket:Pt,round:number,preferred:Pt):Pt {
 const collider=new Collider(campus.buildings),base=Math.atan2(preferred[0]-basket[0],preferred[1]-basket[1]),distance=8+round*4
 for(const offset of [0,.4,-.4,.8,-.8,1.2,-1.2,Math.PI]){const a=base+offset,x=basket[0]+Math.sin(a)*distance,z=basket[1]+Math.cos(a)*distance
  if(pointInPoly(x,z,campus.boundary)&&!collider.blocked(x,z,1.5)&&!campus.trees.some(t=>Math.hypot(x-t[0],z-t[1])<3))return [x,z]}
 return [preferred[0],preferred[1]]
}
/** Aim at a world-space point; wind still affects the displayed and actual flight. */
export function discAim(lie:Pt,target:Pt){
 const dx=target[0]-lie[0],dz=target[1]-lie[1],distance=Math.hypot(dx,dz)
 const angle=Math.atan2(dx,dz);let low=0,high=1
 for(let n=0;n<12;n++){
  const power=(low+high)/2;let flight=discLaunch(lie,angle,power)
  for(let i=0;i<120;i++){flight=stepDisc(flight,.05);if(flight.vy<0&&flight.y<=1)break}
  if(Math.hypot(flight.x-lie[0],flight.z-lie[1])<distance)low=power;else high=power
 }
 return {angle,power:(low+high)/2}
}
export function discLaunch(lie:Pt,angle:number,power:number){const speed=4+power*15;return {x:lie[0],y:1,z:lie[1],vx:Math.sin(angle)*speed,vy:3+power*2,vz:Math.cos(angle)*speed}}
/** Dots use the same wind and flight physics as a real throw. */
export function discTrajectory(lie:Pt,angle:number,power:number,wind:Pt){
 const points:{x:number;y:number;z:number}[]=[],dt=.05
 let flight=discLaunch(lie,angle,power)
 for(let i=0;i<100;i++){flight=stepDisc(flight,dt,wind);if(flight.y<=.15)break;if(i%3===0)points.push({x:flight.x,y:flight.y,z:flight.z})}
 return points
}

/** A disc skips once or twice, then skids to rest rather than stopping in mid-air. */
export function stepDiscLanding(state:{x:number;y:number;z:number;vx:number;vy:number;vz:number},dt:number){
 const next={...state};next.x+=next.vx*dt;next.z+=next.vz*dt;next.y+=next.vy*dt;next.vy-=7*dt
 if(next.y<=.16){next.y=.16;next.vy=next.vy<-.8?-next.vy*.22:0;const drag=Math.exp(-3.4*dt);next.vx*=drag;next.vz*=drag;if(Math.hypot(next.vx,next.vz)<.08){next.vx=0;next.vz=0}}
 return next
}
/** Wind is a world-space acceleration, shared by preview and actual flight. */
export function makeDiscWind():Pt{const angle=Math.random()*Math.PI*2,magnitude=1.2+Math.random()*2;return [Math.sin(angle)*magnitude,Math.cos(angle)*magnitude]}
