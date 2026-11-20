import { Clone, Text, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { createContext, Suspense, useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import type { AvatarLook } from './Player'
import { indoorState } from './indoorState'
import { turnInteriorCamera, zoomInteriorCamera, panInteriorCamera } from './interiorCamera'
import { SpecialInterior } from './SpecialInteriors'
import { specialObstacles, type SpecialKind } from './specialLayouts'
import { academicDivider, adminObstacles, mathObstacles, libraryObstacles } from './academicLayouts'
import { InteriorCrowd, type IndoorAgent, type CrowdKind } from './interiorCrowd'
import { DiningSimulation, diningObstacles, diningTables, diningCounters, diningWalls, type Diner } from './diningSimulation'

type V = [number,number,number]
type Rect = [number,number,number,number]
export type InteriorKind = 'library'|'dorm'|'student'|'garage'|'greenhouse'|'recreation'|'lab'|'office'|'classroom'|'dining'|'parking'|'bus'|'uits'|'admin'|'math'|'crawford'|'engineering'|'academic'|'design1'|'design2'|'atrium'|'civil'|'soils'|'textile'|'architecture'|'competition'|'technology'|'housing'|'community'|'innovation'|'eventhall'|'activitycenter'
const asset='/models/kenney-furniture/'
const modelScale = createContext(1)
function Model({name,p,r=0,scale=1,pack='furniture'}:{name:string;p:V;r?:number;scale?:number;pack?:'furniture'|'car'|'food'|'nature'}) {const {scene}=useGLTF(`${pack==='furniture'?asset:`/models/kenney-${pack}/`}${name}.glb`);const factor=useContext(modelScale);return <Clone object={scene} position={p} rotation={[0,r,0]} scale={scale*(pack==='furniture'?factor:1)} castShadow receiveShadow/>}
function Block({p,s,c}:{p:V;s:V;c:string}) {return <mesh position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={c}/></mesh>}
function Label({text,p,size=.45,color='#273b37',rotY=0}:{text:string;p:V;size?:number;color?:string;rotY?:number}) {return <Text position={p} rotation={[0,rotY,0]} fontSize={size} color={color} anchorX="center" anchorY="middle" maxWidth={8}>{text}</Text>}
function Ball({p,color,r=.1}:{p:V;color:string;r?:number}) {return <mesh position={p}><sphereGeometry args={[r,10,8]}/><meshStandardMaterial color={color}/></mesh>}
function WallWindow({x,z=-11.8}:{x:number;z?:number}) {return <group><Block p={[x,2.4,z]} s={[3,2.5,.12]} c="#82aeb6"/>{[-1.5,0,1.5].map(a=><Block key={a} p={[x+a,2.4,z+.1]} s={[.12,2.6,.16]} c="#e9eee6"/>)}<Block p={[x,2.4,z+.1]} s={[3,.12,.16]} c="#e9eee6"/></group>}
// Area titles are mounted boards above the window line so the frames never cut through the lettering.
function AreaSign({x,text,color,w=3.4}:{x:number;text:string;color:string;w?:number}) {return <group position={[x,3.93,-11.8]}><Block p={[0,0,0]} s={[w,.46,.08]} c={color}/><Block p={[0,-.19,.045]} s={[w-.2,.03,.01]} c="#e7c35a"/><Label text={text} p={[0,.02,.05]} size={.27} color="#fbf6e8"/></group>}
function Architecture({student,windows=[-10,-5,0,5,10]}:{student:boolean;windows?:number[]}) {return <><Block p={[0,-.12,0]} s={[28,.24,24]} c="#d8d0bb"/><DiningWall p={[0,2.1,-11.95]} s={[28,4.2,.2]} color="#e9e7db">{windows.map(x=><WallWindow key={x} x={x}/>)}</DiningWall><DiningWall p={[-13.95,2.1,0]} s={[.2,4.2,24]} color="#e2e0d3"/><DiningWall p={[13.95,2.1,0]} s={[.2,4.2,24]} color="#e2e0d3"/><Block p={[-11,1.6,11.8]} s={[3.4,3.2,.15]} c="#83aeb1"/><Block p={[-11,1.6,11.69]} s={[.1,3.2,.2]} c="#ebece0"/><Block p={[-11,3.5,11.66]} s={[1.1,.4,.06]} c="#2f6b4b"/><Label text="EXIT" p={[-11,3.5,11.62]} size={.26} color="#f4f8f0" rotY={Math.PI}/>{student&&<><DiningWall p={[-5,1.7,-1]} s={[.25,3.4,8]} color="#c8bda7"/><DiningWall p={[-5,1.7,8.1]} s={[.25,3.4,3.8]} color="#c8bda7"/><DiningWall p={[5,1.7,-5]} s={[.25,3.4,7]} color="#c8bda7"/><DiningWall p={[5,1.7,5.6]} s={[.25,3.4,8.8]} color="#c8bda7"/><AreaSign x={-8.5} text="FOOD COURT" color="#9b3f35"/><AreaSign x={8.5} text="GAME ROOM" color="#2f5d73"/></>}</>}
const studentWalls:Rect[]=[[-5,-1,.3,8],[-5,8.1,.3,3.8],[5,-5,.3,7],[5,5.6,.3,8.8]]
const studentFurniture:Rect[]=[[-11,-8,4,1.5],[-11,-3.8,4,1.5],[-11,.5,4,1.5],[-10,5,2,2],[-10,9,2,2],[0,-6,3,2],[0,-1,3,2],[0,4,3,2],[9,-6,3,2],[9,-1,3,2],[10,5,2,1.5],[-2,9,2.5,1],[-8.7,7,1.3,1.3],[12,8,1,1]]
const desks:Rect[]=[];for(const z of [-4,-1,2,5])for(const x of [-8,-4,0,4,8])desks.push([x,z,1.4,1.1])
function collision(x:number,z:number,rects:Rect[]){return Math.abs(x)>13.4||Math.abs(z)>11.3||rects.some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.38&&Math.abs(z-cz)<d/2+.38)}
function Move({look,rects,startZ=9}:{look:AvatarLook;rects:Rect[];startZ?:number}) {
 const body=useRef<THREE.Group>(null),walk=useRef(0),keys=useRef(new Set<string>()),pos=useRef(new THREE.Vector3(0,0,startZ))
 const orbit=useRef({yaw:Math.atan2(4,10),pitch:.62,distance:13}),drag=useRef<{x:number;y:number;pan:boolean}|null>(null),pan=useRef({x:0,y:0})
 const focus=useRef(new THREE.Vector3(0,1,startZ)),{camera,gl}=useThree()
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{if(!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement))keys.current.add(e.key.toLowerCase())}
  const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase())
  const pointerDown=(e:PointerEvent)=>{if(e.button>2)return;e.preventDefault();drag.current={x:e.clientX,y:e.clientY,pan:e.button===1}}
  const pointerMove=(e:PointerEvent)=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(drag.current.pan)panInteriorCamera(pan.current,orbit.current,dx,dy);else turnInteriorCamera(orbit.current,dx,dy);drag.current.x=e.clientX;drag.current.y=e.clientY}
  const pointerUp=()=>{drag.current=null}
  const wheel=(e:WheelEvent)=>{e.preventDefault();zoomInteriorCamera(orbit.current,e.deltaY)}
  const menu=(e:Event)=>e.preventDefault()
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp)
  gl.domElement.addEventListener('pointerdown',pointerDown);gl.domElement.addEventListener('wheel',wheel,{passive:false});gl.domElement.addEventListener('contextmenu',menu)
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);gl.domElement.removeEventListener('pointerdown',pointerDown);gl.domElement.removeEventListener('wheel',wheel);gl.domElement.removeEventListener('contextmenu',menu)}
 },[gl])
 useFrame((_,raw)=>{
  const dt=Math.min(raw,.05),k=keys.current
  if(k.has('q'))orbit.current.yaw+=dt*1.6;if(k.has('e'))orbit.current.yaw-=dt*1.6
  let x=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),z=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'))
  const n=Math.hypot(x,z)
  if(n){pan.current={x:0,y:0};x/=n;z/=n;const speed=(k.has('shift')?6:3.5)*dt;const blocked=(px:number,pz:number)=>collision(px,pz,rects)||indoorState.npcPositions.some(([ax,az])=>Math.hypot(px-ax,pz-az)<.75);if(!blocked(pos.current.x+x*speed,pos.current.z))pos.current.x+=x*speed;if(!blocked(pos.current.x,pos.current.z+z*speed))pos.current.z+=z*speed;if(body.current)body.current.rotation.y=Math.atan2(x,z)}
  walk.current=THREE.MathUtils.lerp(walk.current,n?.8:0,dt*10);if(body.current)body.current.position.copy(pos.current)
  indoorState.x=pos.current.x;indoorState.z=pos.current.z;indoorState.heading=body.current?.rotation.y??0;indoorState.moving=!!n
  const {yaw,pitch,distance}=orbit.current,horizontal=Math.cos(pitch)*distance
  const viewX=pos.current.x+pan.current.x,viewZ=pos.current.z+pan.current.y
  const want=new THREE.Vector3(viewX+Math.sin(yaw)*horizontal,1+Math.sin(pitch)*distance,viewZ+Math.cos(yaw)*horizontal)
  camera.position.lerp(want,1-Math.exp(-dt*9));focus.current.lerp(new THREE.Vector3(viewX,1,viewZ),1-Math.exp(-dt*12));camera.lookAt(focus.current)
 })
 return <group ref={body}><Character {...look} walk={walk} scale={1.15}/></group>
}
// Game tables are sized to the characters: the playing surface sits at hand height (~0.78).
function Pool(){const wood='#5b3a28',rail='#2f6b4b';return <group position={[9,0,-6]}>
 {[-1.3,1.3].flatMap(x=>[-.62,.62].map(z=><Block key={`${x}:${z}`} p={[x,.28,z]} s={[.2,.56,.2]} c={wood}/>))}
 <Block p={[0,.62,0]} s={[3.2,.22,1.9]} c={wood}/><Block p={[0,.735,0]} s={[2.9,.02,1.6]} c="#2f7d55"/>
 {[-1,1].map(d=><group key={d}><Block p={[0,.79,d*.86]} s={[3.2,.1,.18]} c={wood}/><Block p={[0,.78,d*.76]} s={[2.8,.07,.06]} c={rail}/><Block p={[d*1.51,.79,0]} s={[.18,.1,1.9]} c={wood}/><Block p={[d*1.41,.78,0]} s={[.06,.07,1.5]} c={rail}/></group>)}
 {[-1.4,0,1.4].flatMap(x=>[-.74,.74].map(z=><mesh key={`${x}:${z}`} position={[x,.748,z]}><cylinderGeometry args={[.1,.1,.02,14]}/><meshStandardMaterial color="#141716"/></mesh>))}
 {[-.7,.7].flatMap(x=>[-1,1].map(d=><Ball key={`${x}:${d}`} p={[x,.845,d*.86]} color="#e9dcb8" r={.025}/>))}
 <Block p={[0,.746,.0]} s={[.02,.002,1.5]} c="#3d8d63"/>
 </group>}
function PingPong(){return <group position={[9,0,-1]}>
 {[-1.15,1.15].flatMap(x=>[-.6,.6].map(z=><Block key={`${x}:${z}`} p={[x,.36,z]} s={[.1,.72,.1]} c="#3b4644"/>))}<Block p={[0,.4,0]} s={[2.2,.06,.06]} c="#3b4644"/>
 <Block p={[0,.74,0]} s={[2.8,.06,1.5]} c="#2f6290"/>
 {[-1,1].map(d=><group key={d}><Block p={[0,.772,d*.73]} s={[2.8,.004,.04]} c="#f2f1ea"/><Block p={[d*1.38,.772,0]} s={[.04,.004,1.5]} c="#f2f1ea"/></group>)}<Block p={[0,.772,0]} s={[2.8,.004,.02]} c="#f2f1ea"/>
 <mesh position={[0,.83,0]}><boxGeometry args={[.015,.11,1.6]}/><meshStandardMaterial color="#f4f3ea" transparent opacity={.75}/></mesh><Block p={[0,.89,0]} s={[.03,.02,1.62]} c="#f7f6ef"/>{[-.81,.81].map(z=><Block key={z} p={[0,.83,z]} s={[.05,.15,.05]} c="#2c3332"/>)}
 </group>}
function StudentTable({z,index}:{z:number;index:number}) {return <group>
 <DiningModel name="tablecross" p={[0,0,z]} scale={2.75}/>
 {[-1,1].map(side=><DiningModel key={side} name="chaircushion" p={[side*1.85,0,z]} r={side<0?Math.PI/2:-Math.PI/2} scale={2.05}/>)}
 <DiningModel name="plate-dinner" pack="food" p={[-.35,.98,z]} scale={.58}/><DiningModel name={index===1?'donut-sprinkles':'sandwich'} pack="food" p={[-.35,1.02,z]} scale={.65}/><DiningModel name="cup" pack="food" p={[.45,1,z+.2]} scale={.7}/>
 </group>}
function Student({look:_look}:{look:AvatarLook}) {return <>
 <Architecture student/>
 {[{z:-8,name:'CHICK-FIL-A',color:'#b83f3d',foods:['burger','fries','sandwich'],menu:'CHICKEN  •  FRIES'},{z:-3.8,name:'DUNKIN’',color:'#e5843d',foods:['donut-sprinkles','cup-coffee','donut-sprinkles'],menu:'COFFEE  •  DONUTS'},{z:.5,name:'SUSHI',color:'#608978',foods:['maki-salmon','salad','maki-salmon'],menu:'ROLLS  •  BOWLS'}].map(({z,name,color,foods,menu},index)=><group key={name}>
  <Block p={[-11,.55,z]} s={[3.9,1.1,1.45]} c={color}/><Block p={[-11,1.15,z]} s={[4,.12,1.5]} c="#efe9da"/>
  <Block p={[-11,2.6,z-.6]} s={[4,.68,.16]} c={index===1?'#f6dfd9':'#f8f2e7'}/><Label text={name} p={[-11,2.61,z-.48]} size={.39} color={index===1?'#cc5d78':color}/>
  <Block p={[-11,2.05,z-.55]} s={[3.9,.42,.12]} c="#2d413b"/><Label text={menu} p={[-11,2.06,z-.46]} size={.21} color="#f9efd6"/>
  {foods.map((food,i)=><DiningModel key={i} name={food} pack="food" p={[-12.1+i*.72,1.25,z+.15]} scale={.72}/>)}
  <Block p={[-9.62,1.28,z+.08]} s={[.42,.2,.38]} c="#344440"/><Block p={[-9.62,1.48,z-.01]} s={[.33,.26,.08]} c="#7fa59c"/>
  {index===2&&<><Block p={[-11.35,1.58,z+.48]} s={[2.2,.7,.06]} c="#a9ced0"/>{[-12.42,-10.28].map(x=><Block key={x} p={[x,1.58,z+.48]} s={[.07,.75,.1]} c="#e6e9dc"/>)}</>}
 </group>)}
 {[-6,-1,4].map((z,i)=><StudentTable key={z} z={z} index={i}/>)}
 <DiningModel name="loungesofa" p={[-10,0,5]} scale={2.1}/><DiningModel name="loungechair" p={[-10,0,9]} scale={1.9}/><DiningModel name="tablecoffee" p={[-8.7,0,7]} scale={1.65}/>
 <DiningModel name="pottedplant" p={[-13,0,10]} scale={2}/><DiningModel name="trashcan" p={[-6.5,0,3]} scale={1.65}/>
 <Pool/><PingPong/><DiningModel name="loungechair" p={[10,0,5]} scale={1.9}/>
 {/* Arcade cabinet angled toward the room; its front (local -z) faces the play area and camera. */}<group position={[12.2,0,8.2]} rotation={[0,3*Math.PI/4,0]}><Block p={[0,0.8,0]} s={[1.05,1.6,.85]} c="#283b44"/><Block p={[0,1.75,0]} s={[1.1,.32,.9]} c="#d8a82f"/><Label rotY={Math.PI} text="ARCADE" p={[0,1.76,-0.48]} size={.19} color="#25362f"/><Block p={[0,1.25,-0.45]} s={[.86,.72,.09]} c="#121f2a"/><Block p={[0,1.25,-0.51]} s={[.72,.56,.04]} c="#508f9a"/><Label rotY={Math.PI} text="SPACE OWLS" p={[0,1.26,-0.55]} size={.12} color="#ffe091"/><Block p={[0,0.78,-0.57]} s={[1,.14,.48]} c="#3c5a63"/><Ball p={[-0.25,0.9,-0.65]} color="#e5684e" r={.08}/>{[0,.2,.4].map(dx=><Ball key={dx} p={[12+dx,.89,7.35]} color="#efc44b" r={.06}/>)}<Block p={[0,0.35,-0.46]} s={[.3,.22,.04]} c="#141e21"/></group>
 <Block p={[-2,.55,9]} s={[2.5,1.1,1]} c="#987a5c"/><Block p={[-2,1.13,9]} s={[2.65,.12,1.1]} c="#ded2b9"/><Block p={[-2.75,1.32,9.3]} s={[.06,.3,.06]} c="#5d544a"/><Block p={[-2.75,1.62,9.3]} s={[1.7,.36,.06]} c="#2f4d47"/><Label text="INFORMATION" p={[-2.75,1.62,9.265]} size={.2} color="#f6efdc" rotY={Math.PI}/><Label text="INFORMATION" p={[-2.75,1.62,9.335]} size={.2} color="#f6efdc"/><DiningModel name="laptop" p={[-2,1.2,9]} scale={1.1}/>
 </>}

