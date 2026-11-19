import { useMemo } from 'react'
import * as THREE from 'three'
import { centroid, Collider, distToSeg, pointInPoly, type Area, type Campus, type Pt } from '../campus'
import { textTexture } from './textures'

// Hand-placed campus landmarks (from KSU's interactive map, used as reference) plus OpenStreetMap
// features: Slap the Rock, the KSU letters at Hornet Village, the Globe plaza and tent canopies,
// benches, flagpoles, the fountain, bus shelters, and the basketball / volleyball courts.

const GOLD = '#FFC629'
const INK = '#0B1315'
const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.45, metalness: 0.15 })
const ink = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 })
const steel = new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 0.3, metalness: 0.35 })
const white = new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.6, side: THREE.DoubleSide })
const dark = new THREE.MeshStandardMaterial({ color: '#33373b', roughness: 0.6 })
const concrete = new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 0.9 })

function bcentroid(campus: Campus, code: string): Pt | null {
  const b = campus.buildings.find((x) => x.code === code)
  return b ? centroid(b.poly) : null
}

/** Nearest spot to (x, z) that is clear of buildings (and, with campus, of lots and roads: on a lawn). */
function clear(collider: Collider, x: number, z: number, r = 3, campus?: Campus): Pt {
  const ok = (px: number, pz: number) => {
    if (collider.blocked(px, pz, r)) return false
    if (!campus) return true
    for (const a of campus.areas) if (a.kind === 'parking' && pointInPoly(px, pz, a.poly)) return false
    for (const l of campus.roads) for (let i = 0; i < l.pts.length - 1; i++) if (distToSeg(px, pz, l.pts[i], l.pts[i + 1]) < l.w / 2 + r + 1) return false
    return true
  }
  if (ok(x, z)) return [x, z]
  for (let d = 2; d < 60; d += 2)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const px = x + Math.cos(a) * d
      const pz = z + Math.sin(a) * d
      if (ok(px, pz)) return [px, pz]
    }
  return [x, z]
}

/** "Slap the Rock": the gold boulder on the lawn by Crawford Lab. */
function SlapTheRock({ at }: { at: Pt }) {
  const geo = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(1.1, 1)
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const n = 1 + Math.sin(i * 12.9898) * 0.08
      p.setXYZ(i, p.getX(i) * 1.35 * n, p.getY(i) * 0.85 * n, p.getZ(i) * n)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const label = useMemo(() => textTexture('SLAP THE ROCK', { bg: GOLD, fg: INK, w: 512, h: 96 }), [])
  return (
    <group position={[at[0], 0.8, at[1]]} rotation={[0, 0.6, 0]}>
      <mesh geometry={geo} material={gold} castShadow receiveShadow />
      <mesh position={[0, 0.25, 1.02]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[1.8, 0.34]} />
        <meshBasicMaterial map={label} transparent />
      </mesh>
    </group>
  )
}

/** The big gold K S U letters in front of Hornet Village. Letters are built from bars and arcs. */
function KsuLetters({ at, yaw }: { at: Pt; yaw: number }) {
  const H = 1.6
  const T = 0.32 // stroke
  const D = 0.35 // depth
  const bar = (x: number, y: number, h: number, rot = 0, key = '') => (
    <mesh key={key} position={[x, y, 0]} rotation={[0, 0, rot]} material={gold} castShadow>
      <boxGeometry args={[T, h, D]} />
    </mesh>
  )
  const arc = (x: number, y: number, r: number, start: number, len: number, key: string) => (
    <mesh key={key} position={[x, y, 0]} rotation={[0, 0, start]} material={gold} castShadow>
      <torusGeometry args={[r, T / 2, 8, 20, len]} />
    </mesh>
  )
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      {/* plinth */}
      <mesh position={[0, 0.2, 0]} material={ink} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.4, 0.9]} />
      </mesh>
      <group position={[0, 0.4, 0]}>
        {/* K */}
        <group position={[-1.5, 0, 0]}>
          {bar(-0.35, H / 2, H, 0, 'k1')}
          {bar(0.1, H * 0.72, H * 0.62, -0.75, 'k2')}
          {bar(0.1, H * 0.28, H * 0.62, 0.75, 'k3')}
        </group>
        {/* S: two opposite arcs */}
        <group position={[0, 0, 0]}>
          {arc(0, H * 0.73, H * 0.24, Math.PI * 0.05, Math.PI * 1.45, 's1')}
          {arc(0, H * 0.27, H * 0.24, Math.PI * 1.05, Math.PI * 1.45, 's2')}
        </group>
        {/* U */}
        <group position={[1.45, 0, 0]}>
          {bar(-0.38, H * 0.62, H * 0.76, 0, 'u1')}
          {bar(0.38, H * 0.62, H * 0.76, 0, 'u2')}
          {arc(0, H * 0.25, 0.38, Math.PI, Math.PI, 'u3')}
        </group>
      </group>
    </group>
  )
}

