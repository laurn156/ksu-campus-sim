import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { studentFace, studentVariant, studentJersey } from './studentFace'
import { bbox, Collider, pointInPoly, type Campus, type Pt } from '../campus'
import { protectedShuttle, trafficStopAction } from './trafficSafety'

type Route = Pt[]
function positionAlong(path:Route, distance:number) {
  let d=distance
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1])
    if(length<0.01)continue
    if(d<=length){const t=d/length;return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length}}
    d-=length
  }
  return null
}
function routeLength(path:Route) {return path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0)}
function usable(path:Route,collider:Collider) {
  for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3)
    for(let j=0;j<=n;j++) if(collider.blocked(a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,0.7))return false
  }
  return true
}
function useTrafficRoutes(campus:Campus) {
  return useMemo(()=>{
    const collider=new Collider(campus.buildings)
    const roads=campus.roads.filter(r=>r.kind==='unclassified' && routeLength(r.pts)>80 && r.pts.some(([x,z])=>pointInPoly(x,z,campus.boundary))).map(r=>r.pts).sort((a,b)=>routeLength(b)-routeLength(a))
    const paths=campus.paths.map(p=>p.pts).filter(p=>routeLength(p)>20 && routeLength(p)<180 && p.length>=2 && p.every(([x,z])=>pointInPoly(x,z,campus.boundary)) && usable(p,collider))
    const selected:Route[]=[]
    for(const path of paths) {
      const [x,z]=path[Math.floor(path.length/2)]
      if(selected.every(p=>Math.hypot(x-p[Math.floor(p.length/2)][0],z-p[Math.floor(p.length/2)][1])>35))selected.push(path)
    }
    // Shuffle the spatially separated routes so consecutive rider types aren't clustered.
    let seed=7319
    for(let i=selected.length-1;i>0;i--){seed=(seed*16807)%2147483647;const j=seed%(i+1);[selected[i],selected[j]]=[selected[j],selected[i]]}
    const pathsForParking=campus.paths.flatMap(p=>p.pts)
    const parkingRoutes:Route[]=[]
    for(const lot of campus.areas.filter(a=>a.kind==='parking' && a.a>400)) {
      const [x0,z0,x1,z1]=bbox(lot.poly), candidates:Pt[]=[]
      // Sample across the lot, not just its first corner, so pedestrians are visible among cars.
      for(let x=x0+3;x<x1;x+=8)for(let z=z0+3;z<z1;z+=8)
        if(pointInPoly(x,z,lot.poly)&&pointInPoly(x,z,campus.boundary)&&!collider.blocked(x,z,1))candidates.push([x,z])
      if(candidates.length<2)continue
      const starts=[0,Math.floor(candidates.length*.33),Math.floor(candidates.length*.66)]
      for(const index of starts) {
        const start=candidates[index]
        const finish=candidates.find((p,j)=>j!==index && Math.hypot(p[0]-start[0],p[1]-start[1])>=12 && Math.hypot(p[0]-start[0],p[1]-start[1])<=32 && [0.25,.5,.75].every(t=>pointInPoly(start[0]+(p[0]-start[0])*t,start[1]+(p[1]-start[1])*t,lot.poly)) && usable([start,p],collider))
        if(finish)parkingRoutes.push([start,finish])
      }
      // Also connect a campus path to the lot for pedestrians arriving and leaving.
      const point=candidates[Math.floor(candidates.length/2)]
      const choices=pathsForParking.map(p=>({p,d:Math.hypot(p[0]-point[0],p[1]-point[1])})).filter(p=>p.d>6&&p.d<70).sort((a,b)=>a.d-b.d)
      const choice=choices.find(c=>usable([c.p,point],collider))
      if(choice)parkingRoutes.push([choice.p,point])
    }
    return {roads,paths:selected,parkingRoutes}
  },[campus])
}

