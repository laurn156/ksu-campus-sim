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
export function stepDisc(state:{x:number;y:number;z:number;vx:number;vy:number;vz:number},dt:number){
 const next={...state};next.x+=next.vx*dt;next.y+=next.vy*dt;next.z+=next.vz*dt;next.vy-=5.5*dt
 const drag=Math.exp(-.65*dt);next.vx*=drag;next.vz*=drag
 return next
}
