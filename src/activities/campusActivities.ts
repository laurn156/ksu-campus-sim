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
 const next={...state};next.x+=next.vx*dt;next.y+=next.vy*dt;next.z+=next.vz*dt;next.vy-=5.5*dt
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
