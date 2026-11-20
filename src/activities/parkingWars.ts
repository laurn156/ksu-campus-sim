import { bbox, pointInPoly, type Campus, type Pt } from '../campus.ts'
import { driveRace, type RaceCar } from './bathtubRace.ts'
/** Select two spots within an existing parking area, leaving a navigable approach. */
export function parkingSpots(campus:Campus):Pt[]{
 const lot=campus.areas.find(a=>a.name==='P29 - Commuter Only');if(!lot)return []
 const [x0,z0,x1,z1]=bbox(lot.poly),x=(x0+x1)/2,z=(z0+z1)/2
 const spots:Pt[]=[[x-8,z-25],[x+8,z+25]]
 return spots.every(p=>pointInPoly(p[0],p[1],lot.poly))?spots:[]
}
export type ParkingRun={car:RaceCar;spots:Pt[];time:number;parked:number;finished:boolean;failed:boolean;hold:number}
export function stepParking(run:ParkingRun,keys:Set<string>,dt:number,blocked:(x:number,z:number)=>boolean){
 if(run.finished||run.failed)return
 dt=Math.min(.05,dt);run.time-=dt;
 // A competing driver claims the first space after 35 seconds; another opens.
 if(run.time<85&&run.parked===0){run.parked=1;run.hold=0}if(run.time<=0){run.time=0;run.failed=true;return}
 driveRace(run.car,keys,dt,[[1e9,1e9],[1e9,1e9]],blocked)
 const target=run.spots[run.parked],angle=Math.abs(Math.atan2(Math.sin(run.car.heading),Math.cos(run.car.heading)))
 const aligned=Math.min(angle,Math.abs(Math.PI-angle))<.4
 if(Math.abs(run.car.x-target[0])<1.3&&Math.abs(run.car.z-target[1])<2.3&&aligned&&Math.abs(run.car.speed)<.5){run.hold+=dt;if(run.hold>=1)run.finished=true}else run.hold=0
}
