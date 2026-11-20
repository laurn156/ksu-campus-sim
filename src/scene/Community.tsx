import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import { studentFace, studentVariant, studentJersey } from './studentFace'
import { Collider, pointInPoly, type Campus } from '../campus'
import { player, spawnPoint, type AvatarLook } from './Player'
import type { Profile } from '../ui/Welcome'
import { STUDENTS, scheduleFor, type StudentProfile, type StudentId } from '../life/students'
import { makePathNetwork } from './Scrappy'
import { centroid } from '../campus'

/** companion: a student currently walking with the player (lunch, studying, hanging out). */
export const community: { students:{id:StudentId;name:string;x:number;z:number;line:string}[];talking:StudentId|null;companion:StudentId|null } = { students:[],talking:null,companion:null }
export function CampusStudents({ campus, minute }: {campus:Campus;minute:number}) {
  const collider=useMemo(()=>new Collider(campus.buildings),[campus])
  const network=useMemo(()=>makePathNetwork(campus,collider),[campus,collider])
  const [x,z]=useMemo(()=>spawnPoint(campus),[campus])
  useEffect(()=>()=>{community.students=[]},[])
  return <><AmbientStudents campus={campus}/>{STUDENTS.map((s,i)=><LifeStudent key={s.id} profile={s} campus={campus} minute={minute} index={i} network={network} start={[x,z]}/>)}</>
}
function LifeStudent({profile,campus,minute,index,network,start}:{profile:StudentProfile;campus:Campus;minute:number;index:number;network:ReturnType<typeof makePathNetwork>;start:[number,number]}) {
  const [near,setNear]=useState(false)
  useEffect(()=>{const timer=setInterval(()=>setNear(Math.hypot(position.current[0]-player.x,position.current[1]-player.z)<7),300);return()=>clearInterval(timer)},[])
  const ref=useRef<THREE.Group>(null),walk=useRef(0), position=useRef<[number,number]>([start[0]+Math.sin(index*1.26)*3.5,start[1]+Math.cos(index*1.26)*3.5]), wait=useRef(index===0?14:4)
  const route=useRef<number[]>([]), lastDestination=useRef(''), scheduled=scheduleFor(profile,minute)
  const [repath,setRepath]=useState(0), following=useRef(false)
  useEffect(()=>{
    if(!network.largest.length || lastDestination.current===scheduled.code)return
    lastDestination.current=scheduled.code
    const target=campus.buildings.find(b=>b.code===scheduled.code);if(!target)return
    const [tx,tz]=centroid(target.poly),[x,z]=position.current
    const nearest=(px:number,pz:number)=>network.largest.reduce((best,i)=>Math.hypot(network.nodes[i][0]-px,network.nodes[i][1]-pz)<Math.hypot(network.nodes[best][0]-px,network.nodes[best][1]-pz)?i:best,network.largest[0])
    const from=nearest(x,z),to=nearest(tx,tz),queue=[from],parent=new Int32Array(network.nodes.length).fill(-1);parent[from]=from
    for(let q=0;q<queue.length&&parent[to]<0;q++)for(const n of network.edges[queue[q]])if(parent[n]<0){parent[n]=queue[q];queue.push(n)}
    const path:number[]=[];if(parent[to]>=0){let n=to;while(n!==from){path.unshift(n);n=parent[n]}path.unshift(from)}route.current=path
  },[scheduled.code,network,campus,repath])
  useFrame((_,raw)=>{
    const dt=Math.min(raw,.05); wait.current=Math.max(0,wait.current-dt)
    const conversing=community.talking===profile.id
    // Walking with the player: keep a step behind and to the side; catch up (or hop over) if left far behind.
    if(community.companion===profile.id&&!conversing){
      following.current=true
      const back=player.heading+Math.PI,gx=player.x+Math.sin(back)*1.6+Math.cos(back)*1.1,gz=player.z+Math.cos(back)*1.6-Math.sin(back)*1.1
      const dx=gx-position.current[0],dz=gz-position.current[1],d=Math.hypot(dx,dz)
      if(d>30){position.current=[gx,gz]}
      else if(d>.25){const step=Math.min(d,dt*(d>4?10:5.5));position.current[0]+=dx/d*step;position.current[1]+=dz/d*step;if(ref.current)ref.current.rotation.y=Math.atan2(dx,dz)}
      walk.current=THREE.MathUtils.lerp(walk.current,d>.25?.75:0,Math.min(1,dt*6))
      if(ref.current)ref.current.position.set(position.current[0],0,position.current[1])
      const e=community.students.find(s=>s.id===profile.id);if(e){e.x=position.current[0];e.z=position.current[1]}
      return
    }
    if(following.current){following.current=false;lastDestination.current='';route.current=[];setRepath(v=>v+1)}
    const next=conversing||wait.current>0?undefined:route.current[0]
    if(conversing&&ref.current)ref.current.rotation.y=Math.atan2(player.x-position.current[0],player.z-position.current[1])
    if(next!==undefined){const [tx,tz]=network.nodes[next],dx=tx-position.current[0],dz=tz-position.current[1],d=Math.hypot(dx,dz)
      if(d<.15)route.current.shift()
      else {const step=Math.min(d,dt*1.8);position.current[0]+=dx/d*step;position.current[1]+=dz/d*step;if(ref.current)ref.current.rotation.y=Math.atan2(dx,dz)}
    }
    walk.current=THREE.MathUtils.lerp(walk.current,next!==undefined?.7:0,Math.min(1,dt*6))
    if(ref.current)ref.current.position.set(position.current[0],0,position.current[1])
    const entry=community.students.find(s=>s.id===profile.id)
    if(entry){entry.x=position.current[0];entry.z=position.current[1]}else community.students.push({id:profile.id,name:profile.name,x:position.current[0],z:position.current[1],line:'Hello!'})
  })
  return <group ref={ref} onClick={event=>{event.stopPropagation();if(near)window.dispatchEvent(new CustomEvent('open-student',{detail:profile.id}))}} position={[...position.current.slice(0,1),0,position.current[1]] as [number,number,number]}><Character color={profile.color} headwear={index%2?'cap':'none'} face="happy" top="tee" topColor="#f4f0e6" bottom="shorts" shoes="sneakers" walk={walk} scale={1.15}/>{near&&<Html position={[0,2,0]} center distanceFactor={18}><button className="student-label" onClick={event=>{event.stopPropagation();window.dispatchEvent(new CustomEvent('open-student',{detail:profile.id}))}}>{profile.name}</button></Html>}</group>
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
      if(chosen.length>=340) break
    }
    // If paths are unusually sparse, use a closer spacing to keep the campus populated.
    if(chosen.length<340) for(const c of candidates) {
      const x=(c.a[0]+c.b[0])/2,z=(c.a[1]+c.b[1])/2
      if(chosen.every(p=>Math.hypot(x-(p.a[0]+p.b[0])/2,z-(p.a[1]+p.b[1])/2)>4)) chosen.push(c)
      if(chosen.length>=340) break
    }
    // Keep every walkable sidewalk segment for onward junction choices.
    const cells=new Map<string,{i:number;end:0|1}[]>()
    for(let i=0;i<candidates.length;i++) for(const end of [0,1] as const) {
      const p=end===0?candidates[i].a:candidates[i].b
      const key=Math.floor(p[0]/4)+','+Math.floor(p[1]/4)
      const list=cells.get(key)??[];list.push({i,end});cells.set(key,list)
    }
    const states=chosen.map(c=>({x:(c.a[0]+c.b[0])/2,z:(c.a[1]+c.b[1])/2,segment:candidates.indexOf(c),target:Math.random()<0.5?0:1,previous:-1}))
    const neighbors=(point:[number,number],current:number,previous:number)=>{
      const cx=Math.floor(point[0]/4),cz=Math.floor(point[1]/4),out:{i:number;end:0|1}[]=[]
      for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)for(const item of cells.get((cx+x)+','+(cz+z))??[]) {
        if(item.i===current || item.i===previous)continue
        const p=item.end===0?candidates[item.i].a:candidates[item.i].b
        if(Math.hypot(p[0]-point[0],p[1]-point[1])<2.5 && !collider.blocked((p[0]+point[0])/2,(p[1]+point[1])/2,0.7))out.push(item)
      }
      return out
    }
    return {states,candidates,neighbors}
  },[campus])
  const head=useRef<THREE.InstancedMesh>(null), body=useRef<THREE.InstancedMesh>(null)
  const left=useRef<THREE.InstancedMesh>(null),right=useRef<THREE.InstancedMesh>(null)
  const arms=useRef<THREE.InstancedMesh>(null), bareLegs=useRef<THREE.InstancedMesh>(null)
  const faces=useRef<(THREE.InstancedMesh|null)[]>([]), backpacks=useRef<THREE.InstancedMesh>(null)
  const hats=useRef<THREE.InstancedMesh>(null), brims=useRef<THREE.InstancedMesh>(null), bands=useRef<THREE.InstancedMesh>(null)
  const glasses=useRef<THREE.InstancedMesh>(null), skirts=useRef<THREE.InstancedMesh>(null), jerseys=useRef<THREE.InstancedMesh>(null)
  const jerseyTexture=useMemo(studentJersey,[])
  const faceTextures=useMemo(()=>[0,1,2,3].map(studentFace),[])
  const helper=useMemo(()=>new THREE.Object3D(),[])
  const base=useMemo(()=>new THREE.Matrix4(),[]), part=useMemo(()=>new THREE.Matrix4(),[])
  const palette=useMemo(()=>['#8ab1e8','#e9876b','#aecb91','#b9a5e0','#f2cc5f','#6f90c4'].map(c=>new THREE.Color(c)),[])
  const shirts=useMemo(()=>['#ece9df','#333638','#c6a231','#849276','#8790a9','#b394ac'].map(c=>new THREE.Color(c)),[])
  useEffect(()=>{
    walkers.states.forEach((_,i)=>{head.current?.setColorAt(i,palette[i%palette.length]);arms.current?.setColorAt(i*2,palette[i%palette.length]);arms.current?.setColorAt(i*2+1,palette[i%palette.length]);bareLegs.current?.setColorAt(i*2,palette[i%palette.length]);bareLegs.current?.setColorAt(i*2+1,palette[i%palette.length]);body.current?.setColorAt(i,shirts[(i*5)%shirts.length]);left.current?.setColorAt(i,new THREE.Color('#55586a'));right.current?.setColorAt(i,new THREE.Color('#55586a'));backpacks.current?.setColorAt(i,new THREE.Color(['#333b3b','#8b6e52','#dad1bd'][i%3]));hats.current?.setColorAt(i,new THREE.Color(['#f0e9da','#403d45','#6a503d','#d1b56a','#1e2225'][studentVariant(i)%5]));brims.current?.setColorAt(i,new THREE.Color(['#f0e9da','#403d45','#6a503d','#d1b56a','#1e2225'][studentVariant(i)%5]));bands.current?.setColorAt(i,new THREE.Color(['#e8ba36','#eee9dd','#9a83b5'][i%3]));skirts.current?.setColorAt(i,new THREE.Color(['#5f627b','#967e9e','#343b3c'][i%3]))})
    for(const mesh of [head.current,body.current,left.current,right.current,arms.current,bareLegs.current,backpacks.current,hats.current,brims.current,bands.current,skirts.current]) if(mesh?.instanceColor)mesh.instanceColor.needsUpdate=true
  },[walkers,palette,shirts])
  useFrame(({clock},delta)=>{
    if(!head.current || !body.current || !left.current || !right.current || !arms.current || !bareLegs.current || faces.current.some(x=>!x) || !backpacks.current || !hats.current || !brims.current || !bands.current || !glasses.current || !skirts.current || !jerseys.current)return
    walkers.states.forEach((person,i)=>{
      const path=walkers.candidates[person.segment]
      const goal=person.target===0?path.a:path.b
      let dx=goal[0]-person.x,dz=goal[1]-person.z, distance=Math.hypot(dx,dz)
      if(distance<0.13) {
        const options=walkers.neighbors(goal,person.segment,person.previous)
        if(options.length) {const next=options[Math.floor(Math.random()*options.length)];person.previous=person.segment;person.segment=next.i;person.target=next.end===0?1:0}
        else {person.previous=-1;person.target=person.target===0?1:0}
        const newPath=walkers.candidates[person.segment],newGoal=person.target===0?newPath.a:newPath.b
        dx=newGoal[0]-person.x;dz=newGoal[1]-person.z;distance=Math.hypot(dx,dz)
      }
      if(distance>0){const step=Math.min(distance,Math.min(delta,0.05)*(1.05+(i%5)*0.09));person.x+=dx/distance*step;person.z+=dz/distance*step}
      helper.position.set(person.x,0,person.z)
      helper.rotation.set(0,Math.atan2(dx,dz),0);helper.scale.setScalar(1);helper.updateMatrix();base.copy(helper.matrix)
      part.makeTranslation(0,1.13,0);head.current!.setMatrixAt(i,part.premultiply(base))
      part.makeTranslation(0,1.15,0.342);faces.current[i%4]?.setMatrixAt(Math.floor(i/4),part.premultiply(base))
      const style=studentVariant(i)%8
      helper.position.set(0,1.31,0);helper.rotation.set(0,0,0);helper.scale.set(style<=3?1:0,style===1?1.35:1,style<=3?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);hats.current!.setMatrixAt(i,part)
      helper.position.set(0,1.32,style===0?-.27:0);helper.rotation.set(0,0,0);helper.scale.set(style===0?1:style===2?1.45:0,1,style===0?1:style===2?1.45:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);brims.current!.setMatrixAt(i,part)
      helper.position.set(0,1.18,0);helper.rotation.set(Math.PI/2,0,0);helper.scale.setScalar(style===4?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);bands.current!.setMatrixAt(i,part)
      for(const [j,side] of [-1,1].entries()){helper.position.set(side*.12,1.17,.342);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%5===0?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);glasses.current!.setMatrixAt(i*2+j,part)}
      helper.position.set(0,.39,0);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%5===1?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);skirts.current!.setMatrixAt(i,part)
      helper.position.set(0,.68,.232);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%6===0?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);jerseys.current!.setMatrixAt(i,part)
      helper.position.set(0,.64,-.235);helper.rotation.set(0,0,0);helper.scale.setScalar(i%3===0?1:0);helper.updateMatrix()
      part.copy(helper.matrix).premultiply(base);backpacks.current!.setMatrixAt(i,part)
      part.makeTranslation(0,0.62,0);body.current!.setMatrixAt(i,part.premultiply(base))
      const swing=Math.sin(clock.elapsedTime*6+i)*0.05
      for(const [j,side] of [-1,1].entries()) {
        helper.position.set(side*.12,.20,swing*side);helper.rotation.set(0,0,0);helper.scale.set(1,studentVariant(i)%4===0?.7:1,1);helper.updateMatrix()
        part.copy(helper.matrix).premultiply(base);(j===0?left.current!:right.current!).setMatrixAt(i,part)
        helper.position.set(side*.12,.09,swing*side);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%4===0?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);bareLegs.current!.setMatrixAt(i*2+j,part)
      }
      for(const [j,side] of [-1,1].entries()) {
        helper.position.set(side*0.27,0.61,0);helper.rotation.set(swing*side*3,0,-side*0.22);helper.scale.setScalar(1);helper.updateMatrix()
        part.copy(helper.matrix).premultiply(base);arms.current!.setMatrixAt(i*2+j,part)
      }
    })
    for(const mesh of [head.current,body.current,left.current,right.current,arms.current,bareLegs.current,...faces.current,backpacks.current,hats.current,brims.current,bands.current,glasses.current,skirts.current,jerseys.current])if(mesh)mesh.instanceMatrix.needsUpdate=true
  })
  const n=walkers.states.length
  return <group>
    <instancedMesh ref={head} args={[undefined,undefined,n]} frustumCulled={false}><sphereGeometry args={[0.34,12,10]}/><meshStandardMaterial roughness={0.9}/></instancedMesh>
    {faceTextures.map((texture,k)=><instancedMesh key={k} ref={m=>{faces.current[k]=m}} args={[undefined,undefined,Math.ceil((n-k)/4)]} frustumCulled={false}><planeGeometry args={[0.42,0.36]}/><meshBasicMaterial map={texture} transparent alphaTest={0.05} depthWrite={false}/></instancedMesh>)}
    <instancedMesh ref={hats} args={[undefined,undefined,n]} frustumCulled={false}><sphereGeometry args={[.35,12,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={brims} args={[undefined,undefined,n]} frustumCulled={false}><cylinderGeometry args={[.25,.25,.035,12]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={bands} args={[undefined,undefined,n]} frustumCulled={false}><torusGeometry args={[.337,.035,5,16]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={glasses} args={[undefined,undefined,n*2]} frustumCulled={false}><torusGeometry args={[.075,.012,5,12]}/><meshStandardMaterial color="#24242a"/></instancedMesh>
    <instancedMesh ref={skirts} args={[undefined,undefined,n]} frustumCulled={false}><cylinderGeometry args={[.19,.29,.22,12]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={jerseys} args={[undefined,undefined,n]} frustumCulled={false}><planeGeometry args={[.28,.14]}/><meshBasicMaterial map={jerseyTexture} transparent alphaTest={.05} depthWrite={false}/></instancedMesh>
    <instancedMesh ref={backpacks} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.15,0.14,4,8]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={body} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.23,0.18,4,10]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
    <instancedMesh ref={left} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.1,0.14,4,8]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
    <instancedMesh ref={right} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[0.1,0.14,4,8]}/><meshStandardMaterial roughness={0.95}/></instancedMesh>
    <instancedMesh ref={bareLegs} args={[undefined,undefined,n*2]} frustumCulled={false}><capsuleGeometry args={[.075,.08,4,8]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
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