function Classroom({look:_look}:{look:AvatarLook}) {return <><Architecture student={false}/><Block p={[0,2.3,-11.7]} s={[10,2.4,.18]} c="#fcfcf3"/><Label text={'∫ x² dx = x³ / 3 + C\nf(x) = ax² + bx + c\nsin² θ + cos² θ = 1'} p={[0,2.4,-11.55]} size={.37}/><Block p={[9,2.4,-11.7]} s={[4,2.4,.16]} c="#f7f7ed"/><Label text="PROJECTOR" p={[9,2.4,-11.55]} size={.25}/><Block p={[0,3.8,-3]} s={[.8,.25,.5]} c="#f6f4ea"/><Model name="desk" p={[-10,0,-9]} scale={1.4}/><Model name="computerscreen" p={[-10,1.05,-9]} scale={.8}/>{desks.map(([x,z],i)=><group key={`${x}:${z}`}><Model name="desk" p={[x,0,z]} scale={1.05}/><Model name="chairdesk" p={[x,0,z+1]} scale={1}/>{i%3===0?<Model name="laptop" p={[x,1,z]} scale={.7}/>:<Model name="books" p={[x,1,z]} scale={.65}/ >}</group>)}<mesh position={[-12,3.25,-11.7]}><circleGeometry args={[.48,20]}/><meshStandardMaterial color="#fdfbf0"/></mesh><Label text="◷" p={[-12,3.25,-11.55]} size={.7}/></>}

// Each furniture placement carries its collision footprint, keeping visual and movement layouts together.
interface Placed { name: string; x:number; z:number; w:number; d:number; scale?:number; r?:number; pack?:'furniture'|'car'|'food'|'nature' }
const piece=(name:string,x:number,z:number,w=1.5,d=1.5,scale=1,r=0,pack:Placed['pack']='furniture'):Placed=>({name,x,z,w,d,scale,r,pack})
const partition:Rect[]=[[-8,-2,12,.25],[8,-2,12,.25]]
function Dividers(){return <>{partition.map(([x,z,w,d],i)=><DiningWall key={i} p={[x,1.45,z]} s={[w,2.9,d]} color="#c8c6ba"><Block p={[x,2.6,z+.16]} s={[w-.6,.12,.08]} c="#e9e6d8"/></DiningWall>)}</>}
function Poster({x,z=-11.78,title,color='#d7ac4a'}:{x:number;z?:number;title:string;color?:string}) {return <group><Block p={[x,2.1,z]} s={[1.6,2.1,.07]} c={color}/><Label text={title} p={[x,2.2,z+.06]} size={.23} color="#f8f7ee"/></group>}
function MakeTables({xs,z,look:_look,items=true}:{xs:number[];z:number;look:AvatarLook;items?:boolean}) {return <>{xs.map((x,i)=><group key={x}><DiningModel name="tablecross" p={[x,0,z]} scale={1.8}/><DiningModel name="chaircushion" p={[x,0,z+1.5]} scale={1.35}/>{items&&<><DiningModel name={z===3?'computerscreen':i%2?'books':'laptop'} p={[x,1.02,z]} scale={.7}/><DiningModel name="cup" pack="food" p={[x+.6,1.03,z]} scale={.5}/></>}</group>)}</>}

function LibraryShelf({x,z}:{x:number;z:number}) {
 const books=['#b85748','#d0a957','#628b83','#66809d','#d7c6a3','#8e6b80']
 return <group>
  <Block p={[x,1.48,z]} s={[1.8,2.96,.16]} c="#8b654b"/>
  {[-.86,.86].map(dx=><Block key={dx} p={[x+dx,1.48,z+.33]} s={[.12,2.96,.7]} c="#a57e5f"/>)}
  {[.12,.78,1.44,2.1,2.82].map(y=><Block key={y} p={[x,y,z+.33]} s={[1.8,.12,.75]} c="#a57e5f"/>)}
  {[.2,.86,1.52,2.18].flatMap((y,row)=>Array.from({length:9},(_,i)=><Block key={`${row}:${i}`} p={[x-.73+i*.18,y+.25+(i%3)*.02,z+.58]} s={[.14,.5+(i%3)*.04,.24]} c={books[(row*3+i+(x>0?2:0))%books.length]}/>))}
 </group>
}
function Library({look}:{look:AvatarLook}) {return <><Dividers/><AreaSign x={0} w={6.2} text="LAWRENCE V. JOHNSON LIBRARY" color="#3f5f58"/>{[-10,-6,0,6,10].map(x=><LibraryShelf key={x} x={x} z={-9.45}/>)}{[-8,0,8].map(x=><LibraryShelf key={`aisle:${x}`} x={x} z={-7.9}/>)}{[-11.8,11.8].flatMap(x=>[1,5].map(z=><LibraryShelf key={`${x}:${z}`} x={x} z={z-.4}/>))}<MakeTables xs={[-9,-5,5,9]} z={-5} look={look}/><MakeTables xs={[-8,0,8]} z={3} look={look}/><Block p={[-10,.52,8]} s={[2.3,1.04,1.2]} c="#8a6d55"/><Block p={[-10,.98,7.39]} s={[2.3,.05,.02]} c="#d8b552"/><Model name="computerscreen" p={[-9.6,1.13,8]} scale={.8}/><Model name="loungesofa" p={[10,0,8]} scale={1.4}/><Model name="pottedplant" p={[12,0,9]} scale={1.2}/>{[-5,5].map(x=><group key={x}><AcademicTable x={x} z={7} w={2.8}/>{[-.7,.7].flatMap(dx=>[-1,1].map(side=><DiningModel key={`${dx}:${side}`} name="chaircushion" p={[x+dx,0,7+side*1.4]} r={side>0?Math.PI:0} scale={1.3}/>))}</group>)}<Block p={[-10,1.08,8]} s={[2.4,.1,1.3]} c="#e6ddcb"/><DiningModel name="books" p={[-10.5,1.16,8]} scale={.75}/><Block p={[-9.5,1.22,8]} s={[.25,.22,.35]} c="#3a5551"/><DeskSign x={-10} y={1.13} z={8.5} text="INFO • CHECK OUT"/></>}

// ---- Residence hall (shared by every dorm, commons, courtyard, columns and Hornet Village building) ----
// Two bedrooms behind the dividers, a common lounge / laundry / kitchen in front. Everything is block-built so
// orientation is explicit: beds head against the back wall, chairs face their desks, the sofa faces the TV.
function DormBed({x,blanket}:{x:number;blanket:string}) {return <group position={[x,0,-9.6]}><Block p={[0,.24,0]} s={[1.6,.32,2.6]} c="#9a7656"/><Block p={[0,.47,0]} s={[1.5,.16,2.5]} c="#f3efe4"/><Block p={[0,.57,.35]} s={[1.54,.06,1.75]} c={blanket}/><Block p={[0,.6,-.85]} s={[1.1,.14,.42]} c="#fbf8f0"/><Block p={[0,.62,-1.32]} s={[1.7,1,.08]} c="#86664b"/></group>}
function DormDesk({x,accent}:{x:number;accent:string}) {return <group position={[x,0,-10.9]}><Block p={[0,.74,0]} s={[1.6,.06,.8]} c="#b89a77"/>{[-.75,.75].map(dx=><Block key={dx} p={[dx,.37,0]} s={[.06,.74,.75]} c="#9c7f60"/>)}<DiningModel name="laptop" p={[-.2,.77,.05]} scale={.7}/><DiningModel name="books" p={[.5,.77,-.1]} scale={.55}/><Block p={[-.62,.95,-.22]} s={[.04,.38,.04]} c="#3a4447"/><Block p={[-.5,1.12,-.15]} s={[.26,.06,.14]} c={accent}/>
 <group position={[0,0,1]}><Block p={[0,.45,0]} s={[.55,.08,.55]} c={accent}/><Block p={[0,.82,.26]} s={[.55,.66,.07]} c={accent}/><Block p={[0,.22,0]} s={[.06,.44,.06]} c="#5a6768"/><Block p={[0,.03,0]} s={[.5,.04,.5]} c="#5a6768"/></group></group>}
function Wardrobe({side}:{side:Side}) {return <group position={[side*13.2,0,-3.3]} rotation={[0,side<0?Math.PI/2:-Math.PI/2,0]}><Block p={[0,1.1,0]} s={[1.4,2.2,.7]} c="#a98563"/><Block p={[0,1.1,.355]} s={[.02,2.05,.01]} c="#6b4a33"/>{[-.12,.12].map(d=><Block key={d} p={[d,1.15,.37]} s={[.04,.22,.03]} c="#d8b552"/>)}</group>}
function WallPoster({side,z,color,title}:{side:Side;z:number;color:string;title:string}) {return <group position={[side*13.8,2.2,z]} rotation={[0,side<0?Math.PI/2:-Math.PI/2,0]}><Block p={[0,0,0]} s={[1,1.3,.03]} c={color}/><Label text={title} p={[0,0,.02]} size={.15} color="#fbf6e8"/></group>}
function DormBedroom({side,blanket,accent,poster,posterColor}:{side:Side;blanket:string;accent:string;poster:string;posterColor:string}) {return <group>
 <DormBed x={side*10.5} blanket={blanket}/><group position={[side*12.25,0,-10.9]}><Block p={[0,.3,0]} s={[.6,.6,.55]} c="#9a7656"/><Round p={[0,.75,0]} r={.08} h={.3}/><mesh position={[0,.98,0]}><cylinderGeometry args={[.12,.17,.2,14,1,true]}/><meshStandardMaterial color="#f3e6c4" emissive="#f1d797" emissiveIntensity={.35} side={THREE.DoubleSide}/></mesh></group>
 <DormDesk x={side*5} accent={accent}/><Wardrobe side={side}/><WallPoster side={side} z={-9.6} color={posterColor} title={poster}/>
 <Rug x={side*8} z={-6.8} w={3.4} d={2.4} color={side<0?'#d9c3a6':'#c3d2cf'} border={side<0?'#b39a78':'#93aaa5'}/>
 </group>}
function Round({p,r,h,c='#3a4447'}:{p:V;r:number;h:number;c?:string}) {return <mesh position={p}><cylinderGeometry args={[r,r,h,12]}/><meshStandardMaterial color={c}/></mesh>}
function Dorm({look:_look}:{look:AvatarLook}) {return <><Dividers/><AreaSign x={0} text="RESIDENCE HALL" color="#4b6a60"/>
 <DormBedroom side={-1} blanket="#c9a24a" accent="#4f6f68" poster="GO OWLS" posterColor="#c9a24a"/><DormBedroom side={1} blanket="#6f8fb0" accent="#8a5d4f" poster="STUDY HARD" posterColor="#5e8a83"/>
 {/* Lounge: TV on the west wall, sofa facing it, coffee table between. */}
 <group position={[-13.4,0,4.9]}><Block p={[0,.25,0]} s={[.5,.5,1.8]} c="#5b4636"/><Block p={[.05,1.2,0]} s={[.07,.95,1.6]} c="#1c2223"/><Block p={[.09,1.2,0]} s={[.01,.84,1.48]} c="#2f5d73"/></group>
 <group position={[-9.65,0,4.9]}><Block p={[0,.3,0]} s={[1,.4,2.6]} c="#c9786a"/><Block p={[.45,.75,0]} s={[.25,.9,2.6]} c="#b8695c"/>{[-1.35,1.35].map(dz=><Block key={dz} p={[0,.5,dz]} s={[1,.6,.2]} c="#b8695c"/>)}{[-.6,.6].map(dz=><Block key={dz} p={[.25,.58,dz]} s={[.45,.14,.5]} c="#f0e2c8"/>)}</group>
 <group position={[-11.4,0,4.9]}><Block p={[0,.42,0]} s={[.8,.06,1.3]} c="#a98563"/>{[-.32,.32].flatMap(a=>[-.55,.55].map(b=><Block key={`${a}:${b}`} p={[a,.2,b]} s={[.05,.4,.05]} c="#7c5f45"/>))}<DiningModel name="cup-coffee" pack="food" p={[0,.45,.3]} scale={.55}/><DiningModel name="books" p={[0,.45,-.3]} scale={.55}/></group>
 <Rug x={-11.3} z={4.9} w={3.6} d={3.4} color="#d3c4a8" border="#b0987a"/>
 {/* Laundry against the left divider. */}
 {[-12,-10.9,-9.8].map((x,i)=><group key={x} position={[x,0,-1.35]}><Block p={[0,.55,0]} s={[1,1.1,.9]} c="#e6ebe7"/><mesh position={[0,.55,.455]}><circleGeometry args={[.3,18]}/><meshStandardMaterial color={i===2?'#9aa29e':'#6f979b'}/></mesh><Block p={[0,1.02,.43]} s={[.8,.1,.02]} c="#3b4a4b"/><Ball p={[.3,1.02,.45]} color={i===2?'#e0b84c':'#6fd08c'} r={.03}/></group>)}
 <group position={[-10.9,2.3,-1.82]}><Block p={[0,0,0]} s={[2.4,.45,.06]} c="#3f6a7a"/><Label text="LAUNDRY" p={[0,0,.035]} size={.22} color="#f4f8f0"/></group>
 {/* Kitchen along the east wall, dining table in the middle of the right side. */}
 <group position={[13.2,0,6.2]}><Block p={[0,.45,0]} s={[.75,.9,5.4]} c="#8a9a96"/><Block p={[-.02,.93,0]} s={[.8,.06,5.45]} c="#e9e4d6"/><Block p={[-.05,.95,-1.2]} s={[.5,.02,.7]} c="#9fb0b2"/><Block p={[.2,1.15,-1.2]} s={[.05,.4,.05]} c="#c9ced0"/><Block p={[.08,1.33,-1.2]} s={[.28,.04,.04]} c="#c9ced0"/><Block p={[-.05,.97,.8]} s={[.6,.02,.7]} c="#262b2c"/>{[[.6,.15],[.6,-.15],[1,.15],[1,-.15]].map(([dz,dx],i)=><mesh key={i} position={[dx-.05,.985,dz]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.05,.09,14]}/><meshStandardMaterial color="#5a6768"/></mesh>)}{[-2.3,-1.7,-.6,0,1.6,2.2].map(dz=><Block key={dz} p={[-.38,.55,dz]} s={[.01,.6,.5]} c="#7a8a86"/>)}<DiningModel name="kitchenmicrowave" p={[0,.96,2.1]} scale={.8}/></group>
 <group position={[13.15,0,10.5]}><Block p={[0,1,0]} s={[.85,2,.8]} c="#e9ebe6"/><Block p={[-.43,1.35,0]} s={[.01,.02,.7]} c="#9aa29e"/><Block p={[-.45,1.6,.3]} s={[.03,.4,.04]} c="#9aa29e"/><Block p={[-.45,.7,.3]} s={[.03,.4,.04]} c="#9aa29e"/></group>
 <group position={[8.5,0,6.5]}><Block p={[0,.74,0]} s={[1.6,.06,1]} c="#c2a27e"/>{[-.7,.7].flatMap(a=>[-.42,.42].map(b=><Block key={`${a}:${b}`} p={[a,.37,b]} s={[.06,.74,.06]} c="#8c6e52"/>))}<DiningModel name="plate-dinner" pack="food" p={[-.3,.77,-.25]} scale={.5}/><DiningModel name="cup" pack="food" p={[.35,.77,.25]} scale={.55}/>
  {[[-1.1,0],[1.1,Math.PI]].map(([dz,r])=><group key={dz} position={[0,0,dz]} rotation={[0,r,0]}><Block p={[0,.45,0]} s={[.55,.08,.55]} c="#6f8f86"/><Block p={[0,.82,-.26]} s={[.55,.66,.07]} c="#6f8f86"/>{[-.22,.22].flatMap(a=>[-.22,.22].map(b=><Block key={`${a}:${b}`} p={[a,.22,b]} s={[.04,.44,.04]} c="#9aa29e"/>))}</group>)}</group>
 {/* Restroom door on the east wall, plants at the entrance. */}
 <group position={[13.8,0,-.8]} rotation={[0,-Math.PI/2,0]}><Block p={[0,1.05,0]} s={[1,2.1,.06]} c="#9a7656"/><Block p={[.35,1.05,.04]} s={[.05,.12,.04]} c="#d8b552"/><Block p={[0,2.35,.02]} s={[1,.28,.04]} c="#33504b"/><Label text="RESTROOM" p={[0,2.35,.045]} size={.13} color="#f6efdc"/></group>
 <DiningModel name="pottedplant" p={[12.5,0,-1.4]} scale={1.3}/><DiningModel name="pottedplant" p={[-12.8,0,9.6]} scale={1.4}/>
 </>}
