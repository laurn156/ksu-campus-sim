import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Collider, type Campus, type Pt } from '../campus'

// Shared position lets the HUD locate the mascot at the instant the menu is used.
export const scrappy = { x: -105, z: -197 }

export function Scrappy({ campus }: { campus: Campus }) {
  const group = useRef<THREE.Group>(null)
  const legs = useRef<THREE.Group>(null)
  const target = useRef<Pt | null>(null)
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
    <group ref={legs}>
      {[-0.27,0.27].map(x => <group key={x} position={[x,0,0]}><mesh position={[0,0.25,0]}><boxGeometry args={[0.28,0.5,0.3]} /><meshStandardMaterial color="#edb918" /></mesh><mesh position={[0,0.09,0.15]}><boxGeometry args={[0.35,0.18,0.55]} /><meshStandardMaterial color="#181818" /></mesh></group>)}
    </group>
    <mesh position={[0,0.86,0]} castShadow><boxGeometry args={[0.85,0.85,0.48]} /><meshStandardMaterial color="#f6bd16" /></mesh>
    {[-1,1].map(side => <mesh key={side} position={[side*0.56,0.94,0]} rotation={[0,0,side*0.25]}><capsuleGeometry args={[0.16,0.55,4,8]} /><meshStandardMaterial color="#161616" /></mesh>)}
    <mesh position={[0,1.65,0]} castShadow><sphereGeometry args={[0.55,20,16]} /><meshStandardMaterial color="#111313" /></mesh>
    {[-1,1].map(side => <group key={side}><mesh position={[side*0.24,1.68,0.45]}><sphereGeometry args={[0.20,12,10]} /><meshStandardMaterial color="#f4f1e4" /></mesh><mesh position={[side*0.24,1.72,0.61]}><sphereGeometry args={[0.09,12,10]} /><meshStandardMaterial color="#111" /></mesh><mesh position={[side*0.34,2.06,0]} rotation={[0,0,side*-0.5]}><coneGeometry args={[0.18,0.4,5]} /><meshStandardMaterial color="#111" /></mesh></group>)}
    <mesh position={[0,1.52,0.55]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[0.18,0.34,5]} /><meshStandardMaterial color="#f6bc12" /></mesh>
    <mesh position={[0,0.96,0.25]}><planeGeometry args={[0.48,0.28]} /><meshStandardMaterial color="#111" /></mesh>
  </group>
}
