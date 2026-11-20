import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Collider, pointInPoly, type Campus } from '../campus'
import { indoorState } from '../scene/indoorState'
import { player } from '../scene/Player'
import { activityState } from './activityState'
import { parkingSpots, stepParking, type ParkingRun } from './parkingWars'
let run:ParkingRun|null=null,phase:'instructions'|'driving'='instructions',saved={yaw:0,pitch:0}
const keys=new Set<string>(),listeners=new Set<()=>void>();function notify(){listeners.forEach(f=>f())}
function exit(){if(!run)return;run=null;activityState.mode=null;activityState.locked=false;player.yaw=saved.yaw;player.pitch=saved.pitch;player.viewChanged=true;keys.clear();notify()}
function start(spots:ReturnType<typeof parkingSpots>){if(!spots.length)return;saved={yaw:player.yaw,pitch:player.pitch};run={car:{x:player.x,z:player.z,heading:player.heading,speed:0,next:1,finished:false},spots,time:120,parked:0,finished:false,failed:false,hold:0};phase='instructions';activityState.mode='parking';activityState.locked=true;notify()}
function drive(){if(!run)return;phase='driving';player.pitch=.75;player.viewChanged=true;notify()}
function Car({color='#dabc42'}:{color?:string}){return <group><mesh position={[0,.55,0]}><boxGeometry args={[1.7,.8,3.5]}/><meshStandardMaterial color={color}/></mesh><mesh position={[0,1.1,-.1]}><boxGeometry args={[1.5,.65,1.8]}/><meshStandardMaterial color="#789c9f"/></mesh>{[-.9,.9].flatMap(x=>[-1,1].map(z=><mesh key={x+':'+z} position={[x,.35,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.35,.35,.22,12]}/><meshStandardMaterial color="#222"/></mesh>))}</group>}
export function ParkingWorld({campus}:{campus:Campus}){
 const [,refresh]=useState(0),group=useRef<THREE.Group>(null),last=useRef(0),spots=useMemo(()=>parkingSpots(campus),[campus]),collider=useMemo(()=>new Collider(campus.buildings),[campus])
 useEffect(()=>{const f=()=>refresh(n=>n+1);listeners.add(f);return()=>{listeners.delete(f);exit()}},[])
 useFrame((_,dt)=>{if(!run||phase!=='driving')return;stepParking(run,keys,dt,(x,z)=>collider.blocked(x,z,1)||!pointInPoly(x,z,campus.boundary));player.x=run.car.x;player.z=run.car.z;player.heading=run.car.heading;player.yaw=run.car.heading+Math.PI;if(group.current){group.current.position.set(run.car.x,0,run.car.z);group.current.rotation.y=run.car.heading}if(performance.now()-last.current>150){last.current=performance.now();notify()}})
 return <>{spots.length>0&&!run&&<group position={[spots[0][0],0,spots[0][1]-12]}><Car/><Text position={[0,3,0]} color="#ffc629" fontSize={.7} anchorX="center">PARKING WARS</Text></group>}{run&&phase==='driving'&&<><group ref={group}><Car/></group>{run.spots.map(([x,z],i)=>i!==run!.parked&&<group key={'occupied'+i} position={[x,0,z]}><Car color="#647e8b"/></group>)}{run.spots.map(([x,z],i)=><group key={i} position={[x,.12,z]}><mesh><boxGeometry args={[2.8,.08,5]}/><meshBasicMaterial color={i===run!.parked?'#71d790':'#b6b6b6'} transparent opacity={.7}/></mesh><Text position={[0,2,0]} color="#ffcd30" anchorX="center" fontSize={.6}>{i===run!.parked?'PARK HERE':'OCCUPIED'}</Text></group>)}</>}</>
}
export function ParkingActivities({campus}:{campus:Campus}){
 const [,refresh]=useState(0),[near,setNear]=useState(false),spots=useMemo(()=>parkingSpots(campus),[campus])
 useEffect(()=>{const f=()=>refresh(n=>n+1);listeners.add(f);return()=>{listeners.delete(f);exit()}},[])
 useEffect(()=>{const id=setInterval(()=>{const n=!!spots.length&&!indoorState.active&&!player.view&&!player.busRide&&!activityState.mode&&Math.hypot(player.x-spots[0][0],player.z-(spots[0][1]-12))<7;activityState.parkingNear=n;setNear(n)},250);return()=>{clearInterval(id);activityState.parkingNear=false}},[spots])
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;const k=e.key.toLowerCase();if(run&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();keys.add(k);return}if(e.repeat)return;if(k==='escape'&&run)exit();else if(k==='e'&&near&&!run&&!activityState.mode)start(spots)};const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase()),blur=()=>keys.clear();addEventListener('keydown',down);addEventListener('keyup',up);addEventListener('blur',blur);return()=>{removeEventListener('keydown',down);removeEventListener('keyup',up);removeEventListener('blur',blur)}},[near,spots])
 return <>{near&&!activityState.mode&&<div className="activity-prompt">Press <b>E</b> to Start Parking Wars</div>}{run&&<section className="activity-panel"><header><strong>Parking Wars</strong><button onClick={exit}>Exit</button></header>{phase==='instructions'?<><p>Class starts in two minutes! Find parking!</p><small>W/S accelerate or brake · A/D steer. Align with the green space and stop inside it for one second.</small><p><button onClick={drive}>Start</button></p></>:run.finished?<><p>Parked! {Math.ceil(run.time)} seconds to spare.</p><button onClick={exit}>Finish</button></>:run.failed?<><p>Time's up! Class has started.</p><button onClick={exit}>Exit</button></>:<><p>Time remaining: {Math.ceil(run.time)} seconds</p><small>Align with the green space and stop inside it.</small></>}</section>}</>
}
