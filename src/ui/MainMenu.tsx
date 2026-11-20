import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Campus, Pt } from '../campus'
import { Character } from '../characters/Character'
import { CampusScene } from '../scene/Campus'
import { CampusStudents } from '../scene/Community'
import type { AvatarLook } from '../scene/Player'
import { DEFAULT_PROFILE } from './Welcome'
import { PRESETS } from './nestProfile'
import './menu.css'

// Fixed menu view: looking across the Student Center plaza with the Big Owl Bus route behind it.
const EYE = new THREE.Vector3(-120.3, 5, -205.7), TARGET = new THREE.Vector3(-113.2, 3.2, -231.6)
const forward = TARGET.clone().sub(EYE).setY(0).normalize(), right = new THREE.Vector3(-forward.z, 0, forward.x)
const at = (ahead: number, side: number) => EYE.clone().setY(0).addScaledVector(forward, ahead).addScaledVector(right, side)
const faceCamera = Math.atan2(-forward.x, -forward.z)

function MenuCamera() {
  const { camera } = useThree()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    camera.position.copy(EYE).addScaledVector(right, Math.sin(t * .08) * 1.6).add(new THREE.Vector3(0, Math.sin(t * .11) * .25, 0))
    camera.lookAt(TARGET)
  })
  return null
}

/** A student near the menu who waves at the player (right arm reaches up and sways). */
function Waver({ look }: { look: AvatarLook }) {
  const reach = useRef<THREE.Vector3 | null>(new THREE.Vector3()), pos = useMemo(() => at(12, 4.6), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, sway = Math.sin(t * 6) * .35
    reach.current!.copy(pos).addScaledVector(right, -.55 + sway * .3).add(new THREE.Vector3(0, 2.3 + Math.abs(sway) * .2, 0)).addScaledVector(forward, -.35)
  })
  return <group position={pos} rotation={[0, faceCamera, 0]}><Character {...look} reach={reach} scale={1.15} /></group>
}

/** Two students relaxing on a bench at the edge of the plaza, facing the camera. */
function BenchSitters() {
  const sit = useRef(1), pos = useMemo(() => at(17, -6.5), [])
  return <group position={pos} rotation={[0, faceCamera, 0]}>
    <mesh position={[0, .45, -.05]}><boxGeometry args={[2.4, .1, .6]} /><meshStandardMaterial color="#8a6a4c" /></mesh>
    <mesh position={[0, .85, -.32]}><boxGeometry args={[2.4, .5, .08]} /><meshStandardMaterial color="#8a6a4c" /></mesh>
    {[-1.05, 1.05].map(x => <mesh key={x} position={[x, .22, -.05]}><boxGeometry args={[.08, .44, .55]} /><meshStandardMaterial color="#2f3332" /></mesh>)}
    {[-.55, .55].map((x, i) => <group key={x} position={[x, 0, .05]}><Character {...PRESETS[i + 2].look} bag="none" sit={sit} sitLift={.112} scale={1.1} /></group>)}
  </group>
}

/** Students riding scooters back and forth along the nearest walkway. */
function ScooterRiders({ campus }: { campus: Campus }) {
  const line = useMemo<Pt[]>(() => {
    let best: Pt[] = [], dist = Infinity
    const c = at(24, 0)
    for (const p of campus.paths) for (const q of p.pts) { const d = Math.hypot(q[0] - c.x, q[1] - c.z); if (d < dist && p.pts.length > 1) { dist = d; best = p.pts } }
    return best
  }, [campus])
  const lengths = useMemo(() => { const out = [0]; for (let i = 1; i < line.length; i++) out.push(out[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])); return out }, [line])
  const riders = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const total = lengths[lengths.length - 1]; if (!total) return
    riders.current.forEach((g, k) => {
      if (!g) return
      const cyc = (clock.elapsedTime * 3.2 + k * total * .7) % (total * 2), back = cyc > total, d = back ? total * 2 - cyc : cyc
      let i = 1; while (i < lengths.length - 1 && lengths[i] < d) i++
      const a = line[i - 1], b = line[i], t = (d - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1)
      const dx = b[0] - a[0], dz = b[1] - a[1], dir = back ? -1 : 1, len = Math.hypot(dx, dz) || 1
      g.position.set(a[0] + dx * t - dz / len * .8 * dir, 0, a[1] + dz * t + dx / len * .8 * dir)
      g.rotation.y = Math.atan2(dx * dir, dz * dir)
    })
  })
  if (line.length < 2) return null
  return <>{[0, 1].map(k => <group key={k} ref={g => { riders.current[k] = g }}>
    <mesh position={[0, .1, 0]}><boxGeometry args={[.28, .05, .9]} /><meshStandardMaterial color={k ? '#d4a720' : '#3f74b5'} /></mesh>
    <mesh position={[0, .6, .38]}><boxGeometry args={[.05, 1, .05]} /><meshStandardMaterial color="#c9ced0" /></mesh>
    <mesh position={[0, 1.1, .38]}><boxGeometry args={[.5, .05, .05]} /><meshStandardMaterial color="#2b2f30" /></mesh>
    {[-.38, .38].map(z => <mesh key={z} position={[0, .07, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.07, .07, .05, 12]} /><meshStandardMaterial color="#1f2324" /></mesh>)}
    <group position={[0, .14, -.05]}><Character {...PRESETS[k ? 4 : 1].look} scale={1.05} /></group>
  </group>)}</>
}