function Lab({look:_look}:{look:AvatarLook}) {return <><Dividers/><Label text="ENGINEERING LAB" p={[0,3.5,-11.68]}/>{[-9,-5,5,9].map(x=><group key={x}><Model name="desk" p={[x,0,-7]} scale={1.5}/><Model name="computerscreen" p={[x,1.15,-7]} scale={.8}/><Model name="chairdesk" p={[x,0,-5.7]}/></group>)}{[-8,0,8].map(x=><group key={x}><Model name="table" p={[x,0,3]} scale={1.6}/><Block p={[x,1.35,3]} s={[1.3,.8,.8]} c="#748b8b"/><Block p={[x,1.45,3.43]} s={[.9,.4,.08]} c="#d1e6d8"/><Ball p={[x,1.1,3.48]} color="#e8ba46" r={.12}/></group>)}<Model name="bookcaseopen" p={[-12,0,-9]} scale={1.5}/><Model name="bookcaseclosed" p={[12,0,-9]} scale={1.5}/><Poster x={-6} title="DESIGN • BUILD"/><Poster x={6} title="INNOVATE" color="#5c8d88"/></>}
function Garage({look:_look}:{look:AvatarLook}) {return <><Dividers/><Label text="COMPETITION WORKSHOP" p={[0,3.45,-11.68]} size={.4}/><Model name="race" pack="car" p={[-7,0,-7]} scale={2.2}/><Model name="debris-tire" pack="car" p={[-11,0,-4]} scale={1.2}/><Model name="wheel-racing" pack="car" p={[-11,0,-6]} scale={1.2}/><Model name="cone" pack="car" p={[-3,0,-6]}/>{[6,10].map(x=><group key={x}><Model name="table" p={[x,0,-7]} scale={1.6}/><Block p={[x,1.35,-7]} s={[1.4,.7,.7]} c="#b7503b"/><Ball p={[x,1.8,-7]} color="#43565c" r={.25}/></group>)}<Model name="desk" p={[-8,0,5]} scale={1.5}/><Model name="computerscreen" p={[-8,1.1,5]} scale={.8}/><Model name="bookcaseopen" p={[11,0,7]} scale={1.4}/><Block p={[5,1.3,5]} s={[.8,.3,.8]} c="#3a4d51"/>{[-1,1].map(x=>[-1,1].map(z=><group key={`${x}:${z}`}><Block p={[5+x*.7,1.3,5+z*.7]} s={[1.2,.08,.08]} c="#404e52"/><Ball p={[5+x*1.2,1.3,5+z*.7]} color="#82999a" r={.25}/></group>))}</>}
function Greenhouse({look:_look}:{look:AvatarLook}) {return <><Label text="GREENHOUSE" p={[0,3.92,-11.6]} size={.4}/>{[-9,-5,5,9].map(x=><DiningModel key={x} name="table" p={[x,0,-7]} scale={1.8}/>)}{[-8,0,8].map(x=><DiningModel key={x} name="table" p={[x,0,3]} scale={1.8}/>)}<DiningModel name="pottedplant" p={[11,0,8]} scale={2.3}/></>}

function Treadmill({x,z}:{x:number;z:number}) {return <group><Block p={[x,.18,z]} s={[1.2,.3,2.2]} c="#495957"/><Block p={[x,.35,z]} s={[.85,.06,1.8]} c="#253b3b"/><Block p={[x,1,z-.9]} s={[.12,1.6,.12]} c="#798b85"/><Block p={[x,1.75,z-.9]} s={[1.15,.2,.3]} c="#718480"/></group>}
// Half basketball court on the west side (hoop on the back wall); cardio, bikes, weights and climbing wall on the east.
function CourtBall(){const ref=useRef<THREE.Mesh>(null)
 useFrame(({clock})=>{if(!ref.current)return;const t=(clock.elapsedTime*.45)%1,sx=-6,sz=-4.6,ex=-7,ez=-9.7
  if(t<.6){const k=t/.6;ref.current.position.set(sx+(ex-sx)*k,1.6+Math.sin(k*Math.PI)*2.1+(3.05-1.6)*k,sz+(ez-sz)*k)}else{const k=(t-.6)/.4;ref.current.position.set(ex+(sx-ex)*k,.15+Math.abs(Math.sin(k*Math.PI*3))*(1-k)*2.4,ez+(sz-ez)*k)}})
 return <mesh ref={ref} castShadow><sphereGeometry args={[.13,14,10]}/><meshStandardMaterial color="#d46e3b"/></mesh>}
function BasketballCourt(){const line='#f6efe0',cx=-7
 return <group>
  <Block p={[cx,.02,-4.9]} s={[12.6,.04,12.6]} c="#c99a62"/>{Array.from({length:14},(_,i)=><Block key={i} p={[cx-6.3+i*.9+.45,.043,-4.9]} s={[.01,.002,12.6]} c="#b4864f"/>)}
  {[[cx,-11.15,12.2,.07],[cx,1.35,12.2,.07]].map(([x,z,w,d],i)=><Block key={i} p={[x,.045,z]} s={[w,.004,d]} c={line}/>)}{[cx-6.1,cx+6.1].map(x=><Block key={x} p={[x,.045,-4.9]} s={[.07,.004,12.5]} c={line}/>)}
  <Block p={[cx,.046,-8.6]} s={[3.6,.004,5.1]} c="#2f5d73"/>{[cx-1.8,cx+1.8].map(x=><Block key={x} p={[x,.048,-8.6]} s={[.07,.004,5.1]} c={line}/>)}<Block p={[cx,.048,-6.05]} s={[3.6,.004,.07]} c={line}/>
  <mesh position={[cx,.05,-6.05]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.75,1.82,32,1,Math.PI,Math.PI]}/><meshStandardMaterial color={line}/></mesh>
  <mesh position={[cx,.05,-10.1]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[5.6,5.68,48,1,Math.PI,Math.PI]}/><meshStandardMaterial color={line}/></mesh>
  <mesh position={[cx,.05,1.35]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.75,1.82,32,1,0,Math.PI]}/><meshStandardMaterial color={line}/></mesh><group position={[cx,.06,-1.2]} rotation={[-Math.PI/2,0,0]}><Label text="OWLS" p={[0,0,0]} size={.8} color="#2f5d73"/></group>
  <Block p={[cx,2.2,-11.65]} s={[.18,4.3,.18]} c="#3a4447"/><Block p={[cx,3.4,-11.25]} s={[.12,.12,.7]} c="#3a4447"/><Block p={[cx,3.45,-10.9]} s={[1.8,1.05,.06]} c="#f4f6f2"/><Block p={[cx,3.25,-10.86]} s={[.6,.45,.01]} c="#c4473c"/><Block p={[cx,3.25,-10.855]} s={[.52,.37,.01]} c="#f4f6f2"/>
  <mesh position={[cx,3.05,-10.62]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.23,.02,6,20]}/><meshStandardMaterial color="#d46e3b"/></mesh><mesh position={[cx,2.85,-10.62]}><cylinderGeometry args={[.23,.15,.38,12,1,true]}/><meshStandardMaterial color="#f4f6f2" wireframe/></mesh>
  <CourtBall/>
  {[-12.3,-1.7].map(x=><group key={x}>{[0,1,2].map(r=><Block key={r} p={[x,.2+r*.25,2.6+r*.35]} s={[1.8,.12,.35]} c="#9a7656"/>)}</group>)}
 </group>}
function Recreation({look:_look}:{look:AvatarLook}) {return <>
 <AreaSign x={1.5} w={4.6} text="RECREATION & WELLNESS" color="#3f5f58"/><BasketballCourt/>
 {[4,7,10].map(x=><Treadmill key={x} x={x} z={-6}/>)}
 {[4,7].map(x=><group key={x}><mesh position={[x,.45,-1.6]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.42,.07,7,16]}/><meshStandardMaterial color="#4e6662"/></mesh><Block p={[x,.95,-1.3]} s={[.12,1.1,.12]} c="#819891"/><Block p={[x,1.45,-1.3]} s={[.1,.1,.6]} c="#607b74"/><Block p={[x,.85,-1.95]} s={[.35,.12,.5]} c="#3e5550"/></group>)}
 {[-9,-5].map(x=><group key={x}><Block p={[x,.4,6]} s={[2,.3,.9]} c="#566d66"/>{[-.85,.85].map(dx=><mesh key={dx} position={[x+dx,.5,6]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.3,.3,.17,10]}/><meshStandardMaterial color="#283a37"/></mesh>)}</group>)}
 <Block p={[11,2,4]} s={[.3,4,8]} c="#b39471"/>{Array.from({length:18},(_,i)=><Ball key={i} p={[10.75,.5+(i%5)*.7,1+Math.floor(i/5)*1.8]} color={['#d7654a','#dfbc52','#689d92','#6783a5'][i%4]} r={.15}/>)}{[4,7].map(x=><group key={x}><Block p={[x,.45,5]} s={[2,.3,1]} c="#59665f"/>{[-.8,.8].map(a=><mesh key={a} position={[x+a,.4,5]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.3,.3,.2,12]}/><meshStandardMaterial color="#33433e"/></mesh>)}</group>)}
 {[-10,-7.5,-5].map((x,i)=><Block key={x} p={[x,.045,9.6]} s={[.8,.02,1.9]} c={['#8fb0a5','#d4b79d','#a6a3c9'][i]}/>)}
 </>}

function Office({look:_look}:{look:AvatarLook}) {return <><Dividers/><Label text="OFFICES & SERVICES" p={[0,3.45,-11.68]}/>{[-9,-5,5,9].map(x=><group key={x}><Model name="desk" p={[x,0,-7]} scale={1.3}/><Model name="computerscreen" p={[x,1.05,-7]} scale={.8}/><Model name="chairdesk" p={[x,0,-6]}/></group>)}<Model name="desk" p={[-8,0,5]} scale={1.7}/><Model name="computerscreen" p={[-8,1.3,5]} scale={.9}/><Label text="INFORMATION" p={[-8,2.4,5]} size={.28}/><Model name="loungesofa" p={[7,0,5]} scale={1.5}/><Model name="tablecoffee" p={[7,0,7]} scale={1.2}/><Model name="pottedplant" p={[11,0,9]} scale={1.2}/></>}
// Stingers: separate dining room, service counters, and a visible preparation kitchen.


/** Hide only this wall if it actually intersects the camera-to-player sightline. */
// Walls never vanish. When a wall stands between the camera and the player it lowers to a short
// ledge (a "cutaway", so the base and room outline stay visible) and rises again once the view is
// clear. A short hold time stops it flickering while the player brushes along it.
function DiningWall({p,s,color,children}:{p:V;s:V;color:string;children?:React.ReactNode}) {
 const wall=useRef<THREE.Mesh>(null), extras=useRef<THREE.Group>(null), {camera}=useThree()
 const bounds=useMemo(()=>new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...p),new THREE.Vector3(...s)),[p[0],p[1],p[2],s[0],s[1],s[2]])
 const ray=useRef(new THREE.Ray()), target=useRef(new THREE.Vector3()), direction=useRef(new THREE.Vector3()), hit=useRef(new THREE.Vector3())
 const state=useRef({cut:false,since:0,height:1})
 const ledge=Math.min(.45,s[1])/s[1]
 useFrame((_,raw)=>{
  if(!wall.current)return
  const dt=Math.min(raw,.05)
  target.current.set(indoorState.x,1,indoorState.z)
  const distance=camera.position.distanceTo(target.current)
  ray.current.set(camera.position,direction.current.subVectors(target.current,camera.position).normalize())
  const point=ray.current.intersectBox(bounds,hit.current)
  const blocking=!!point&&camera.position.distanceTo(point)<distance-.45
  const st=state.current
  if(blocking!==st.cut){st.since+=dt;if(st.since>(blocking?.25:.5)){st.cut=blocking;st.since=0}}else st.since=0
  st.height=THREE.MathUtils.lerp(st.height,st.cut?ledge:1,Math.min(1,dt*8))
  wall.current.scale.y=st.height;wall.current.position.y=p[1]-s[1]/2+s[1]*st.height/2
  if(extras.current)extras.current.visible=st.height>.9
 })
 return <group><mesh ref={wall} position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={color}/></mesh><group ref={extras}>{children}</group></group>
}
// Kenney furniture often uses a corner pivot; center it so place settings and chairs line up.
function DiningModel({name,p,r=0,scale=1,pack='furniture'}:{name:string;p:V;r?:number;scale?:number;pack?:'furniture'|'food'}) {
 const {scene}=useGLTF(`${pack==='furniture'?asset:'/models/kenney-food/'}${name}.glb`)
 const factor=useContext(modelScale),size=scale*(pack==='furniture'?factor:1)
 const offset=useMemo(()=>{const bounds=new THREE.Box3().setFromObject(scene);return [-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2] as V},[scene])
 return <group position={p} rotation={[0,r,0]}><Clone object={scene} scale={size} position={[offset[0]*size,offset[1]*size,offset[2]*size]} castShadow receiveShadow/></group>
}
function DiningArchitecture() {
 return <>
  <Block p={[0,-.12,0]} s={[28,.24,24]} c="#d8d1bf"/>
  {[-10,-6,-2,2,6,10].map((x,i)=><Block key={x} p={[x,.012,1.6]} s={[3.96,.024,19.9]} c={i%2?'#e7e1d2':'#ded9c9'}/>)}
  <Block p={[0,.02,-9.6]} s={[27.7,.04,4.6]} c="#c6c8bd"/>
  <DiningWall p={[0,2.1,-11.95]} s={[28,4.2,.2]} color="#f0eadc">{[-10,-5,0,5,10].map(x=><WallWindow key={x} x={x}/>)}</DiningWall>
  <DiningWall p={[-13.95,2.1,0]} s={[.2,4.2,24]} color="#e6dfce"/>
  <DiningWall p={[13.95,2.1,0]} s={[.2,4.2,24]} color="#e6dfce"/>
  {diningWalls.map(([x,z,w,d],i)=><DiningWall key={i} p={[x,1.6,z]} s={[w,3.2,d]} color="#c7c0ac"/>)}
  <Block p={[0,3.02,-8.4]} s={[4.2,.34,.28]} c="#9b856b"/>
  <Label text="KITCHEN" p={[0,3.03,-8.2]} size={.27}/>
  <Model name="doorwayopen" p={[-2,0,-8.35]} scale={2.1}/>
  {[-9,0,9].map(x=>[-5,5].map(z=><pointLight key={`${x}:${z}`} position={[x,3.8,z]} intensity={2.1} distance={9}/>))}
  <Block p={[-11,1.6,11.8]} s={[3.4,3.2,.15]} c="#86adb0"/><Block p={[-11,1.6,11.69]} s={[.1,3.2,.2]} c="#eeebe0"/><Block p={[-11,3.5,11.66]} s={[1.1,.4,.06]} c="#2f6b4b"/><Label text="EXIT" p={[-11,3.5,11.62]} size={.26} color="#f4f8f0" rotY={Math.PI}/>
 </>
}
function ServingStation({x,index}:{x:number;index:number}) {
 const name=['GRILL','HOME STYLE','SALAD BAR','PIZZA & DELI'][index]
 const foods=[['burger','fries','sandwich'],['bread','carrot','sandwich'],['salad','broccoli','apple'],['pizza','sandwich','bread']][index]
 return <group>
  <Block p={[x,.5,-5.8]} s={[3.1,1,1.35]} c={index===2?'#6e8d70':'#b07e58'}/>
  <Block p={[x,1.05,-5.8]} s={[3.2,.12,1.48]} c="#dadbd3"/>
  <Block p={[x,1.12,-5.8]} s={[2.6,.08,.9]} c="#7b8580"/>
  {[-.8,0,.8].map((offset,i)=><group key={offset}><Block p={[x+offset,1.2,-5.8]} s={[.67,.12,.72]} c="#e6e6dd"/><DiningModel pack="food" name={foods[i]} p={[x+offset,1.29,-5.8]} scale={.75}/></group>)}
  <Block p={[x,1.7,-6.35]} s={[3,.08,.08]} c="#8f9993"/>
  {[-1.45,1.45].map(n=><Block key={n} p={[x+n,1.38,-6.35]} s={[.08,.65,.08]} c="#9aaba5"/>)}
  <Block p={[x,2.65,-6.5]} s={[3.2,.75,.16]} c="#33433e"/>
  <Label text={name} p={[x,2.67,-6.39]} size={.28} color="#f6ead1"/>
  <DiningModel name="laptop" p={[x+1.05,1.12,-5.25]} scale={.65}/>
 </group>
}
function DiningTable({x,z,index}:{x:number;z:number;index:number}) {
 const groupTable=index>=10,height=groupTable?1.14:.98
 const chairs:readonly (readonly [number,number,number])[]=groupTable?
  [[-1.55,0,Math.PI/2],[1.55,0,-Math.PI/2],[-.6,-1.3,0],[.6,-1.3,0],[-.6,1.3,Math.PI],[.6,1.3,Math.PI]]:
  [[-1.3,0,Math.PI/2],[1.3,0,-Math.PI/2],[0,-1.1,0],[0,1.1,Math.PI]]
 return <group>
  <DiningModel name="tablecross" p={[x,0,z]} scale={groupTable?2.15:1.85}/>
  {chairs.map(([dx,dz,rotation],i)=><DiningModel key={i} name="chaircushion" p={[x+dx,0,z+dz]} r={rotation} scale={1.38}/>)}
  <DiningModel name="plate-dinner" pack="food" p={[x,height,z]} scale={.45}/>
  <DiningModel name={index%2?'sandwich':'salad'} pack="food" p={[x,height+.04,z]} scale={.55}/>
  <DiningModel name="cup" pack="food" p={[x+.45,height,z-.2]} scale={.6}/>
 </group>
}
function Booth({x,z,flip=false}:{x:number;z:number;flip?:boolean}) {return <group>
  <Block p={[x,.38,z]} s={[1.1,.76,2.1]} c="#92614b"/>
  <Block p={[x,.86,z]} s={[1.12,.22,2.12]} c="#c08760"/>
  <Block p={[x+(flip?.48:-.48),1.25,z]} s={[.18,1.15,2.12]} c="#b87954"/>
  <Block p={[x+(flip?-1:1),.76,z]} s={[1,.1,1.4]} c="#e5d4b7"/>
 </group>}
