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


/** Background walkers are instanced, keeping draw calls low even on a large campus. */
function AmbientStudents({campus}:{campus:Campus}) {
  const walkers=useMemo(()=>{
    const collider=new Collider(campus.buildings)
    const candidates:{a:[number,number];b:[number,number]}[]=[]
    for(const path of campus.paths) for(let i=1;i<path.pts.length;i++) {
      const a=path.pts[i-1], b=path.pts[i], length=Math.hypot(b[0]-a[0],b[1]-a[1])
      if(length<4) continue
      const portions=Math.max(1,Math.ceil(length/18))
      for(let j=0;j<portions;j++) {
        const t0=j/portions,t1=(j+1)/portions
        const p:[number,number]=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0]
        const q:[number,number]=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1]
        if(!pointInPoly((p[0]+q[0])/2,(p[1]+q[1])/2,campus.boundary)) continue
        if([0,0.25,0.5,0.75,1].some(t=>collider.blocked(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,0.7)))continue
        candidates.push({a:p,b:q})
      }
    }
    // Fixed shuffle avoids filling just the first group of paths in map-file order.
    let seed=9182
    for(let i=candidates.length-1;i>0;i--){seed=(seed*16807)%2147483647;const j=seed%(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
    const chosen:typeof candidates=[]
    for(const c of candidates) {
      const x=(c.a[0]+c.b[0])/2,z=(c.a[1]+c.b[1])/2
      if(chosen.every(p=>Math.hypot(x-(p.a[0]+p.b[0])/2,z-(p.a[1]+p.b[1])/2)>9)) chosen.push(c)
      if(chosen.length>=140) break
    }
    // If paths are unusually sparse, use a closer spacing to keep the campus populated.
    if(chosen.length<120) for(const c of candidates) {
      const x=(c.a[0]+c.b[0])/2,z=(c.a[1]+c.b[1])/2
      if(chosen.every(p=>Math.hypot(x-(p.a[0]+p.b[0])/2,z-(p.a[1]+p.b[1])/2)>4)) chosen.push(c)
      if(chosen.length>=140) break
    }
    return chosen
  },[campus])
  const head=useRef<THREE.InstancedMesh>(null), body=useRef<THREE.InstancedMesh>(null)
  const left=useRef<THREE.InstancedMesh>(null),right=useRef<THREE.InstancedMesh>(null)
  const arms=useRef<THREE.InstancedMesh>(null)
  const helper=useMemo(()=>new THREE.Object3D(),[])
  const base=useMemo(()=>new THREE.Matrix4(),[]), part=useMemo(()=>new THREE.Matrix4(),[])
  const palette=useMemo(()=>['#8ab1e8','#e9876b','#aecb91','#b9a5e0','#f2cc5f','#6f90c4'].map(c=>new THREE.Color(c)),[])
  const shirts=useMemo(()=>['#ece9df','#333638','#c6a231','#849276','#8790a9','#b394ac'].map(c=>new THREE.Color(c)),[])
  useEffect(()=>{
    walkers.forEach((_,i)=>{head.current?.setColorAt(i,palette[i%palette.length]);arms.current?.setColorAt(i*2,palette[i%palette.length]);arms.current?.setColorAt(i*2+1,palette[i%palette.length]);body.current?.setColorAt(i,shirts[(i*5)%shirts.length]);left.current?.setColorAt(i,new THREE.Color('#55586a'));right.current?.setColorAt(i,new THREE.Color('#55586a'))})
    for(const mesh of [head.current,body.current,left.current,right.current,arms.current]) if(mesh?.instanceColor)mesh.instanceColor.needsUpdate=true
  },[walkers,palette,shirts])
  useFrame(({clock})=>{
    if(!head.current || !body.current || !left.current || !right.current || !arms.current)return
    walkers.forEach((path,i)=>{
      const length=Math.hypot(path.b[0]-path.a[0],path.b[1]-path.a[1]) || 1
      const phase=(clock.elapsedTime*1.25/length+i*0.137)%2
      const t=phase<1?phase:2-phase, sign=phase<1?1:-1
      helper.position.set(path.a[0]+(path.b[0]-path.a[0])*t,0,path.a[1]+(path.b[1]-path.a[1])*t)
      helper.rotation.set(0,Math.atan2((path.b[0]-path.a[0])*sign,(path.b[1]-path.a[1])*sign),0);helper.scale.setScalar(1);helper.updateMatrix();base.copy(helper.matrix)
      part.makeTranslation(0,1.13,0);head.current!.setMatrixAt(i,part.premultiply(base))
      part.makeTranslation(0,0.62,0);body.current!.setMatrixAt(i,part.premultiply(base))
      const swing=Math.sin(clock.elapsedTime*6+i)*0.05
      part.makeTranslation(-0.12,0.20,swing);left.current!.setMatrixAt(i,part.premultiply(base))
      part.makeTranslation(0.12,0.20,-swing);right.current!.setMatrixAt(i,part.premultiply(base))
      for(const [j,side] of [-1,1].entries()) {
        helper.position.set(side*0.27,0.61,0);helper.rotation.set(swing*side*3,0,-side*0.22);helper.scale.setScalar(1);helper.updateMatrix()
        part.copy(helper.matrix).premultiply(base);arms.current!.setMatrixAt(i*2+j,part)
      }
    })
    for(const mesh of [head.current,body.current,left.current,right.current,arms.current])mesh!.instanceMatrix.needsUpdate=true
  })
  const n=walkers.length
  return <group>
    <instancedMesh ref={head} args={[undefined,undefined,n]} frustumCulled={false}><sphereGeometry args={[0.34,12,10]}/><meshStandardMaterial roughness={0.9}/></instancedMesh>
    <instancedMesh ref={body} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.23,0.18,4,10]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
    <instancedMesh ref={left} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.1,0.14,4,8]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
    <instancedMesh ref={right} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.1,0.14,4,8]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
    <instancedMesh ref={arms} args={[undefined,undefined,n*2]} frustumCulled={false}><capsuleGeometry args={[0.07,0.16,4,8]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
  </group>
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

