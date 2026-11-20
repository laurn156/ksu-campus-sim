import { Clone, Text, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { createContext, Suspense, useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import type { AvatarLook } from './Player'
import { indoorState } from './indoorState'

type V = [number,number,number]
type Rect = [number,number,number,number]
export type InteriorKind = 'library'|'dorm'|'student'|'garage'|'greenhouse'|'recreation'|'lab'|'office'|'classroom'|'dining'|'parking'
const asset='/models/kenney-furniture/'
const modelScale = createContext(1)
function Model({name,p,r=0,scale=1,pack='furniture'}:{name:string;p:V;r?:number;scale?:number;pack?:'furniture'|'car'|'food'|'nature'}) {const {scene}=useGLTF(`${pack==='furniture'?asset:`/models/kenney-${pack}/`}${name}.glb`);const factor=useContext(modelScale);return <Clone object={scene} position={p} rotation={[0,r,0]} scale={scale*(pack==='furniture'?factor:1)}/>}
function Block({p,s,c}:{p:V;s:V;c:string}) {return <mesh position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={c}/></mesh>}
function Label({text,p,size=.45,color='#273b37'}:{text:string;p:V;size?:number;color?:string}) {return <Text position={p} fontSize={size} color={color} anchorX="center" anchorY="middle" maxWidth={8}>{text}</Text>}
function Ball({p,color,r=.1}:{p:V;color:string;r?:number}) {return <mesh position={p}><sphereGeometry args={[r,10,8]}/><meshStandardMaterial color={color}/></mesh>}
function Person({p,look,i=0,rotation=0}:{p:V;look:AvatarLook;i?:number;rotation?:number}) {const colors=['orange','green','blue','yellow','purple','cream'] as const;return <group position={p} rotation={[0,rotation,0]}><Character {...look} color={colors[i%colors.length]} top="tee" topColor={['#e4b240','#507d77','#b55e51','#667d9b'][i%4]} scale={.9}/></group>}
function WallWindow({x,z=-11.8}:{x:number;z?:number}) {return <group><Block p={[x,2.4,z]} s={[3,2.5,.12]} c="#82aeb6"/>{[-1.5,0,1.5].map(a=><Block key={a} p={[x+a,2.4,z+.1]} s={[.12,2.6,.16]} c="#e9eee6"/>)}<Block p={[x,2.4,z+.1]} s={[3,.12,.16]} c="#e9eee6"/></group>}
function Architecture({student}:{student:boolean}) {return <><Block p={[0,-.12,0]} s={[28,.24,24]} c="#d8d0bb"/><Block p={[0,2.1,-11.95]} s={[28,4.2,.2]} c="#e9e7db"/><Block p={[-13.95,2.1,0]} s={[.2,4.2,24]} c="#e2e0d3"/><Block p={[13.95,2.1,0]} s={[.2,4.2,24]} c="#e2e0d3"/>{[-10,-5,0,5,10].map(x=><WallWindow key={x} x={x}/>)}{[-8,0,8].map(x=>[-6,4].map(z=><group key={`${x}:${z}`}><Model name="lampsquareceiling" p={[x,4.1,z]} scale={1.5}/><pointLight position={[x,3.8,z]} intensity={4} distance={12}/></group>))}<Block p={[-11,1.6,11.8]} s={[3.4,3.2,.15]} c="#83aeb1"/><Block p={[-11,1.6,11.69]} s={[.1,3.2,.2]} c="#ebece0"/><Label text="EXIT" p={[-11,3.5,11.6]} size={.3}/>{student&&<><Block p={[-5,1.7,-1]} s={[.25,3.4,8]} c="#c8bda7"/><Block p={[-5,1.7,8.1]} s={[.25,3.4,3.8]} c="#c8bda7"/><Block p={[5,1.7,-5]} s={[.25,3.4,7]} c="#c8bda7"/><Block p={[5,1.7,5.6]} s={[.25,3.4,8.8]} c="#c8bda7"/><Label text="FOOD COURT" p={[-9,3.5,-11.7]}/><Label text="GAME ROOM" p={[9,3.5,-11.7]}/></>}</>}
const studentWalls:Rect[]=[[-5,-1,.3,8],[-5,8.1,.3,3.8],[5,-5,.3,7],[5,5.6,.3,8.8]]
const studentFurniture:Rect[]=[[-11,-8,4,1.5],[-11,-3.8,4,1.5],[-11,.5,4,1.5],[-10,5,2,2],[-10,9,2,2],[0,-6,2,2],[0,-1,2,2],[0,4,2,2],[9,-6,3,2],[9,-1,3,2],[10,5,2,1.5],[-2,9,2.5,1],[-8.7,7,1.3,1.3],[12,8,1,1]]
const desks:Rect[]=[];for(const z of [-4,-1,2,5])for(const x of [-8,-4,0,4,8])desks.push([x,z,1.4,1.1])
function collision(x:number,z:number,rects:Rect[]){return Math.abs(x)>13.4||Math.abs(z)>11.3||rects.some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.38&&Math.abs(z-cz)<d/2+.38)}
function Move({look,rects}:{look:AvatarLook;rects:Rect[]}) {const body=useRef<THREE.Group>(null),walk=useRef(0),keys=useRef(new Set<string>()),pos=useRef(new THREE.Vector3(0,0,9));const {camera}=useThree()
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(!(e.target instanceof HTMLInputElement))keys.current.add(e.key.toLowerCase())};const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}},[])
 useFrame((_,raw)=>{const dt=Math.min(raw,.05),k=keys.current;let x=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),z=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'));const n=Math.hypot(x,z);if(n){x/=n;z/=n;const speed=(k.has('shift')?6:3.5)*dt;if(!collision(pos.current.x+x*speed,pos.current.z,rects))pos.current.x+=x*speed;if(!collision(pos.current.x,pos.current.z+z*speed,rects))pos.current.z+=z*speed;if(body.current)body.current.rotation.y=Math.atan2(x,z)}walk.current=THREE.MathUtils.lerp(walk.current,n?.8:0,dt*10);if(body.current)body.current.position.copy(pos.current);indoorState.x=pos.current.x;indoorState.z=pos.current.z;indoorState.heading=body.current?.rotation.y??0;indoorState.moving=!!n;camera.position.lerp(new THREE.Vector3(pos.current.x+4,8,pos.current.z+10),Math.min(1,dt*5));camera.lookAt(pos.current.x,1,pos.current.z)})
 return <group ref={body}><Character {...look} walk={walk} scale={1.15}/></group>}
