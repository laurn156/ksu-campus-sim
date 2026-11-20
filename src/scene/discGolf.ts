import { bbox, Collider, distToSeg, pointInPoly, type Campus, type Pt } from '../campus.ts'

/** Pick clear, well-spaced places on the wooded green, leaving the paths open. */
export function discGolfSpots(campus:Campus):Pt[] {
 const lawn=campus.areas.find(a=>a.kind==='pitch:disc_golf')
 if(!lawn)return []
 const [x0,z0,x1,z1]=bbox(lawn.poly),collider=new Collider(campus.buildings)
 const targets:Pt[]=[[x0+(x1-x0)*.25,z0+(z1-z0)*.3],[x0+(x1-x0)*.7,z0+(z1-z0)*.42],[x0+(x1-x0)*.5,z0+(z1-z0)*.76]]
 // Preserve the original three, then spread twelve more throughout the wooded course.
 for(const z of [.15,.37,.59,.81])for(const x of [.18,.37,.57,.77])targets.push([x0+(x1-x0)*x,z0+(z1-z0)*z])
 const trees=campus.trees.filter(t=>t[0]>=x0-4&&t[0]<=x1+4&&t[1]>=z0-4&&t[1]<=z1+4)
 const segments=[...campus.paths,...campus.roads].flatMap(p=>p.pts.slice(1).map((q,i)=>({a:p.pts[i],b:q,w:p.w}))).filter(({a,b,w})=>Math.max(a[0],b[0])+w/2+3>=x0&&Math.min(a[0],b[0])-w/2-3<=x1&&Math.max(a[1],b[1])+w/2+3>=z0&&Math.min(a[1],b[1])-w/2-3<=z1)
 const spots:Pt[]=[]
 const valid=(x:number,z:number)=>{
  if(!pointInPoly(x,z,lawn.poly)||collider.blocked(x,z,2))return false
  if(lawn.poly.some((p,i)=>distToSeg(x,z,p,lawn.poly[(i+1)%lawn.poly.length])<3))return false
  if(trees.some(t=>Math.hypot(t[0]-x,t[1]-z)<4))return false
  if(segments.some(({a,b,w})=>distToSeg(x,z,a,b)<w/2+2.5))return false
  return spots.every(p=>Math.hypot(p[0]-x,p[1]-z)>=12)
 }
 for(const [tx,tz] of targets){
  let found:Pt|undefined
  for(let r=0;r<=35&&!found;r+=2)for(let n=0;n<16;n++){
   const x=tx+Math.cos(n*Math.PI/8)*r,z=tz+Math.sin(n*Math.PI/8)*r
   if(valid(x,z)){found=[x,z];break}
  }
  if(found)spots.push(found)
  if(spots.length===15)break
 }
 return spots
}

/** Select at most two rendered trees inside the course to open small clearings. */
export function discGolfTreesToRemove(campus:Campus,trees:readonly (readonly [number,number,number])[],baskets:readonly Pt[]):number[]{
 const lawn=campus.areas.find(a=>a.kind==='pitch:disc_golf')
 if(!lawn||!baskets.length)return []
 return trees.map(([x,z],i)=>({x,z,i})).filter(t=>pointInPoly(t.x,t.z,lawn.poly))
  .map(t=>({...t,d:Math.min(...baskets.map(([x,z])=>Math.hypot(t.x-x,t.z-z)))}))
  .sort((a,b)=>a.d-b.d||a.i-b.i).slice(0,2).map(t=>t.i)
}