export function MenuBackground({ campus, look }: { campus: Campus | null; look: AvatarLook }) {
  return <div className="menu-bg" aria-hidden="true">
    {campus && <Canvas shadows={false} camera={{ fov: 42, near: .5, far: 1500, position: EYE.toArray() }} dpr={[1, 1.5]}>
      <color attach="background" args={['#cfe3f0']} /><fog attach="fog" args={['#cfe3f0', 120, 600]} />
      <hemisphereLight args={['#e8f3ff', '#8aa86a', 1.15]} /><directionalLight position={[60, 120, 40]} intensity={1.5} />
      <MenuCamera /><CampusScene campus={campus} /><CampusStudents campus={campus} minute={11 * 60} />
      <Waver look={look} /><BenchSitters /><ScooterRiders campus={campus} />
    </Canvas>}
  </div>
}

type MenuProps = { campus: Campus | null; look?: AvatarLook; returning: string | null; onPlay: () => void; onCustomize: () => void; onHelp: () => void; children?: ReactNode }
export function MainMenu({ campus, look, returning, onPlay, onCustomize, onHelp, children }: MenuProps) {
  return <main className="menu">
    <MenuBackground campus={campus} look={look ?? PRESETS[0].look ?? DEFAULT_PROFILE.look} />
    <section className="menu-panel">
      <div className="menu-owl" aria-hidden="true">🦉</div>
      <h1 className="menu-title">NEST LIFE</h1>
      <p className="menu-sub">Your Campus. Your Story.</p>
      {returning && <p className="menu-back">Welcome back, <b>{returning}</b>!</p>}
      <div className="menu-buttons">
        <button className="menu-btn primary" onClick={onPlay}><span aria-hidden="true">▶</span> Play</button>
        <button className="menu-btn" onClick={onCustomize}><span aria-hidden="true">👤</span> Customize Character</button>
        <button className="menu-btn" onClick={onHelp}><span aria-hidden="true">📖</span> How to Play</button>
      </div>
      <small className="menu-foot">KSU MARIETTA CAMPUS</small>
    </section>
    {children}
  </main>
}

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return <div className="menu-overlay" role="dialog" aria-modal="true" aria-labelledby="howto-title">
    <div className="menu-card wide">
      <h2 id="howto-title">How to Play</h2>
      <div className="howto-grid">
        <div><h3>Movement</h3><ul className="keys">
          <li><kbd>W A S D</kbd> Walk</li><li><kbd>Drag mouse</kbd> Move camera</li><li><kbd>Q / E</kbd> Turn camera</li><li><kbd>F</kbd> Talk · board the bus</li><li><kbd>G</kbd> Go inside a building</li>
        </ul></div>
        <div><h3>Things to Do</h3><ul>
          <li>Explore KSU Marietta</li><li>Talk to students</li><li>Ride the Big Owl Bus</li><li>Play campus minigames</li><li>Visit the robotics labs</li><li>Meet other real players</li>
        </ul></div>
      </div>
      <button className="menu-btn primary small" onClick={onBack}>Back</button>
    </div>
  </div>
}
