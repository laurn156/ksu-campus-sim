import type { Pt } from '../campus.ts'
import { driveRace, type RaceCar } from './bathtubRace.ts'

/** Choose three spaced stops along the same road used by campus shuttles. */
export function busStops(path:Pt[],x:number,z:number):Pt[] {
 if(path.length<4)return []
 let closest=0;for(let i=1;i<path.length;i++)if(Math.hypot(path[i][0]-x,path[i][1]-z)<Math.hypot(path[closest][0]-x,path[closest][1]-z))closest=i
 const forward=closest<path.length/2,first=forward?path.slice(closest):path.slice(0,closest+1).reverse(),back=forward?path.slice(0,-1).reverse():path.slice(1),ordered=first.concat(back)
 const stops:Pt[]=[];let last:Pt=[x,z],distance=0
 for(const p of ordered){distance+=Math.hypot(p[0]-last[0],p[1]-last[1]);last=p;if(distance>=75){stops.push(p);distance=0;if(stops.length===3)break}}
 return stops.length===3?stops:[]
}
export type BusRun={car:RaceCar;stops:Pt[];next:number;doors:boolean;wait:number;passengers:number;finished:boolean;elapsed:number;pickedUp:number;collisions:number;impactCooldown:number;pedestrianHits:number;arrivals:number[];lateStops:number}
export function driveBus(run:BusRun,keys:Set<string>,dt:number,blocked:(x:number,z:number)=>boolean){
 if(run.finished)return
 run.elapsed+=Math.min(dt,.05)
 if(run.doors){run.car.speed=0;run.wait+=Math.min(dt,.05);return}
 // Reuse the driving physics without its race-checkpoint logic.
 run.impactCooldown=Math.max(0,run.impactCooldown-Math.min(dt,.05))
 const speed=Math.abs(run.car.speed);let impact=false
 driveRace(run.car,keys,dt,[[1e9,1e9],[1e9,1e9]],(x,z)=>{impact=blocked(x,z);return impact})
 if(impact&&speed>.5&&run.impactCooldown<=0){run.collisions++;run.impactCooldown=1.5}
}
export function toggleBusDoors(run:BusRun):'opened'|'closed'|'moving'|'away' {
 if(run.doors){if(run.wait<2)return 'opened';run.doors=false;run.next++;const boarding=[3,2,1][run.next-1]??1,leaving=[0,1,3][run.next-1]??0;run.pickedUp+=boarding;run.passengers=Math.max(0,run.passengers+boarding-leaving);if(run.next>=run.stops.length)run.finished=true;return 'closed'}
 if(Math.abs(run.car.speed)>.4)return 'moving'
 const stop=run.stops[run.next];if(!stop||Math.hypot(run.car.x-stop[0],run.car.z-stop[1])>9)return 'away'
 if(run.arrivals[run.next]===undefined){run.arrivals[run.next]=run.elapsed;if(run.elapsed>stopDeadline(run.next))run.lateStops++}
 run.doors=true;run.wait=0;return 'opened'
}

/** The route schedule gives 40 seconds per stop, including boarding time. */
export function stopDeadline(index:number){return (index+1)*40}
/** Reward completed pickups while encouraging careful, efficient driving. */
export function busScore(run:BusRun){return Math.max(0,run.pickedUp*100-(run.collisions-(run.pedestrianHits||0))*25-(run.pedestrianHits||0)*50-Math.floor(run.elapsed/10)*5-(run.lateStops||0)*75)}
