import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { distToSeg, type Building, type Campus } from '../campus'
import { Character } from '../characters/Character'
import { player, type AvatarLook } from './Player'
import './interiors.css'
import { indoorState } from './indoorState'

type Kind = 'library'|'dorm'|'student'|'garage'|'greenhouse'|'recreation'|'lab'|'office'|'classroom'|'dining'
function interiorKind(b: Building): Kind {
  const n=(b.name+' '+b.short+' '+b.kind).toLowerCase()
  if (b.code==='A') return 'student'
  if (n.includes('greenhouse')) return 'greenhouse'
  if (n.includes('hornet hub') || b.id==='1504299650' || b.code==='O' || n.includes('competition')) return 'garage'
  if (b.code==='S1'||b.code==='S2'||n.includes('recreation')||n.includes('gymnasium')) return 'recreation'
  if (b.code==='C'||n.includes('library')) return 'library'
  if (/dormitory|apartments|residence|hornet village|courtyard|commons|columns/.test(n)) return 'dorm'
  if (b.code==='X'||/dining|stingers/.test(n)) return 'dining'
  if (/lab|engineering|innovation|textile|architecture|design|science|soils/.test(n)||['Q','G','E','L','L1','I1','I2','M','N'].includes(b.code)) return 'lab'
  if (/admin|office|housing|uits/.test(n)||b.code==='B') return 'office'
  return 'classroom'
}
function Box({p,s,c}: {p:[number,number,number];s:[number,number,number];c:string}) {return <mesh position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={c}/></mesh>}
function Sign({text,p,size=.55}: {text:string;p:[number,number,number];size?:number}) {return <Text position={p} fontSize={size} color="#293a34" anchorX="center" anchorY="middle" rotation={[-Math.PI/2,0,0]}>{text}</Text>}
function Table({x,z,color='#ab835a'}:{x:number;z:number;color?:string}) {return <group><Box p={[x,.8,z]} s={[2.4,.16,1.3]} c={color}/>{[-.9,.9].map(dx=>[-.4,.4].map(dz=><Box key={`${dx}:${dz}`} p={[x+dx,.4,z+dz]} s={[.12,.8,.12]} c="#565a50"/>))}</group>}
function Chair({x,z}:{x:number;z:number}) {return <group><Box p={[x,.52,z]} s={[.65,.12,.65]} c="#536b5c"/><Box p={[x,.85,z+.27]} s={[.65,.7,.12]} c="#536b5c"/><Box p={[x,.25,z]} s={[.48,.5,.48]} c="#77766b"/></group>}
function Plant({x,z}:{x:number;z:number}) {return <group><Box p={[x,.35,z]} s={[.6,.7,.6]} c="#af7051"/><mesh position={[x,1.2,z]}><sphereGeometry args={[.65,7,5]}/><meshStandardMaterial color="#4f8443"/></mesh></group>}
function Furnish({kind}: {kind:Kind}) {
 const tables=[[-6,-3],[-2,-3],[2,-3],[6,-3],[-6,1],[-2,1],[2,1],[6,1]]
 if(kind==='library')return <>{[-7,-3,1,5].map(x=><group key={x}><Box p={[x,1.4,-5]} s={[2.5,2.8,.65]} c="#886c4d"/>{[.6,1.2,1.8,2.4].map(y=><Box key={y} p={[x,y,-4.63]} s={[2.2,.4,.16]} c={y%1?'#5b7564':'#c18b5f'}/>)}</group>)}{tables.slice(4).map(([x,z])=><group key={x}><Table x={x} z={z}/><Chair x={x} z={z+1.2}/></group>) }<Sign text="LIBRARY · STUDY & READ" p={[0,.03,-8]}/></>
 if(kind==='dorm')return <>{[-6,2].map(x=><group key={x}><Box p={[x,.5,-4]} s={[2.4,1,4]} c="#c2a47d"/><Box p={[x,1.05,-4]} s={[2.2,.2,3.8]} c="#ece8d9"/><Box p={[x,1.2,-5.2]} s={[1.8,.22,.7]} c="#e8c966"/><Table x={x+2.4} z={0}/><Chair x={x+2.4} z={1.2}/></group>)}<Sign text="RESIDENCE LOUNGE" p={[0,.03,-8]}/></>
 if(kind==='student'||kind==='dining')return <>{['CHICK-FIL-A','DUNKIN’','SUSHI'].map((n,i)=><group key={n}><Box p={[-6+i*6,1,-6]} s={[4.6,2,1.4]} c={['#b84e45','#dc8b55','#638779'][i]}/><Sign text={n} p={[-6+i*6,2.02,-6]} size={.42}/></group>)}{tables.slice(4).map(([x,z])=><group key={x}><Table x={x} z={z}/><Chair x={x} z={z+1.1}/></group>)}{kind==='student'&&<><Table x={-4} z={5} color="#356b50"/><Table x={4} z={5} color="#426f95"/><Sign text="POOL" p={[-4,.91,5]}/><Sign text="PING PONG" p={[4,.91,5]} size={.35}/></>}</>
 if(kind==='greenhouse')return <>{[-6,-2,2,6].map(x=>[-4,0,4].map(z=><Plant key={`${x}:${z}`} x={x} z={z}/>))}<Sign text="GREENHOUSE" p={[0,.03,-8]}/></>
 if(kind==='garage')return <><Box p={[-5,.65,-3]} s={[4,1.3,2]} c="#e1b644"/>{[-6,-4].map(x=>[-4,-2].map(z=><mesh key={`${x}:${z}`} position={[x,.35,z]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.45,.45,.3,12]}/><meshStandardMaterial color="#2e3432"/></mesh>))}<Table x={3} z={-5}/><Table x={6} z={0}/><Box p={[3,1.5,-5]} s={[1.5,1,.4]} c="#c15c42"/><Sign text="COMPETITION WORKSHOP · CARS & DRONES" p={[0,.03,-8]} size={.42}/><mesh position={[3,1.7,0]}><sphereGeometry args={[.5,8,6]}/><meshStandardMaterial color="#4b6770"/></mesh>{[-1,1].map(x=>[-1,1].map(z=><Box key={`${x}:${z}`} p={[3+x*.7,1.7,z*.7]} s={[.65,.1,.65]} c="#293d3e"/>))}</>
 if(kind==='recreation')return <><Box p={[-3,.03,-1]} s={[11,.06,12]} c="#c99561"/><Sign text="BASKETBALL" p={[-3,.08,-1]}/><Box p={[-3,2.8,-6.5]} s={[2,.2,.15]} c="#eee9d9"/><Box p={[6,1,-4]} s={[1.4,2,2]} c="#5a6265"/><Box p={[6,1,0]} s={[1.4,2,2]} c="#5a6265"/><Box p={[7,2.3,5]} s={[.3,4.6,5]} c="#bd9b76"/>{[0,1,2,3,4].map(i=><mesh key={i} position={[6.8,.7+i*.7,3.5+(i%2)*2]}><sphereGeometry args={[.2,6,4]}/><meshStandardMaterial color={['#bf5550','#edc347','#679b84'][i%3]}/></mesh>)}<Sign text="GYM · CLIMBING" p={[5,.04,5]} size={.4}/></>
 return <>{tables.map(([x,z],i)=><group key={i}><Table x={x} z={z} color={kind==='lab'?'#c6c7bc':'#b5966f'}/><Chair x={x} z={z+1.1}/>{kind==='lab'&&<Box p={[x,1.15,z]} s={[.65,.55,.12]} c="#405d64"/>}</group>)}<Box p={[0,1.7,-7]} s={[8,2,.15]} c={kind==='office'?'#e6e4d9':'#476257'}/><Sign text={kind==='lab'?'LAB & MAKER SPACE':kind==='office'?'OFFICES':'CLASSROOM'} p={[0,.03,-8]}/></>
}
function Walker({look}: {look:AvatarLook}) {
 const body=useRef<THREE.Group>(null), keys=useRef(new Set<string>()),walk=useRef(0),pos=useRef(new THREE.Vector3(0,0,7));const {camera}=useThree()
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(!(e.target instanceof HTMLInputElement))keys.current.add(e.key.toLowerCase())};const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}},[])
 useFrame((_,raw)=>{const dt=Math.min(raw,.05),k=keys.current;let x=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),z=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'));const len=Math.hypot(x,z);if(len){x/=len;z/=len;pos.current.x=THREE.MathUtils.clamp(pos.current.x+x*dt*(k.has('shift')?8:4.5),-9,9);pos.current.z=THREE.MathUtils.clamp(pos.current.z+z*dt*(k.has('shift')?8:4.5),-8.5,8.5);if(body.current)body.current.rotation.y=Math.atan2(x,z)}walk.current=THREE.MathUtils.lerp(walk.current,len?.8:0,dt*10);if(body.current)body.current.position.copy(pos.current);camera.position.lerp(new THREE.Vector3(pos.current.x+12,19,pos.current.z+17),Math.min(1,dt*5));camera.lookAt(pos.current.x,0,pos.current.z)})
 return <group ref={body}><Character {...look} walk={walk} scale={1.15}/></group>
}
function Room({building,look}:{building:Building;look:AvatarLook}) {const kind=interiorKind(building);return <><color attach="background" args={['#e8ece2']}/><ambientLight intensity={1.3}/><directionalLight position={[5,15,8]} intensity={2}/><Box p={[0,-.15,0]} s={[20,.3,20]} c={kind==='recreation'?'#d6bf9d':'#e3dfd1'}/><Box p={[0,2,-9.8]} s={[20,4,.4]} c="#eceadf"/><Box p={[-9.8,2,0]} s={[.4,4,20]} c="#e2e1d6"/><Box p={[9.8,2,0]} s={[.4,4,20]} c="#e2e1d6"/><Furnish kind={kind}/><Walker look={look}/></>}
export function BuildingInteriors({campus,look}:{campus:Campus;look:AvatarLook}) {
 const [near,setNear]=useState<Building|null>(null),[inside,setInside]=useState<Building|null>(null)
 useEffect(()=>{const id=setInterval(()=>{if(indoorState.active||player.view||player.busRide){setNear(null);return}let best:Building|null=null,dist=10;for(const b of campus.buildings)for(let i=0,j=b.poly.length-1;i<b.poly.length;j=i++){const d=distToSeg(player.x,player.z,b.poly[j],b.poly[i]);if(d<dist){dist=d;best=b}}setNear(old=>old?.id===best?.id?old:best)},200);return()=>clearInterval(id)},[campus])
 useEffect(()=>()=>{indoorState.active=false},[])
 const enter=()=>{if(!near)return;indoorState.active=true;setInside(near)}
 const exit=()=>{indoorState.active=false;setInside(null)}
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.key==='Escape'&&inside)exit();else if(e.key.toLowerCase()==='g'&&!inside&&near)enter()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[inside,near])
 return <>{!inside&&near&&<div className="enter-building"><span>{near.short||near.name||'Building'}</span><button onClick={enter}>Go inside <kbd>G</kbd></button></div>}{inside&&<div className="interior-screen"><Canvas camera={{position:[12,19,24],fov:45,near:.1,far:150}}><Room building={inside} look={look}/></Canvas><div className="interior-header"><div><small>INSIDE</small><strong>{inside.short||inside.name||'Building'}</strong></div><button onClick={exit}>← Exit building</button></div><div className="interior-controls"><b>WASD</b> move · <b>Shift</b> run · <b>Esc</b> exit</div></div>}</>
}
