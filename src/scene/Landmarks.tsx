import { useMemo } from 'react'
import * as THREE from 'three'
import { centroid, Collider, distToSeg, pointInPoly, type Area, type Campus, type Pt } from '../campus'

// Hand-placed campus landmarks (from KSU's interactive map, used as reference) plus OpenStreetMap
// features: Slap the Rock, the KSU letters at Hornet Village, the Globe plaza and tent canopies,
// benches, flagpoles, the fountain, bus shelters, and the basketball / volleyball courts.

const GOLD = '#FFC629'
const INK = '#0B1315'
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

/** The real rock: glossy black paint covered in handprints (mostly yellow, some white and colourful),
 *  with "SLAP / ROCK" painted big in white on the front. Equirectangular texture for a sphere. */
function rockTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const g = c.getContext('2d')!
  g.fillStyle = '#16181b'
  g.fillRect(0, 0, c.width, c.height)
  let seed = 9
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // old layers of paint peeking through (charcoal / slate patches)
  for (let i = 0; i < 200; i++) {
    const v = 26 + r() * 30
    g.fillStyle = `rgba(${v},${v + 3},${v + 8},0.5)`
    g.beginPath()
    g.ellipse(r() * c.width, r() * c.height, 20 + r() * 80, 12 + r() * 40, r() * 3, 0, Math.PI * 2)
    g.fill()
  }
  // a clear handprint: rounded palm, four separate fingers, thumb out to the side
  const hand = (x: number, y: number, s: number, rot: number, col: string) => {
    g.save()
    g.translate(x, y)
    g.rotate(rot)
    g.scale(s / 1.75, s) // pre-squeeze: the rock is stretched 1.75x wide
    g.fillStyle = col
    g.beginPath()
    g.moveTo(-16, 4)
    g.quadraticCurveTo(-18, 30, 0, 32)
    g.quadraticCurveTo(18, 30, 16, 4)
    g.quadraticCurveTo(0, -4, -16, 4)
    g.fill()
    const finger = (fx: number, fy: number, len: number, ang: number) => {
      g.save()
      g.translate(fx, fy)
      g.rotate(ang)
      g.beginPath()
      g.roundRect(-3.6, -len, 7.2, len + 4, 3.6)
      g.fill()
      g.restore()
    }
    finger(-11.5, 4, 17, -0.22)
    finger(-4, 1, 21, -0.07)
    finger(4, 1, 22, 0.06)
    finger(11.5, 4, 18, 0.2)
    finger(-16, 18, 15, -1.05) // thumb
    g.restore()
  }
  // keep prints off the lettering, and spaced out so each one reads as a hand
  const TX = c.width * 0.25
  const inText = (x: number, y: number) => Math.abs(x - TX) < 300 && y > 250 && y < 660
  const placed: [number, number][] = []
  const yellows = ['#FFC629', '#F5D33B', '#FFE066']
  const others = ['#ffffff', '#7fd0ff', '#ff7ab6', '#7be07b', '#ff9a3c']
  for (let tries = 0; tries < 6000 && placed.length < 230; tries++) {
    const x = r() * c.width
    const y = 250 + r() * 560
    if (inText(x, y) || placed.some(([px, py]) => Math.abs(px - x) < 46 && Math.abs(py - y) < 64)) continue
    placed.push([x, y])
    const col = r() < 0.75 ? yellows[Math.floor(r() * yellows.length)] : others[Math.floor(r() * others.length)]
    hand(x, y, 1.55 + r() * 0.35, (r() - 0.5) * 1.1, col)
  }
  // "SLAP / THE / ROCK" in chunky white paint on the front (u ~ 0.25 faces +z)
  g.save()
  g.translate(TX, 0)
  g.scale((1 / 1.75) * 1.55, 1)
  g.fillStyle = 'rgba(255,255,255,.94)'
  g.strokeStyle = 'rgba(255,255,255,.55)'
  g.lineWidth = 9
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const [txt, y, size] of [['SLAP', 330, 130], ['THE', 450, 95], ['ROCK', 570, 130]] as const) {
    g.font = `900 ${size}px Impact, "Arial Black", sans-serif`
    g.strokeText(txt, 0, y)
    g.fillText(txt, 0, y)
  }
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** "Slap the Rock": a big, low, lumpy boulder in glossy black paint with handprints, on a mulch bed. */
function SlapTheRock({ at }: { at: Pt }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 44, 26)
    const p = g.getAttribute('position')
    const v = new THREE.Vector3()
    // a few big "fracture planes" cut flat faces into it, then small chips: craggy, like real stone
    const planes = [[0.8, 0.5, 0.3, 0.86], [-0.6, 0.7, -0.4, 0.84], [0.1, 0.9, 0.6, 0.8], [-0.9, -0.1, 0.5, 0.88], [0.4, 0.2, -0.9, 0.87], [0.0, 1, 0, 0.82]]
      .map(([x, y, z, d]) => ({ n: new THREE.Vector3(x, y, z).normalize(), d }))
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const n = 1 + 0.16 * Math.sin(v.x * 1.7 + 0.7) * Math.cos(v.z * 1.4 + 0.3) + 0.1 * Math.sin(v.y * 2.3 + v.x * 1.6)
        + 0.06 * Math.cos(v.z * 4.3 - v.y * 2.1) + 0.045 * Math.sin(v.x * 9.1 + v.z * 7.3) * Math.cos(v.y * 8.2)
      v.multiplyScalar(n)
      for (const pl of planes) {
        const k = v.dot(pl.n)
        if (k > pl.d) v.addScaledVector(pl.n, pl.d - k) // slice it flat
      }
      const y = v.y < 0 ? Math.max(v.y, -0.45) : v.y * (v.x > 0 ? 0.85 : 1) // sloping top, higher on one end
      v.set(v.x * 1.75, y * 1.3, v.z * 1.35)
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: rockTexture(), roughness: 0.35, metalness: 0.05, flatShading: true }), [])
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, 0.6, 0]}>
      {/* mulch / dirt bed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[1.45, 1, 1]} receiveShadow>
        <circleGeometry args={[2.9, 40]} />
        <meshStandardMaterial color="#6e5440" roughness={1} />
      </mesh>
      <mesh geometry={geo} material={mat} position={[0, 0.6, 0]} scale={1.4} castShadow receiveShadow />
    </group>
  )
}

/** Freestanding block letters, with yellow faces and deep black sides. */
function KsuLetters({ at, yaw }: { at: Pt; yaw: number }) {
  const textures = useMemo(() => {
    const make = (face: boolean) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1536
      canvas.height = 600
      const g = canvas.getContext('2d')!
      g.font = '900 530px Arial, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'alphabetic'
      g.lineJoin = 'round'
      g.lineWidth = 26
      g.strokeStyle = INK
      g.fillStyle = face ? GOLD : INK
      const baseline = 587 - g.measureText('KSU').actualBoundingBoxDescent
      g.strokeText('KSU', 768, baseline, 1470)
      g.fillText('KSU', 768, baseline, 1470)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      return texture
    }
    return { face: make(true), side: make(false) }
  }, [])
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.1, 0]} material={ink} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.2, 0.85]} />
      </mesh>
      {/* Closely spaced silhouettes give the letters solid dark depth from oblique views. */}
      {Array.from({ length: 25 }, (_, i) => (
        <mesh key={i} position={[0, 1.06, -0.3 + i * 0.025]} castShadow>
          <planeGeometry args={[4.6, 1.8]} />
          <meshStandardMaterial map={i === 24 ? textures.face : textures.side} transparent alphaTest={0.5} side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** Rough continents, as [lon, lat] polygons (degrees). Enough to read as Earth on the sculpture. */
const CONTINENTS: [number, number][][] = [
  [[-168, 66], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-66, 45], [-75, 35], [-81, 25], [-97, 26], [-105, 20], [-87, 15], [-78, 8], [-90, 15], [-110, 23], [-117, 32], [-125, 40], [-124, 48], [-135, 58], [-152, 60], [-166, 60]],
  [[-78, 10], [-60, 10], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-72, -30], [-71, -18], [-80, -5]],
  [[-17, 21], [-5, 36], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -28], [20, -35], [13, -22], [9, -1], [-5, 5], [-17, 14]],
  [[-10, 36], [-9, 43], [0, 49], [5, 60], [15, 68], [30, 70], [60, 70], [90, 76], [140, 72], [175, 66], [160, 58], [140, 50], [130, 40], [122, 30], [108, 18], [100, 8], [80, 8], [72, 20], [57, 25], [48, 30], [36, 36], [26, 40], [12, 44]],
  [[114, -22], [122, -18], [136, -12], [145, -15], [153, -27], [150, -37], [140, -38], [130, -32], [116, -34]],
  [[-50, 60], [-30, 68], [-22, 76], [-40, 83], [-60, 80], [-70, 76]],
]

function globeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  const X = (lon: number) => ((lon + 180) / 360) * c.width
  const Y = (lat: number) => ((90 - lat) / 180) * c.height
  // land: brushed steel plates
  g.fillStyle = '#dfe3e6'
  for (const poly of CONTINENTS) {
    g.beginPath()
    poly.forEach(([lo, la], i) => (i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))))
    g.closePath()
    g.fill()
  }
  // the open wire grid (latitude / longitude bars)
  g.strokeStyle = '#eef1f3'
  g.lineWidth = 7
  for (let lat = -75; lat <= 75; lat += 15) {
    g.beginPath()
    g.moveTo(0, Y(lat))
    g.lineTo(c.width, Y(lat))
    g.stroke()
  }
  for (let lon = -180; lon < 180; lon += 15) {
    g.beginPath()
    g.moveTo(X(lon), Y(84))
    g.lineTo(X(lon), Y(-84))
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** The Globe sculpture: open wire globe with steel continents in a tilted meridian ring, on a stone
 *  pedestal in a round brick-edged planter (mulch + shrubs), in its circular plaza. */
function GlobePlaza({ at }: { at: Pt }) {
  const mats = useMemo(() => {
    const tex = globeTexture()
    return {
      globe: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.75, roughness: 0.3 }),
      ring: new THREE.MeshStandardMaterial({ color: '#e9edf0', metalness: 0.8, roughness: 0.25 }),
      stone: new THREE.MeshStandardMaterial({ color: '#4b4744', roughness: 0.8 }),
      brick: new THREE.MeshStandardMaterial({ color: '#a44a35', roughness: 0.9 }),
      mulch: new THREE.MeshStandardMaterial({ color: '#4a2f22', roughness: 1 }),
      shrub: new THREE.MeshStandardMaterial({ color: '#3f6e35', roughness: 0.9, flatShading: true }),
    }
  }, [])
  const R = 1.9
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} receiveShadow>
        <circleGeometry args={[15, 64]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.95} />
      </mesh>
      {/* round planter: brick curb, mulch, shrubs */}
      <mesh position={[0, 0.25, 0]} material={mats.brick} castShadow receiveShadow>
        <cylinderGeometry args={[4.6, 4.6, 0.4, 64, 1, true]} />
      </mesh>
      <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.brick}>
        <ringGeometry args={[4.3, 4.65, 64]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.mulch} receiveShadow>
        <circleGeometry args={[4.4, 64]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 2.4, 0.6, Math.sin(a) * 2.4]} scale={[1, 0.7, 1]} material={mats.shrub} castShadow>
            <icosahedronGeometry args={[0.55, 1]} />
          </mesh>
        )
      })}
      {/* pedestal */}
      <mesh position={[0, 0.9, 0]} material={mats.stone} castShadow>
        <boxGeometry args={[1.5, 1.2, 1.5]} />
      </mesh>
      {/* tilted assembly: globe + meridian ring + base arm */}
      <group position={[0, 1.5 + R + 0.25, 0]} rotation={[0, 0.5, 0.41]}>
        <mesh material={mats.globe} castShadow>
          <sphereGeometry args={[R, 96, 48]} />
        </mesh>
        <mesh material={mats.ring} castShadow rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[R + 0.18, 0.09, 12, 96, Math.PI * 1.3]} />
        </mesh>
        <mesh position={[0, R + 0.18, 0]} material={mats.ring}>
          <sphereGeometry args={[0.13, 16, 12]} />
        </mesh>
      </group>
      <mesh position={[0.35, 1.8, 0]} rotation={[0, 0, 0.41]} material={mats.ring} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.9, 12]} />
      </mesh>
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
    if (i === 0) {
      const canvas = document.createElement('canvas')
      canvas.width = 260; canvas.height = 160
      const g = canvas.getContext('2d')!
      for (let stripe = 0; stripe < 13; stripe++) {
        g.fillStyle = stripe % 2 === 0 ? '#b22234' : '#fff'
        g.fillRect(0, stripe * 160 / 13, 260, 160 / 13 + 1)
      }
      g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 104, 160 * 7 / 13)
      g.fillStyle = '#fff'
      for (let row = 0; row < 9; row++) for (let col = 0; col < (row % 2 ? 5 : 6); col++) {
        g.beginPath(); g.arc(9 + col * 17 + (row % 2 ? 8 : 0), 5 + row * 9.3, 1.8, 0, Math.PI * 2); g.fill()
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }
    const canvas = document.createElement('canvas')
    canvas.width = 300; canvas.height = 180
    const g = canvas.getContext('2d')!
    if (i === 1) {
      g.fillStyle = '#bd2537'; g.fillRect(0, 0, 300, 180)
      g.fillStyle = '#fff'; g.fillRect(0, 60, 300, 60)
      g.fillStyle = '#263965'; g.fillRect(0, 0, 120, 120)
      g.fillStyle = '#fff'
      for (let star = 0; star < 13; star++) {
        const a = star * Math.PI * 2 / 13
        g.beginPath(); g.arc(60 + 46 * Math.sin(a), 56 + 46 * Math.cos(a), 3, 0, Math.PI * 2); g.fill()
      }
      g.strokeStyle = '#e6be48'; g.lineWidth = 5
      g.beginPath(); g.arc(60, 49, 24, Math.PI, 0); g.stroke()
      g.fillStyle = '#e6be48'
      for (const x of [40,60,80]) g.fillRect(x - 2, 47, 4, 30)
      g.fillStyle = '#e6be48'; g.fillRect(35, 79, 50, 4)
    } else {
      // A stylized owl with feathered wings, ear tufts, eyes and a beak.
      g.fillStyle = '#111'; g.fillRect(0, 0, 300, 180)
      g.fillStyle = '#e5b72b'
      for (const side of [-1, 1]) {
        g.save(); g.translate(150, 0); g.scale(side, 1)
        g.beginPath(); g.moveTo(27, 73); g.quadraticCurveTo(65, 48, 116, 21)
        g.lineTo(105, 53); g.lineTo(119, 48); g.lineTo(95, 75)
        g.lineTo(105, 74); g.quadraticCurveTo(75, 103, 35, 104); g.closePath(); g.fill()
        g.strokeStyle = '#f4eee0'; g.lineWidth = 2
        g.beginPath(); g.moveTo(42, 79); g.quadraticCurveTo(82, 58, 111, 28); g.stroke()
        g.restore()
      }
      g.fillStyle = '#f3f1e9'
      g.beginPath(); g.moveTo(108, 35); g.lineTo(117, 63); g.quadraticCurveTo(103, 107, 150, 121)
      g.quadraticCurveTo(197, 107, 183, 63); g.lineTo(192, 35); g.lineTo(169, 48)
      g.quadraticCurveTo(150, 40, 131, 48); g.closePath(); g.fill()
      g.fillStyle = '#171717'
      g.beginPath(); g.moveTo(119, 49); g.lineTo(133, 57); g.lineTo(150, 64); g.lineTo(167, 57); g.lineTo(181, 49)
      g.lineTo(177, 86); g.quadraticCurveTo(172, 104, 150, 110); g.quadraticCurveTo(128, 104, 123, 86); g.closePath(); g.fill()
      for (const side of [-1, 1]) {
        g.save(); g.translate(150, 0); g.scale(side, 1)
        g.fillStyle = '#e5b72b'; g.beginPath(); g.moveTo(5, 69); g.lineTo(32, 61); g.lineTo(28, 78); g.lineTo(10, 81); g.closePath(); g.fill()
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(19, 74, 8, 6, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#111'; g.beginPath(); g.arc(19, 74, 3, 0, Math.PI * 2); g.fill(); g.restore()
      }
      g.fillStyle = '#f1bf25'; g.beginPath(); g.moveTo(143, 84); g.lineTo(157, 84); g.lineTo(150, 100); g.closePath(); g.fill()
      g.fillStyle = '#e5b72b'; g.textAlign = 'center'; g.font = 'bold 28px sans-serif'; g.fillText('KENNESAW',150,143)
      g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText('STATE OWLS',150,168)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
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


/** Math-to-library courtyard, laid out against the long Math facade. */
function MathCourtyard() {
  const groundLabel = useMemo(() => {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#e6d9c4';ctx.fillRect(0,0,512,512)
    ctx.strokeStyle='#f5f1e8';ctx.lineWidth=13;ctx.strokeRect(58,58,396,396)
    ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 150px sans-serif';ctx.fillText('KSU',256,260)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture
  },[])
  const path='#d4c9b7',soil='#927761'
  return <group position={[-178.45,0,-171.84]} rotation={[0,.497,0]}>
    {/* The long terrace follows Math, with paths through a landscaped circular garden. */}
    <mesh position={[0,.075,8]} receiveShadow><boxGeometry args={[54,.08,7]}/><meshStandardMaterial color={path}/></mesh>
    <mesh position={[0,.072,15]} receiveShadow><boxGeometry args={[5,.075,18]}/><meshStandardMaterial color={path}/></mesh>
    <mesh position={[0,.071,27]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[16,64]}/><meshStandardMaterial color={soil}/></mesh>
    <mesh position={[0,.085,27]} receiveShadow><boxGeometry args={[4,.08,32]}/><meshStandardMaterial color={path}/></mesh>
    <mesh position={[0,.14,27]} rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[3.8,48]}/><meshStandardMaterial color={path}/></mesh>
    <mesh position={[0,.19,27]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[4,4]}/><meshBasicMaterial map={groundLabel}/></mesh>
    {[-18,-6,6,18].map((x)=><group key={x} position={[x,0,8]}>
      <mesh position={[0,.75,0]}><cylinderGeometry args={[1.1,1.1,.12,20]}/><meshStandardMaterial color="#eee8d8"/></mesh>
      <mesh position={[0,.38,0]}><cylinderGeometry args={[.09,.09,.75,8]}/><meshStandardMaterial color="#60655f"/></mesh>
      <mesh position={[0,1.6,0]}><cylinderGeometry args={[.045,.045,3.2,8]}/><meshStandardMaterial color="#60655f"/></mesh>
      <mesh position={[0,3.36,0]} castShadow><coneGeometry args={[2.2,.62,12,1,true]}/><meshStandardMaterial color="#f7c72e" roughness={.85} side={THREE.DoubleSide}/></mesh>
      {[0,1,2,3].map((i)=><group key={i} position={[Math.cos(i*Math.PI/2)*1.65,0,Math.sin(i*Math.PI/2)*1.65]}>
        <mesh position={[0,.45,0]}><boxGeometry args={[.65,.1,.65]}/><meshStandardMaterial color="#7b8077"/></mesh>
        <mesh position={[0,.22,0]}><cylinderGeometry args={[.06,.06,.44,6]}/><meshStandardMaterial color="#60655f"/></mesh>
      </group>)}
    </group>)}
    {[-1,1].flatMap((side)=>[-10,-5,5,10].map((x)=><mesh key={`${side}-${x}`} position={[x,.38,27+side*8]} scale={[1,.6,1]}><icosahedronGeometry args={[.6,1]}/><meshStandardMaterial color="#668451"/></mesh>))}
  </group>
}

/** Straight row of white tensile shade canopies (Math building corner -> Administration). */
function TentRow({ from, to }: { from: Pt; to: Pt }) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const n = Math.max(2, Math.round(len / 4.2))
  const yaw = Math.atan2(dx, dz)
  const sail = useMemo(() => {
    const g = new THREE.ConeGeometry(2.9, 1.1, 4, 1, true)
    g.rotateY(Math.PI / 4)
    return g
  }, [])
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n
        return (
          <group key={i} position={[from[0] + dx * t, 0, from[1] + dz * t]} rotation={[0, yaw, 0]}>
            <mesh position={[0, 3.5, 0]} material={white} castShadow geometry={sail} />
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * 2, 1.5, 0]} material={dark}>
                <cylinderGeometry args={[0.06, 0.06, 3, 6]} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