/** The Globe sculpture on its round plaza by the Student Center. */
function GlobePlaza({ at }: { at: Pt }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} receiveShadow>
        <circleGeometry args={[15, 48]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[6, 6.6, 48]} />
        <meshStandardMaterial color="#b9ad99" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={concrete} castShadow>
        <cylinderGeometry args={[1.4, 1.6, 1, 24]} />
      </mesh>
      <mesh position={[0, 2.6, 0]} material={steel} castShadow>
        <sphereGeometry args={[1.6, 32, 24]} />
      </mesh>
      <mesh position={[0, 2.6, 0]} rotation={[0.4, 0, 0.3]} material={steel}>
        <torusGeometry args={[2, 0.07, 8, 48]} />
      </mesh>
    </group>
  )
}

/** Row of white tensile shade canopies (the tents beside the Globe plaza). */
function Canopies({ from, to }: { from: Pt; to: Pt }) {
  const n = 6
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const yaw = Math.atan2(dx, dz)
  const sail = useMemo(() => {
    const g = new THREE.ConeGeometry(3.4, 1.4, 4, 1, true)
    g.rotateY(Math.PI / 4)
    return g
  }, [])
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1)
        const x = from[0] + dx * t
        const z = from[1] + dz * t
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
            <mesh position={[0, 3.6, 0]} material={white} castShadow>
              <primitive object={sail} attach="geometry" />
            </mesh>
            {[-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <mesh key={`${sx}${sz}`} position={[sx * 2.2, 1.5, sz * 2.2]} material={dark}>
                  <cylinderGeometry args={[0.06, 0.06, 3, 6]} />
                </mesh>
              )),
            )}
          </group>
        )
      })}
    </group>
  )
}

function Bench({ x, z, dir }: { x: number; z: number; dir: number | null }) {
  const yaw = ((dir ?? 180) * Math.PI) / 180
  return (
    <group position={[x, 0, z]} rotation={[0, -yaw + Math.PI, 0]}>
      <mesh position={[0, 0.45, 0]} material={dark} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.5]} />
      </mesh>
      <mesh position={[0, 0.8, -0.22]} material={dark} castShadow>
        <boxGeometry args={[1.8, 0.5, 0.06]} />
      </mesh>
      {[-0.8, 0.8].map((sx) => (
        <mesh key={sx} position={[sx, 0.22, 0]} material={dark}>
          <boxGeometry args={[0.06, 0.44, 0.45]} />
        </mesh>
      ))}
    </group>
  )
}

function Flagpole({ x, z, i }: { x: number; z: number; i: number }) {
  const flag = useMemo(() => {
    if (i === 0) return textTexture('★', { bg: '#b22234', fg: '#ffffff', w: 96, h: 64 })
    if (i === 1) return textTexture('GA', { bg: '#1f3a6b', fg: '#ffffff', w: 96, h: 64 })
    return textTexture('KSU', { bg: INK, fg: GOLD, w: 96, h: 64 })
  }, [i])
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 6, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 12, 8]} />
      </mesh>
      <mesh position={[0.95, 10.9, 0]}>
        <planeGeometry args={[1.8, 1.15]} />
        <meshStandardMaterial map={flag} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Fountain({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} material={concrete} castShadow>
        <cylinderGeometry args={[3, 3.2, 0.6, 32]} />
      </mesh>
      <mesh position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.7, 32]} />
        <meshStandardMaterial color="#6aa3c9" roughness={0.15} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.35, 1.3, 12]} />
        <meshStandardMaterial color="#cde7f5" transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

function Shelter({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.5, 0]} material={dark} castShadow>
        <boxGeometry args={[3.6, 0.12, 1.6]} />
      </mesh>
      <mesh position={[0, 1.25, -0.75]}>
        <boxGeometry args={[3.4, 2.4, 0.05]} />
        <meshStandardMaterial color="#bcd6e0" transparent opacity={0.45} />
      </mesh>
      {[-1.7, 1.7].map((sx) => (
        <mesh key={sx} position={[sx, 1.25, -0.75]} material={dark}>
          <boxGeometry args={[0.1, 2.5, 0.1]} />
        </mesh>
      ))}
    </group>
  )
}

