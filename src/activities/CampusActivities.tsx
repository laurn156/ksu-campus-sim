import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Collider, pointInPoly, type Campus, type Pt } from '../campus'
import { indoorState } from '../scene/indoorState'
import { player } from '../scene/Player'
import { letters, huntPositions, nearestBasket, stepDisc } from './campusActivities'
import { discGolfSpots } from '../scene/discGolf'
import { activityState } from './activityState'
import './activities.css'

type Flight={x:number;y:number;z:number;vx:number;vy:number;vz:number}
type Disc={basket:Pt;lie:Pt;flight:Flight|null;throws:number;done:boolean}
type Store={mode:null|'disc'|'hunt';disc:Disc|null;found:number[];places:Pt[];angle:number;power:number;charging:boolean}
const state:Store={mode:null,disc:null,found:[],places:[],angle:0,power:0,charging:false}
const listeners=new Set<()=>void>()
function notify(){listeners.forEach(f=>f())}
function exit(){state.mode=null;state.disc=null;state.charging=false;activityState.mode=null;activityState.locked=false;notify()}
function startHunt(campus:Campus){const spots=huntPositions(campus);if(spots.length!==letters.length)return;state.mode='hunt';state.places=spots;state.found=[];activityState.mode='hunt';activityState.locked=false;notify()}
function startDisc(basket:Pt){state.mode='disc';state.angle=Math.atan2(basket[0]-player.x,basket[1]-player.z);state.disc={basket,lie:[player.x,player.z],flight:null,throws:0,done:false};activityState.mode='disc';activityState.locked=true;notify()}
function throwDisc(){const d=state.disc;if(!d||d.flight||d.done)return;const speed=6+state.power*13;d.flight={x:d.lie[0],y:1,z:d.lie[1],vx:Math.sin(state.angle)*speed,vy:3.8+state.power*2,vz:Math.cos(state.angle)*speed};d.throws++;state.charging=false;notify()}