/** Covered walkway: flat roof on posts along a straight line (Crawford -> Math). */
function CoveredWalk({ from, to, width = 3.6 }: { from: Pt; to: Pt; width?: number }) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  const posts = Math.max(2, Math.round(len / 4))
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 3.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.22, len]} />
        <meshStandardMaterial color="#e9e6df" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.18, 0]}>
        <boxGeometry args={[width + 0.15, 0.08, len + 0.1]} />
        <meshStandardMaterial color="#7d1f1f" roughness={0.7} />
      </mesh>
      {Array.from({ length: posts + 1 }, (_, i) =>
        [-1, 1].map((sx) => (
          <mesh key={`${i}${sx}`} position={[(sx * (width - 0.3)) / 2, 1.6, -len / 2 + (len * i) / posts]} material={dark} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 3.2, 8]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** Open canopy over a footprint (the Atrium's walk-under structures). */
function FootprintCanopy({ poly }: { poly: Pt[] }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    g.translate(0, 3.6, 0)
    return g
  }, [poly])
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#e3e1db" roughness={0.7} />
      </mesh>
      {poly.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.8, z]} material={dark} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 3.6, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** A flight of concrete stairs from a (top) to b (bottom), with cheek walls and handrails. */
function Stairs({ a, b, width = 3.4, rise = 1.4 }: { a: Pt; b: Pt; width?: number; rise?: number }) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  const n = Math.max(4, Math.round(len / 0.45))
  const run = len / n
  const stepMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d6d1c6', roughness: 0.9 }), [])
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, yaw, 0]}>
      {Array.from({ length: n }, (_, i) => {
        const h = Math.max(0.06, rise * (1 - i / n))
        return (
          <mesh key={i} position={[0, h / 2, run * (i + 0.5)]} material={stepMat} castShadow receiveShadow>
            <boxGeometry args={[width, h, run + 0.01]} />
          </mesh>
        )
      })}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[(sx * (width + 0.3)) / 2, 0, 0]}>
          <mesh position={[0, rise / 2 + 0.1, len / 2]} rotation={[Math.atan2(rise, len), 0, 0]} material={concrete} castShadow>
            <boxGeometry args={[0.3, 0.5, Math.hypot(len, rise)]} />
          </mesh>
          <mesh position={[0, rise / 2 + 1.05, len / 2]} rotation={[Math.atan2(rise, len), 0, 0]} material={dark}>
            <boxGeometry args={[0.06, 0.06, Math.hypot(len, rise)]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Domed skylight on the Library roof. */
function LibraryDome({ at, y }: { at: Pt; y: number }) {
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh position={[0, 0.4, 0]} material={concrete}>
        <cylinderGeometry args={[3.4, 3.4, 0.8, 24]} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cfe1ea" roughness={0.2} metalness={0.3} />
      </mesh>
    </group>
  )
}

