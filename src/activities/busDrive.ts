import type { Pt } from '../campus.ts'
import { driveRace, type RaceCar } from './bathtubRace.ts'

/** Choose three spaced stops along the same road used by campus shuttles. */
export function busStops(path:Pt[],x:number,z:number):Pt[] {
 if(path.length<4)return []
 let closest=0;for(let i=1;i<path.length;i++)if(Math.hypot(path[i][0]-x,path[i][1]-z)<Math.hypot(path[closest][0]-x,path[closest][1]-z))closest=i
 const forward=closest<path.length/2, ordered=forward?path.slice(closest):path.slice(0,closest+1).reverse()
 const stops:Pt[]=[];let last:Pt=[x,z],distance=0
 for(const p of ordered){distance+=Math.hypot(p[0]-last[0],p[1]-last[1]);last=p;if(distance>=75){stops.push(p);distance=0;if(stops.length===3)break}}
 return stops.length>=2?stops:[]
}
export type BusRun={car:RaceCar;stops:Pt[];next:number;doors:boolean;wait:number;passengers:number;finished:boolean;elapsed:number}
export function driveBus(run:BusRun,keys:Set<string>,dt:number,blocked:(x:number,z:number)=>boolean){
 if(run.finished)return
 run.elapsed+=Math.min(dt,.05)
 if(run.doors){run.car.speed=0;run.wait+=Math.min(dt,.05);return}
 // Reuse the driving physics without its race-checkpoint logic.
 driveRace(run.car,keys,dt,[[1e9,1e9],[1e9,1e9]],blocked)
}
export function toggleBusDoors(run:BusRun):'opened'|'closed'|'moving'|'away' {
 if(run.doors){if(run.wait<2)return 'opened';run.doors=false;run.next++;run.passengers=Math.max(0,run.passengers+(run.next===1?3:run.next===2?1:-4));if(run.next>=run.stops.length)run.finished=true;return 'closed'}
 if(Math.abs(run.car.speed)>.4)return 'moving'
 const stop=run.stops[run.next];if(!stop||Math.hypot(run.car.x-stop[0],run.car.z-stop[1])>9)return 'away'
 run.doors=true;run.wait=0;return 'opened'
}
