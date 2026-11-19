import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import { Collider, pointInPoly, type Campus } from '../campus'
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
  return <><AmbientStudents campus={campus}/>{students.map(s => <group key={s.name} position={[s.x,0,s.z]} rotation={[0,Math.PI,0]}><Character color={s.color} headwear="none" face="happy" top="tee" topColor="#f4f0e6" bottom="shorts" shoes="sneakers" scale={1.15}/><Html position={[0,2,0]} center distanceFactor={18}><div className="student-label">{s.name}</div></Html></group>)}</>
}


/** A modest population walking short stretches of mapped sidewalks. */
function AmbientStudents({campus}:{campus:Campus}) {
  const walkers=useMemo(()=>{
    const collider=new Collider(campus.buildings)
    const candidates=campus.paths.flatMap(path=>path.pts.slice(1).map((b,i)=>({a:path.pts[i],b})))
      .filter(({a,b})=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return length>8 && length<70 && pointInPoly((a[0]+b[0])/2,(a[1]+b[1])/2,campus.boundary) && !collider.blocked(a[0],a[1],1) && !collider.blocked(b[0],b[1],1) && !collider.blocked((a[0]+b[0])/2,(a[1]+b[1])/2,1)})
    const chosen: typeof candidates=[]
    for(const c of candidates) {
      const x=(c.a[0]+c.b[0])/2,z=(c.a[1]+c.b[1])/2
      if(chosen.every(p=>Math.hypot(x-(p.a[0]+p.b[0])/2,z-(p.a[1]+p.b[1])/2)>26)) chosen.push(c)
      if(chosen.length>=20) break
    }
    return chosen
  },[campus])
  return <>{walkers.map((path,i)=><Walker key={i} path={path} index={i}/>)}</>
}
function Walker({path,index}:{path:{a:[number,number];b:[number,number]};index:number}) {
  const ref=useRef<THREE.Group>(null), walk=useRef(0.7)
  const colors=['blue','orange','green','purple','yellow','slate'] as const
  useFrame(({clock})=>{
    if(!ref.current) return
    const length=Math.hypot(path.b[0]-path.a[0],path.b[1]-path.a[1])
    const phase=(clock.elapsedTime*1.25/length+index*0.137)%2
    const t=phase<1?phase:2-phase, sign=phase<1?1:-1
    ref.current.position.set(path.a[0]+(path.b[0]-path.a[0])*t,0,path.a[1]+(path.b[1]-path.a[1])*t)
    ref.current.rotation.y=Math.atan2((path.b[0]-path.a[0])*sign,(path.b[1]-path.a[1])*sign)
  })
  return <group ref={ref}><Character color={colors[index%colors.length]} face="happy" headwear={index%3===0?'cap':'none'} top={index%2===0?'tee':'hoodie'} topColor={index%2===0?'#eee9dd':'#333337'} bottom="pants" bottomColor="#55596a" shoes="sneakers" walk={walk} scale={1.05}/></group>
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

