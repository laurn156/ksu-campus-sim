import type { Pt } from '../campus.ts'
/** Positive means an obstacle overlaps the oriented shuttle footprint. */
export function busPenetration(x:number,z:number,heading:number,ox:number,oz:number,radius:number){
 const dx=ox-x,dz=oz-z,side=dx*Math.cos(heading)-dz*Math.sin(heading),forward=dx*Math.sin(heading)+dz*Math.cos(heading)
 return Math.max(0,Math.min(1.35+radius-Math.abs(side),5.3+radius-Math.abs(forward)))
}
/** Block new or deeper contact, while allowing a vehicle to back out of overlap. */
export function busObstacleBlocks(from:Pt,to:Pt,heading:number,obstacle:Pt,radius:number){
 const before=busPenetration(from[0],from[1],heading,obstacle[0],obstacle[1],radius)
 const after=busPenetration(to[0],to[1],heading,obstacle[0],obstacle[1],radius)
 return after>.02&&after>before+.001
}
export type Crossing={at:Pt;normal:Pt;phase:number}
export function crossingsForStops(path:Pt[],stops:Pt[]):Crossing[]{return stops.flatMap((stop,j)=>{
 let closest=0;for(let i=1;i<path.length;i++)if(Math.hypot(path[i][0]-stop[0],path[i][1]-stop[1])<Math.hypot(path[closest][0]-stop[0],path[closest][1]-stop[1]))closest=i
 return [4,9].map((back,k)=>{const i=Math.max(1,Math.min(path.length-2,closest-back)),a=path[i-1],b=path[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return {at:path[i],normal:[-(b[1]-a[1])/len,(b[0]-a[0])/len] as Pt,phase:j*2.3+k*3.1}})
})}
/** Students cross frequently, briefly pausing at each curb. */
export function crossingPosition(c:Crossing,time:number):Pt{
 const t=((time+c.phase)%8+8)%8,progress=t<.5?-1:t<3.5?-1+(t-.5)*2/3:t<4?1:t<7?1-(t-4)*2/3:-1
 return [c.at[0]+c.normal[0]*progress*5,c.at[1]+c.normal[1]*progress*5]
}