/** Courts drawn on their real OSM outlines with markings, hoops and nets. */
function Court({ area }: { area: Area }) {
  const sport = area.kind.slice(6)
  const { cx, cz, len, wid, yaw } = useMemo(() => {
    // fit an oriented rectangle: longest edge = court direction
    let best = 0
    let ang = 0
    const p = area.poly
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (l > best) {
        best = l
        ang = Math.atan2(b[0] - a[0], b[1] - a[1])
      }
    }
    const [cx, cz] = centroid(p)
    const ux = Math.sin(ang)
    const uz = Math.cos(ang)
    let lmin = Infinity, lmax = -Infinity, wmin = Infinity, wmax = -Infinity
    for (const [x, z] of p) {
      const l = (x - cx) * ux + (z - cz) * uz
      const w = -(x - cx) * uz + (z - cz) * ux
      lmin = Math.min(lmin, l); lmax = Math.max(lmax, l); wmin = Math.min(wmin, w); wmax = Math.max(wmax, w)
    }
    return { cx, cz, len: lmax - lmin, wid: wmax - wmin, yaw: ang }
  }, [area])
  if (sport === 'basketball') {
    return (
      <group position={[cx, 0.1, cz]} rotation={[0, yaw, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[wid, len]} />
          <meshStandardMaterial color="#4f7d46" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[wid * 0.86, len * 0.9]} />
          <meshStandardMaterial color="#3d6fa6" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.7, 1.85, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[wid * 0.86, 0.12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * (len * 0.45 - 0.3)]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
            <mesh position={[0, 0.02, 2.4]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[5.9, 6.05, 40, 1, 0, Math.PI]} />
              <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 1.6, -0.2]} material={dark}>
              <cylinderGeometry args={[0.08, 0.08, 3.2, 8]} />
            </mesh>
            <mesh position={[0, 3.2, 0.3]} material={white}>
              <boxGeometry args={[1.8, 1.05, 0.06]} />
            </mesh>
            <mesh position={[0, 2.9, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.23, 0.025, 6, 16]} />
              <meshStandardMaterial color="#e2582c" />
            </mesh>
          </group>
        ))}
      </group>
    )
  }
  if (sport === 'volleyball') {
    return (
      <group position={[cx, 0.1, cz]} rotation={[0, yaw, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[wid, len]} />
          <meshStandardMaterial color="#e3c58f" roughness={1} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[wid * 0.8, 0.9, 0.03]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * wid * 0.8) / 2, 1.2, 0]} material={dark}>
            <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
          </mesh>
        ))}
      </group>
    )
  }
  return null
}

export function Landmarks({ campus }: { campus: Campus }) {
  const placed = useMemo(() => {
    const collider = new Collider(campus.buildings)
    const E = bcentroid(campus, 'E')
    const R702 = bcentroid(campus, 'R702')
    const C = bcentroid(campus, 'C')
    const globe = campus.features.find((f) => f.kind === 'sculpture')
    const rock = E ? clear(collider, E[0] + 55, E[1] - 5, 3) : null
    // the yellow letters show up in the aerial photo just west of Hornet Village 2
    const letters = R702 ? clear(collider, -264, 179, 3.5, campus) : null
    // letters face away from the hall, toward the drive (readable as you arrive)
    const lettersYaw = R702 && letters ? Math.atan2(letters[0] - R702[0], letters[1] - R702[1]) + Math.PI : 0
    const canopy = globe && C ? { from: [globe.x + (C[0] - globe.x) * 0.22, globe.z + (C[1] - globe.z) * 0.22] as Pt, to: [globe.x + (C[0] - globe.x) * 0.55, globe.z + (C[1] - globe.z) * 0.55] as Pt } : null
    return { rock, letters, lettersYaw, globe, canopy }
  }, [campus])
  const flags = campus.features.filter((f) => f.kind === 'flagpole')
  return (
    <group>
      {placed.rock && <SlapTheRock at={placed.rock} />}
      {placed.letters && <KsuLetters at={placed.letters} yaw={placed.lettersYaw} />}
      {placed.globe && <GlobePlaza at={[placed.globe.x, placed.globe.z]} />}
      {placed.canopy && <Canopies from={placed.canopy.from} to={placed.canopy.to} />}
      {campus.features.map((f, i) =>
        f.kind === 'bench' ? <Bench key={i} x={f.x} z={f.z} dir={f.dir} /> : f.kind === 'fountain' ? <Fountain key={i} x={f.x} z={f.z} /> : f.kind === 'shelter' ? <Shelter key={i} x={f.x} z={f.z} /> : null,
      )}
      {flags.map((f, i) => (
        <Flagpole key={`f${i}`} x={f.x} z={f.z} i={i} />
      ))}
      {campus.areas
        .filter((a) => a.kind === 'pitch:basketball' || a.kind === 'pitch:volleyball')
        .map((a, i) => (
          <Court key={i} area={a} />
        ))}
    </group>
  )
}

/** Where the landmarks are, for the HUD's "You're at" card. */
export function landmarkSpots(campus: Campus): { name: string; at: Pt; r: number }[] {
  const out: { name: string; at: Pt; r: number }[] = []
  const collider = new Collider(campus.buildings)
  const E = bcentroid(campus, 'E')
  if (E) out.push({ name: 'Slap the Rock', at: clear(collider, E[0] + 55, E[1] - 5, 3), r: 10 })
  out.push({ name: 'KSU Sign · Hornet Village', at: clear(collider, -264, 179, 3.5, campus), r: 10 })
  const g = campus.features.find((f) => f.kind === 'sculpture')
  if (g) out.push({ name: 'The Globe', at: [g.x, g.z], r: 16 })
  return out
}
