import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { bbox, Collider, pointInPoly, type Campus, type Pt } from '../campus'
import { Character } from '../characters/Character'

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
    const pathsForParking=campus.paths.flatMap(p=>p.pts)
    const parkingRoutes:Route[]=[]
    for(const lot of campus.areas.filter(a=>a.kind==='parking' && a.a>400)) {
      const [x0,z0,x1,z1]=bbox(lot.poly)
      let point:Pt|null=null
      for(let x=x0+3;x<x1 && !point;x+=5)for(let z=z0+3;z<z1 && !point;z+=5)if(pointInPoly(x,z,lot.poly)&&pointInPoly(x,z,campus.boundary)&&!collider.blocked(x,z,1))point=[x,z]
      if(!point)continue
      const choices=pathsForParking.map(p=>({p,d:Math.hypot(p[0]-point![0],p[1]-point![1])})).filter(p=>p.d>6&&p.d<70).sort((a,b)=>a.d-b.d)
      const choice=choices.find(c=>usable([c.p,point!],collider))
      if(choice)parkingRoutes.push([choice.p,point])
      if(parkingRoutes.length>=14)break
    }
    return {roads,paths:selected,parkingRoutes}
  },[campus])
}

function TrafficMover({path,index,speed,kind,children}:{path:Route;index:number;speed:number;kind:'road'|'path'|'parking';children:React.ReactNode}) {
  const ref=useRef<THREE.Group>(null)
  const len=useMemo(()=>routeLength(path),[path])
  useFrame(({clock})=>{
    if(!ref.current||len<=0)return
    const phase=(clock.elapsedTime*speed+index*len*0.29)%(len*2)
    const forward=phase<len, loc=positionAlong(path,forward?phase:len*2-phase)
    if(!loc)return
    const dir=forward?1:-1, offset=kind==='road'?1.45:0
    ref.current.position.set(loc.x+loc.dz*offset*dir,0,loc.z-loc.dx*offset*dir)
    ref.current.rotation.y=Math.atan2(loc.dx*dir,loc.dz*dir)
  })
  return <group ref={ref}>{children}</group>
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
  const colors=['blue','orange','green','purple','yellow','slate'] as const
  return <group>
    {kind==='bike' && <group><Wheel z={-.65}/><Wheel z={.65}/><Rod a={[0,.34,-.65]} b={[0,.38,0]} color="#e2b529"/><Rod a={[0,.38,0]} b={[0,.34,.65]} color="#e2b529"/><Rod a={[0,.34,-.65]} b={[0,.85,-.18]} color="#e2b529"/><Rod a={[0,.85,-.18]} b={[0,.34,.65]} color="#e2b529"/><Rod a={[0,.34,.65]} b={[0,1.05,.55]}/><Rod a={[-.3,1.05,.55]} b={[.3,1.05,.55]}/><mesh position={[0,.86,-.18]}><boxGeometry args={[.27,.06,.3]}/><meshStandardMaterial color="#242424"/></mesh></group>}
    {kind==='scooter' && <group><Wheel z={-.47} r={.15}/><Wheel z={.5} r={.15}/><mesh position={[0,.19,0]}><boxGeometry args={[.26,.08,.95]}/><meshStandardMaterial color="#c4bdad"/></mesh><Rod a={[0,.2,.48]} b={[0,1.12,.43]}/><Rod a={[-.27,1.12,.43]} b={[.27,1.12,.43]}/></group>}
    {kind==='skate' && <group><mesh position={[0,.13,0]}><boxGeometry args={[.3,.08,.95]}/><meshStandardMaterial color="#b98145"/></mesh>{[-.33,.33].flatMap(z=>[-.14,.14].map(x=><mesh key={x+','+z} position={[x,.08,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.07,.07,.06,10]}/><meshStandardMaterial color="#d5d4c8"/></mesh>))}</group>}
    <group position={[0,kind==='bike'?.46:.18,kind==='bike'?-.13:0]} scale={.8}><Character color={colors[index%colors.length]} headwear={index%2?'cap':'none'} face="happy" top="tee" topColor="#eee9dd" bottom="pants" bottomColor="#55586a" shoes="sneakers"/></group>
  </group>
}
export function Traffic({campus}:{campus:Campus}) {
  const {roads,paths,parkingRoutes}=useTrafficRoutes(campus)
  const colors=['#dbded9','#314e67','#a13b35','#6d7371','#d1bd96']
  return <>
    {Array.from({length:Math.min(5,roads.length*2)},(_,i)=>{const path=roads[i%roads.length];return <TrafficMover key={'car'+i} path={path} index={i} speed={8+i%3} kind="road"><Car color={colors[i%colors.length]}/></TrafficMover>})}
    {parkingRoutes.map((path,i)=><TrafficMover key={'parking'+i} path={path} index={i} speed={1.2} kind="parking"><ParkingWalker index={i}/></TrafficMover>)}
    {Array.from({length:Math.min(9,paths.length)},(_,i)=><TrafficMover key={'rider'+i} path={paths[i]} index={i} speed={i%3===0?3.5:2.4} kind="path"><Rider kind={(['bike','skate','scooter'] as const)[i%3]} index={i}/></TrafficMover>)}
  </>
}
function ParkingWalker({index}:{index:number}) {
  const walk=useRef(.7)
  return <Character color={(['green','blue','orange','purple'] as const)[index%4]} headwear="none" face="happy" top="tee" topColor="#f0eee6" bottom="pants" bottomColor="#55586a" shoes="sneakers" walk={walk} scale={1.05}/>
}

