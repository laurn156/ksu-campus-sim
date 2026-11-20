import { centroid, Collider, pointInPoly, type Campus, type Pt } from '../campus.ts'
import { discGolfSpots } from '../scene/discGolf.ts'

export const letters=['H','O','O','T','Y','H','O','O'] as const
/** Multiple riddles per landmark; none gives away the building's name. */
export const huntClues=[
 ['Grab a bite, meet a friend, or take a break between classes.', 'Find the busy campus gathering place where lunch and conversation meet.', 'Where student life gathers, your first letter waits outside.'],
 ['Quiet pages and countless stories wait behind these doors.', 'Where knowledge sits on shelves, look outside for a letter.', 'Shhh! Find the place where Owls borrow stories and study quietly.'],
 ['Numbers, proofs and patterns are the language spoken here.', 'Where equations cover the board, a letter waits outside.', 'Follow the signs of fractions, formulas and functions.'],
 ['Safety goggles and experiments belong near this letter.', 'Where discoveries begin with a hypothesis, look outside.', 'Beakers and experiments point the way to this letter.'],
 ['Debugging, keyboards and a place for a sandwich meet nearby.', 'Find the place where programmers gather and sandwiches are stacked.', 'Lines of code and a sandwich counter share a home near this letter.'],
 ['Sketches and tiny models become plans for buildings here.', 'Find the studio where future spaces begin as drawings.', 'Drafting tables and design critiques will lead you to this letter.'],
 ['Find the place where Owls lift, climb and shoot hoops.', 'Sneakers, weights and a climbing wall are your clues.', 'Where students work up a sweat and play, look outside.'],
 ['Hungry Owls gather here for a meal together.', 'Follow the scent of lunch to a favorite gathering spot.', 'Trays and tables await inside; a letter waits outdoors.'],
] as const
/** Choose a fresh variation for each clue whenever a new hunt starts. */
export function chooseHuntClues(previous:readonly string[]=[],random:()=>number=Math.random):string[]{
 return huntClues.map((options,i)=>{const choices=options.filter(c=>c!==previous[i]);return choices[Math.floor(random()*choices.length)]})
}
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
/** Aim toward the selected point at chain height, accounting for the current wind. */
export function discAim(lie:Pt,target:Pt,wind:Pt=[0,0]){
 const dx=target[0]-lie[0],dz=target[1]-lie[1],distance=Math.hypot(dx,dz)
 const wanted=Math.atan2(dx,dz);let angle=wanted,power=.5
 const sample=(heading:number,p:number)=>{
  let f=discLaunch(lie,heading,p)
  for(let i=0;i<120;i++){
   const prev=f;f=stepDisc(f,.04,wind)
   if(f.vy<0&&f.y<=1.3){const t=Math.max(0,Math.min(1,(prev.y-1.3)/(prev.y-f.y||1)));return [prev.x+(f.x-prev.x)*t-lie[0],prev.z+(f.z-prev.z)*t-lie[1]] as Pt}
  }
  return [f.x-lie[0],f.z-lie[1]] as Pt
 }
 for(let pass=0;pass<5;pass++){
  let low=0,high=1
  for(let n=0;n<12;n++){const p=(low+high)/2,[x,z]=sample(angle,p);if(Math.hypot(x,z)<distance)low=p;else high=p}
  power=(low+high)/2
  const [x,z]=sample(angle,power),actual=Math.atan2(x,z)
  angle+=Math.atan2(Math.sin(wanted-actual),Math.cos(wanted-actual))
 }
 return {angle,power}
}
export function discLaunch(lie:Pt,angle:number,power:number){const speed=4+power*15;return {x:lie[0],y:1,z:lie[1],vx:Math.sin(angle)*speed,vy:3+power*2,vz:Math.cos(angle)*speed}}
/** Dots use the same wind and flight physics as a real throw. */
export function discTrajectory(lie:Pt,angle:number,power:number,wind:Pt){
 const points:{x:number;y:number;z:number}[]=[],dt=.05
 let flight=discLaunch(lie,angle,power)
 for(let i=0;i<100;i++){flight=stepDisc(flight,dt,wind);if(flight.y<=.15)break;if(i%3===0)points.push({x:flight.x,y:flight.y,z:flight.z})}
 return points
}

/** Find actual contact with the chain area, sweeping between frames to avoid tunneling. */
export function discBasketContact(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},basket:Pt){
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/.08))
 for(let i=1;i<=steps;i++){
  const t=i/steps,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t,z=from.z+(to.z-from.z)*t
  // The modeled chain assembly tapers from radius .4 at the top to .2 at the bottom.
  if(y>=.86&&y<=1.84&&Math.hypot(x-basket[0],z-basket[1])<=.2+(y-.86)*.2/.98)return {x,y,z}
 }
 return null
}

/** A disc skips once or twice, then skids to rest rather than stopping in mid-air. */
export function stepDiscLanding(state:{x:number;y:number;z:number;vx:number;vy:number;vz:number},dt:number){
 const next={...state};next.x+=next.vx*dt;next.z+=next.vz*dt;next.y+=next.vy*dt;next.vy-=7*dt
 if(next.y<=.16){next.y=.16;next.vy=next.vy<-.8?-next.vy*.22:0;const drag=Math.exp(-3.4*dt);next.vx*=drag;next.vz*=drag;if(Math.hypot(next.vx,next.vz)<.08){next.vx=0;next.vz=0}}
 return next
}
/** Wind is a world-space acceleration, shared by preview and actual flight. */
export function makeDiscWind():Pt{const angle=Math.random()*Math.PI*2,magnitude=1.2+Math.random()*2;return [Math.sin(angle)*magnitude,Math.cos(angle)*magnitude]}
