import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import { DEFAULT_PROFILE } from '../ui/Welcome'
import { player } from '../scene/Player'
import type { Peer } from './World'
import type { Social } from './Social'
function Ghost({name,look,index}:{name:string;look:Peer['look'];index:number}){
 const group=useRef<THREE.Group>(null),center=useRef({x:player.x+12+index*3,z:player.z+12}),phase=useRef(index*2),walk=useRef(0.6)
 useFrame((_,dt)=>{phase.current+=dt*.12;if(group.current){group.current.position.set(center.current.x+Math.cos(phase.current)*4,0,center.current.z+Math.sin(phase.current)*4);group.current.rotation.y=-phase.current}})
 return <group ref={group}><Character {...DEFAULT_PROFILE.look} {...look} walk={walk} scale={1.15}/><Html position={[0,2,0]} center distanceFactor={18}><div className="student-label">{name} · Offline representation</div></Html></group>
}
export function OfflineFriends({userId,peers,social}:{userId:string;peers:Peer[];social:Social}){
 const ids=social.links.filter(l=>l.state==='accepted').map(l=>l.sender===userId?l.recipient:l.sender)
 return <>{social.profiles.filter(p=>ids.includes(p.id)&&!peers.some(peer=>peer.id===p.id)&&!social.blocked.includes(p.id)).slice(0,12).map((p,i)=><Ghost key={p.id} index={i} name={p.username} look={p.appearance}/>)}</>
}