export function ActivityWorld({campus}:{campus:Campus}){
 const [,update]=useState(0),discRef=useRef<THREE.Mesh>(null),sign=useMemo(()=>huntPositions(campus)[0],[campus]),collider=useMemo(()=>new Collider(campus.buildings),[campus]),last=useRef(0)
 useEffect(()=>{const f=()=>update(n=>n+1);listeners.add(f);return()=>{listeners.delete(f);exit()}},[])
 useFrame((_,raw)=>{const dt=Math.min(raw,.05),d=state.disc
  if(state.mode==='disc'&&d){if(state.charging&&!d.flight&&!d.done){state.power=Math.min(1,state.power+dt*.55);if(performance.now()-last.current>80){last.current=performance.now();notify()}}
   if(d.flight){const next=stepDisc(d.flight,dt),hit=Math.hypot(next.x-d.basket[0],next.z-d.basket[1])<1.05&&next.y<2.25&&next.y>.4
    if(hit){d.done=true;d.flight=null;d.lie=[...d.basket];notify()}
    else if(next.y<=.15||collider.blocked(next.x,next.z,.8)||!pointInPoly(next.x,next.z,campus.boundary)){d.lie=[d.flight.x,d.flight.z];player.x=d.lie[0];player.z=d.lie[1];d.flight=null;notify()}
    else d.flight=next
   }
   if(discRef.current){const p=d.flight;discRef.current.position.set(p?.x??d.lie[0],p?.y??.16,p?.z??d.lie[1]);discRef.current.rotation.y+=dt*8}
  }
 })
 const d=state.disc
 return <>{sign&&<group position={[sign[0],0,sign[1]]}><mesh position={[0,1,0]}><boxGeometry args={[.12,2,.12]}/><meshStandardMaterial color="#6d5540"/></mesh><mesh position={[0,2.05,0]}><boxGeometry args={[2.4,.8,.12]}/><meshStandardMaterial color="#234b40"/></mesh><Text position={[0,2.05,.07]} fontSize={.18} color="#ffe284" anchorX="center" anchorY="middle">HOOTY HOO HUNT</Text></group>}{state.mode==='hunt'&&state.places.map(([x,z],i)=>!state.found.includes(i)&&<group key={i} position={[x,1.5,z]}><Text fontSize={1.4} color="#ffc629" outlineWidth={.05} outlineColor="#332a11" anchorX="center" anchorY="middle">{letters[i]}</Text><mesh position={[0,-.8,0]}><cylinderGeometry args={[.55,.55,.08,12]}/><meshStandardMaterial color="#ffc629"/></mesh></group>)}{state.mode==='disc'&&d&&<><mesh ref={discRef} position={[d.lie[0],.16,d.lie[1]]}><cylinderGeometry args={[.3,.3,.06,20]}/><meshStandardMaterial color="#f6bf29"/></mesh>{!d.done&&!d.flight&&<group position={[d.lie[0],.1,d.lie[1]]} rotation={[0,state.angle,0]}><mesh position={[0,.02,2]}><boxGeometry args={[.08,.03,4]}/><meshBasicMaterial color="#ffd13d"/></mesh><mesh position={[0,.04,4]} rotation={[-Math.PI/2,0,0]}><coneGeometry args={[.35,.7,3]}/><meshBasicMaterial color="#ffd13d"/></mesh></group>}</>}</>
}
export function CampusActivities({campus,identity}:{campus:Campus;identity:string}){
 const [,update]=useState(0),[near,setNear]=useState<'disc'|'hunt'|null>(null),[nearest,setNearest]=useState<number|null>(null),[message,setMessage]=useState('')
 const sign=useMemo(()=>huntPositions(campus)[0],[campus]),baskets=useMemo(()=>discGolfSpots(campus),[campus])
 useEffect(()=>{const f=()=>update(n=>n+1);listeners.add(f);return()=>{listeners.delete(f);exit()}},[])
 useEffect(()=>{const id=setInterval(()=>{if(indoorState.active||player.view||player.busRide){activityState.near=null;setNear(null);return}const b=baskets.reduce<Pt|null>((best,p)=>!best||Math.hypot(p[0]-player.x,p[1]-player.z)<Math.hypot(best[0]-player.x,best[1]-player.z)?p:best,null);const next=b&&Math.hypot(player.x-b[0],player.z-b[1])<8?'disc':sign&&Math.hypot(player.x-sign[0],player.z-sign[1])<12?'hunt':null;activityState.near=next;setNear(next);if(state.mode==='hunt'){let best=-1,d=4;state.places.forEach((p,i)=>{const dist=Math.hypot(player.x-p[0],player.z-p[1]);if(!state.found.includes(i)&&dist<d){best=i;d=dist}});setNearest(best<0?null:best)}},250);return()=>clearInterval(id)},[campus,sign,baskets])
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;if(e.key==='Escape'&&state.mode){exit();return}if(e.key.toLowerCase()!=='e'||indoorState.active||player.view||player.busRide)return
   if(state.mode==='hunt'&&nearest!==null){state.found=[...state.found,nearest];try{localStorage.setItem('nest-hunt:'+identity,JSON.stringify(state.found))}catch{/* storage unavailable */}if(state.found.length===letters.length)setMessage('You found every letter! Hooty Hoo!');notify()}
   else if(!state.mode&&near==='hunt'){setMessage('');startHunt(campus);try{const stored=JSON.parse(localStorage.getItem('nest-hunt:'+identity)||'[]');if(Array.isArray(stored))state.found=stored.filter(i=>Number.isInteger(i)&&i>=0&&i<letters.length)}catch{/* start fresh */}notify()}
   else if(!state.mode&&near==='disc'){const b=nearestBasket(campus,player.x,player.z);if(b)startDisc(b)}
  };addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey)},[near,nearest,campus,identity])
 const d=state.disc
 return <>{!state.mode&&near&&<div className="activity-prompt">Press <b>E</b> to {near==='disc'?'Play Disc Golf':'Start Hooty Hoo Hunt'}</div>}{state.mode==='hunt'&&<section className="activity-panel"><header><strong>Hooty Hoo Hunt</strong><button onClick={()=>{exit();setMessage('')}}>Exit</button></header><p>{letters.map((l,i)=>state.found.includes(i)?l:'_').join(' ')}</p><small>{nearest!==null?'Press E to collect this letter':'Explore campus to find the letters.'}</small>{(message||state.found.length===letters.length)&&<p role="status">{message||'You found every letter! Hooty Hoo!'}</p>}</section>}{state.mode==='disc'&&d&&<section className="activity-panel disc-panel"><header><strong>Disc Golf</strong><button onClick={exit}>Exit</button></header><p>{d.done?`Finished in ${d.throws} ${d.throws===1?'throw':'throws'}!`:`Throws: ${d.throws}`}</p>{!d.done&&<><small>Move your mouse over the aim area, then hold and release to throw.</small><div className="disc-aim" onPointerMove={e=>{if(d.flight)return;const rect=e.currentTarget.getBoundingClientRect();const offset=(e.clientX-rect.left)/rect.width-.5;state.angle=Math.atan2(d.basket[0]-d.lie[0],d.basket[1]-d.lie[1])+offset*Math.PI;notify()}} onPointerDown={e=>{if(d.flight)return;e.currentTarget.setPointerCapture(e.pointerId);state.power=0;state.charging=true}} onPointerUp={()=>{if(state.charging)throwDisc()}} onPointerCancel={()=>{state.charging=false}}><span>◀ AIM ▶</span><div className="power"><i style={{width:`${state.power*100}%`}}/></div></div><small>{d.flight?'Disc in flight…':'Hold for power and release'}</small></>}{d.done&&<button onClick={exit}>Finish</button>}</section>}</>
}