function Pool(){return <group><Block p={[9,.8,-6]} s={[3.1,.35,1.8]} c="#624332"/><Block p={[9,1,-6]} s={[2.8,.08,1.5]} c="#387153"/>{[-1.3,0,1.3].map(x=>[-.7,.7].map(z=><Ball key={`${x}:${z}`} p={[9+x,1.08,-6+z]} color="#242820" r={.13}/>))}{[0,1,2,3,4].map(i=><Ball key={i} p={[8.6+i*.17,1.1,-6+(i%2)*.17]} color={['#f1e8ca','#db4840','#e3ba3d','#404c85','#252b27'][i]} r={.08}/>)}{[-1,1].map(x=>[-.6,.6].map(z=><Block key={`${x}:${z}`} p={[9+x,.4,-6+z]} s={[.22,.8,.22]} c="#564638"/>))}<Block p={[9,1.13,-5.3]} s={[2.7,.05,.05]} c="#c3a275"/></group>}
function PingPong(){return <group><Block p={[9,.8,-1]} s={[3,.16,1.6]} c="#426e91"/><Block p={[9,1,-1]} s={[.04,.35,1.6]} c="#e6e6dd"/>{[-1.2,1.2].map(x=>[-.6,.6].map(z=><Block key={`${x}:${z}`} p={[9+x,.4,-1+z]} s={[.13,.8,.13]} c="#444e4b"/>))}<Ball p={[9.5,.96,-1]} color="#f6eee0" r={.08}/><mesh position={[8.5,.93,-.8]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.25,12]}/><meshStandardMaterial color="#c65b4b"/></mesh></group>}
function Student({look}:{look:AvatarLook}) {const counters=[{z:-8,name:'CHICK-FIL-A',color:'#b8423e',items:'CHICKEN  •  FRIES'},{z:-3.8,name:'DUNKIN’',color:'#df7b36',items:'COFFEE  •  DONUTS'},{z:.5,name:'SUSHI',color:'#577e6c',items:'ROLLS  •  BOWLS'}];return <><Architecture student/>{counters.map((c,i)=><group key={c.name}><Block p={[-11,1,c.z]} s={[4,2,1.5]} c={c.color}/><Block p={[-11,2.9,c.z-.6]} s={[4.2,1,.2]} c="#f7f3e8"/><Label text={c.name} p={[-11,3,c.z-.46]} size={.45} color={c.color}/><Block p={[-11,2.2,c.z-.45]} s={[3.8,.5,.1]} c="#32413a"/><Label text={c.items} p={[-11,2.2,c.z-.36]} size={.24} color="#f5e8cb"/><Model name="laptop" p={[-11.8,2,c.z]} scale={.75}/>{i===1&&<Model name="kitchencoffeemachine" p={[-10.4,2,c.z]} scale={.8}/>}<Person look={look} p={[-9,0,c.z+1.4]} i={i} rotation={Math.PI}/></group>)}{[-10,0,5].map((_,i)=><group key={i}><Model name="tableround" p={[0,0,-6+i*5]} scale={1.5}/>{[-1.5,1.5].map(x=><Model key={x} name="chaircushion" p={[x,0,-6+i*5]} r={x<0?Math.PI/2:-Math.PI/2} scale={1.1}/>)}<Person look={look} p={[1.7,0,-6+i*5]} i={i+2}/></group>)}<Model name="loungesofa" p={[-10,0,5]} scale={1.5}/><Model name="loungechair" p={[-10,0,9]} scale={1.3}/><Model name="tablecoffee" p={[-8.7,0,7]} scale={1.2}/><Model name="pottedplant" p={[-13,0,10]} scale={1.3}/><Model name="trashcan" p={[-6.5,0,3]} scale={1.1}/><Pool/><PingPong/><Person look={look} p={[7,0,-6]} i={4}/><Person look={look} p={[10.8,0,-1]} i={5}/><Model name="loungechair" p={[10,0,5]} scale={1.4}/><Block p={[12,1,8]} s={[1,2,.8]} c="#32494b"/><Block p={[12,1.5,7.57]} s={[.7,.7,.08]} c="#82b9bd"/><Label text="ARCADE" p={[12,2.2,7.5]} size={.2}/><Block p={[-2,1,9]} s={[2.5,2,1]} c="#8d795e"/><Label text="INFO" p={[-2,2.3,8.4]} size={.3}/></>}
function Classroom({look}:{look:AvatarLook}) {return <><Architecture student={false}/><Block p={[0,2.3,-11.7]} s={[10,2.4,.18]} c="#fcfcf3"/><Label text={'∫ x² dx = x³ / 3 + C\nf(x) = ax² + bx + c\nsin² θ + cos² θ = 1'} p={[0,2.4,-11.55]} size={.37}/><Block p={[9,2.4,-11.7]} s={[4,2.4,.16]} c="#f7f7ed"/><Label text="PROJECTOR" p={[9,2.4,-11.55]} size={.25}/><Block p={[0,3.8,-3]} s={[.8,.25,.5]} c="#f6f4ea"/><Model name="desk" p={[-10,0,-9]} scale={1.4}/><Model name="computerscreen" p={[-10,1.05,-9]} scale={.8}/><Person look={look} p={[-6,0,-9]} i={2}/>{desks.map(([x,z],i)=><group key={`${x}:${z}`}><Model name="desk" p={[x,0,z]} scale={1.05}/><Model name="chairdesk" p={[x,0,z+1]} scale={1}/>{i%3===0?<Model name="laptop" p={[x,1,z]} scale={.7}/>:<Model name="books" p={[x,1,z]} scale={.65}/ >}{i%2===0&&<Person look={look} p={[x,0,z+1]} i={i}/>}</group>)}<mesh position={[-12,3.25,-11.7]}><circleGeometry args={[.48,20]}/><meshStandardMaterial color="#fdfbf0"/></mesh><Label text="◷" p={[-12,3.25,-11.55]} size={.7}/></>}