function TrafficMover({path,index,speed,kind,children}:{path:Route;index:number;speed:number;kind:'road'|'path'|'parking';children:React.ReactNode}) {
  const ref=useRef<THREE.Group>(null)
  const len=useMemo(()=>routeLength(path),[path]),progress=useRef(index*len*.29),initialized=useRef(false)
  useFrame((_,dt)=>{
    if(!ref.current||len<=0)return
    const nextProgress=progress.current+Math.min(dt,.05)*speed,phase=nextProgress%(len*2)
    const forward=phase<len,loc=positionAlong(path,forward?phase:len*2-phase)
    if(!loc)return
    const dir=forward?1:-1,offset=kind==='road'?1.45:0,x=loc.x+loc.dz*offset*dir,z=loc.z-loc.dx*offset*dir
    const nextDistance=Math.hypot(x-protectedShuttle.x,z-protectedShuttle.z),currentDistance=initialized.current?Math.hypot(ref.current.position.x-protectedShuttle.x,ref.current.position.z-protectedShuttle.z):nextDistance
    const action=kind==='road'?trafficStopAction(protectedShuttle.active,currentDistance,nextDistance):'move'
    if(action==='hold')return
    progress.current=nextProgress;initialized.current=true;ref.current.visible=action!=='clear'
    ref.current.position.set(x,0,z);ref.current.rotation.y=Math.atan2(loc.dx*dir,loc.dz*dir)
  })
  return <group ref={ref} visible={false}>{children}</group>
}
function Car({color}:{color:string}) {
  return <group>
    <mesh position={[0,0.64,0]} castShadow><boxGeometry args={[1.8,0.75,4.1]}/><meshStandardMaterial color={color} roughness={0.55}/></mesh>
    <mesh position={[0,1.17,-0.15]}><boxGeometry args={[1.55,0.65,2.15]}/><meshStandardMaterial color="#52656c" roughness={0.35}/></mesh>
    {[-1,1].flatMap(x=>[-1.3,1.3].map(z=><mesh key={x+','+z} position={[x*0.87,0.36,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.35,0.35,0.18,12]}/><meshStandardMaterial color="#252625"/></mesh>))}
    <mesh position={[0,0.65,2.06]}><boxGeometry args={[1.3,0.14,0.04]}/><meshStandardMaterial color="#eee2ad"/></mesh>
  </group>
}
function Rod({a,b,color='#363b3a',radius=0.035}:{a:[number,number,number];b:[number,number,number];color?:string;radius?:number}) {
  const data=useMemo(()=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mid=start.clone().add(end).multiplyScalar(.5),dir=end.clone().sub(start);return {mid,len:dir.length(),q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize())}},[a,b])
  return <mesh position={data.mid} quaternion={data.q}><cylinderGeometry args={[radius,radius,data.len,8]}/><meshStandardMaterial color={color}/></mesh>
}
function Wheel({z,r=.34}:{z:number;r?:number}) {
  return <group position={[0,r,z]}><mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[r-.035,.035,8,20]}/><meshStandardMaterial color="#252829"/></mesh><Rod a={[-.09,0,0]} b={[.09,0,0]} color="#c5c5bc" radius={.025}/></group>
}
function Rider({kind,index}:{kind:'bike'|'scooter'|'skate';index:number}) {
  const colors=['#8ab1e8','#e9876b','#aecb91','#b9a5e0','#f2cc5f','#6f90c4'] as const
  return <group>
    {kind==='bike' && <group><Wheel z={-.65}/><Wheel z={.65}/><Rod a={[0,.34,-.65]} b={[0,.38,0]} color="#e2b529"/><Rod a={[0,.38,0]} b={[0,.34,.65]} color="#e2b529"/><Rod a={[0,.34,-.65]} b={[0,.85,-.18]} color="#e2b529"/><Rod a={[0,.85,-.18]} b={[0,.34,.65]} color="#e2b529"/><Rod a={[0,.34,.65]} b={[0,1.05,.55]}/><Rod a={[-.3,1.05,.55]} b={[.3,1.05,.55]}/><mesh position={[0,.86,-.18]}><boxGeometry args={[.27,.06,.3]}/><meshStandardMaterial color="#242424"/></mesh></group>}
    {kind==='scooter' && <group><Wheel z={-.47} r={.15}/><Wheel z={.5} r={.15}/><mesh position={[0,.19,0]}><boxGeometry args={[.26,.08,.95]}/><meshStandardMaterial color="#c4bdad"/></mesh><Rod a={[0,.2,.48]} b={[0,1.12,.43]}/><Rod a={[-.27,1.12,.43]} b={[.27,1.12,.43]}/></group>}
    {kind==='skate' && <group><mesh position={[0,.13,0]}><boxGeometry args={[.3,.08,.95]}/><meshStandardMaterial color="#b98145"/></mesh>{[-.33,.33].flatMap(z=>[-.14,.14].map(x=><mesh key={x+','+z} position={[x,.08,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.07,.07,.06,10]}/><meshStandardMaterial color="#d5d4c8"/></mesh>))}</group>}
    <group position={[0,kind==='bike'?.46:.18,kind==='bike'?-.13:0]} scale={.8}><SimplePerson color={colors[index%colors.length]} walking={false} backpack={index%3===0} index={index}/></group>
  </group>
}
export function Traffic({campus}:{campus:Campus}) {
  const {roads,paths,parkingRoutes}=useTrafficRoutes(campus)
  const colors=['#dbded9','#314e67','#a13b35','#6d7371','#d1bd96']
  return <>
    {Array.from({length:Math.min(13,roads.length*2)},(_,i)=>{const path=roads[i%roads.length];return <TrafficMover key={'car'+i} path={path} index={i} speed={8+i%3} kind="road"><Car color={colors[i%colors.length]}/></TrafficMover>})}
    <ParkingCrowd routes={parkingRoutes}/>
    {Array.from({length:Math.min(30,paths.length)},(_,i)=><TrafficMover key={'rider'+i} path={paths[i]} index={i} speed={i%3===0?3.5:2.4} kind="path"><Rider kind={(['bike','skate','scooter'] as const)[i%3]} index={i}/></TrafficMover>)}
  </>
}
const personHead = new THREE.SphereGeometry(.29,12,10)
const personBody = new THREE.CapsuleGeometry(.20,.16,4,10)
const personLimb = new THREE.CapsuleGeometry(.075,.12,4,8)
const shirtMaterial = new THREE.MeshStandardMaterial({color:'#eee9dd',roughness:.95})
const pantsMaterial = new THREE.MeshStandardMaterial({color:'#55586a',roughness:.95})
function SimplePerson({color,walking,backpack,index}:{color:string;walking:boolean;backpack:boolean;index:number}) {
  const left=useRef<THREE.Mesh>(null),right=useRef<THREE.Mesh>(null)
  const skin=useMemo(()=>new THREE.MeshStandardMaterial({color,roughness:.9}),[color])
  const face=useMemo(()=>studentFace(index%4),[index])
  const jersey=useMemo(studentJersey,[])
  const style=studentVariant(index)%8
  useFrame(({clock})=>{if(walking && left.current && right.current){const swing=Math.sin(clock.elapsedTime*6)*.35;left.current.rotation.x=swing;right.current.rotation.x=-swing}})
  return <group>
    <mesh position={[0,1.12,0]} geometry={personHead} material={skin}/>
    {style<4 && <mesh position={[0,1.27,0]} scale={[1,style===1?1.3:1,1]}><sphereGeometry args={[.30,12,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={['#eee9dc','#35343b','#624936','#c9ae78'][style]}/></mesh>}
    {(style===0||style===2) && <mesh position={[0,1.28,style===0?-.23:0]}><cylinderGeometry args={[.22,.22,.03,12]}/><meshStandardMaterial color="#e4dbc8"/></mesh>}
    {style===4 && <mesh position={[0,1.17,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.29,.025,5,16]}/><meshStandardMaterial color="#d4a82f"/></mesh>}
    {studentVariant(index)%5===0 && [-1,1].map(side=><mesh key={side} position={[side*.105,1.15,.295]}><torusGeometry args={[.07,.01,5,12]}/><meshStandardMaterial color="#262629"/></mesh>)}
    <mesh position={[0,1.13,.292]}><planeGeometry args={[.36,.31]}/><meshBasicMaterial map={face} transparent alphaTest={.05} depthWrite={false}/></mesh>
    {backpack && <mesh position={[0,.65,-.22]} scale={[1,1,.65]}><capsuleGeometry args={[.14,.13,4,8]}/><meshStandardMaterial color="#554a42" roughness={.95}/></mesh>}
    <mesh position={[0,.63,0]} geometry={personBody} material={shirtMaterial}/>
    {studentVariant(index)%6===0 && <mesh position={[0,.67,.205]}><planeGeometry args={[.26,.13]}/><meshBasicMaterial map={jersey} transparent alphaTest={.05} depthWrite={false}/></mesh>}
    {studentVariant(index)%5===1 && <mesh position={[0,.38,0]}><cylinderGeometry args={[.17,.25,.2,12]}/><meshStandardMaterial color="#75607f"/></mesh>}
    {[-1,1].map(side=><mesh key={side} position={[side*.25,.63,0]} rotation={[0,0,-side*.2]} geometry={personLimb} material={skin}/>)}
    <mesh ref={left} position={[-.1,.2,0]} geometry={personLimb} material={pantsMaterial}/>
    <mesh ref={right} position={[.1,.2,0]} geometry={personLimb} material={pantsMaterial}/>
  </group>
}
function ParkingCrowd({routes}:{routes:Route[]}) {
  const heads=useRef<THREE.InstancedMesh>(null), faces=useRef<(THREE.InstancedMesh|null)[]>([])
  const bodies=useRef<THREE.InstancedMesh>(null), limbs=useRef<THREE.InstancedMesh>(null), bags=useRef<THREE.InstancedMesh>(null)
  const faceTextures=useMemo(()=>[0,1,2,3].map(studentFace),[]), jerseyTexture=useMemo(studentJersey,[]), helper=useMemo(()=>new THREE.Object3D(),[])
  const hats=useRef<THREE.InstancedMesh>(null),brims=useRef<THREE.InstancedMesh>(null),bands=useRef<THREE.InstancedMesh>(null),glasses=useRef<THREE.InstancedMesh>(null),skirts=useRef<THREE.InstancedMesh>(null),jerseys=useRef<THREE.InstancedMesh>(null)
  const base=useMemo(()=>new THREE.Matrix4(),[]), part=useMemo(()=>new THREE.Matrix4(),[])
  const journeys=useMemo(()=>routes.flatMap((path,i)=>[0,1].map(j=>({path,length:routeLength(path),index:i*2+j,speed:1.05+j*.12}))),[routes])
  const colors=useMemo(()=>['#aecb91','#8ab1e8','#e9876b','#b9a5e0','#f2cc5f'].map(c=>new THREE.Color(c)),[])
  useEffect(()=>{
    journeys.forEach((_,i)=>{heads.current?.setColorAt(i,colors[i%colors.length]);bodies.current?.setColorAt(i,new THREE.Color(['#eee9dd','#323638','#aab698'][i%3]));bags.current?.setColorAt(i,new THREE.Color(['#554a42','#292c2b','#c8bfaa'][i%3]));hats.current?.setColorAt(i,new THREE.Color(['#ede5d7','#37353b','#6e503b','#d2b56c'][studentVariant(i)%4]));brims.current?.setColorAt(i,new THREE.Color(['#ede5d7','#37353b','#6e503b','#d2b56c'][studentVariant(i)%4]));skirts.current?.setColorAt(i,new THREE.Color(['#685f77','#5d667c','#464646'][i%3]))})
    for(const mesh of [heads.current,bodies.current,bags.current,hats.current,brims.current,skirts.current])if(mesh?.instanceColor)mesh.instanceColor.needsUpdate=true
  },[journeys,colors])
  useFrame(({clock})=>{
    if(!heads.current||faces.current.some(m=>!m)||!bodies.current||!limbs.current||!bags.current||!hats.current||!brims.current||!bands.current||!glasses.current||!skirts.current||!jerseys.current)return
    journeys.forEach((journey,i)=>{
      const {path,length,index,speed}=journey;if(!length)return
      const phase=(clock.elapsedTime*speed+index*length*.29)%(length*2),forward=phase<length
      const pos=positionAlong(path,forward?phase:length*2-phase);if(!pos)return
      const dir=forward?1:-1
      helper.position.set(pos.x,0,pos.z);helper.rotation.set(0,Math.atan2(pos.dx*dir,pos.dz*dir),0);helper.scale.setScalar(1);helper.updateMatrix();base.copy(helper.matrix)
      part.makeTranslation(0,1.12,0);heads.current!.setMatrixAt(i,part.premultiply(base))
      part.makeTranslation(0,1.13,.292);faces.current[i%4]?.setMatrixAt(Math.floor(i/4),part.premultiply(base))
      const style=studentVariant(i)%8
      helper.position.set(0,1.27,0);helper.rotation.set(0,0,0);helper.scale.set(style<4?1:0,style===1?1.3:1,style<4?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);hats.current!.setMatrixAt(i,part)
      helper.position.set(0,1.28,style===0?-.23:0);helper.rotation.set(0,0,0);helper.scale.setScalar(style===0||style===2?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);brims.current!.setMatrixAt(i,part)
      helper.position.set(0,1.17,0);helper.rotation.set(Math.PI/2,0,0);helper.scale.setScalar(style===4?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);bands.current!.setMatrixAt(i,part)
      for(const [j,side] of [-1,1].entries()){helper.position.set(side*.105,1.15,.295);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%5===0?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);glasses.current!.setMatrixAt(i*2+j,part)}
      helper.position.set(0,.38,0);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%5===1?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);skirts.current!.setMatrixAt(i,part)
      helper.position.set(0,.67,.205);helper.rotation.set(0,0,0);helper.scale.setScalar(studentVariant(i)%6===0?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);jerseys.current!.setMatrixAt(i,part)
      part.makeTranslation(0,.63,0);bodies.current!.setMatrixAt(i,part.premultiply(base))
      helper.position.set(0,.65,-.22);helper.rotation.set(0,0,0);helper.scale.setScalar(i%3===0?1:0);helper.updateMatrix();part.copy(helper.matrix).premultiply(base);bags.current!.setMatrixAt(i,part)
      const swing=Math.sin(clock.elapsedTime*6+i)*.05
      for(let k=0;k<4;k++){
        const arm=k>=2,side=k%2===0?-1:1
        helper.position.set(side*(arm?.25:.10),arm?.63:.20,arm?0:swing*side);helper.rotation.set(0,0,arm?-side*.2:0);helper.scale.setScalar(1);helper.updateMatrix()
        part.copy(helper.matrix).premultiply(base);limbs.current!.setMatrixAt(i*4+k,part)
      }
    })
    for(const m of [heads.current,...faces.current,bodies.current,limbs.current,bags.current,hats.current,brims.current,bands.current,glasses.current,skirts.current,jerseys.current])if(m)m.instanceMatrix.needsUpdate=true
  })
  const n=journeys.length
  return <group>
    <instancedMesh ref={heads} args={[undefined,undefined,n]} frustumCulled={false}><sphereGeometry args={[.29,12,10]}/><meshStandardMaterial roughness={.9}/></instancedMesh>
    {faceTextures.map((texture,k)=><instancedMesh key={k} ref={m=>{faces.current[k]=m}} args={[undefined,undefined,Math.ceil((n-k)/4)]} frustumCulled={false}><planeGeometry args={[.36,.31]}/><meshBasicMaterial map={texture} transparent alphaTest={.05} depthWrite={false}/></instancedMesh>)}
    <instancedMesh ref={hats} args={[undefined,undefined,n]} frustumCulled={false}><sphereGeometry args={[.30,12,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={brims} args={[undefined,undefined,n]} frustumCulled={false}><cylinderGeometry args={[.22,.22,.03,12]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={bands} args={[undefined,undefined,n]} frustumCulled={false}><torusGeometry args={[.29,.025,5,16]}/><meshStandardMaterial color="#d4a82f"/></instancedMesh>
    <instancedMesh ref={glasses} args={[undefined,undefined,n*2]} frustumCulled={false}><torusGeometry args={[.07,.01,5,12]}/><meshStandardMaterial color="#24242a"/></instancedMesh>
    <instancedMesh ref={skirts} args={[undefined,undefined,n]} frustumCulled={false}><cylinderGeometry args={[.17,.25,.2,12]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={jerseys} args={[undefined,undefined,n]} frustumCulled={false}><planeGeometry args={[.26,.13]}/><meshBasicMaterial map={jerseyTexture} transparent alphaTest={.05} depthWrite={false}/></instancedMesh>
    <instancedMesh ref={bodies} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[.20,.16,4,10]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={limbs} args={[undefined,undefined,n*4]} frustumCulled={false}><capsuleGeometry args={[.075,.12,4,8]}/><meshStandardMaterial color="#657080" roughness={.95}/></instancedMesh>
    <instancedMesh ref={bags} args={[undefined,undefined,n]} frustumCulled={false}><capsuleGeometry args={[.14,.13,4,8]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
  </group>
}