/** Open white bell tower on the brick base at the library's curved end. */
function LibraryBellTower() {
  const beamGeometry=useMemo(()=>{
    const beams:THREE.BufferGeometry[]=[]
    const bar=(a:THREE.Vector3,b:THREE.Vector3)=>{
      const d=b.clone().sub(a),g=new THREE.CylinderGeometry(.065,.065,d.length(),8)
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()))
      g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);beams.push(g)
    }
    for(const x of [-1.5,1.5])for(const z of [-.85,.85])bar(new THREE.Vector3(x,7.6,z),new THREE.Vector3(x,21,z))
    for(const y of [7.7,14.3,20.9]){
      for(const z of [-.85,.85])bar(new THREE.Vector3(-1.5,y,z),new THREE.Vector3(1.5,y,z))
      for(const x of [-1.5,1.5])bar(new THREE.Vector3(x,y,-.85),new THREE.Vector3(x,y,.85))
    }
    for(const z of [-.85,.85])for(const y of [7.7,14.3]){
      bar(new THREE.Vector3(-1.5,y,z),new THREE.Vector3(1.5,y+6.6,z))
      bar(new THREE.Vector3(1.5,y,z),new THREE.Vector3(-1.5,y+6.6,z))
    }
    return beams
  },[])
  const bell=useMemo(()=>new THREE.LatheGeometry([
    new THREE.Vector2(.30,0),new THREE.Vector2(.25,.08),new THREE.Vector2(.20,.36),
    new THREE.Vector2(.12,.46),new THREE.Vector2(.04,.48),new THREE.Vector2(0,.48),
  ],16),[])
  return <group position={[-168.4,0,-65.9]}>
    <mesh position={[0,3.8,0]} castShadow receiveShadow><boxGeometry args={[3.5,7.6,2.2]}/><meshStandardMaterial color="#a96d57" roughness={.9}/></mesh>
    <mesh position={[0,7.65,0]}><boxGeometry args={[3.7,.2,2.4]}/><meshStandardMaterial color="#e5e5dc"/></mesh>
    {beamGeometry.map((geometry,i)=><mesh key={i} geometry={geometry} material={white} castShadow />)}
    {[-1.05,-.35,.35,1.05].map((x,i)=><group key={x} position={[x,20.15,0]}>
      <mesh geometry={bell} rotation={[0,0,i%2?.05:-.05]}><meshStandardMaterial color="#474740" metalness={.55} roughness={.4}/></mesh>
      <mesh position={[0,-.05,0]}><sphereGeometry args={[.07,8,6]}/><meshStandardMaterial color="#33332e"/></mesh>
    </group>)}
  </group>
}