function DiningAgent({agent,look}:{agent:Diner;look:AvatarLook}) {
 const group=useRef<THREE.Group>(null),tray=useRef<THREE.Group>(null),walk=useRef(0),sit=useRef(agent.seated?1:0),eat=useRef(agent.seated?1:0)
 const colors=['orange','green','blue','yellow','purple'] as const
 useFrame((_,dt)=>{
  if(group.current){group.current.visible=agent.phase!=='away';group.current.position.set(agent.position[0],0,agent.position[1]);let angle=agent.heading;if(agent.phase==='eat')angle+=Math.sin(performance.now()*.0007+agent.id)*.18;group.current.rotation.y=angle}
  if(tray.current){tray.current.visible=agent.tray;tray.current.position.set(0,agent.seated?1.01:.68,agent.seated?.72:.5)}
  walk.current=THREE.MathUtils.lerp(walk.current,agent.walk?.75:0,Math.min(1,dt*8));sit.current=THREE.MathUtils.lerp(sit.current,agent.seated?1:0,Math.min(1,dt*5));eat.current=agent.phase==='eat'||agent.phase==='pickup'?1:0
 })
 return <group ref={group} visible={agent.phase!=='away'} position={[agent.position[0],0,agent.position[1]]} rotation={[0,agent.heading,0]}><Character {...look} color={colors[agent.id%colors.length]} top="tee" topColor={['#d6a939','#63867b','#b96555','#586f91','#92768e'][agent.id%5]} scale={1.15} walk={walk} sit={sit} sitLift={.112} eat={eat}/><group ref={tray} visible={agent.tray} position={[0,agent.seated?1.01:.68,agent.seated?.72:.5]}><Block p={[0,0,0]} s={[.62,.06,.45]} c="#d8cfb7"/><DiningModel name="plate-dinner" pack="food" p={[0,.04,0]} scale={.38}/><DiningModel name="sandwich" pack="food" p={[0,.07,0]} scale={.42}/></group></group>
}
function DiningCrowd({look}:{look:AvatarLook}) {
 const sim=useMemo(()=>new DiningSimulation(diningObstacles,diningTables.map(({x,z})=>[x,z]),5),[])
 useEffect(()=>()=>{indoorState.npcPositions=[]},[])
 useFrame((_,dt)=>{sim.step(Math.min(dt,.05),[indoorState.x,indoorState.z]);indoorState.npcPositions=sim.agents.filter(a=>a.phase!=='away').map(a=>a.position)})
 return <>{sim.agents.map(agent=><DiningAgent key={agent.id} agent={agent} look={look}/>)}</>
}
function Dining({look}:{look:AvatarLook}) {
 return <>
  <DiningArchitecture/>
  <Block p={[0,3.6,-8.17]} s={[7,.48,.1]} c="#1d2825"/><Block p={[0,3.3,-8.17]} s={[7,.10,.12]} c="#e4b63b"/>
  <Label text="STINGERS DINING HALL" p={[0,3.62,-8.09]} size={.35} color="#f5d368"/>
  {diningCounters.map((x,i)=><ServingStation key={x} x={x} index={i}/>)}
  {diningTables.map((table,i)=><DiningTable key={`${table.x}:${table.z}`} {...table} index={i}/>)}
  {[-12,12].map(x=>[1,5].map(z=><Booth key={`${x}:${z}`} x={x} z={z} flip={x>0}/>))}
  <DiningModel name="trashcan" p={[-12,0,9]} scale={1.5}/><DiningModel name="trashcan" p={[12,0,9]} scale={1.5}/><Block p={[-12,1,9]} s={[.65,.18,.65]} c="#5b805d"/><Block p={[12,1,9]} s={[.65,.18,.65]} c="#6389a0"/>
  <DiningModel name="pottedplant" p={[-12,0,-1]} scale={1.5}/><DiningModel name="pottedplant" p={[12,0,-1]} scale={1.5}/>
  <DiningModel name="kitchencabinetdrawer" p={[-11.2,0,-10.5]} scale={1.7}/><DiningModel name="kitchensink" p={[-9.4,0,-10.5]} scale={1.7}/>
  <DiningModel name="kitchenstove" p={[7.8,0,-10.5]} scale={1.7}/><DiningModel name="kitchenfridgelarge" p={[11.4,0,-10.5]} scale={1.45}/>
  <DiningModel name="kitchenmicrowave" p={[5.8,1,-10.5]} scale={1.1}/><DiningModel name="cutting-board" pack="food" p={[-10,1.05,-10.4]} scale={1.4}/>
  <Block p={[-12,1.05,-3]} s={[1.3,2.1,.9]} c="#546d68"/><Block p={[-12,1.65,-2.52]} s={[.94,.55,.08]} c="#d9e2d9"/><Label text="DRINKS" p={[-12,2.28,-2.49]} size={.19}/>{[-.3,.3].map(dx=><group key={dx}><Block p={[-12+dx,1.3,-2.49]} s={[.08,.2,.12]} c="#d9e2d9"/><DiningModel name="cup" pack="food" p={[-12+dx,.55,-2.42]} scale={.65}/></group>)}
  <Block p={[12,1.05,-3]} s={[1.3,2.1,.9]} c="#6c827b"/><Block p={[12,1.65,-2.52]} s={[.94,.55,.08]} c="#d9e2d9"/><Label text="WATER" p={[12,2.28,-2.49]} size={.19}/>{[-.3,.3].map(dx=><group key={dx}><Block p={[12+dx,1.3,-2.49]} s={[.08,.2,.12]} c="#d9e2d9"/><DiningModel name="cup" pack="food" p={[12+dx,.55,-2.42]} scale={.65}/></group>)}
  <DiningModel name="bottle-ketchup" pack="food" p={[-5,.98,4.6]} scale={.7}/><DiningModel name="bottle-musterd" pack="food" p={[5,.98,4.6]} scale={.7}/>
  <WallPoster side={-1} z={-1.5} color="#3f6a4f" title={"FRESH\nEVERY DAY"}/><WallPoster side={1} z={-1.5} color="#d2a32d" title="GO OWLS"/>
  <DiningCrowd look={look}/>
 </>
}
function Parking(){return <><Block p={[0,.02,0]} s={[26,.04,22]} c="#858984"/>{[-9,-4,4,9].map(x=><group key={x}><Block p={[x,.05,0]} s={[.12,.04,18]} c="#e4e3d4"/><Model name="sedan" pack="car" p={[x+1.8,0,-6]} scale={1.5}/></group>)}<Label text="PARKING" p={[0,3.2,-11.68]}/><Model name="cone" pack="car" p={[2,0,5]}/></>}
const rooms:Record<Exclude<InteriorKind,'student'|'classroom'>,Placed[]>={
 library:[...[-10,-6,0,6,10].map(x=>piece('bookcaseopen',x,-9,1.8,1.2,1.7)),...[-11.8,11.8].flatMap(x=>[1,5].map(z=>piece('bookcaseopen',x,z,1.8,1.2))),...[-9,-5,5,9].map(x=>piece('table',x,-5,1.7,1.4)),...[-8,0,8].map(x=>piece('table',x,3,1.7,1.4)),piece('desk',-10,8,2,1.5),piece('loungesofa',10,8,2,1)],
 dorm:[...[-1,1].flatMap(d=>[piece('bed',d*10.5,-9.6,1.7,2.7),piece('nightstand',d*12.25,-10.9,.6,.6),piece('desk',d*5,-10.9,1.7,.9),piece('wardrobe',d*13.2,-3.3,.8,1.5)]),piece('washers',-10.9,-1.35,3.4,.95),piece('sofa',-9.25,4.9,.35,2.8),piece('coffee',-11.4,4.9,.8,1.3),piece('tv',-13.4,4.9,.5,1.8),piece('counter',13.2,6.2,.8,5.5),piece('fridge',13.15,10.5,.9,.85),piece('dining',8.5,6.5,1.6,1),piece('plant',12.5,-1.4,.7,.7),piece('plant',-12.8,9.6,.7,.7)],
 lab:[...[-9,-5,5,9].map(x=>piece('desk',x,-7,2,1.5)),...[-8,0,8].map(x=>piece('table',x,3,2,1.5)),piece('bookcaseopen',-12,-9),piece('bookcaseclosed',12,-9)],
 garage:[piece('race',-7,-7,5,3,2.2,0,'car'),...[-11].map(x=>piece('debris-tire',x,-4,1,1,1.2,0,'car')),...[6,10].map(x=>piece('table',x,-7,2,1.5)),piece('desk',-8,5,2,1.5),piece('bookcaseopen',11,7),piece('table',5,5,2,1.5)],
 greenhouse:[...[-7,7].map(x=>piece('table',x,7,2,1.5)),...[-9,-5,5,9].map(x=>piece('table',x,-7,2,1.5)),...[-8,0,8].map(x=>piece('table',x,3,2,1.5)),piece('kitchensink',-11,8),piece('pottedplant',11,8),piece('soil',13.25,4.5,1,1.3)],
 recreation:[...[4,7].map(x=>piece('bike',x,-1.6,.6,1.1)),...[-9,-5].map(x=>piece('weights',x,6,2.2,1)),...[4,7,10].map(x=>piece('table',x,-6,1.3,2.3)),...[4,7].map(x=>piece('table',x,5,2,1.2)),piece('table',11,4,.5,8),piece('hoop',-7,-11.3,.5,.9),...[-12.3,-1.7].map(x=>piece('bleacher',x,3,1.9,1.3))],
 office:[...[-9,-5,5,9].map(x=>piece('desk',x,-7,2,1.4)),piece('desk',-8,5,2.2,1.5),piece('loungesofa',7,5,2.5,1.5),piece('tablecoffee',7,7,1.6,1.2),piece('pottedplant',11,9)],
 bus:[...[-1.5,1.5].flatMap(x=>[-8,0,8].map(z=>piece('chair',x,z,.12,.12))),...[-3.25,3.25].map(x=>piece('chair',x,0,.4,24)),...[-7,-3,1,5].flatMap(z=>[-2.85,2.85].map(x=>piece('chair',x,z,.55,1.15))),piece('desk',-2.25,-10,1.5,2),piece('chair',-1.15,-8.7,.4,.3)],
 crawford:[], engineering:[], academic:[], design1:[], design2:[], atrium:[], civil:[], soils:[], textile:[], architecture:[], competition:[], technology:[], housing:[], community:[], innovation:[], eventhall:[], activitycenter:[],
 admin:[],
 math:[],
 uits:[...[-10.5,10.5].map(x=>piece('desk',x,0,.18,20)),piece('desk',0,-9.8,21,.2),...[-6,0].map(x=>piece('desk',x,-6.6,4,1.2)),piece('desk',7,-7.5,4,1.3),piece('desk',9.8,-3.25,1.2,2.6),piece('bookcaseopen',9,1,1.5,1.2)],
 dining:[...[-9,-5,5,9].map(x=>piece('kitchenbar',x,-8,2,1.5)),...[-8,0,8].map(x=>piece('table',x,3,1.7,1.4)),...[-8,8].map(x=>piece('table',x,8,1.7,1.4))],
 parking:[...[-9,-4,4,9].map(x=>piece('sedan',x+1.8,-6,2,4,1.5,0,'car')),piece('cone',2,5,1,1,1,0,'car')]
}
// Extra architectural and tabletop details are deliberately kept against walls or
// on existing furniture, so they do not introduce invisible movement obstacles.
function WallBoard({x,title,lines,color='#34564d'}:{x:number;title:string;lines:string;color?:string}) {
 return <group><Block p={[x,2.35,-11.68]} s={[2.7,1.55,.14]} c={color}/><Block p={[x,2.95,-11.58]} s={[2.45,.08,.04]} c="#d5b95d"/><Label text={title} p={[x,2.7,-11.55]} size={.24} color="#f9e9b6"/><Label text={lines} p={[x,2.17,-11.55]} size={.16} color="#f7f4e9"/></group>
}
function Clock({x}:{x:number}) {return <group><mesh position={[x,3.35,-11.65]}><circleGeometry args={[.38,24]}/><meshStandardMaterial color="#f6f3e9"/></mesh><Block p={[x,3.42,-11.6]} s={[.04,.25,.05]} c="#263633"/><Block p={[x+.09,3.34,-11.59]} s={[.2,.04,.05]} c="#263633"/></group>}
function SideWindow({z,side}:{z:number;side:-1|1}) {const x=side*13.78;return <group><Block p={[x,2.3,z]} s={[.12,2.1,3.3]} c="#87abb0"/>{[-1.65,0,1.65].map(n=><Block key={n} p={[x-side*.08,2.3,z+n]} s={[.14,2.2,.1]} c="#e9eee7"/>)}<Block p={[x-side*.08,2.3,z]} s={[.14,.1,3.4]} c="#e9eee7"/></group>}
function RoomFinish({kind}:{kind:CrowdKind}) {
 const floor=kind==='dorm'?'#e0d1ba':kind==='garage'||kind==='lab'?'#cbd2ca':kind==='greenhouse'?'#cbd6bf':kind==='parking'?'#898d89':'#e4e0d2'
 return <>
  {[-10,-6,-2,2,6,10].map((x,i)=><Block key={x} p={[x,.008,0]} s={[3.96,.016,23.5]} c={i%2?floor:'#d9d6c8'}/>)}
  <DiningWall p={[-13.93,2.1,0]} s={[.12,4.1,23.8]} color="#e2e0d3">{[-6,2,8].map(z=><SideWindow key={z} z={z} side={-1}/>)}</DiningWall>
  <DiningWall p={[13.93,2.1,0]} s={[.12,4.1,23.8]} color="#e2e0d3">{[-6,2,8].map(z=><SideWindow key={z} z={z} side={1}/>)}</DiningWall>
 </>
}
function FoodCounterDetails(){return <>
 <WallBoard x={-2} title="CAMPUS LIFE" lines={'EVENTS • CLUBS\nWELCOME, OWLS'} color="#977938"/>
 
 <DiningModel name="pottedplant" p={[-6.4,0,10]} scale={1.8}/>
 </>}
