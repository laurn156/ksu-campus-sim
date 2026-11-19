import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Collider, type Campus, type Pt } from '../campus'

// Shared position lets the HUD locate the mascot at the instant the menu is used.
export const scrappy = { x: -105, z: -197 }

function makeFace() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512
  const g = c.getContext('2d')!
  // White feathered cheek patches wrap around a dark owl mask.
  g.fillStyle = '#f0eee4'
  g.beginPath(); g.moveTo(60,155); g.quadraticCurveTo(24,350,256,455); g.quadraticCurveTo(488,350,452,155); g.lineTo(383,204); g.quadraticCurveTo(376,327,256,390); g.quadraticCurveTo(136,327,129,204); g.closePath(); g.fill()
  g.fillStyle = '#e7b619'
  for (const side of [-1,1]) {
    g.save(); g.translate(256,0); g.scale(side,1)
    g.beginPath(); g.moveTo(24,156); g.lineTo(205,84); g.quadraticCurveTo(169,158,79,185); g.closePath(); g.fill()
    // eyes sit inside the black mask rather than on round white eyeballs
    g.fillStyle = '#d6ad48'; g.beginPath(); g.ellipse(80,205,20,13,-0.25,0,Math.PI*2); g.fill()
    g.fillStyle = '#121313'; g.beginPath(); g.ellipse(80,205,9,11,0,0,Math.PI*2); g.fill()
    g.fillStyle = '#e7b619'; g.restore()
  }
  g.fillStyle = '#eab816'; g.beginPath(); g.moveTo(256,195); g.bezierCurveTo(182,202,186,276,256,289); g.bezierCurveTo(326,276,330,202,256,195); g.fill()
  g.fillStyle = '#292723'; g.beginPath(); g.moveTo(205,276); g.quadraticCurveTo(256,309,307,276); g.quadraticCurveTo(288,344,256,348); g.quadraticCurveTo(224,344,205,276); g.fill()
  g.fillStyle = '#f2c52b'; g.beginPath(); g.moveTo(222,300); g.quadraticCurveTo(256,320,290,300); g.lineTo(256,329); g.closePath(); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function makeShirt() {
  const c=document.createElement('canvas'); c.width=512; c.height=240
  const g=c.getContext('2d')!; g.fillStyle='#151515'; g.fillRect(20,25,472,180)
  g.strokeStyle='#f4efe0'; g.lineWidth=10; g.strokeRect(20,25,472,180)
  g.fillStyle='#f4c326'; g.textAlign='center'; g.font='bold 76px sans-serif'; g.fillText('KENNESAW',256,107)
  g.fillStyle='#fff'; g.font='bold 60px sans-serif'; g.fillText('STATE OWLS',256,176)
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t
}

export function Scrappy({ campus }: { campus: Campus }) {
  const group = useRef<THREE.Group>(null)
  const legs = useRef<THREE.Group>(null)
  const target = useRef<Pt | null>(null)
  const face = useMemo(makeFace, [])
  const shirt = useMemo(makeShirt, [])
  const collider = useMemo(() => new Collider(campus.buildings), [campus])
  const points = useMemo(() => campus.paths.flatMap(p => p.pts).filter(([x,z]) => x > -400 && x < 220 && z > -300 && z < 220 && !collider.blocked(x,z,1)), [campus, collider])
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05)
    if (!target.current || Math.hypot(target.current[0]-scrappy.x,target.current[1]-scrappy.z)<1.2) {
      const nearby = points.filter(([x,z]) => { const d=Math.hypot(x-scrappy.x,z-scrappy.z); return d>8 && d<32 })
      target.current = nearby[Math.floor(Math.random()*nearby.length)] ?? null
    }
    if (target.current) {
      const dx=target.current[0]-scrappy.x, dz=target.current[1]-scrappy.z, len=Math.hypot(dx,dz)||1
      const nx=scrappy.x+dx/len*2*dt, nz=scrappy.z+dz/len*2*dt
      if (!collider.blocked(nx,nz,0.6)) { scrappy.x=nx; scrappy.z=nz } else target.current=null
      if (group.current) group.current.rotation.y=Math.atan2(dx,dz)
    }
    if (group.current) group.current.position.set(scrappy.x,0,scrappy.z)
    if (legs.current) legs.current.rotation.z=Math.sin(clock.elapsedTime*7)*0.12
  })
  return <group ref={group} scale={1.35}>
    {/* Black furry legs, gold shorts and broad gold-soled sneakers. */}
    <group ref={legs}>
      {[-0.23,0.23].map(x => <group key={x} position={[x,0,0]}>
        <mesh position={[0,0.34,0]}><capsuleGeometry args={[0.12,0.36,4,8]} /><meshStandardMaterial color="#161616" /></mesh>
        <mesh position={[0,0.12,0.12]}><boxGeometry args={[0.34,0.22,0.5]} /><meshStandardMaterial color="#171717" /></mesh>
        <mesh position={[0,0.035,0.12]}><boxGeometry args={[0.36,0.07,0.52]} /><meshStandardMaterial color="#e8ae13" /></mesh>
        <mesh position={[0,0.59,0]}><boxGeometry args={[0.4,0.37,0.46]} /><meshStandardMaterial color="#edb818" /></mesh>
        <mesh position={[0,0.4,0]}><boxGeometry args={[0.4,0.045,0.47]} /><meshStandardMaterial color="#f3eee2" /></mesh>
      </group>)}
    </group>
    {/* Loose yellow shirt, white hem, black arms and gold shoulder sleeves. */}
    <mesh position={[0,1.05,0]} castShadow><boxGeometry args={[0.94,0.74,0.56]} /><meshStandardMaterial color="#f2ba16" /></mesh>
    <mesh position={[0,0.7,0]}><boxGeometry args={[0.96,0.065,0.57]} /><meshStandardMaterial color="#f5eee0" /></mesh>
    {[-1,1].map(side => <group key={side}>
      <mesh position={[side*0.56,1.23,0]} rotation={[0,0,side*0.5]}><capsuleGeometry args={[0.15,0.2,4,8]} /><meshStandardMaterial color="#f0b917" /></mesh>
      <mesh position={[side*0.66,0.98,0]} rotation={[0,0,side*0.3]}><capsuleGeometry args={[0.13,0.38,4,8]} /><meshStandardMaterial color="#151515" /></mesh>
    </group>)}
    {/* A single illustrated mask avoids protruding, staring eyes. */}
    <mesh position={[0,1.82,0]} castShadow><sphereGeometry args={[0.59,24,18]} /><meshStandardMaterial color="#101111" /></mesh>
    {[-1,1].map(side => <mesh key={side} position={[side*0.4,2.24,0]} rotation={[0,0,-side*0.55]}><coneGeometry args={[0.19,0.34,5]} /><meshStandardMaterial color="#101111" /></mesh>)}
    <mesh position={[0,1.82,0.535]}><planeGeometry args={[1.05,1.0]} /><meshBasicMaterial map={face} transparent alphaTest={0.05} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0,1.08,0.286]}><planeGeometry args={[0.68,0.32]} /><meshBasicMaterial map={shirt} transparent alphaTest={0.05} /></mesh>
  </group>
}
