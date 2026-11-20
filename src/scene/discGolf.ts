import { bbox, Collider, distToSeg, pointInPoly, type Campus, type Pt } from '../campus.ts'

/** Pick three clear, well-spaced places on the wooded green, leaving the paths open. */
export function discGolfSpots(campus:Campus):Pt[] {
 const lawn=campus.areas.find(a=>a.kind==='pitch:disc_golf')
 if(!lawn)return []
 const [x0,z0,x1,z1]=bbox(lawn.poly),collider=new Collider(campus.buildings)
 const targets:Pt[]=[[x0+(x1-x0)*.25,z0+(z1-z0)*.3],[x0+(x1-x0)*.7,z0+(z1-z0)*.42],[x0+(x1-x0)*.5,z0+(z1-z0)*.76]]
 const paths=[...campus.paths,...campus.roads],spots:Pt[]=[]
 const valid=(x:number,z:number)=>{
  if(!pointInPoly(x,z,lawn.poly)||collider.blocked(x,z,2))return false
  if(lawn.poly.some((p,i)=>distToSeg(x,z,p,lawn.poly[(i+1)%lawn.poly.length])<3))return false
  if(campus.trees.some(t=>Math.hypot(t[0]-x,t[1]-z)<4))return false
  if(paths.some(p=>p.pts.some((q,i)=>i>0&&distToSeg(x,z,p.pts[i-1],q)<p.w/2+2.5)))return false
  return spots.every(p=>Math.hypot(p[0]-x,p[1]-z)>=20)
 }
 for(const [tx,tz] of targets){
  let found:Pt|undefined
  for(let r=0;r<=35&&!found;r+=2)for(let n=0;n<16;n++){
   const x=tx+Math.cos(n*Math.PI/8)*r,z=tz+Math.sin(n*Math.PI/8)*r
   if(valid(x,z)){found=[x,z];break}
  }
  if(found)spots.push(found)
 }
 return spots
}