function ClassroomDetails(){return <>
 <Clock x={12}/><WallBoard x={-12} title="CLASSROOM" lines={'OFFICE HOURS\nASK QUESTIONS'} color="#ad8653"/>
 <Block p={[9,2.3,-11.5]} s={[3.7,2.1,.08]} c="#f8f7ef"/><Label p={[9,2.35,-11.42]} text={'y = mx + b\n△x → 0'} size={.34} color="#455b5a"/>
 <Block p={[-10,1.1,-9]} s={[1.3,.08,.75]} c="#f0e9dc"/><DiningModel name="books" p={[-10.3,1.18,-9]} scale={.65}/>
 {[-8,0,8].map((x,i)=><DiningModel key={x} name={i===1?'laptop':'books'} p={[x,1.03,2]} scale={.7}/>)}
 </>}
function LibraryDetails(){return <>
 <WallBoard x={-3} title="RESEARCH HELP" lines={'ASK A LIBRARIAN\nSTUDY ROOMS'} color="#4a6f68"/><WallBoard x={3} title="QUIET STUDY" lines={'PLEASE KEEP\nVOICES LOW'} color="#a1844f"/><Clock x={12}/>
 {[-9,-5,5,9].map((x,i)=><group key={x}><DiningModel name={i%2?'laptop':'books'} p={[x,1.04,-5]} scale={.65}/><DiningModel name="cup" pack="food" p={[x+.55,1.05,-5]} scale={.45}/></group>)}
  <SideBoard side={1} z={-.8} y={2.1} w={1.8} color="#7a5a3f" title="NEW ARRIVALS" lines={'FICTION • SCIENCE\nKSU AUTHORS'}/>
 <Rug x={0} z={3} w={22} d={4.2} color="#c8d3cc" border="#9db1a8"/><Rug x={9.6} z={8.3} w={4.2} d={3} color="#d8c7b2" border="#b49a7c"/>
 <FloorLamp x={12.6} z={7.2}/><FloorLamp x={-3.4} z={8.9}/><Globe x={11.8} z={-3.2}/><DiningModel name="pottedplant" p={[-12.8,0,-3.4]} scale={1.4}/>
 </>}
function DormDetails(){return <>
 <WallBoard x={0} title="RESIDENT LIFE" lines={'FLOOR MEETING • SUN 7 PM\nRA ON CALL: ROOM 101'} color="#718a80"/>
 <group position={[6.2,1.85,-1.82]}><Block p={[0,0,0]} s={[2,1.1,.06]} c="#7a5c3e"/><Block p={[0,-.04,.035]} s={[1.8,.85,.01]} c="#c79a63"/><Label text="WELCOME, OWLS!" p={[0,.42,.045]} size={.12} color="#fbf3dd"/>{[[-.55,.05,'#f3e7a1'],[0,.08,'#f5c1b4'],[.55,.02,'#bfe0d4'],[-.25,-.25,'#cfd9f1'],[.35,-.27,'#f8f4ea']].map(([x,y,c],k)=><Block key={k} p={[x as number,(y as number)-.04,.045]} s={[.4,.3,.01]} c={c as string}/>)}</group>
 </>}
function LabDetails(){return <>
 <WallBoard x={-4} title="ENGINEERING" lines={'DESIGN • TEST • BUILD\nMAKER WORKSPACE'} color="#567b76"/><WallBoard x={4} title="LAB NOTES" lines={'PROTOTYPE\nITERATE • LEARN'} color="#ac8c4c"/><Clock x={12}/>
 {[-9,-5,5,9].map(x=><group key={x}><DiningModel name="computerkeyboard" p={[x,1.13,-6.7]} scale={.7}/><DiningModel name="books" p={[x+.65,1.1,-7]} scale={.5}/></group>)}
 {[-8,0,8].map((x,i)=><group key={x}><Block p={[x,1.55,3]} s={[1.2,.9,.8]} c={i===1?'#738d8b':'#717f7a'}/><Block p={[x,1.6,3.43]} s={[.82,.5,.04]} c="#bfdbd1"/><Block p={[x+.48,1.35,3.47]} s={[.12,.12,.07]} c="#e4ad43"/><Ball p={[x-.4,1.28,3.48]} color="#c46a56" r={.08}/></group>)}
 </>}
function GarageDetails(){return <>
 <WallBoard x={-4} title="HORNET GARAGE" lines={'DESIGN • BUILD\nRACE • COMPETE'} color="#8d493c"/><WallBoard x={4} title="PROJECTS" lines={'DRONES • ROBOTS\nCOMPETITION CARS'} color="#596f64"/>
 {[-11,-10.2,-9.4].map((x,i)=><Model key={x} name="wheel-racing" pack="car" p={[x,.15,-4]} scale={.7+i*.05}/>)}
 {[6,10].map(x=><group key={x}><Block p={[x,.97,-7]} s={[1.8,.1,1.1]} c="#a68a69"/><Block p={[x+.35,1.24,-7]} s={[.55,.4,.6]} c="#b74939"/><Block p={[x+.35,1.48,-7]} s={[.5,.08,.55]} c="#d18a63"/><Ball p={[x-.4,1.2,-7]} color="#687b73" r={.22}/></group>)}
 <Block p={[5,1.35,5]} s={[.9,.3,.9]} c="#53696a"/>{[-1,1].flatMap(x=>[-1,1].map(z=><group key={`${x}:${z}`}><Block p={[5+x*.7,1.38,5+z*.7]} s={[1.3,.08,.08]} c="#3f514f"/><Ball p={[5+x*1.25,1.4,5+z*.7]} color="#202e2c" r={.25}/></group>))}
 </>}
function Pot({p,w=.4,h=.36,leaf,flower,r=.3}:{p:V;w?:number;h?:number;leaf:string;flower?:string;r?:number}) {const [x,y,z]=p;return <group>
 <Block p={[x,y+h/2,z]} s={[w,h,w]} c="#a8714f"/><Block p={[x,y+h+.012,z]} s={[w*.86,.025,w*.86]} c="#4a3527"/>
 <mesh position={[x,y+h+r*.8,z]} castShadow><icosahedronGeometry args={[r,1]}/><meshStandardMaterial color={leaf}/></mesh>{flower&&<Ball p={[x,y+h+r*1.65,z]} color={flower} r={r*.38}/>}
 </group>}
function GreenhouseDetails(){return <>
 {/* Bench plants: one pot per spot, foliage sits on the soil instead of inside it. */}
 {[-9,-5,5,9].flatMap(x=>[-.6,0,.6].map((dx,i)=><Pot key={`${x}:${dx}`} p={[x+dx,1.02,-7]} leaf={['#538b53','#75a65b','#43875e'][i]} flower={i===1?'#dfc35c':undefined}/>))}
 {[-8,0,8].map(x=><group key={x}><Block p={[x,1.08,3]} s={[1.6,.1,.8]} c="#7e6452"/>{[-.55,-.18,.18,.55].map((dx,i)=><Pot key={dx} p={[x+dx,1.13,3]} w={.26} h={.2} r={.15} leaf={i%2?'#6c9965':'#88ae70'}/>)}</group>)}
 {[-7,7].map(x=><group key={x}><DiningModel name="table" p={[x,0,7]} scale={1.8}/>{[-.6,0,.6].map((dx,i)=><Pot key={dx} p={[x+dx,1.02,7]} w={.4} h={.32} r={.28} leaf={['#53905b','#709c59','#498a67'][i]} flower={['#e2b458','#c98692','#e9c976'][i]}/>)}</group>)}
 {/* Seedling shelves against the rear wall. */}
 {[-10,0,10].map(x=><group key={x}>{[.45,1.05,1.65,2.25].map(y=><group key={y}><Block p={[x,y,-10.85]} s={[2.6,.1,.8]} c="#8b9e90"/>{[-.8,0,.8].map((dx,i)=><Pot key={dx} p={[x+dx,y+.05,-10.8]} w={.3} h={.22} r={.14} leaf={['#5f9a5c','#7aa862','#4c8a62'][i]}/>)}</group>)}{[-1.25,1.25].map(dx=><Block key={dx} p={[x+dx,1.35,-10.85]} s={[.08,2.7,.8]} c="#758d81"/>)}</group>)}
 <DiningModel name="kitchensink" p={[-11,0,8]} scale={1.8}/><Block p={[-10.8,1.45,8]} s={[.12,.7,.12]} c="#9eb2a7"/><Block p={[-11.05,1.8,8]} s={[.6,.1,.12]} c="#9eb2a7"/>
 {/* Potting soil bag and thermostat sit flush against the east wall. */}
 <group position={[13.25,0,4.5]} rotation={[0,-Math.PI/2,0]}><Block p={[0,.45,0]} s={[1.2,.9,.9]} c="#a68f73"/><Label text="POTTING SOIL" p={[0,.55,.46]} size={.16} color="#f8eedb"/></group>
 <group position={[13.84,2.1,-2.5]} rotation={[0,-Math.PI/2,0]}><Block p={[0,0,.03]} s={[.75,.5,.06]} c="#f1efe4"/><Block p={[0,.04,.065]} s={[.55,.24,.02]} c="#33504b"/><Label text="72°F" p={[0,.04,.08]} size={.14} color="#bfe8c9"/><Label text="TEMP" p={[0,-.17,.07]} size={.07} color="#3c4f4a"/></group>
 <WallBoard x={-5} title="GREENHOUSE" lines={'PLANTS • RESEARCH\nGROWING TOGETHER'} color="#5b8061"/><WallBoard x={5} title="PLANT CARE" lines={'WATER • LIGHT\nGROW • LEARN'} color="#728d63"/>
 </>}
function RecreationDetails(){return <><WallBoard x={6} title="CARDIO ZONE" lines={'WIPE DOWN EQUIPMENT\nAFTER USE'} color="#567a75"/><WallBoard x={10.5} title="CLIMBING WALL" lines={'BELAY CHECK REQUIRED\nOPEN 3–9 PM'} color="#aa8350"/></>}

function OfficeDetails(){return <>
 <WallBoard x={-4} title="CAMPUS SERVICES" lines={'WELCOME\nHOW CAN WE HELP?'} color="#557a72"/><WallBoard x={4} title="INFORMATION" lines={'STUDENT RESOURCES\nCAMPUS DIRECTORY'} color="#a38248"/><Clock x={12}/>
 {[-9,-5,5,9].map(x=><group key={x}><DiningModel name="computerkeyboard" p={[x,1.05,-6.7]} scale={.65}/><DiningModel name="books" p={[x+.6,1.05,-7]} scale={.55}/></group>)}
 <DiningModel name="books" p={[7,1.05,7]} scale={.7}/><DiningModel name="cup" pack="food" p={[7.5,1.05,7]} scale={.5}/>
 </>}
function ParkingDetails(){return <>{[-9,-4,4,9].flatMap(x=>[-9,-3,3].map(z=><Block key={`${x}:${z}`} p={[x,.08,z]} s={[.09,.025,2.3]} c="#f0e8cb"/>))}<WallBoard x={0} title="PARKING" lines={'DRIVE SLOWLY\nPEDESTRIAN CROSSING'} color="#555f5b"/>{[-10,10].map(x=><Block key={x} p={[x,2,0]} s={[.3,4,.3]} c="#dad8cc"/>)}</>}
function ActivityZones({kind}:{kind:CrowdKind}) {
 const zones:Partial<Record<CrowdKind,[number,number,number,number,string][]>>={
  student:[[-9,-3.5,7,14,'#e9d9c4'],[0,0,8.5,19,'#d5dfd2'],[9,0,7,19,'#d5dce0']],
  library:[[-8,-6,10,8,'#e4dcc7'],[7,-6,10,8,'#e4dcc7'],[0,4,22,8,'#d9dfd2']],
  dorm:[[-8,-6,9,9,'#dfd1ba'],[8,-6,9,9,'#dfd1ba'],[-7,6,10,8,'#d4d9c9']],
  lab:[[-8,-6,10,8,'#cdd8d1'],[8,-6,10,8,'#cdd8d1'],[0,4,22,7,'#d5dbd2']],
  garage:[[-7,-7,9,7,'#b9c3bd'],[8,-6,10,8,'#d2c9b6'],[0,5,21,7,'#c8d0c7']],
  greenhouse:[[-8,-6,10,8,'#c7d9bd'],[8,-6,10,8,'#c7d9bd'],[0,4,22,7,'#d5dfc6']],
  office:[[-8,-6,10,8,'#d9ded2'],[8,-6,10,8,'#d9ded2'],[7,6,8,7,'#e2d6c0']],
  classroom:[[0,-9,23,4,'#dad8c9'],[0,1,23,13,'#e8e2d4']],
 }
 return <>{(zones[kind]??[]).map(([x,z,w,d,color],i)=><Block key={i} p={[x,.018,z]} s={[w,.008,d]} c={color}/>)}</>
}
function InteriorDetails({kind}:{kind:CrowdKind}) {return <><RoomFinish kind={kind}/><ActivityZones kind={kind}/ >{kind==='student'?<FoodCounterDetails/>:kind==='classroom'?<ClassroomDetails/>:kind==='library'?<LibraryDetails/>:kind==='dorm'?<DormDetails/>:kind==='lab'?<LabDetails/>:kind==='garage'?<GarageDetails/>:kind==='greenhouse'?<GreenhouseDetails/>:kind==='recreation'?<RecreationDetails/>:kind==='office'?<OfficeDetails/>:<ParkingDetails/>}</>}

