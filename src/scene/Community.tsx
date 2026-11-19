import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import { Collider, type Campus } from '../campus'
import { player, spawnPoint, type AvatarLook } from './Player'
import type { Profile } from '../ui/Welcome'

type Student = { name:string; x:number; z:number; color:'purple'|'green'|'orange'; line:string }
export const community: { students:Student[] } = { students:[] }
export function CampusStudents({ campus }: {campus:Campus}) {
  const students = useMemo(() => {
    const [x,z] = spawnPoint(campus)
    const collider = new Collider(campus.buildings)
    const info = [
      {name:'Maya', color:'purple' as const, line:'Hey! Have you explored the Student Center yet?'},
      {name:'Jordan', color:'green' as const, line:'Welcome to Marietta! The globe is one of my favorite spots.'},
      {name:'Alex', color:'orange' as const, line:'I’m heading across campus. See you around!'},
    ]
    const pts:Student[] = []
    for (let r=7; r<40 && pts.length<info.length; r+=4) for (let i=0;i<12 && pts.length<info.length;i++) {
      const a=i*Math.PI/6, sx=x+Math.sin(a)*r, sz=z+Math.cos(a)*r
      if (!collider.blocked(sx,sz,1.5) && pts.every(p=>Math.hypot(p.x-sx,p.z-sz)>5)) pts.push({...info[pts.length],x:sx,z:sz})
    }
    community.students = pts
    return pts
  }, [campus])
  useEffect(() => () => {community.students=[]},[])
  return <>{students.map(s => <group key={s.name} position={[s.x,0,s.z]} rotation={[0,Math.PI,0]}><Character color={s.color} headwear="none" face="happy" top="tee" topColor="#f4f0e6" bottom="shorts" shoes="sneakers" scale={1.15}/><Html position={[0,2,0]} center distanceFactor={18}><div className="student-label">{s.name}</div></Html></group>)}</>
}

type Peer = { id:string; name:string; look:AvatarLook; x:number; z:number; heading:number; moving:boolean; time:number }
export function LocalPlayers({ profile }: {profile:Profile}) {
  const [peers,setPeers] = useState<Peer[]>([])
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const id = crypto.randomUUID(), channel = new BroadcastChannel('ksu-campus-local-v1')
    const onMessage = (event:MessageEvent) => {
      const p = event.data as Peer & {type:string}
      if (!p || p.id===id || typeof p.id!=='string') return
      if(p.type==='leave') {setPeers(old=>old.filter(x=>x.id!==p.id));return}
      if(p.type!=='position' || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !p.look) return
      setPeers(old => [...old.filter(x=>x.id!==p.id), {...p,time:Date.now()}])
    }
    channel.addEventListener('message',onMessage)
    const interval=setInterval(() => {
      channel.postMessage({type:'position',id,name:profile.name || 'Student',look:profile.look,x:player.x,z:player.z,heading:player.heading,moving:player.moving})
      setPeers(old => old.filter(p=>Date.now()-p.time<3500))
    },200)
    return () => {channel.postMessage({type:'leave',id});clearInterval(interval);channel.removeEventListener('message',onMessage);channel.close()}
  },[profile])
  return <>{peers.map(p=><Remote key={p.id} peer={p}/>)}</>
}
function Remote({peer}:{peer:Peer}) {
  const group=useRef<THREE.Group>(null), walk=useRef(0)
  useFrame((_,dt)=>{
    if(group.current){group.current.position.lerp(new THREE.Vector3(peer.x,0,peer.z),Math.min(1,dt*10));group.current.rotation.y=peer.heading}
    walk.current=THREE.MathUtils.lerp(walk.current,peer.moving?0.75:0,Math.min(1,dt*8))
  })
  return <group ref={group} position={[peer.x,0,peer.z]}><Character {...peer.look} walk={walk} scale={1.15}/><Html position={[0,2,0]} center distanceFactor={18}><div className="student-label">{peer.name}</div></Html></group>
}

