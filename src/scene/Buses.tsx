import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Campus, Pt } from '../campus'
import { protectedShuttle } from './trafficSafety'

export const busDriver = { index: -1 }
export const busPositions: { x: number; z: number; h: number }[] = []
// Where the player is standing on campus (written by Player each frame). A bus
// holds at its current spot while the player is next to it, so it can be boarded.
export const busCaller = { x: NaN, z: NaN, riding: -1 }
const HOLD_RADIUS = 11

// An illustrative campus shuttle, not a live route or a timetable.
function busTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#141515'; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#e5b51c'
  g.beginPath(); g.moveTo(20, 190); g.lineTo(300, 45); g.lineTo(460, 50); g.lineTo(205, 204); g.fill()
  g.fillStyle = '#f2c52e'; g.font = 'bold 28px sans-serif'; g.fillText('KENNESAW STATE UNIVERSITY', 420, 30)
  g.fillStyle = '#292d2d'; for (let x = 65; x < 990; x += 145) { g.fillRect(x, 48, 125, 80); g.strokeStyle = '#777'; g.lineWidth = 4; g.strokeRect(x, 48, 125, 80) }
  // Keep the logo below the window band and draw it last so no window covers its top.
  g.fillStyle = '#f4f4f1'; g.font = 'italic bold 76px sans-serif'; g.fillText('BIG', 510, 188)
  g.font = 'italic bold 46px sans-serif'; g.fillText('OWL BUS', 510, 230)
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function busRoute(campus: Campus): Pt[] {
  // Follow OSM roads past the Student Center and south along Polytechnic Lane.
  const ross = campus.roads.filter(r => r.name?.startsWith('Rossbacher') && r.pts.some(([x,z]) => x > -220 && x < 20 && z < -300))
  const poly = campus.roads.find(r => r.name === 'Polytechnic Lane' && r.pts.length > 40)
  if (!poly || ross.length === 0) return []
  const east = [...ross].sort((a,b) => b.pts[b.pts.length-1][0] - a.pts[a.pts.length-1][0])[0]
  const connection = ross.find(r => r.pts.some(([x,z]) => Math.hypot(x + 213.56, z + 306.01) < 1) && r.pts.some(([x,z]) => Math.hypot(x + 173.07, z + 311.16) < 1))
  const link = ross.find(r => r.pts.some(([x,z]) => Math.hypot(x + 173.07, z + 311.16) < 1) && r !== connection)
  if (!connection || !link) return []
  return [...east.pts].reverse().concat([...link.pts].reverse(), [...connection.pts].reverse(), poly.pts)
}

function Shuttle({ path, offset, texture }: { path: Pt[]; offset: number; texture: THREE.Texture }) {
  const ref = useRef<THREE.Group>(null)
  const data = useMemo(() => {
    const cumulative = [0]
    for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i-1] + Math.hypot(path[i][0]-path[i-1][0], path[i][1]-path[i-1][1]))
    return { cumulative, length: cumulative[cumulative.length-1] ?? 0 }
  }, [path])
  const motion = useRef<{distance:number; wait:number; inStop:boolean} | null>(null)
  const stopAt = useMemo(() => {
    let best=0, distance=Infinity
    path.forEach(([x,z],i)=>{const d=Math.hypot(x+90.6,z+311.24);if(d<distance){distance=d;best=i}})
    return data.cumulative[best] ?? 0
  },[path,data])
  useFrame((_, dtRaw) => {
    if (!ref.current || data.length === 0) return
    if (Math.round(offset * 4) === busDriver.index) { ref.current.visible=false; return }
    ref.current.visible=true
    if (!motion.current) motion.current={distance:offset*data.length*2,wait:0,inStop:false}
    const m=motion.current, dt=Math.min(dtRaw,0.05), index=Math.round(offset * 4)
    const here=busPositions[index]
    const safetyDistance=here?Math.hypot(here.x-protectedShuttle.x,here.z-protectedShuttle.z):Infinity
    const clearing=protectedShuttle.active&&safetyDistance<12
    const waiting=!clearing&&!!here&&((busCaller.riding!==index&&Math.hypot(here.x-busCaller.x,here.z-busCaller.z)<HOLD_RADIUS)||(protectedShuttle.active&&safetyDistance<18))
    if(clearing)ref.current.visible=false
    if (!waiting) {
      if (m.wait>0) m.wait=Math.max(0,m.wait-dt)
      else m.distance=(m.distance+dt*8)%(data.length*2)
    }
    const cycle = m.distance
    const atStop=Math.abs((cycle<data.length?cycle:2*data.length-cycle)-stopAt)<6
    if(atStop && !m.inStop){m.wait=6;m.inStop=true}
    if(!atStop)m.inStop=false
    const forward = cycle < data.length
    const d = forward ? cycle : 2 * data.length - cycle
    let i = 1; while (i < data.cumulative.length - 1 && data.cumulative[i] < d) i++
    const a = path[i-1], b = path[i]
    const span = data.cumulative[i] - data.cumulative[i-1] || 1
    const t = (d-data.cumulative[i-1])/span
    const dx=(b[0]-a[0])/span, dz=(b[1]-a[1])/span
    const dir = forward ? 1 : -1
    ref.current.position.set(a[0]+(b[0]-a[0])*t + dz*1.6*dir, 0, a[1]+(b[1]-a[1])*t - dx*1.6*dir)
    ref.current.rotation.y = Math.atan2(dx*dir, dz*dir)
    busPositions[index] = { x: ref.current.position.x, z: ref.current.position.z, h: ref.current.rotation.y }
  })
  return <group ref={ref}>
    <mesh position={[0,1.8,0]} castShadow><boxGeometry args={[2.5,2.8,10.5]} /><meshStandardMaterial color="#171919" roughness={0.55} /></mesh>
    <mesh position={[0,3.3,0]}><boxGeometry args={[2.35,0.25,9.5]} /><meshStandardMaterial color="#ddddcf" /></mesh>
    <mesh position={[0,2.2,5.27]}><planeGeometry args={[2.25,1.55]} /><meshStandardMaterial color="#40585b" metalness={0.15} roughness={0.35} /></mesh>
    {[-1,1].map(side => <mesh key={side} position={[side*1.26,2.05,0]} rotation={[0,side*Math.PI/2,0]}><planeGeometry args={[10.3,2.35]} /><meshStandardMaterial map={texture} side={THREE.DoubleSide} /></mesh>)}
    {[-1,1].flatMap(x => [-3.1,3.1].map(z => <mesh key={`${x},${z}`} position={[x*1.22,0.62,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.62,0.62,0.35,16]} /><meshStandardMaterial color="#191a1a" /></mesh>))}
  </group>
}
export function Buses({ campus }: { campus: Campus }) {
  const path = useMemo(() => busRoute(campus), [campus])
  const texture = useMemo(busTexture, [])
  if (path.length < 2) return null
  return <>{[0,1,2,3].map(i => <Shuttle key={i} path={path} offset={i/4} texture={texture} />)}</>
}