// Riders face the front of the bus (-z), so the backrest sits behind them on the +z side.
function BusSeat({x,z}:{x:number;z:number}) {return <group><Block p={[x,.32,z]} s={[.9,.55,1.05]} c="#405964"/><Block p={[x,.64,z]} s={[.95,.2,1.05]} c="#b7974d"/><Block p={[x,1.13,z+.47]} s={[.95,1.1,.22]} c="#4d6871"/></group>}
function BusDriver({look}:{look:AvatarLook}) {const seated=useRef(1),drive=useRef(1);return <group position={[-2.1,0,-9.4]} rotation={[0,Math.PI,0]}><Character {...look} color="blue" top="tee" topColor="#4b6261" scale={1.15} sit={seated} sitLift={.112} eat={drive}/></group>}
// Driver's station: pedestal seat (backrest behind the driver) facing a low dashboard and wheel, windshield kept clear.
function DriverStation(){return <group>
 <Block p={[-2.1,.28,-9.35]} s={[.25,.5,.25]} c="#2b3537"/><Block p={[-2.1,.08,-9.35]} s={[.7,.06,.7]} c="#2b3537"/>
 <Block p={[-2.1,.64,-9.35]} s={[.9,.2,.85]} c="#33464d"/><Block p={[-2.1,1.18,-8.9]} s={[.9,1.05,.16]} c="#33464d"/><Block p={[-2.1,1.82,-8.92]} s={[.55,.3,.14]} c="#2a3b41"/>
 {[-1,1].map(d=><Block key={d} p={[-2.1+d*.5,.85,-9.3]} s={[.08,.08,.6]} c="#2a3b41"/>)}
 <Block p={[-2.2,.62,-10.85]} s={[1.6,1.24,.9]} c="#3a474a"/><Block p={[-2.2,1.27,-10.75]} s={[1.6,.06,1.1]} c="#2c3638"/><Block p={[-2.35,1.31,-10.55]} s={[.7,.03,.3]} c="#6fa8a0"/>
 <Block p={[-2.15,1.02,-10.2]} s={[.08,.08,.5]} c="#222b2d"/>
 <mesh position={[-2.15,1.1,-9.95]} rotation={[-Math.PI/2+.55,0,0]}><torusGeometry args={[.3,.045,8,24]}/><meshStandardMaterial color="#1c2426"/></mesh>
 </group>}
function BusInterior({look}:{look:AvatarLook}){return <>
 <BusDriver look={look}/>
 <Block p={[0,-.1,0]} s={[7,.2,24]} c="#868d87"/><Block p={[0,.02,0]} s={[2.6,.04,23.5]} c="#c5c9c0"/>
 <DiningWall p={[-3.45,1.9,0]} s={[.16,3.8,24]} color="#e3e2d5">{[-8,-4,0,4,8].map(z=><Block key={z} p={[-3.34,2.3,z]} s={[.08,1.6,2.9]} c="#86adb3"/>)}</DiningWall>
 <DiningWall p={[3.45,1.9,0]} s={[.16,3.8,24]} color="#e3e2d5">{[-8,-4,0,4,8].map(z=><Block key={z} p={[3.34,2.3,z]} s={[.08,1.6,2.9]} c="#86adb3"/>)}</DiningWall>
 <DiningWall p={[0,1.9,-11.9]} s={[7,3.8,.18]} color="#d8ddd3"><Block p={[0,2.15,-11.78]} s={[6.2,2.1,.1]} c="#9cc3c8"/></DiningWall>
 {[-7,-3,1,5].flatMap(z=>[-2.12,2.12].map(x=><BusSeat key={`${x}:${z}`} x={x} z={z}/>))}
 {[-1.5,1.5].map(x=><group key={x}><Block p={[x,3.2,0]} s={[.08,.08,20]} c="#dfc66d"/>{[-8,0,8].map(z=><Block key={z} p={[x,1.65,z]} s={[.08,3.1,.08]} c="#dfc66d"/>)}</group>)}
 <DriverStation/>
 <Block p={[-1.15,.6,-8.7]} s={[.12,1.2,.12]} c="#5a6768"/><Block p={[-1.15,1.3,-8.7]} s={[.4,.3,.28]} c="#3c4a4b"/><Block p={[-1.15,1.3,-8.55]} s={[.3,.2,.02]} c="#a9d8c5"/><Label text="TAP ID" p={[-1.15,1.3,-8.53]} size={.08} color="#203030"/>
 <Block p={[0,3.48,-11.74]} s={[4.2,.36,.1]} c="#273c39"/><Label text="BIG OWL BUS  •  STUDENT CENTER  •  LIBRARY" p={[0,3.48,-11.68]} size={.15} color="#f4d475"/>
 <DiningWall p={[0,1.9,11.9]} s={[7,3.8,.18]} color="#d8ddd3"><Block p={[0,2.4,11.79]} s={[4,1.3,.08]} c="#87aeb3"/><Block p={[0,3.35,11.76]} s={[2.1,.3,.06]} c="#a84237"/><Label text="EMERGENCY EXIT" p={[0,3.35,11.72]} size={.15} color="#fff7e8" rotY={Math.PI}/></DiningWall>
 </>}

function Cable({points,color,r=.022}:{points:V[];color:string;r?:number}) {const curve=useMemo(()=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),[points]);return <mesh castShadow><tubeGeometry args={[curve,24,r,6,false]}/><meshStandardMaterial color={color} roughness={.6}/></mesh>}
const patchColors=['#3f7fc4','#e2b946','#d0573f','#4f9a62','#3f7fc4','#9b6bc0','#e2b946','#3f7fc4']
// A network rack in local space: the front faces +z. Units with status lights, a patch panel and patch cords.
function ServerRack({p,r=0}:{p:V;r?:number}) {
 const cords=useMemo(()=>patchColors.map((_,i)=>{const x=-.42+i*.12,side=i<4?-.56:.56;return [[x,2.18,.58],[x,1.98,.66],[side*.9,1.9,.64],[side,1.7,.6]] as V[]}),[])
 return <group position={p} rotation={[0,r,0]}>
  <Block p={[0,1.25,0]} s={[1.2,2.5,1.1]} c="#1d2829"/><Block p={[0,2.52,0]} s={[1.24,.06,1.14]} c="#2c3a3b"/>
  {[-.56,.56].map(x=><Block key={x} p={[x,1.2,.56]} s={[.08,2.3,.05]} c="#3a4a4b"/>)}
  {[.25,.5,.75,1,1.25,1.5,1.75].map((y,i)=><group key={y}><Block p={[0,y,.56]} s={[1.02,.2,.04]} c={i%3===0?'#2f3f40':'#263435'}/>{[-.38,-.3,-.22].map(x=><Block key={x} p={[x,y,.585]} s={[.05,.11,.01]} c="#162020"/>)}<Ball p={[.32,y+.03,.59]} color="#6fe08c" r={.022}/><Ball p={[.4,y+.03,.59]} color={i%2?'#6fe08c':'#f0b94a'} r={.022}/></group>)}
  <Block p={[0,2.18,.56]} s={[1.02,.16,.05]} c="#c9cdc6"/>{patchColors.map((_,i)=><Block key={i} p={[-.42+i*.12,2.18,.59]} s={[.07,.06,.02]} c="#2a3334"/>)}
  {cords.map((pts,i)=><Cable key={i} points={pts} color={patchColors[i]} r={.016}/>)}
 </group>}
function UitsInterior(){return <>
 <Block p={[0,.025,0]} s={[21,.05,20]} c="#d5ddd5"/><Block p={[-6.5,.055,3.5]} s={[7,.02,4]} c="#d5c9ac"/><Block p={[0,.055,-3]} s={[10,.02,5]} c="#c3d2c9"/>
 <DiningWall p={[-10.5,1.65,0]} s={[.18,3.3,20]} color="#d4d9ce"/><DiningWall p={[10.5,1.65,0]} s={[.18,3.3,20]} color="#d4d9ce"/>
 <DiningWall p={[0,1.65,-9.8]} s={[21,3.3,.18]} color="#e4e7dc"/>
 {/* Wall signage: every sign is mounted flush on a wall and laid out so none overlap. */}
 <Block p={[-3,2.75,-9.66]} s={[6.4,.6,.1]} c="#304f4b"/><Label text="UITS • TECHNOLOGY SUPPORT" p={[-3,2.75,-9.6]} size={.3} color="#f7d56b"/>
 <Block p={[2.6,2.5,-9.66]} s={[2.2,1,.1]} c="#22393f"/><Block p={[2.6,2.5,-9.6]} s={[2,.82,.02]} c="#163036"/><Label text={'NOW SERVING\nA 014'} p={[2.6,2.5,-9.58]} size={.2} color="#f5e8b7"/>
 <Block p={[-9.1,2.3,-9.66]} s={[1.5,1.1,.1]} c="#ae9165"/><Label text={'TECH HELP\nCHECK IN'} p={[-9.1,2.3,-9.6]} size={.17} color="#fff1db"/>
 <Block p={[7,2.05,-9.66]} s={[2.6,.45,.1]} c="#5d6b66"/><Label text="REPAIR BENCH" p={[7,2.05,-9.6]} size={.2} color="#f4eee0"/>
 <group position={[-10.4,2.3,3.5]} rotation={[0,Math.PI/2,0]}><Block p={[0,0,0]} s={[2.8,.5,.1]} c="#426b62"/><Label text="WAITING AREA" p={[0,0,.06]} size={.22} color="#f4eee0"/></group>
 {[-6,0].map((x,i)=><group key={x}><Block p={[x,.55,-6.6]} s={[4,1.1,1.2]} c="#977e62"/><Block p={[x,1.14,-6.6]} s={[4.1,.12,1.3]} c="#eee7d8"/><DiningModel name="computerscreen" p={[x,1.23,-6.6]} scale={1.35}/><DiningModel name="computerkeyboard" p={[x,1.25,-6.1]} scale={1.05}/><Block p={[x,1.95,-9.66]} s={[2,.42,.1]} c="#426b62"/><Label text={`HELP DESK ${i+1}`} p={[x,1.95,-9.6]} size={.19} color="#f4eee0"/></group>)}
 <Block p={[7,.55,-7.5]} s={[4,1.1,1.3]} c="#8d846f"/><Block p={[7,1.14,-7.5]} s={[4.1,.12,1.4]} c="#d7d8cd"/><DiningModel name="laptop" p={[6.3,1.23,-7.5]} scale={1.4}/><DiningModel name="laptop" p={[7.5,1.23,-7.5]} scale={1.2}/>
 {/* Network closet: two racks against the east wall with a cable tray feeding them from above. */}
 <ServerRack p={[9.8,0,-2.6]} r={-Math.PI/2}/><ServerRack p={[9.8,0,-3.9]} r={-Math.PI/2}/>
 <Block p={[10.15,3.0,-4]} s={[.4,.05,5]} c="#8d9693"/>{[-1,1].map(d=><Block key={d} p={[10.15+d*.19,3.06,-4]} s={[.03,.12,5]} c="#6f7875"/>)}
 {['#3f7fc4','#e2b946','#7d8a88'].map((c,i)=><group key={c}><Cable points={[[10.05+i*.08,2.55,-2.4-i*.12],[10.05+i*.08,2.8,-2.4-i*.12],[10.08+i*.08,3.02,-1.9]]} color={c} r={.03}/><Cable points={[[10.05+i*.08,2.55,-3.7-i*.12],[10.06+i*.08,2.85,-3.9-i*.1],[10.1+i*.08,3.02,-4.6]]} color={c} r={.03}/></group>)}
 <Cable points={[[9.4,.05,-1.9],[8.9,.03,-1.2],[8.9,.03,.2],[9.2,.05,.6]]} color="#3f7fc4" r={.03}/>
 <DiningModel name="bookcaseopen" p={[9,0,1]} scale={2.3}/>{[.45,.9,1.35].map(y=><DiningModel key={y} name="laptop" p={[9,y,1]} scale={1.1}/>)}
 {[-8,-5].map(x=><DiningModel key={x} name="chaircushion" p={[x,0,3.1]} r={Math.PI} scale={2.1}/>)}
 </>}

// ---- Shared wall signage and decor for the academic buildings (B, C, D). Everything is wall-mounted or floor-standing.
type Side=-1|1
/** A board mounted flush on a side wall (side -1 = west wall, 1 = east wall), facing into the room. */
function SideBoard({side,z,y=2.1,w=2.4,h=1.2,color,title,lines,ink='#fbf5e6'}:{side:Side;z:number;y?:number;w?:number;h?:number;color:string;title:string;lines?:string;ink?:string}) {
 return <group position={[side*13.8,y,z]} rotation={[0,side<0?Math.PI/2:-Math.PI/2,0]}><Block p={[0,0,0]} s={[w,h,.08]} c={color}/><Block p={[0,h/2-.12,.045]} s={[w-.25,.05,.01]} c="#e1bf5b"/><Label text={title} p={[0,lines?h*.18:0,.05]} size={.22} color={ink}/>{lines&&<Label text={lines} p={[0,-h*.18,.05]} size={.14} color={ink}/>}</group>}
function Corkboard({side,z}:{side:Side;z:number}) {const notes=[['#f3e7a1',-.6,.15],['#f5c1b4',-.1,.22],['#bfe0d4',.45,.12],['#f8f4ea',-.45,-.28],['#cfd9f1',.15,-.25],['#f3e7a1',.62,-.3]] as const
 return <group position={[side*13.8,1.85,z]} rotation={[0,side<0?Math.PI/2:-Math.PI/2,0]}><Block p={[0,0,0]} s={[2,1.25,.08]} c="#7a5c3e"/><Block p={[0,-.04,.045]} s={[1.8,.95,.01]} c="#c79a63"/><Label text="ANNOUNCEMENTS" p={[0,.5,.05]} size={.12} color="#fbf3dd"/>{notes.map(([c,x,y],i)=><group key={i}><Block p={[x,y-.04,.055]} s={[.36,.3,.01]} c={c}/><Ball p={[x,y+.07,.065]} color="#c0463c" r={.02}/></group>)}</group>}