/** Where the Math building's south stairs start, and which way they run. */
function mathStairs(campus: Campus): { a: Pt; b: Pt } | null {
  const D = campus.buildings.find((x) => x.code === 'D')
  if (!D) return null
  let best = 0
  let ang = 0
  for (let i = 0; i < D.poly.length; i++) {
    const p = D.poly[i]
    const q = D.poly[(i + 1) % D.poly.length]
    const l = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (l > best) {
      best = l
      ang = Math.atan2(q[0] - p[0], q[1] - p[1])
    }
  }
  let ux = Math.sin(ang)
  let uz = Math.cos(ang)
  if (uz < 0) {
    ux = -ux
    uz = -uz // point south (away from the Student Center)
  }
  const [cx, cz] = centroid(D.poly)
  let far = 0
  for (const [x, z] of D.poly) far = Math.max(far, (x - cx) * ux + (z - cz) * uz)
  const a: Pt = [cx + ux * (far + 0.4), cz + uz * (far + 0.4)]
  return { a, b: [a[0] + ux * 9, a[1] + uz * 9] }
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
    // the little round plot between the crossing walkways, by the parking lot south-east of the hall
    const letters: Pt | null = R702 ? [-208, 171] : null // the lens-shaped plot between the walkways by the lot
    // letters face away from the hall, toward the drive (readable as you arrive)
    // face the parking lot next to the plot (readable as you drive/walk in)
    const lot = campus.areas
      .filter((a) => a.kind === 'parking')
      .map((a) => centroid(a.poly))
      .sort((p, q) => Math.hypot(p[0] + 208, p[1] - 171) - Math.hypot(q[0] + 208, q[1] - 171))[0]
    const lettersYaw = letters && lot ? Math.atan2(lot[0] - letters[0], lot[1] - letters[1]) : 0
    void C
    // facing ends of Math (D) and Administration (B), and of Crawford (E) and Math
    // Follow the existing walkway from the Mathematics end toward Administration,
    // then turn into the middle of its facing facade.
    const tents = { from: [-137.08, -200.03] as Pt, corner: [-105.8, -148.2] as Pt, to: [-98.9, -153.0] as Pt }
    const walk = { from: [-240, -135] as Pt, to: [-205, -158] as Pt }
    const stairs = mathStairs(campus)
    const lib = campus.buildings.find((b) => b.code === 'C')
    return { rock, letters, lettersYaw, globe, tents, walk, stairs, lib }
  }, [campus])
  const flags = campus.features.filter((f) => f.kind === 'flagpole')
  return (
    <group>
      {placed.rock && <SlapTheRock at={placed.rock} />}
      {placed.letters && <KsuLetters at={placed.letters} yaw={placed.lettersYaw} />}
      {placed.globe && <GlobePlaza at={[placed.globe.x, placed.globe.z]} />}
      <MathCourtyard />
      <TentRow from={placed.tents.from} to={placed.tents.corner} />
      <TentRow from={placed.tents.corner} to={placed.tents.to} />
      <CoveredWalk from={placed.walk.from} to={placed.walk.to} />
      {placed.stairs && <Stairs a={placed.stairs.a} b={placed.stairs.b} />}
      {campus.paths
        .filter((p) => p.kind === 'steps')
        .map((p, i) => (
          <Stairs key={`st${i}`} a={p.pts[0]} b={p.pts[p.pts.length - 1]} width={Math.max(3, p.w)} rise={Math.min(1.6, 0.12 * Math.hypot(p.pts[0][0] - p.pts[p.pts.length - 1][0], p.pts[0][1] - p.pts[p.pts.length - 1][1]))} />
        ))}
      {campus.canopies.filter((b) => b.id !== '559995482' && b.id !== '559995483').map((b) => (
        <FootprintCanopy key={b.id} poly={b.poly} />
      ))}
      {placed.lib && <><LibraryDome at={centroid(placed.lib.poly)} y={placed.lib.h} /><LibraryBellTower /></>}
      {campus.features.filter((f) => !(f.kind === 'bench' && f.x >= -205 && f.x <= -177 && f.z >= 57 && f.z <= 63)).map((f, i) =>
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
  out.push({ name: 'KSU Sign · Hornet Village', at: [-208, 171], r: 10 })
  const g = campus.features.find((f) => f.kind === 'sculpture')
  if (g) out.push({ name: 'The Globe', at: [g.x, g.z], r: 16 })
  return out
}
