import { combinedKeys } from '../hardware/controller'
import { Text } from '@react-three/drei'
import { Character } from '../characters/Character'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Collider, pointInPoly, type Campus } from '../campus'
import { busDriver, busPositions, busRoute } from '../scene/Buses'
import { indoorState } from '../scene/indoorState'
import { visibleTreePositions } from '../scene/treeRegistry'
import { protectedShuttle } from '../scene/trafficSafety'
import { player } from '../scene/Player'
import { activityState } from './activityState'
import { busStops, driveBus, toggleBusDoors, busScore, stopDeadline, stopHeading, insideBusStop, STOP_WIDTH, STOP_LENGTH, type BusRun } from './busDrive'
import { busObstacleBlocks, crossingsForStops, crossingPosition, type Crossing } from './busHazards'

type Session={run:BusRun;phase:'instructions'|'driving';savedYaw:number;savedPitch:number;index:number;notice:string;crossings:Crossing[]}
let session:Session|null=null
const keys=new Set<string>(),listeners=new Set<()=>void>()
function notify(){listeners.forEach(f=>f())}
function close(){if(!session)return;player.yaw=session.savedYaw;player.pitch=session.savedPitch;player.viewChanged=true;session=null;busDriver.index=-1;protectedShuttle.active=false;activityState.mode=null;activityState.locked=false;keys.clear();notify()}
function begin(index:number,path:ReturnType<typeof busRoute>){const bus=busPositions[index];if(!bus)return;const stops=busStops(path,bus.x,bus.z);if(stops.length<2)return;session={index,savedYaw:player.yaw,savedPitch:player.pitch,phase:'instructions',notice:'',crossings:crossingsForStops(path,stops),run:{car:{x:bus.x,z:bus.z,heading:bus.h,speed:0,next:1,finished:false},stops,stopHeadings:stops.map(stop=>stopHeading(path,stop)),next:0,doors:false,wait:0,passengers:0,finished:false,elapsed:0,pickedUp:0,collisions:0,impactCooldown:0,pedestrianHits:0,arrivals:[],lateStops:0}};activityState.mode='busdrive';activityState.locked=true;depart()}
function depart(){if(!session)return;session.phase='driving';busDriver.index=session.index;player.x=session.run.car.x;player.z=session.run.car.z;player.pitch=.7;player.viewChanged=true;notify()}
function doors(){if(!session||session.phase!=='driving'||session.run.finished)return;const result=toggleBusDoors(session.run);session.notice=result==='moving'?'Stop inside the rectangle before opening the doors.':result==='away'?'Drive closer to the highlighted stop.':result==='opened'?'Passengers are boarding. Wait two seconds, then press B to close the doors.':'';notify()}
function BoardingStudent({index}:{index:number}){const ref=useRef<THREE.Group>(null),walk=useRef(.8);useFrame(()=>{if(!ref.current||!session)return;const t=Math.min(1,session.run.wait/2);ref.current.position.set(3.8-t*2.2,0,2-index*1.1);ref.current.visible=t<.95});return <group ref={ref} rotation={[0,-Math.PI/2,0]}><Character color={index%2?'blue':'yellow'} top="tee" topColor={index%2?'#4b7776':'#b75648'} bottom="pants" shoes="sneakers" walk={walk} scale={1.15}/></group>}
function CrossingStudent({crossing,index}:{crossing:Crossing;index:number}){const ref=useRef<THREE.Group>(null),walk=useRef(.7);useFrame(()=>{if(!session||!ref.current)return;const [x,z]=crossingPosition(crossing,session.run.elapsed),t=(session.run.elapsed+crossing.phase)%8;ref.current.position.set(x,0,z);ref.current.rotation.y=Math.atan2(crossing.normal[0],crossing.normal[1])+(t>=4?Math.PI:0);walk.current=t>=.5&&t<3.5||t>=4&&t<7?.8:0});return <group ref={ref}><Character color={index%2?'green':'purple'} top="tee" topColor={index%2?'#d6a939':'#678e81'} bottom="pants" shoes="sneakers" walk={walk} scale={1.15}/></group>}
function Bus(){return <><mesh position={[0,1.8,0]}><boxGeometry args={[2.5,2.8,10.5]}/><meshStandardMaterial color="#171919"/></mesh><mesh position={[0,3.3,0]}><boxGeometry args={[2.35,.25,9.5]}/><meshStandardMaterial color="#dddcd1"/></mesh><mesh position={[0,2.2,5.27]}><planeGeometry args={[2.25,1.55]}/><meshStandardMaterial color="#536e72"/></mesh>{[-1,1].map(side=><group key={side} position={[side*1.26,2.05,0]} rotation={[0,side*Math.PI/2,0]}><mesh><planeGeometry args={[10.3,2.3]}/><meshStandardMaterial color="#232d2e" side={THREE.DoubleSide}/></mesh><Text position={[0,-.45,.02]} fontSize={.55} color="#f4c52e" anchorX="center">BIG OWL BUS</Text></group>)}{[-1,1].flatMap(x=>[-3.1,3.1].map(z=><mesh key={x+':'+z} position={[x*1.22,.62,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.62,.62,.35,12]}/><meshStandardMaterial color="#191a1a"/></mesh>))}</>}
export function VehicleWorld({campus}:{campus:Campus}){
 const [,refresh]=useState(0),group=useRef<THREE.Group>(null),collider=useMemo(()=>new Collider(campus.buildings),[campus]),last=useRef(0)
 useEffect(()=>{const f=()=>refresh(x=>x+1);listeners.add(f);return()=>{listeners.delete(f);close()}},[])
 useFrame((_,raw)=>{const s=session;if(!s||s.phase!=='driving')return;const crashes=s.run.collisions,carBefore=s.run.car;const inStop=(x:number,z:number)=>s.run.stops.some((stop,i)=>insideBusStop(x,z,stop,s.run.stopHeadings[i]??0));protectedShuttle.active=inStop(carBefore.x,carBefore.z);protectedShuttle.x=carBefore.x;protectedShuttle.z=carBefore.z;let pedestrian=false
 const beforeX=carBefore.x,beforeZ=carBefore.z
 driveBus(s.run,combinedKeys(keys),raw,(x,z)=>{
  // Compare each obstacle at the proposed heading, so turning does not make an
  // existing overlap look like a new collision. Backing out must always work.
  const h=carBefore.heading
  const blocks=(ox:number,oz:number,radius:number)=>busObstacleBlocks([beforeX,beforeZ],[x,z],h,[ox,oz],radius)
  if(collider.blocked(x,z,1.5)&&!collider.blocked(beforeX,beforeZ,1.5))return true
  if(!pointInPoly(x,z,campus.boundary)&&pointInPoly(beforeX,beforeZ,campus.boundary))return true
  for(const tree of visibleTreePositions){if(Math.abs(tree[0]-x)<8&&Math.abs(tree[1]-z)<8&&blocks(tree[0],tree[1],.35))return true}
  if(!inStop(x,z))for(let i=0;i<busPositions.length;i++){const b=busPositions[i];if(!b||i===s.index||Math.hypot(b.x-x,b.z-z)>13)continue;for(const offset of [-4,-2,0,2,4])if(blocks(b.x+Math.sin(b.h)*offset,b.z+Math.cos(b.h)*offset,1.1))return true}
  for(const c of s.crossings){const [px,pz]=crossingPosition(c,s.run.elapsed);if(blocks(px,pz,.4)){pedestrian=true;return true}}
  return false
 })
 if(s.run.collisions>crashes){if(pedestrian){s.run.pedestrianHits++;s.notice='Student crossing! Stop and let them pass. −50 points.'}else s.notice='Oh no! Collision — slow down and steer clear.'}const car=s.run.car;player.x=car.x;player.z=car.z;player.heading=car.heading;player.yaw=car.heading+Math.PI;if(group.current){group.current.position.set(car.x,0,car.z);group.current.rotation.y=car.heading}if(performance.now()-last.current>150){last.current=performance.now();notify()}})
 const s=session
 return s&&s.phase==='driving'?<><group ref={group}><Bus/>{s.run.doors&&[0,1,2].map(i=><BoardingStudent key={i} index={i}/>)}{s.run.doors&&<mesh position={[1.45,1.4,3]} rotation={[0,.7,0]}><boxGeometry args={[.12,2.3,1.6]}/><meshStandardMaterial color="#a8d3d3"/></mesh>}</group>{s.crossings.map((crossing,i)=><CrossingStudent key={i} crossing={crossing} index={i}/>)}{busRoute(campus).filter((_,i)=>i%6===0).map(([x,z],i)=><mesh key={'route'+i} position={[x,.13,z]}><cylinderGeometry args={[.35,.35,.05,8]}/><meshBasicMaterial color="#f6cd49"/></mesh>)}{s.run.stops.map(([x,z],i)=><group key={i} position={[x,0,z]}><mesh position={[0,.1,0]} rotation={[0,s.run.stopHeadings[i]??0,0]}><boxGeometry args={[STOP_WIDTH,.12,STOP_LENGTH]}/><meshBasicMaterial color={i===s.run.next?'#ffd12e':'#8b9690'} transparent opacity={.5}/></mesh><Text position={[0,4,0]} fontSize={1} color="#ffca29" anchorX="center">{i===s.run.next?'NEXT STOP':`STOP ${i+1}`}</Text></group>)}</>:null
}
export function VehicleActivities({campus}:{campus:Campus}){
 const [,refresh]=useState(0),[near,setNear]=useState<number|null>(null),path=useMemo(()=>busRoute(campus),[campus])
 useEffect(()=>{const f=()=>refresh(x=>x+1);listeners.add(f);return()=>{listeners.delete(f);close();activityState.vehicleNear=false}},[])
 useEffect(()=>{const id=setInterval(()=>{let index:number|null=null;if(!indoorState.active&&!player.view&&!player.busRide&&!activityState.mode){let d=11;busPositions.forEach((p,i)=>{if(!p)return;const n=Math.hypot(player.x-p.x,player.z-p.z);if(n<d&&busStops(path,p.x,p.z).length>=2){d=n;index=i}})}activityState.vehicleNear=index!==null;setNear(index)},250);return()=>clearInterval(id)},[path])
 useEffect(()=>{const start=(e:Event)=>{const detail=(e as CustomEvent<{name:string;target:{x:number;z:number}}>).detail;if(detail.name!=='Drive the Big Owl Bus'||activityState.mode)return;let nearest=-1,distance=Infinity;busPositions.forEach((b,i)=>{if(!b)return;const d=Math.hypot(b.x-detail.target.x,b.z-detail.target.z);if(d<distance&&busStops(path,b.x,b.z).length>=2){distance=d;nearest=i}});if(nearest>=0){begin(nearest,path);depart()}};window.addEventListener('activity-start',start);return()=>window.removeEventListener('activity-start',start)},[path])
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;const k=e.key.toLowerCase();if(session&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();keys.add(k);return}if(e.repeat)return;if(k==='escape'&&session){close();return}if(k==='b'&&session)doors();else if(k==='f'&&!session&&near!==null&&!activityState.mode)begin(near,path)};const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase()),blur=()=>keys.clear();addEventListener('keydown',down);addEventListener('keyup',up);addEventListener('blur',blur);return()=>{removeEventListener('keydown',down);removeEventListener('keyup',up);removeEventListener('blur',blur)}},[near,path])
 const s=session
 return <>{!s&&near!==null&&!activityState.mode&&<div className="activity-prompt">Press <b>F</b> to Drive Big Owl Bus</div>}{s&&<section className="activity-panel"><header><strong>Big Owl Bus</strong><button onClick={close}>Exit</button></header>{s.phase==='instructions'?<><p>Pick up students at every stop!</p><small>W/S accelerate or brake · A/D steer. Stop at each marker and press B to board students. Earn points for pickups; collisions and time cost points.</small><p><button onClick={depart}>Start route</button></p></>:s.run.finished?<><p>Route complete!</p><p>{s.run.pickedUp} picked up · {s.run.collisions} collisions · {s.run.lateStops} late stops · {s.run.elapsed.toFixed(1)} seconds · Score {busScore(s.run)}</p><button onClick={close}>Finish</button></>:<><p>Stop {s.run.next+1} / {s.run.stops.length} · {s.run.pickedUp} picked up · {s.run.collisions} crashes · {s.run.pedestrianHits} students hit</p><small>{s.run.elapsed>stopDeadline(s.run.next)?`Late by ${Math.ceil(s.run.elapsed-stopDeadline(s.run.next))}s`: `Stop due in ${Math.max(0,Math.ceil(stopDeadline(s.run.next)-s.run.elapsed))}s`} · {s.run.lateStops} late stops</small><br/><small>{s.notice||'Follow the gold stop marker. B opens or closes doors when stopped.'}</small></>}</section>}</>
}