// Each furniture placement carries its collision footprint, keeping visual and movement layouts together.
interface Placed { name: string; x:number; z:number; w:number; d:number; scale?:number; r?:number; pack?:'furniture'|'car'|'food'|'nature' }
const piece=(name:string,x:number,z:number,w=1.5,d=1.5,scale=1,r=0,pack:Placed['pack']='furniture'):Placed=>({name,x,z,w,d,scale,r,pack})
const partition:Rect[]=[[-8,-2,12,.25],[8,-2,12,.25]]
function Dividers(){return <>{partition.map(([x,z,w,d],i)=><group key={i}><Block p={[x,1.45,z]} s={[w,2.9,d]} c="#c8c6ba"/><Block p={[x,2.6,z+.16]} s={[w-.6,.12,.08]} c="#e9e6d8"/></group>)}</>}
function Poster({x,z=-11.78,title,color='#d7ac4a'}:{x:number;z?:number;title:string;color?:string}) {return <group><Block p={[x,2.1,z]} s={[1.6,2.1,.07]} c={color}/><Label text={title} p={[x,2.2,z+.06]} size={.23} color="#f8f7ee"/></group>}
function MakeTables({xs,z,look,items=true}:{xs:number[];z:number;look:AvatarLook;items?:boolean}) {return <>{xs.map((x,i)=><group key={x}><Model name="table" p={[x,0,z]} scale={1.25}/><Model name="chaircushion" p={[x,0,z+1]} scale={.85}/>{items&&<><Model name={i%2?'books':'laptop'} p={[x,1.05,z]} scale={.65}/><Person look={look} p={[x,0,z+1.4]} i={i}/></>}</group>)}</>}
function Library({look}:{look:AvatarLook}) {return <><Dividers/><Label text="LIBRARY" p={[0,3.45,-11.68]}/>{[-10,-6,0,6,10].map((x,i)=><group key={x}><Model name="bookcaseopen" p={[x,0,-9]} scale={1.7}/>{[-.45,0,.45].map(y=><Model key={y} name="books" p={[x+y,1.25,-8.75]} scale={.55}/>)}<Poster x={x} title={['READ','DISCOVER','STUDY'][i%3]}/></group>)}<MakeTables xs={[-9,-5,5,9]} z={-5} look={look}/><MakeTables xs={[-8,0,8]} z={3} look={look}/><Model name="desk" p={[-10,0,8]} scale={1.5}/><Model name="computerscreen" p={[-10,1.1,8]} scale={.8}/><Person look={look} p={[-11,0,9]} i={3}/><Model name="loungesofa" p={[10,0,8]} scale={1.4}/><Model name="pottedplant" p={[12,0,9]} scale={1.2}/></>}
function Dorm({look}:{look:AvatarLook}) {return <><Dividers/><Label text="RESIDENCE" p={[0,3.45,-11.68]}/>{[-8,8].map((x,i)=><group key={x}><Model name="bedsingle" p={[x,0,-8]} scale={1.5}/><Model name="cabinetbed" p={[x+2,0,-8]} scale={1.1}/><Model name="lampsquaretable" p={[x+2,.65,-8]} scale={.8}/><Model name="bookcaseclosed" p={[x-2,0,-10]} scale={1.4}/><Model name="desk" p={[x,0,-5]} scale={1.2}/><Model name="laptop" p={[x,1,-5]} scale={.75}/><Model name="chairdesk" p={[x,0,-4]} scale={1}/><Poster x={x} title={i?'STUDY':'GO OWLS'} color={i?'#5e8a83':'#d6a63a'}/></group>)}<Model name="loungesofa" p={[-8,0,5]} scale={1.5}/><Model name="tablecoffee" p={[-8,0,7]} scale={1.3}/><Model name="loungechair" p={[-5,0,6]} scale={1.2}/><Model name="kitchenfridge" p={[10,0,5]} scale={1.3}/><Model name="kitchencabinet" p={[8,0,5]} scale={1.3}/><Model name="kitchencoffeemachine" p={[8,1.1,5]} scale={.7}/><Person look={look} p={[-6,0,8]} i={2}/><Person look={look} p={[8,0,7]} i={4}/><Model name="pottedplant" p={[12,0,10]}/></>}
function Lab({look}:{look:AvatarLook}) {return <><Dividers/><Label text="ENGINEERING LAB" p={[0,3.5,-11.68]}/>{[-9,-5,5,9].map((x,i)=><group key={x}><Model name="desk" p={[x,0,-7]} scale={1.5}/><Model name="computerscreen" p={[x,1.15,-7]} scale={.8}/><Model name="chairdesk" p={[x,0,-5.7]}/><Person look={look} p={[x,0,-5]} i={i}/></group>)}{[-8,0,8].map((x,i)=><group key={x}><Model name="table" p={[x,0,3]} scale={1.6}/><Block p={[x,1.35,3]} s={[1.3,.8,.8]} c="#748b8b"/><Block p={[x,1.45,3.43]} s={[.9,.4,.08]} c="#d1e6d8"/><Ball p={[x,1.1,3.48]} color="#e8ba46" r={.12}/><Person look={look} p={[x+2,0,3]} i={i+2}/></group>)}<Model name="bookcaseopen" p={[-12,0,-9]} scale={1.5}/><Model name="bookcaseclosed" p={[12,0,-9]} scale={1.5}/><Poster x={-6} title="DESIGN • BUILD"/><Poster x={6} title="INNOVATE" color="#5c8d88"/></>}
function Garage({look}:{look:AvatarLook}) {return <><Dividers/><Label text="COMPETITION WORKSHOP" p={[0,3.45,-11.68]} size={.4}/><Model name="race" pack="car" p={[-7,0,-7]} scale={2.2}/><Model name="debris-tire" pack="car" p={[-11,0,-4]} scale={1.2}/><Model name="wheel-racing" pack="car" p={[-11,0,-6]} scale={1.2}/><Model name="cone" pack="car" p={[-3,0,-6]}/>{[6,10].map((x,i)=><group key={x}><Model name="table" p={[x,0,-7]} scale={1.6}/><Block p={[x,1.35,-7]} s={[1.4,.7,.7]} c="#b7503b"/><Ball p={[x,1.8,-7]} color="#43565c" r={.25}/><Person look={look} p={[x,0,-5]} i={i}/></group>)}<Model name="desk" p={[-8,0,5]} scale={1.5}/><Model name="computerscreen" p={[-8,1.1,5]} scale={.8}/><Model name="bookcaseopen" p={[11,0,7]} scale={1.4}/><Block p={[5,1.3,5]} s={[.8,.3,.8]} c="#3a4d51"/>{[-1,1].map(x=>[-1,1].map(z=><group key={`${x}:${z}`}><Block p={[5+x*.7,1.3,5+z*.7]} s={[1.2,.08,.08]} c="#404e52"/><Ball p={[5+x*1.2,1.3,5+z*.7]} color="#82999a" r={.25}/></group>))}<Person look={look} p={[2,0,6]} i={3}/></>}
function Greenhouse({look}:{look:AvatarLook}) {return <><Dividers/><Label text="GREENHOUSE" p={[0,3.45,-11.68]}/>{[-9,-5,5,9].map((x,i)=><group key={x}><Model name="table" p={[x,0,-7]} scale={1.7}/>{[-.5,0,.5].map((n,j)=><Model key={n} name={['plantsmall1','plantsmall2','plantsmall3'][j]} p={[x+n,1.1,-7]} scale={1.1}/>)}<Model name={i%2?'crop-melon':'crop-carrot'} pack="nature" p={[x,0,-5]} scale={1.3}/></group>)}{[-8,0,8].map((x,i)=><group key={x}><Model name="table" p={[x,0,3]} scale={1.5}/><Model name="pottedplant" p={[x,1,3]} scale={.9}/><Person look={look} p={[x+1.8,0,3]} i={i}/></group>)}<Model name="bookcaseopen" p={[-11,0,8]} scale={1.4}/><Model name="pottedplant" p={[11,0,8]} scale={1.5}/></>}
function Hoop({x,z}:{x:number;z:number}) {return <group><Block p={[x,3.1,z]} s={[2.2,1.3,.12]} c="#edf0e7"/><Block p={[x,2.8,z+.5]} s={[1,.07,.7]} c="#c26a43"/><mesh position={[x,2.75,z+.7]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.42,.045,6,16]}/><meshStandardMaterial color="#d46e49"/></mesh></group>}
function Treadmill({x,z}:{x:number;z:number}) {return <group><Block p={[x,.18,z]} s={[1.2,.3,2.2]} c="#495957"/><Block p={[x,.35,z]} s={[.85,.06,1.8]} c="#253b3b"/><Block p={[x,1,z-.9]} s={[.12,1.6,.12]} c="#798b85"/><Block p={[x,1.75,z-.9]} s={[1.15,.2,.3]} c="#718480"/></group>}
function Recreation({look}:{look:AvatarLook}) {return <><Block p={[-5,.02,-4]} s={[15,.05,14]} c="#c79a66"/><Block p={[-5,.06,-4]} s={[.07,.03,14]} c="#f1e1c8"/><mesh position={[-5,.08,-4]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[2,.045,5,28]}/><meshStandardMaterial color="#f7ebd6"/></mesh><Hoop x={-5} z={-11.6}/><Label text="RECREATION & WELLNESS" p={[-5,3.9,-11.7]} size={.35}/>{[4,7,10].map((x,i)=><group key={x}><Treadmill x={x} z={-6}/><Person look={look} p={[x,0,-4]} i={i}/></group>)}<Block p={[11,2,4]} s={[.3,4,8]} c="#b39471"/>{Array.from({length:18},(_,i)=><Ball key={i} p={[10.75,.5+(i%5)*.7,1+Math.floor(i/5)*1.8]} color={['#d7654a','#dfbc52','#689d92','#6783a5'][i%4]} r={.15}/>)}{[4,7].map(x=><group key={x}><Block p={[x,.45,5]} s={[2,.3,1]} c="#59665f"/>{[-.8,.8].map(a=><mesh key={a} position={[x+a,.4,5]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.3,.3,.2,12]}/><meshStandardMaterial color="#33433e"/></mesh>)}</group>)}<Person look={look} p={[-5,0,0]} i={4}/><Ball p={[-4,0.35,-1]} color="#bf7043" r={.3}/></>}
function Office({look}:{look:AvatarLook}) {return <><Dividers/><Label text="OFFICES & SERVICES" p={[0,3.45,-11.68]}/>{[-9,-5,5,9].map((x,i)=><group key={x}><Model name="desk" p={[x,0,-7]} scale={1.3}/><Model name="computerscreen" p={[x,1.05,-7]} scale={.8}/><Model name="chairdesk" p={[x,0,-6]}/><Person look={look} p={[x,0,-5]} i={i}/></group>)}<Model name="desk" p={[-8,0,5]} scale={1.7}/><Model name="computerscreen" p={[-8,1.3,5]} scale={.9}/><Label text="INFORMATION" p={[-8,2.4,5]} size={.28}/><Model name="loungesofa" p={[7,0,5]} scale={1.5}/><Model name="tablecoffee" p={[7,0,7]} scale={1.2}/><Model name="pottedplant" p={[11,0,9]} scale={1.2}/><Person look={look} p={[5,0,8]} i={4}/></>}
// Stingers: separate dining room, service counters, and a visible preparation kitchen.
const diningTables = [-9,-5,5,9].flatMap(x=>[.5,4.6,8.7].map(z=>({x,z})))
const diningCounters = [-9,-5,5,9]
const diningWalls:Rect[]=[[-8,-8.4,12,.22],[8,-8.4,12,.22]]
const diningObstacles:Rect[]=[...diningWalls,...diningCounters.map(x=>[x,-5.8,3.25,1.65] as Rect),...diningTables.map(({x,z})=>[x,z,2.65,2.4] as Rect),[-11.5,3,2.2,6], [11.5,3,2.2,6],[-12,9,1.4,1.4],[12,9,1.4,1.4],[-12,-3,1.4,1],[12,-3,1.4,1],[-10.2,-10.4,3.4,1], [9.6,-10.4,4.2,1]]