function DeskSign({x,y,z,text,color='#2f4d47'}:{x:number;y:number;z:number;text:string;color?:string}) {return <group position={[x,y,z]}><Block p={[0,.15,0]} s={[.06,.3,.06]} c="#5d544a"/><Block p={[0,.45,0]} s={[1.7,.34,.06]} c={color}/><Label text={text} p={[0,.45,-.035]} size={.17} color="#f6efdc" rotY={Math.PI}/><Label text={text} p={[0,.45,.035]} size={.17} color="#f6efdc"/></group>}
function FlagStand({x,z}:{x:number;z:number}) {return <group position={[x,0,z]}><mesh position={[0,.05,0]}><cylinderGeometry args={[.25,.3,.1,16]}/><meshStandardMaterial color="#2e3433"/></mesh><mesh position={[0,1.35,0]}><cylinderGeometry args={[.025,.025,2.7,8]}/><meshStandardMaterial color="#c9a54a" metalness={.4} roughness={.4}/></mesh><Ball p={[0,2.72,0]} color="#d8b552" r={.06}/><Block p={[.48,2.3,0]} s={[.9,.62,.02]} c="#f0b628"/><Block p={[.48,2.3,0]} s={[.9,.18,.025]} c="#1c1c1c"/><Label text="KSU" p={[.48,2.3,.016]} size={.11} color="#f0b628"/><Label text="KSU" p={[.48,2.3,-.016]} size={.11} color="#f0b628" rotY={Math.PI}/></group>}
function WaterCooler({x,z}:{x:number;z:number}) {return <group position={[x,0,z]}><Block p={[0,.55,0]} s={[.5,1.1,.5]} c="#e9ebe4"/><Block p={[0,.85,.255]} s={[.3,.12,.02]} c="#3b4a4b"/><mesh position={[0,1.36,0]}><cylinderGeometry args={[.2,.2,.5,16]}/><meshStandardMaterial color="#8fc6e4" transparent opacity={.8}/></mesh><Ball p={[-.08,.83,.27]} color="#4a7fd1" r={.03}/><Ball p={[.08,.83,.27]} color="#d1564a" r={.03}/></group>}
function FilingCabinet({x,z,r=0}:{x:number;z:number;r?:number}) {return <group position={[x,0,z]} rotation={[0,r,0]}><Block p={[0,.7,0]} s={[.7,1.4,.65]} c="#8f9a96"/>{[.3,.72,1.14].map(y=><group key={y}><Block p={[0,y,.33]} s={[.6,.36,.01]} c="#a3aeaa"/><Block p={[0,y+.08,.345]} s={[.22,.04,.02]} c="#4a5250"/></group>)}</group>}
function FloorLamp({x,z}:{x:number;z:number}) {return <group position={[x,0,z]}><mesh position={[0,.03,0]}><cylinderGeometry args={[.22,.25,.06,16]}/><meshStandardMaterial color="#2f3332"/></mesh><mesh position={[0,.9,0]}><cylinderGeometry args={[.025,.025,1.75,8]}/><meshStandardMaterial color="#2f3332"/></mesh><mesh position={[0,1.85,0]}><cylinderGeometry args={[.2,.32,.38,18,1,true]}/><meshStandardMaterial color="#f3e6c4" emissive="#f1d797" emissiveIntensity={.35} side={THREE.DoubleSide}/></mesh></group>}
function Globe({x,z}:{x:number;z:number}) {return <group position={[x,0,z]}><mesh position={[0,.04,0]}><cylinderGeometry args={[.22,.26,.08,16]}/><meshStandardMaterial color="#6b4a33"/></mesh><mesh position={[0,.45,0]}><cylinderGeometry args={[.04,.05,.8,8]}/><meshStandardMaterial color="#6b4a33"/></mesh><mesh position={[0,1.12,0]} rotation={[0,0,.4]}><sphereGeometry args={[.36,24,16]}/><meshStandardMaterial color="#4f86b0"/></mesh>{[[.15,.2,.25],[-.2,-.05,.22],[.05,-.22,.26]].map(([a,b,c],i)=><Ball key={i} p={[a,1.12+b,c]} color="#7fae6a" r={.12}/>)}<mesh position={[0,1.12,0]} rotation={[0,Math.PI/2,.4]}><torusGeometry args={[.4,.02,6,28]}/><meshStandardMaterial color="#c9a54a" metalness={.4}/></mesh></group>}
function Rug({x,z,w,d,color,border}:{x:number;z:number;w:number;d:number;color:string;border:string}) {return <group><Block p={[x,.035,z]} s={[w,.012,d]} c={border}/><Block p={[x,.042,z]} s={[w-.3,.012,d-.3]} c={color}/></group>}
function RecycleBins({x,z}:{x:number;z:number}) {return <group position={[x,0,z]}>{[['#3f74b5','RECYCLE',-.24],['#59605e','TRASH',.24]].map(([c,t,dz])=><group key={t as string}><Block p={[0,.42,dz as number]} s={[.5,.84,.44]} c={c as string}/><Block p={[0,.86,dz as number]} s={[.54,.05,.48]} c="#2b302f"/><group position={[-.255,.55,dz as number]} rotation={[0,-Math.PI/2,0]}><Label text={t as string} p={[0,0,0]} size={.08} color="#f4f4ee"/></group></group>)}</group>}
function TeacherDesk({x,z}:{x:number;z:number}) {return <group><Block p={[x,.72,z]} s={[1.6,.08,.85]} c="#b89a77"/><Block p={[x,.36,z-.3]} s={[1.55,.72,.06]} c="#9c7f60"/>{[-.75,.75].map(dx=><Block key={dx} p={[x+dx,.36,z]} s={[.08,.72,.8]} c="#9c7f60"/>)}<DiningModel name="laptop" p={[x-.3,.77,z]} scale={.75}/><DiningModel name="books" p={[x+.45,.77,z]} scale={.55}/></group>}
function SideWindowRow({side,zs}:{side:Side;zs:number[]}) {return <>{zs.map(z=><SideWindow key={z} z={z} side={side}/>)}</>}
// Side-wall finish for the E–I2 buildings: windows along the rear section, a safety or notice
// board on each wall, and a fire extinguisher / first-aid kit by the front section.
const specialBoards:Record<SpecialKind,[string,string,string,string,string,string]>={
 crawford:['LAB SAFETY','GOGGLES • GLOVES\nNO FOOD OR DRINK','#8c3b32','RESEARCH SYMPOSIUM','POSTERS DUE FRIDAY','#3f5f58'],
 engineering:['LAB SAFETY','SECURE LOOSE ITEMS\nCHECK THE E-STOP','#8c3b32','ROBOTICS CLUB','MEETS THURSDAYS','#2f5d73'],
 academic:['STUDY TIPS','BREAK • REVIEW\nREPEAT','#55705f','CAREER FAIR','STUDENT CENTER • 10 AM','#6d5a3f'],
 design1:['LAB SAFETY','WATCH HOT NOZZLES\nLOG EVERY PRINT','#8c3b32','DESIGN SHOWCASE','SUBMIT YOUR MODELS','#5b4a7a'],
 design2:['SHOP SAFETY','EYE & EAR PROTECTION\nNO LOOSE SLEEVES','#8c3b32','SENIOR DESIGN','DEMO DAY • APRIL','#2f5d73'],
 atrium:['HACKATHON','THIS WEEKEND\nTEAMS OF 4','#2f5d73','CS TUTORING','MON–THU • 3–7 PM','#55705f'],
 civil:['SITE SAFETY','HARD HATS IN THE\nTESTING BAY','#8c3b32','ASCE CHAPTER','CONCRETE CANOE TEAM','#6d5a3f'],
 soils:['LAB SAFETY','LABEL EVERY SAMPLE\nWASH YOUR HANDS','#8c3b32','FIELD TRIP','SAMPLE SITE • FRIDAY','#55705f'],
 textile:['STUDIO RULES','CLEAN YOUR STATION\nRETURN SHEARS','#8c3b32','FASHION SHOW','SPRING SHOWCASE','#7a4a6a'],
 competition:['SHOP RULES','SAFETY GLASSES ON\nBATTERIES IN LIPO BAGS','#8c3b32','JOIN A TEAM','VEX • SAE • ROV • AERO','#3f5f58'],
 technology:['LAB SAFETY','CHECK THE E-STOP\nSECURE ALL WIRING','#8c3b32','CO-OP FAIR','MEET EMPLOYERS • FRIDAY','#2f5d73'],
 housing:['QUIET HOURS','SUN–THU • 11 PM\nFRI–SAT • 1 AM','#55705f','MOVE-IN DAY','CHECK IN AT THE\nFRONT DESK','#6d5a3f'],
 community:['HOUSE RULES','CLEAN UP AFTER\nYOURSELF','#55705f','THIS WEEK','KARAOKE • WED 8 PM','#6d5a3f'],
 innovation:['ROBOTICS LAB','TEST • OBSERVE','#2f5d73','INNOVATION','BUILD • CREATE','#55705f'],
 eventhall:['EVENT MAP','FAIR • SYMPOSIUM\nSENIOR DESIGN','#55705f','RESUME HELP','CAREER CENTER TABLE\nBY THE ENTRANCE','#2f5d73'],
 activitycenter:['GAME ROOM','PLAY • RELAX','#55705f','RESIDENT EVENTS','WELCOME','#6d5a3f'],
 architecture:['STUDIO NOTES','SAVE OFTEN\nCRIT AT 4 PM','#55705f','LECTURE SERIES','VISITING ARCHITECTS','#3f5f58'],
}
function FireExtinguisher({side,z}:{side:Side;z:number}) {return <group position={[side*13.72,0,z]}><Block p={[0,1.25,0]} s={[.06,.5,.5]} c="#b8352c"/><mesh position={[-side*.18,.75,0]}><cylinderGeometry args={[.11,.11,.55,14]}/><meshStandardMaterial color="#c8352b"/></mesh><Block p={[-side*.18,1.08,0]} s={[.1,.1,.1]} c="#262b2a"/></group>}
function FirstAid({side,z}:{side:Side;z:number}) {return <group position={[side*13.78,1.5,z]} rotation={[0,side<0?Math.PI/2:-Math.PI/2,0]}><Block p={[0,0,0]} s={[.6,.5,.14]} c="#f1f1ea"/><Block p={[0,0,.075]} s={[.28,.08,.01]} c="#c8352b"/><Block p={[0,0,.075]} s={[.08,.28,.01]} c="#c8352b"/></group>}
function SpecialDecor({kind}:{kind:SpecialKind}) {const [lt,ll,lc,rt,rl,rc]=specialBoards[kind];return <>
 <SideWindowRow side={-1} zs={[-8,-4.2]}/><SideWindowRow side={1} zs={[-8,-4.2]}/>
 <SideBoard side={-1} z={2} color={lc} title={lt} lines={ll}/><SideBoard side={1} z={2.4} color={rc} title={rt} lines={rl}/>
 <FireExtinguisher side={-1} z={4.4}/><FirstAid side={1} z={4.6}/><Clock x={12}/>
 <DiningModel name="pottedplant" p={[-12.9,0,-1.8]} scale={1.3}/><DiningModel name="pottedplant" p={[12.9,0,-1.8]} scale={1.3}/>
 </>}
function AcademicPartitions({math=false}:{math?:boolean}){return <>{academicDivider.map(([x,z,w,d],i)=><DiningWall key={i} p={[x,1.45,z]} s={[w,2.9,d]} color="#c8c6ba"><Block p={[x,2.65,z+.17]} s={[w-.5,.1,.08]} c="#ece8d9"/></DiningWall>)}{math&&<DiningWall p={[0,1.45,-7]} s={[.25,2.9,8]} color="#c6c7bd"/>}</>}
function DeskSet({x,z}:{x:number;z:number}){return <group><DiningModel name="desk" p={[x,0,z]} scale={1.45}/><DiningModel name="chairdesk" p={[x,0,z+1.1]} scale={1.35}/><DiningModel name="computerscreen" p={[x,1.05,z-.1]} scale={.85}/><DiningModel name="computerkeyboard" p={[x,1.06,z+.25]} scale={.75}/><DiningModel name="books" p={[x+.6,1.05,z]} scale={.6}/><DiningModel name="lampsquaretable" p={[x-.55,1.02,z]} scale={.75}/></group>}
function AcademicTable({x,z,w=3}:{x:number;z:number;w?:number}){return <group><Block p={[x,.94,z]} s={[w,.14,1.65]} c="#b99a79"/>{[-1,1].flatMap(a=>[-1,1].map(b=><Block key={`${a}:${b}`} p={[x+a*(w/2-.2),.47,z+b*.6]} s={[.15,.9,.15]} c="#816b57"/>))}<DiningModel name="laptop" p={[x-.6,1.05,z]} scale={.9}/><DiningModel name="books" p={[x+.5,1.05,z]} scale={.75}/><DiningModel name="cup" pack="food" p={[x+.9,1.05,z+.35]} scale={.65}/></group>}
function Administration(){return <>
 <Block p={[-7,.03,5]} s={[7,.025,5]} c="#d8d0bc"/><Block p={[7,.03,6]} s={[8,.025,6]} c="#dad9c9"/><AcademicPartitions/>
 {[4,10].map((x,i)=><group key={x}><Block p={[x,.35,i?8:7]} s={[1.4,.7,1.3]} c="#728b7f"/><Block p={[x,.85,(i?8:7)+.55]} s={[1.4,1,.2]} c="#607e73"/></group>)}
 <Corkboard side={-1} z={1.2}/><SideBoard side={-1} z={5.4} color="#526e63" title="DIRECTORY" lines={'B • ADMINISTRATION\nOFFICES • MEETING ROOM'}/>
 <Block p={[-8.4,1.31,5]} s={[.45,.1,.36]} c="#465956"/><Block p={[-8.4,1.42,5]} s={[.35,.12,.16]} c="#243735"/>

 <Block p={[-7,.58,5]} s={[4,1.16,1.2]} c="#8a6d55"/><Block p={[-7,1.19,5]} s={[4.1,.12,1.3]} c="#e8dfce"/><Block p={[-7,.95,5.62]} s={[4,.06,.02]} c="#d8b552"/><Label text="RECEPTION" p={[-7,.62,5.62]} size={.3} color="#f6efdc"/><DiningModel name="computerscreen" p={[-7.6,1.26,5]} scale={1}/><DiningModel name="computerkeyboard" p={[-7.6,1.26,5.35]} scale={.8}/><DiningModel name="books" p={[-6.1,1.26,5]} scale={.65}/>
 <DiningModel name="chairdesk" p={[-7,0,3.8]} scale={1.4}/><group><Block p={[7,.35,6]} s={[2.9,.7,1.3]} c="#728b7f"/><Block p={[7,.85,6.55]} s={[2.9,1,.2]} c="#607e73"/></group><group position={[7,0,4]}><Block p={[0,.46,0]} s={[1.5,.07,.9]} c="#a98563"/>{[-.65,.65].flatMap(x=>[-.35,.35].map(z=><Block key={`${x}:${z}`} p={[x,.22,z]} s={[.07,.44,.07]} c="#7c5f45"/>))}<DiningModel name="books" p={[-.35,.5,0]} scale={.6}/><DiningModel name="cup" pack="food" p={[.4,.5,.1]} scale={.55}/></group><DiningModel name="pottedplant" p={[-12,0,8]} scale={1.5}/>
 <WallBoard x={0} title="WELCOME" lines={'STUDENT SERVICES\nKENNESAW STATE'} color="#61796d"/><Clock x={3}/><AreaSign x={-7.5} text="OFFICES" color="#4b6a60"/><AreaSign x={7} text="MEETING ROOM" color="#6d5a3f"/>
 {[-10,-5].map(x=><group key={x}><DeskSet x={x} z={-7}/><LibraryShelf x={x} z={-10.6}/><DiningModel name="chaircushion" p={[x+1.55,0,-5.2]} scale={1.2}/></group>)}
 <AcademicTable x={7} z={-6} w={4}/>{[5.6,7,8.4].map(x=><DiningModel key={x} name="chaircushion" p={[x,0,-4.5]} scale={1.25}/>)}
 <Block p={[7,2.3,-11.78]} s={[4.4,1.8,.08]} c="#9aa29e"/><Block p={[7,2.3,-11.73]} s={[4.2,1.6,.02]} c="#f6f7f1"/><Label text={'CAMPUS PLANNING\n• Fall events\n• Student feedback'} p={[7,2.35,-11.71]} size={.2} color="#3b5450"/><Block p={[7,1.45,-11.66]} s={[3.6,.05,.14]} c="#9aa29e"/><DiningModel name="pottedplant" p={[12,0,-9]} scale={1.5}/>
 <SideWindowRow side={-1} zs={[-5]}/><SideWindowRow side={1} zs={[-8,-4,4,8]}/>
 <FlagStand x={-10} z={3.4}/><WaterCooler x={-12.9} z={-2.3}/><FilingCabinet x={-13.2} z={-9.6} r={Math.PI/2}/><FilingCabinet x={-13.2} z={-8.85} r={Math.PI/2}/>
 <Block p={[13.25,.45,-6]} s={[.8,.9,2]} c="#7b6450"/><Block p={[13.25,.92,-6]} s={[.85,.05,2.05]} c="#d9cfbd"/><DiningModel name="kitchencoffeemachine" p={[13.25,.95,-6.5]} scale={.8}/>{[-5.6,-5.3].map(z=><DiningModel key={z} name="cup" pack="food" p={[13.2,.95,z]} scale={.6}/>)}
 <Rug x={7} z={6} w={6.5} d={4.6} color="#c9d4c6" border="#9fb2a6"/><FloorLamp x={11.4} z={9.2}/><DiningModel name="pottedplant" p={[12.8,0,10.6]} scale={1.5}/>
 </>}
function MathDesk({x,z,i}:{x:number;z:number;i:number}){return <group><DiningModel name="desk" p={[x,0,z]} scale={1.2}/><DiningModel name="chairdesk" p={[x,0,z+1.05]} scale={1.25}/><DiningModel name={i%2?'laptop':'books'} p={[x,1.03,z]} scale={.68}/></group>}
// Supply shelf in the math lounge: graphing calculators, textbooks, binders and drafting tools. Front faces the room (-x).
function MathShelf(){const wood='#a07f5f',calc=[0,1,2,3]
 return <group position={[12.95,0,10]} rotation={[0,-Math.PI/2,0]}>
  <Block p={[0,1.1,-.3]} s={[1.8,2.2,.06]} c="#8b6b4f"/>{[-.88,.88].map(x=><Block key={x} p={[x,1.1,0]} s={[.06,2.2,.62]} c={wood}/>)}{[.06,.62,1.18,1.74,2.18].map(y=><Block key={y} p={[0,y,0]} s={[1.8,.05,.62]} c={wood}/>)}
  {calc.map(i=><group key={i} position={[-.6+i*.4,.66,.05]} rotation={[-.35,0,0]}><Block p={[0,.17,0]} s={[.2,.34,.04]} c="#2c3236"/><Block p={[0,.25,.022]} s={[.15,.09,.005]} c="#a9c7a4"/>{[0,1,2].map(r=><Block key={r} p={[0,.07+r*.045,.022]} s={[.15,.025,.005]} c="#59636a"/>)}</group>)}
  {['#2f5d8a','#a8453c','#3f7a55','#b58a2e','#6d4f7a','#2f5d8a','#a8453c'].map((c,i)=><Block key={i} p={[-.7+i*.13,1.36,.02]} s={[.11,.32+(i%3)*.04,.42]} c={c}/>)}<Label text="CALCULUS" p={[.45,1.33,.32]} size={.07} color="#3b4a4b"/><Block p={[.5,1.24,.05]} s={[.6,.08,.42]} c="#d9cfb8"/><Block p={[.5,1.31,.05]} s={[.55,.06,.4]} c="#3f7a55"/>
  {['#3c6aa8','#c9a54a','#c4473c','#59605e'].map((c,i)=><Block key={c} p={[-.55+i*.22,1.93,.02]} s={[.16,.36,.46]} c={c}/>)}<mesh position={[.45,1.83,.05]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.22,20,0,Math.PI]}/><meshStandardMaterial color="#e9e4c8" side={THREE.DoubleSide} transparent opacity={.85}/></mesh>
  {[0,1,2].map(i=><Block key={i} p={[-.5+i*.5,.22,.02]} s={[.4,.28,.5]} c={['#5c6e6b','#7a8a87','#5c6e6b'][i]}/>)}<Label text="GRAPH PAPER" p={[0,.22,.28]} size={.06} color="#f4f4ee"/>
 </group>}