/** Hide only this wall if it actually intersects the camera-to-player sightline. */
function DiningWall({p,s,color,children}:{p:V;s:V;color:string;children?:React.ReactNode}) {
 const group=useRef<THREE.Group>(null), {camera}=useThree()
 const box=useRef(new THREE.Box3()), ray=useRef(new THREE.Ray()), target=useRef(new THREE.Vector3()), hit=useRef(new THREE.Vector3())
 useFrame(()=>{
  if(!group.current)return
  box.current.setFromCenterAndSize(new THREE.Vector3(...p),new THREE.Vector3(...s))
  target.current.set(indoorState.x,1,indoorState.z)
  const distance=camera.position.distanceTo(target.current)
  ray.current.set(camera.position,target.current.clone().sub(camera.position).normalize())
  const point=ray.current.intersectBox(box.current,hit.current)
  group.current.visible=!(point&&camera.position.distanceTo(point)<distance-.15)
 })
 return <group ref={group}><Block p={p} s={s} c={color}/>{children}</group>
}
// Kenney furniture often uses a corner pivot; center it so place settings and chairs line up.
function DiningModel({name,p,r=0,scale=1,pack='furniture'}:{name:string;p:V;r?:number;scale?:number;pack?:'furniture'|'food'}) {
 const {scene}=useGLTF(`${pack==='furniture'?asset:'/models/kenney-food/'}${name}.glb`)
 const factor=useContext(modelScale),size=scale*(pack==='furniture'?factor:1)
 const offset=useMemo(()=>{const bounds=new THREE.Box3().setFromObject(scene);return [-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2] as V},[scene])
 return <group position={p} rotation={[0,r,0]}><Clone object={scene} scale={size} position={[offset[0]*size,offset[1]*size,offset[2]*size]}/></group>
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
  {[-9,0,9].map(x=>[-5,5].map(z=><group key={`${x}:${z}`}><Model name="lampsquareceiling" p={[x,4.08,z]} scale={1.25}/><pointLight position={[x,3.8,z]} intensity={2.1} distance={9}/></group>))}
  <Block p={[-11,1.6,11.8]} s={[3.4,3.2,.15]} c="#86adb0"/><Block p={[-11,1.6,11.69]} s={[.1,3.2,.2]} c="#eeebe0"/><Label text="EXIT" p={[-11,3.5,11.6]} size={.3}/>
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
function DiningTable({x,z,index,look}:{x:number;z:number;index:number;look:AvatarLook}) {
 return <group>
  <DiningModel name="tablecross" p={[x,0,z]} scale={1.65}/>
  {([[-1.0,0,Math.PI/2],[1.0,0,-Math.PI/2],[0,-.95,0],[0,.95,Math.PI]] as const).map(([dx,dz,rotation],i)=><DiningModel key={i} name="chaircushion" p={[x+dx,0,z+dz]} r={rotation} scale={1.15}/>)}
  <DiningModel name="plate-dinner" pack="food" p={[x,.87,z]} scale={.45}/>
  <DiningModel name={index%2?'sandwich':'salad'} pack="food" p={[x,.91,z]} scale={.55}/>
  <DiningModel name="cup" pack="food" p={[x+.45,.87,z-.2]} scale={.6}/>
  {index%3===0&&<Person look={look} p={[x+1.25,0,z+.2]} i={index}/>}
 </group>
}
function Booth({x,z,flip=false}:{x:number;z:number;flip?:boolean}) {return <group>
  <Block p={[x,.38,z]} s={[1.1,.76,2.1]} c="#92614b"/>
  <Block p={[x,.86,z]} s={[1.12,.22,2.12]} c="#c08760"/>
  <Block p={[x+(flip?.48:-.48),1.25,z]} s={[.18,1.15,2.12]} c="#b87954"/>
  <Block p={[x+(flip?-1:1),.76,z]} s={[1,.1,1.4]} c="#e5d4b7"/>
 </group>}
function Dining({look}:{look:AvatarLook}) {
 return <>
  <DiningArchitecture/>
  <Block p={[0,3.6,-8.17]} s={[7,.48,.1]} c="#344a3e"/>
  <Label text="STINGERS DINING HALL" p={[0,3.62,-8.09]} size={.35} color="#f5d368"/>
  {diningCounters.map((x,i)=><ServingStation key={x} x={x} index={i}/>)}
  {diningTables.map((table,i)=><DiningTable key={`${table.x}:${table.z}`} {...table} index={i} look={look}/>)}
  {[-12,12].map(x=>[1,5].map(z=><Booth key={`${x}:${z}`} x={x} z={z} flip={x>0}/>))}
  <DiningModel name="trashcan" p={[-12,0,9]} scale={1.5}/><DiningModel name="trashcan" p={[12,0,9]} scale={1.5}/><Block p={[-12,1,9]} s={[.65,.18,.65]} c="#5b805d"/><Block p={[12,1,9]} s={[.65,.18,.65]} c="#6389a0"/>
  <DiningModel name="pottedplant" p={[-12,0,-1]} scale={1.5}/><DiningModel name="pottedplant" p={[12,0,-1]} scale={1.5}/>
  <DiningModel name="kitchencabinetdrawer" p={[-11.2,0,-10.5]} scale={1.7}/><DiningModel name="kitchensink" p={[-9.4,0,-10.5]} scale={1.7}/>
  <DiningModel name="kitchenstove" p={[7.8,0,-10.5]} scale={1.7}/><DiningModel name="kitchenfridgelarge" p={[11.4,0,-10.5]} scale={1.45}/>
  <DiningModel name="kitchenmicrowave" p={[5.8,1,-10.5]} scale={1.1}/><DiningModel name="cutting-board" pack="food" p={[-10,1.05,-10.4]} scale={1.4}/>
  <Block p={[-12,1.05,-3]} s={[1.3,2.1,.9]} c="#546d68"/><Block p={[-12,1.65,-2.52]} s={[.94,.55,.08]} c="#d9e2d9"/><Label text="DRINKS" p={[-12,2.28,-2.49]} size={.19}/>{[-.3,.3].map(dx=><group key={dx}><Block p={[-12+dx,1.3,-2.49]} s={[.08,.2,.12]} c="#d9e2d9"/><DiningModel name="cup" pack="food" p={[-12+dx,.55,-2.42]} scale={.65}/></group>)}
  <Block p={[12,1.05,-3]} s={[1.3,2.1,.9]} c="#6c827b"/><Block p={[12,1.65,-2.52]} s={[.94,.55,.08]} c="#d9e2d9"/><Label text="WATER" p={[12,2.28,-2.49]} size={.19}/>{[-.3,.3].map(dx=><group key={dx}><Block p={[12+dx,1.3,-2.49]} s={[.08,.2,.12]} c="#d9e2d9"/><DiningModel name="cup" pack="food" p={[12+dx,.55,-2.42]} scale={.65}/></group>)}
  <DiningModel name="bottle-ketchup" pack="food" p={[-4,.87,4.6]} scale={.7}/><DiningModel name="bottle-musterd" pack="food" p={[4,.87,4.6]} scale={.7}/>
  <Poster x={-12} z={-8.23} title="FRESH FOOD" color="#c58d50"/><Poster x={12} z={-8.23} title="GO OWLS" color="#618573"/>
  {[-9,9].map((x,i)=><Person key={x} look={look} p={[x,0,-7.35]} i={i+3}/>)}
 </>
}
function Parking(){return <><Block p={[0,.02,0]} s={[26,.04,22]} c="#858984"/>{[-9,-4,4,9].map(x=><group key={x}><Block p={[x,.05,0]} s={[.12,.04,18]} c="#e4e3d4"/><Model name="sedan" pack="car" p={[x+1.8,0,-6]} scale={1.5}/></group>)}<Label text="PARKING" p={[0,3.2,-11.68]}/><Model name="cone" pack="car" p={[2,0,5]}/></>}
const rooms:Record<Exclude<InteriorKind,'student'|'classroom'>,Placed[]>={
 library:[...[-10,-6,0,6,10].map(x=>piece('bookcaseopen',x,-9,1.8,1.2,1.7)),...[-9,-5,5,9].map(x=>piece('table',x,-5,1.7,1.4)),...[-8,0,8].map(x=>piece('table',x,3,1.7,1.4)),piece('desk',-10,8,2,1.5),piece('loungesofa',10,8,2,1)],
 dorm:[...[-8,8].flatMap(x=>[piece('bedsingle',x,-8,2,3),piece('bookcaseclosed',x-2,-10,1.5,1),piece('desk',x,-5,1.7,1.2)]),piece('loungesofa',-8,5,3,1.2),piece('tablecoffee',-8,7,1.5,1),piece('loungechair',-5,6,1.5,1.5),piece('kitchenfridge',10,5,1.5,1.5),piece('kitchencabinet',8,5,1.5,1.5)],
 lab:[...[-9,-5,5,9].map(x=>piece('desk',x,-7,2,1.5)),...[-8,0,8].map(x=>piece('table',x,3,2,1.5)),piece('bookcaseopen',-12,-9),piece('bookcaseclosed',12,-9)],
 garage:[piece('race',-7,-7,5,3,2.2,0,'car'),...[-11].map(x=>piece('debris-tire',x,-4,1,1,1.2,0,'car')),...[6,10].map(x=>piece('table',x,-7,2,1.5)),piece('desk',-8,5,2,1.5),piece('bookcaseopen',11,7),piece('table',5,5,2,1.5)],
 greenhouse:[...[-9,-5,5,9].map(x=>piece('table',x,-7,2,1.5)),...[-8,0,8].map(x=>piece('table',x,3,2,1.5)),piece('bookcaseopen',-11,8),piece('pottedplant',11,8)],
 recreation:[...[4,7,10].map(x=>piece('table',x,-6,1.3,2.3)),...[4,7].map(x=>piece('table',x,5,2,1.2)),piece('table',11,4,.5,8)],
 office:[...[-9,-5,5,9].map(x=>piece('desk',x,-7,2,1.4)),piece('desk',-8,5,2.2,1.5),piece('loungesofa',7,5,2.5,1.5),piece('tablecoffee',7,7,1.6,1.2),piece('pottedplant',11,9)],
 dining:[...[-9,-5,5,9].map(x=>piece('kitchenbar',x,-8,2,1.5)),...[-8,0,8].map(x=>piece('table',x,3,1.7,1.4)),...[-8,8].map(x=>piece('table',x,8,1.7,1.4))],
 parking:[...[-9,-4,4,9].map(x=>piece('sedan',x+1.8,-6,2,4,1.5,0,'car')),piece('cone',2,5,1,1,1,0,'car')]
}
export function DetailedRoom({kind,look}:{kind:InteriorKind;look:AvatarLook}) {
 const student=kind==='student',classroom=kind==='classroom'
 const rects=student?[...studentWalls,...studentFurniture]:classroom?[...desks,[0,-9,8,1] as Rect]:kind==='dining'?diningObstacles:[...(kind==='recreation'||kind==='parking'?[]:partition),...rooms[kind].map(({x,z,w,d})=>[x,z,w,d] as Rect)]
 const scene=student?<Student look={look}/>:classroom?<Classroom look={look}/>:kind==='library'?<Library look={look}/>:kind==='dorm'?<Dorm look={look}/>:kind==='lab'?<Lab look={look}/>:kind==='garage'?<Garage look={look}/>:kind==='greenhouse'?<Greenhouse look={look}/>:kind==='recreation'?<Recreation look={look}/>:kind==='dining'?<Dining look={look}/>:kind==='parking'?<Parking/>:<Office look={look}/>
 return <><color attach="background" args={['#e8ece2']}/><ambientLight intensity={1.3}/><directionalLight position={[5,15,8]} intensity={1.8}/><Suspense fallback={null}>{!student&&!classroom&&kind!=='dining'&&<Architecture student={false}/ >}<modelScale.Provider value={student||classroom?1:1.5}>{scene}</modelScale.Provider></Suspense><Move rects={rects} look={look}/></>
}