function Mathematics(){return <>
 <Block p={[-8,.025,5]} s={[7,.025,5]} c="#d7dfd4"/><Block p={[7,.025,5]} s={[7,.025,5]} c="#d7dfd4"/><AcademicPartitions math/>
 {[-4.5,4.5].map(x=><group key={x}><Block p={[x,.45,8]} s={[2.2,.16,.9]} c="#a38967"/><Block p={[x,.82,8.4]} s={[2.2,.8,.16]} c="#b49a78"/>{[-.9,.9].map(dx=><Block key={dx} p={[x+dx,.2,8]} s={[.12,.4,.75]} c="#7d7161"/>)}</group>)}
 <RecycleBins x={12.2} z={2}/>
 <Block p={[-8,1.7,-.8]} s={[4,1.5,.1]} c="#f4f5e9"/><Label text={'MATH TUTORING\nx + y = 12'} p={[-8,1.7,-.72]} size={.25} color="#3f605b"/>
 <Block p={[8,1.7,-.8]} s={[4,1.5,.1]} c="#e5d7b4"/><Label text={'MATH CLUB\nOFFICE HOURS'} p={[8,1.7,-.72]} size={.22}/>

 {/* Whiteboards on a windowless back wall, each with a marker tray and a room plate above it. */}
 {[-7,7].map((x,i)=><group key={x}><Block p={[x,2.25,-11.79]} s={[6.2,2,.08]} c="#9aa29e"/><Block p={[x,2.25,-11.74]} s={[6,1.8,.02]} c="#f8f8f2"/><Label text={i?'∫ x² dx = x³ / 3 + C\nf(x) = ax² + bx + c':'a² + b² = c²\nsin² θ + cos² θ = 1'} p={[x,2.3,-11.72]} size={.3} color="#2e4a6b"/><Block p={[x,1.22,-11.68]} s={[5.4,.05,.16]} c="#9aa29e"/>{['#2f5fb5','#c4473c','#2f8a55'].map((c,j)=><Block key={c} p={[x-.4+j*.25,1.27,-11.66]} s={[.18,.04,.04]} c={c}/>)}
  <group position={[x+(i?2.4:-2.4),3.62,-11.8]}><Block p={[0,0,0]} s={[1.3,.34,.06]} c="#33504b"/><Label text={i?'D 102':'D 101'} p={[0,0,.04]} size={.18} color="#f6efdc"/></group><TeacherDesk x={x+(i?3.4:-3.4)} z={-10.2}/></group>)}
 <AreaSign x={0} text="MATHEMATICS" color="#3c5f58"/>
 {[-10,-7,-4,4,7,10].flatMap(x=>[-7,-4].map((z,i)=><MathDesk key={`${x}:${z}`} x={x} z={z} i={i+(x>0?1:0)}/>))}
 <AcademicTable x={-8} z={5}/><AcademicTable x={7} z={5}/>{[-9.1,-8,-6.9,5.9,7,8.1].map(x=><DiningModel key={x} name="chaircushion" p={[x,0,6.4]} scale={1.25}/>)}
 <DiningModel name="desk" p={[12,0,8]} scale={1.3}/><DiningModel name="laptop" p={[12,1.05,8]} scale={.8}/><MathShelf/>
 <Clock x={-12}/><Clock x={12}/>
 <SideWindowRow side={-1} zs={[-9,5,9]}/><SideWindowRow side={1} zs={[-9,4.5]}/>
 <SideBoard side={-1} z={-5.5} color="#2e4a6b" title="π ≈ 3.14159" lines={'C = 2πr\nA = πr²'}/><SideBoard side={1} z={-5.5} color="#6d4f7a" title="e^(iπ) + 1 = 0" lines={"EULER'S IDENTITY"}/>
 <SideBoard side={-1} z={1.2} color="#55705f" title="TUTORING" lines={'MON–THU  2–6 PM\nWALK-INS WELCOME'}/>
 <Rug x={-8} z={5} w={6} d={3.8} color="#c7d3cf" border="#8ea6a0"/><Rug x={7} z={5} w={6} d={3.8} color="#d9cfb8" border="#b3a17d"/>
 <DiningModel name="pottedplant" p={[-12.8,0,10.5]} scale={1.5}/><DiningModel name="pottedplant" p={[2.8,0,-.35]} scale={1.2}/><WaterCooler x={-2.8} z={-.45}/>
 </>}

function InteriorAgent({agent,look,sim}:{agent:IndoorAgent;look:AvatarLook;sim:InteriorCrowd}) {
 const group=useRef<THREE.Group>(null),prop=useRef<THREE.Group>(null),walk=useRef(0),sit=useRef(agent.seated?1:0),eat=useRef(0),work=useRef(0),point=useRef(0),turn=useRef(0)
 const colors=['orange','green','blue','yellow','purple','cream'] as const
 const arrived=()=>{const goal=sim.activities[agent.activity];return !agent.route.length&&Math.hypot(agent.position[0]-goal.position[0],agent.position[1]-goal.position[1])<.18}
 useFrame(({clock},dt)=>{
  const activity=sim.activities[agent.activity],active=arrived()&&!agent.walk,role=active?activity.role:undefined
  // Teachers at a board (teach spots facing the class) alternate between talking to the class and turning to point at the board.
  const lecturing=role==='teach'&&activity.heading===0,atBoard=lecturing&&(clock.elapsedTime*.11+agent.id*.31)%1>.5
  turn.current=THREE.MathUtils.lerp(turn.current,atBoard?2.6:0,Math.min(1,dt*3));point.current=atBoard&&turn.current>2.2?1:0
  if(group.current){group.current.visible=!agent.out;group.current.position.set(agent.position[0],0,agent.position[1]);group.current.rotation.y=agent.heading+turn.current}
  if(prop.current){prop.current.visible=role==='pool'||role==='ping'||role==='water'||!!agent.carry||role==='notes'||role==='repair'||role==='help';if(role==='pool'){
    // Cue held level over the rail, tip angled down at the cue ball: slow draw back, quick stroke forward.
    const cycle=(clock.elapsedTime*.6+agent.id*.37)%1,draw=cycle<.8?cycle/.8:1-(cycle-.8)/.2
    prop.current.position.set(.12,.9,.05-draw*.22);prop.current.rotation.x=.05
   }else{prop.current.position.set(.3,.75,.35);prop.current.rotation.x=Math.sin(clock.elapsedTime*3+agent.id)*.55}prop.current.children[0].visible=role==='pool';prop.current.children[1].visible=role==='ping';prop.current.children[2].visible=role==='water'||agent.carry==='water';prop.current.children[3].visible=role==='notes'||role==='repair'||role==='help'||agent.carry==='laptop'||agent.carry==='part';prop.current.children[4].visible=agent.carry==='book'}
  walk.current=THREE.MathUtils.lerp(walk.current,agent.walk?.75:0,Math.min(1,dt*8));sit.current=THREE.MathUtils.lerp(sit.current,agent.seated?1:0,Math.min(1,dt*5));eat.current=role==='eat'?1:0;work.current=role==='pool'||role==='ping'||role==='water'||role==='plant'||role==='notes'||role==='staff'||role==='repair'||role==='study'||role==='read'||role==='write'||(role==='teach'&&!atBoard)||role==='meeting'||role==='research'||role==='robot'||role==='electronics'||role==='fabricate'||role==='cad'||role==='print'||role==='build'||role==='test'||role==='laundry'||role==='cook'||role==='wash'?1:0
 })
 return <group ref={group} position={[agent.position[0],0,agent.position[1]]} rotation={[0,agent.heading,0]}><Character {...look} color={colors[agent.id%colors.length]} top="tee" topColor={['#d6a939','#63867b','#b96555','#586f91','#92768e'][agent.id%5]} scale={1.15} walk={walk} sit={sit} sitLift={.112} eat={eat} work={work} point={point}/><group ref={prop} visible={false} position={[.3,.75,.35]}><mesh rotation={[Math.PI/2,0,0]} position={[0,0,.65]}><cylinderGeometry args={[.025,.035,1.6,7]}/><meshStandardMaterial color="#ba9268"/></mesh><group><mesh rotation={[-Math.PI/2,0,0]} position={[0,.03,.22]}><circleGeometry args={[.23,12]}/><meshStandardMaterial color="#c74739" side={THREE.DoubleSide}/></mesh><Block p={[0,0,0]} s={[.06,.06,.32]} c="#856746"/></group><group><Block p={[0,0,.1]} s={[.35,.32,.32]} c="#8da698"/><Block p={[0,.23,.1]} s={[.2,.14,.14]} c="#78978a"/><Block p={[0,.04,.34]} s={[.1,.1,.35]} c="#8da698"/></group><group><Block p={[0,0,.15]} s={[.42,.08,.55]} c="#495c59"/><Block p={[0,.07,.16]} s={[.35,.04,.46]} c="#e1e6d8"/></group><group position={[-.08,0,.08]} rotation={[0,0,.15]}><Block p={[0,0,.1]} s={[.1,.42,.32]} c={['#a8453c','#2f5d8a','#3f7a55','#b58a2e'][agent.id%4]}/><Block p={[.005,0,.1]} s={[.09,.38,.3]} c="#f3eddc"/><Block p={[-.052,0,.1]} s={[.01,.42,.32]} c={['#a8453c','#2f5d8a','#3f7a55','#b58a2e'][agent.id%4]}/></group></group></group>
}
function StudentGameBalls({sim}:{sim:InteriorCrowd}) {
 const ping=useRef<THREE.Mesh>(null),pool=useRef<THREE.Group>(null)
 useFrame(({clock})=>{const t=clock.elapsedTime;const active=(role:'pool'|'ping')=>sim.agents.some(a=>{const goal=sim.activities[a.activity];return goal.role===role&&!a.route.length&&Math.hypot(a.position[0]-goal.position[0],a.position[1]-goal.position[1])<.18})
  if(ping.current){const moving=active('ping');ping.current.position.set(9+(moving?Math.sin(t*3)*1.15:0),.81+(moving?Math.abs(Math.sin(t*3))*.38:0),-1+(moving?Math.sin(t*1.7)*.3:0))}
  if(pool.current){const moving=active('pool');pool.current.children.forEach((ball,i)=>{ball.position.x=8.45+i*.21+(moving?Math.sin(t*.9+i)*.16:0);ball.position.z=-6+(i%2)*.18+(moving?Math.cos(t*.8+i)*.13:0)})}
 })
 return <><mesh ref={ping} position={[9,.81,-1]}><sphereGeometry args={[.045,10,8]}/><meshStandardMaterial color="#f6eee0"/></mesh><group ref={pool}>{['#f4e9d4','#db4840','#e3ba3d','#404c85','#252b27'].map((color,i)=><mesh key={i} position={[8.45+i*.21,.81,-6+(i%2)*.18]}><sphereGeometry args={[.065,12,10]}/><meshStandardMaterial color={color}/></mesh>)}</group></>
}
function InteriorPeople({kind,rects,look}:{kind:CrowdKind;rects:Rect[];look:AvatarLook}) {
 const sim=useMemo(()=>new InteriorCrowd(rects,kind,kind==='classroom'?8:kind==='student'?9:kind==='bus'?8:kind==='uits'?7:kind==='innovation'?11:kind==='eventhall'?9:kind==='recreation'?8:(['crawford','engineering','academic','design1','design2','atrium','civil','soils','textile','architecture','competition','technology','housing','community','innovation','eventhall','activitycenter'] as string[]).includes(kind)?6:kind==='math'?12:kind==='admin'?8:kind==='library'?10:5),[kind,rects])
 useEffect(()=>()=>{indoorState.npcPositions=[]},[])
 useFrame((_,dt)=>{sim.step(Math.min(dt,.05),[indoorState.x,indoorState.z]);indoorState.npcPositions=sim.agents.filter(a=>!a.out).map(a=>a.position)})
 return <>{sim.agents.map(agent=><InteriorAgent key={agent.id} agent={agent} look={look} sim={sim}/>)}{kind==='student'&&<StudentGameBalls sim={sim}/>}</>
}
export function DetailedRoom({kind,look,event=0}:{kind:InteriorKind;look:AvatarLook;event?:number}) {
 const student=kind==='student',classroom=kind==='classroom'
 const special=(['crawford','engineering','academic','design1','design2','atrium','civil','soils','textile','architecture','competition','technology','housing','community','innovation','eventhall','activitycenter'] as string[]).includes(kind)
 const rects=useMemo(()=>special?specialObstacles(kind as SpecialKind):kind==='admin'?adminObstacles:kind==='math'?mathObstacles:kind==='library'?libraryObstacles:student?[...studentWalls,...studentFurniture]:classroom?[...desks,[0,-9,8,1] as Rect]:kind==='dining'?diningObstacles:[...(kind==='recreation'||kind==='parking'||kind==='bus'||kind==='uits'||kind==='greenhouse'?[]:partition),...rooms[kind].map(({x,z,w,d})=>[x,z,w,d] as Rect)],[kind,student,classroom,special])
 const scene=special?<><SpecialInterior kind={kind as SpecialKind} Wall={DiningWall} event={event}/><SpecialDecor kind={kind as SpecialKind}/></>:student?<Student look={look}/>:classroom?<Classroom look={look}/>:kind==='library'?<Library look={look}/>:kind==='dorm'?<Dorm look={look}/>:kind==='lab'?<Lab look={look}/>:kind==='garage'?<Garage look={look}/>:kind==='greenhouse'?<Greenhouse look={look}/>:kind==='recreation'?<Recreation look={look}/>:kind==='dining'?<Dining look={look}/>:kind==='parking'?<Parking/>:kind==='admin'?<Administration/>:kind==='math'?<Mathematics/>:kind==='bus'?<BusInterior look={look}/>:kind==='uits'?<UitsInterior/>:<Office look={look}/>
 return <><color attach="background" args={['#e8ece2']}/><ambientLight intensity={.95}/><directionalLight position={[5,15,8]} intensity={1.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-.0003}/><Suspense fallback={null}>{!student&&!classroom&&kind!=='dining'&&kind!=='bus'&&kind!=='uits'&&<Architecture student={false} windows={kind==='admin'?[-7.5,11.5]:kind==='math'||kind==='academic'||kind==='atrium'?[]:kind==='design1'?[0]:kind==='design2'?[-10,10]:kind==='library'?[-8,8]:kind==='dorm'?[-10,-5,5,10]:kind==='activitycenter'?[-4,0,4.5,10]:kind==='recreation'?[1.5]:undefined}/ >}<modelScale.Provider value={student||classroom?1:1.5}>{scene}{kind!=='dining'&&kind!=='bus'&&kind!=='uits'&&kind!=='admin'&&kind!=='math'&&!special&&<InteriorDetails kind={kind}/>}</modelScale.Provider>{kind!=='dining'&&<InteriorPeople kind={kind} rects={rects} look={look}/>}</Suspense><Move rects={rects} look={look} startZ={kind==='uits'?6:9}/></>
}
