import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { ACCENT, INK, OFFWHITE, PALETTE, shade, type PaletteName } from './palette'

// Procedural "clay toy" character built from primitives (no rig, no model
// files). Proportions follow the concept sheet: oversized head, stubby body,
// mitten hands, wristbands.
//
// Units: ~1.5 tall, feet at y=0, facing +z.

export type Headwear = 'none' | 'headband' | 'cap' | 'bun' | 'headphones' | 'bucket' | 'beanie' | 'glasses'
export type Face = 'dots' | 'happy' | 'surprised' | 'wink' | 'angry'
export type Accessory = 'none' | 'glasses' | 'square' | 'rectangle' | 'sunglasses'

export interface CharacterProps {
  color?: PaletteName
  headwear?: Headwear
  face?: Face
  accessory?: Accessory
  top?: 'none' | 'tee' | 'hoodie' | 'ksu-tee' | 'ksu-hoodie' | 'jersey'
  topColor?: string
  bottom?: 'none' | 'shorts' | 'skirt' | 'pants'
  bottomColor?: string
  jerseyNumber?: string
  shoes?: 'none' | 'sneakers' | 'black' | 'boots'
  bag?: 'none' | 'black' | 'cream' | 'brown'
  bagStyle?: 'backpack' | 'sling'
  backpack?: boolean
  /** world-space point the right hand reaches toward (in this character's parent space) */
  reach?: React.MutableRefObject<THREE.Vector3 | null>
  /** performance.now() of the latest swing; the right arm sweeps through a stroke for ~0.4 s */
  swingAt?: React.MutableRefObject<number>
  /** walking speed 0..1 (drives the walk cycle) */
  walk?: React.MutableRefObject<number>
  /** Optional seated and eating animation weights, for ambient indoor characters. */
  sit?: React.MutableRefObject<number>
  /** Vertical lift while seated, in character-local units. */
  sitLift?: number
  eat?: React.MutableRefObject<number>
  work?: React.MutableRefObject<number>
  /** Right arm raised forward and up, as if pointing at a board in front of the character. */
  point?: React.MutableRefObject<number>
  /** both arms raised (goalkeeper reaching high) */
  armsUp?: boolean
  /** sideways lean in radians (goalkeeper stepping); positive leans to the character's left */
  lean?: number
  /** visual variant: clone = translucent shimmer, rival = darker + glow */
  variant?: 'normal' | 'clone' | 'rival'
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  children?: ReactNode
}

function useClay(color: string, variant: CharacterProps['variant']) {
  return useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.78,
      metalness: 0,
      sheen: 0.6,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5),
    })
    if (variant === 'clone') {
      // solid "digital copy" look: cool tint + glow (translucency showed hats through faces)
      m.color = new THREE.Color(color).lerp(new THREE.Color('#bfe9ff'), 0.35)
      m.emissive = new THREE.Color('#7fd6ff')
      m.emissiveIntensity = 0.32
    }
    if (variant === 'rival') {
      m.sheenColor = new THREE.Color('#9aa0b0')
    }
    return m
  }, [color, variant])
}

const inkNormal = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.4 })
const inkRival = new THREE.MeshStandardMaterial({ color: '#ffd9c9', emissive: '#ff5a3c', emissiveIntensity: 1.4 })
let ink = inkNormal

// head geometry constants
const HEAD_Y = 1.1
const HEAD_R = 0.37

/** Point on the (slightly squashed) head surface at azimuth/elevation. */
function onHead(az: number, el: number, out = 1.0): [number, number, number] {
  const r = HEAD_R * out
  return [Math.sin(az) * Math.cos(el) * r, HEAD_Y + Math.sin(el) * r * 0.95, Math.cos(az) * Math.cos(el) * r * 0.95]
}

function Eyes({ face, rival }: { face: Face; rival: boolean }) {
  ink = rival ? inkRival : inkNormal
  const eye = (side: -1 | 1) => {
    const p = onHead(side * 0.3, 0.06, 0.985)
    if (face === 'happy' || (face === 'wink' && side === 1)) {
      return (
        <mesh key={side} position={p} rotation={[0, side * 0.3, 0]} material={ink}>
          <torusGeometry args={[0.045, 0.014, 8, 16, Math.PI]} />
        </mesh>
      )
    }
    return (
      <mesh key={side} position={p} rotation={[0, side * 0.3, 0]} scale={[1, 1, 0.5]} material={ink}>
        <capsuleGeometry args={[0.032, 0.065, 6, 12]} />
      </mesh>
    )
  }
  return (
    <group>
      {eye(-1)}
      {eye(1)}
      {face === 'angry' &&
        ([-1, 1] as const).map((s) => (
          <mesh key={s} position={onHead(s * 0.3, 0.2, 0.99)} rotation={[0, s * 0.3, -s * 0.65]} material={ink}>
            <capsuleGeometry args={[0.011, 0.06, 4, 8]} />
          </mesh>
        ))}
      {face === 'angry' && (
        <mesh position={onHead(0, -0.18, 0.985)} rotation={[0, 0, Math.PI / 2]} material={ink}>
          <capsuleGeometry args={[0.01, 0.06, 4, 8]} />
        </mesh>
      )}
      {(face === 'happy' || face === 'wink' || face === 'dots') && (
        <mesh position={onHead(0, -0.14, 0.99)} rotation={[0, 0, Math.PI]} material={ink}>
          <torusGeometry args={[0.04, 0.011, 8, 16, Math.PI]} />
        </mesh>
      )}
      {face === 'surprised' && (
        <mesh position={onHead(0, -0.17, 0.985)} scale={[1, 1.2, 0.5]} material={ink}>
          <sphereGeometry args={[0.025, 12, 12]} />
        </mesh>
      )}
    </group>
  )
}

function HeadwearMesh({ kind, body, accent }: { kind: Headwear; body: string; accent: string }) {
  const hatColor = kind === 'cap' ? OFFWHITE : kind === 'bucket' ? '#' + new THREE.Color(body).lerp(new THREE.Color('#ffffff'), 0.28).getHexString() : shade(body, 0.85)
  const hat = useClay(hatColor, 'normal')
  const acc = useClay(accent, 'normal')
  const brimMat = useClay(kind === 'cap' ? PALETTE.slate : hatColor, 'normal')
  const dark = useClay(shade(body, 0.62), 'normal')
  const seam = useClay(shade(hatColor, 0.86), 'normal')
  const hole = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a4650', roughness: 0.9, side: THREE.DoubleSide }), [])
  // open brims are seen from both sides (from above and from below/inside)
  const brimSurface = useMemo(() => {
    const m = hat.clone()
    m.side = THREE.DoubleSide
    return m
  }, [hat])

  switch (kind) {
    case 'headband':
      return (
        <mesh position={[0, HEAD_Y + 0.15, 0]} rotation={[Math.PI / 2 - 0.12, 0, 0]} scale={[1, 0.95, 1.9]} material={acc}>
          <torusGeometry args={[0.335, 0.045, 12, 40]} />
        </mesh>
      )
    case 'bun':
      return (
        <group>
          <mesh position={[0, HEAD_Y + 0.15, 0]} rotation={[Math.PI / 2 - 0.12, 0, 0]} scale={[1, 0.95, 1.9]} material={acc}>
            <torusGeometry args={[0.335, 0.045, 12, 40]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.4, -0.04]} material={hat}>
            <sphereGeometry args={[0.13, 24, 24]} />
          </mesh>
          <mesh position={[0, HEAD_Y + 0.52, -0.05]} material={hat}>
            <sphereGeometry args={[0.07, 16, 16]} />
          </mesh>
        </group>
      )
    case 'cap': // backwards cap (from the reference): deep round crown, forehead strap opening, brim out back-left
      return (
        <group position={[0, HEAD_Y, 0]} rotation={[-0.48, 0, 0]}>
          {/* Keep the crown concentric with the head so the two surfaces cannot intersect and flicker. */}
          <mesh scale={[1.065, 1.015, 1.015]} material={hat}>
            <sphereGeometry args={[HEAD_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* panel seams */}
          {[0, Math.PI / 3, -Math.PI / 3].map((ry) => (
            <mesh key={ry} rotation={[0, ry, 0]} scale={[1.07, 1.02, 1.02]} material={seam}>
              <torusGeometry args={[HEAD_R, 0.004, 4, 48, Math.PI]} />
            </mesh>
          ))}
          <mesh position={[0, HEAD_R * 0.9, 0]} material={hat}>
            <sphereGeometry args={[0.04, 14, 14]} />
          </mesh>
          {/* snapback opening on the forehead: dark arch + strap across it */}
          <group position={[0, 0.0, HEAD_R * 1.045]} rotation={[-0.12, 0, 0]}>
            <mesh material={hole}>
              <circleGeometry args={[0.11, 24, 0, Math.PI]} />
            </mesh>
            <mesh position={[0, 0, 0.004]} material={hat}>
              <torusGeometry args={[0.11, 0.022, 10, 28, Math.PI]} />
            </mesh>
            <mesh position={[0, 0.025, 0.006]} rotation={[0, 0, Math.PI / 2]} material={brimMat}>
              <capsuleGeometry args={[0.014, 0.17, 4, 8]} />
            </mesh>
          </group>
          {/* brim: long, pointing back and toward the character's right, drooping down */}
          <group rotation={[0, 0.3, 0]}>
            <mesh position={[0, -0.01, -HEAD_R * 0.85]} rotation={[-0.38, 0, 0]} scale={[1.1, 1, 1.75]} material={brimMat}>
              <cylinderGeometry args={[0.26, 0.26, 0.035, 36, 1, false, Math.PI / 2, Math.PI]} />
            </mesh>
          </group>
        </group>
      )
    case 'beanie': // sits high and pushed back so the eyes show
      return (
        <group position={[0, HEAD_Y, 0]} rotation={[-0.62, 0, 0]}>
          <mesh scale={[1.07, 1.02, 1.02]} material={hat}>
            <sphereGeometry args={[HEAD_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.5]} material={dark}>
            <torusGeometry args={[0.37, 0.05, 12, 40]} />
          </mesh>
          <mesh position={[0, HEAD_R * 0.98, 0]} material={dark}>
            <sphereGeometry args={[0.07, 14, 14]} />
          </mesh>
        </group>
      )
    case 'bucket': // bucket hat (from the reference): tall soft crown, band, wide downturned brim above the eyes
      return (
        <group position={[0, HEAD_Y + 0.17, -0.03]} rotation={[-0.16, 0, 0]}>
          <mesh position={[0, 0.13, 0]} material={hat}>
            <cylinderGeometry args={[0.27, 0.35, 0.26, 40]} />
          </mesh>
          <mesh position={[0, 0.26, 0]} scale={[1, 0.42, 1]} material={hat}>
            <sphereGeometry args={[0.27, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={seam}>
            <torusGeometry args={[0.35, 0.012, 8, 48]} />
          </mesh>
          {/* brim: sloping down and out all round, with a soft rolled edge */}
          <mesh position={[0, -0.04, 0]} material={brimSurface}>
            <cylinderGeometry args={[0.35, 0.55, 0.12, 48, 1, true]} />
          </mesh>
          <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]} material={hat}>
            <torusGeometry args={[0.55, 0.028, 10, 56]} />
          </mesh>
        </group>
      )
    case 'glasses':
      return <Glasses style="glasses" />
    case 'headphones':
      return (
        <group position={[0, HEAD_Y, 0]}>
          <mesh rotation={[0, 0, 0]} material={dark}>
            <torusGeometry args={[HEAD_R + 0.04, 0.035, 12, 32, Math.PI]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (HEAD_R + 0.02), 0, 0]} rotation={[0, 0, Math.PI / 2]} material={dark}>
              <cylinderGeometry args={[0.13, 0.13, 0.1, 24]} />
            </mesh>
          ))}
        </group>
      )
    default:
      return null
  }
}

/** Flat rounded-rectangle frame outline (w x h), facing +z. */
function frameShape(w: number, h: number, r: number, t: number) {
  const rect = (hw: number, hh: number, rr: number) => { const p = new THREE.Path(); p.moveTo(-hw + rr, -hh); p.lineTo(hw - rr, -hh); p.quadraticCurveTo(hw, -hh, hw, -hh + rr); p.lineTo(hw, hh - rr); p.quadraticCurveTo(hw, hh, hw - rr, hh); p.lineTo(-hw + rr, hh); p.quadraticCurveTo(-hw, hh, -hw, hh - rr); p.lineTo(-hw, -hh + rr); p.quadraticCurveTo(-hw, -hh, -hw + rr, -hh); return p }
  const outer = new THREE.Shape(rect(w / 2, h / 2, r).getPoints(8)), inner = rect(w / 2 - t, h / 2 - t, Math.max(0.004, r - t))
  outer.holes.push(inner)
  return new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: false, curveSegments: 8 })
}
function Glasses({ style }: { style: Accessory }) {
  // Square: soft rounded squares. Rectangular: wide, slim rounded frames (like classic wayfarers).
  const frame = useMemo(() => style === 'square' ? frameShape(0.15, 0.13, 0.04, 0.02) : style === 'rectangle' ? frameShape(0.17, 0.1, 0.035, 0.02) : null, [style])
  return (
    <group>
      {([-1, 1] as const).map((s) => (
        <group key={s} position={onHead(s * 0.3, 0.06, 1.02)} rotation={[0, s * 0.3, 0]}>
          {frame ? <mesh key={style} geometry={frame} material={ink} position={[0, 0, -0.006]} /> : <mesh key="round" material={ink}><torusGeometry args={[0.075, 0.012, 8, 24]} /></mesh>}
        </group>
      ))}
      <mesh position={onHead(0, 0.08, 1.03)} rotation={[0, 0, Math.PI / 2]} material={ink}>
        <capsuleGeometry args={[0.008, 0.06, 4, 6]} />
      </mesh>
    </group>
  )
}

function Arm({ side, body, armRef, top, topColor }: { side: -1 | 1; body: THREE.Material; armRef?: React.Ref<THREE.Group>; top: NonNullable<CharacterProps['top']>; topColor: string }) {
  const longSleeve = top === 'hoodie' || top === 'ksu-hoodie'
  return <group ref={armRef} position={[side * 0.245, 0.68, 0]} rotation={[0, 0, side * 0.24]}>
    {top === 'none' ? <mesh position={[0,-0.105,0]} material={body}><capsuleGeometry args={[0.075,0.10,10,20]} /></mesh> : <>
      {/* Roomy sleeves: a puffed short sleeve, or a slouchy long sleeve gathered into a cuff. */}
      <mesh position={[0,longSleeve ? -0.1 : -0.055,0]} castShadow><capsuleGeometry args={[longSleeve ? 0.102 : 0.1,longSleeve ? 0.11 : 0.045,10,20]} /><meshStandardMaterial color={topColor} roughness={0.92} /></mesh>
      {!longSleeve && <><mesh position={[0,-0.115,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.092,0.014,8,24]} /><meshStandardMaterial color={topColor} roughness={0.97} /></mesh><mesh position={[0,-0.15,0]} material={body}><capsuleGeometry args={[0.069,0.06,8,16]} /></mesh></>}
      {longSleeve && <mesh position={[0,-0.195,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.075,0.026,10,24]} /><meshStandardMaterial color={topColor} roughness={0.97}/></mesh>}
    </>}
    <mesh position={[0,-0.235,0.012]} material={body}><sphereGeometry args={[0.087,24,18]} /></mesh>
  </group>
}

/** A printed graphic or patch that wraps the garment's cylindrical middle exactly (no flat cards poking out). */
function Print({ r, z, y, h, arc, map, color }: { r: number; z: number; y: number; h: number; arc: number; map?: THREE.Texture; color?: string }) {
  return <mesh position={[0,y,0]} scale={[1,1,z]}>
    <cylinderGeometry args={[r+0.003, r+0.003, h, 24, 1, true, -arc/2, arc]} />
    {map ? <meshStandardMaterial map={map} transparent alphaTest={0.1} roughness={0.9} /> : <meshStandardMaterial color={color} roughness={1} />}
  </mesh>
}

/** Rounded school backpack sitting on the back, with a front pocket, zip, top handle and padded straps over the shoulders. */
function Backpack({ color, trim, back, front }: { color: string; trim: string; back: number; front: number }) {
  const straps = useMemo(() => [-1, 1].map(s => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    [s*0.12,0.68,-back+0.01],[s*0.14,0.78,-back*0.45],[s*0.15,0.79,0.02],[s*0.16,0.72,front*0.85],[s*0.165,0.58,front+0.012],[s*0.16,0.44,front+0.008],
  ].map(([x,y,z]) => new THREE.Vector3(x,y,z))), 32, 0.024, 8, false)), [back, front])
  return <group>
    <RoundedBox args={[0.38,0.44,0.2]} radius={0.08} smoothness={6} position={[0,0.55,-back-0.095]} castShadow><meshStandardMaterial color={color} roughness={0.85} /></RoundedBox>
    <RoundedBox args={[0.28,0.17,0.08]} radius={0.035} smoothness={4} position={[0,0.44,-back-0.215]}><meshStandardMaterial color={color} roughness={0.85} /></RoundedBox>
    <mesh position={[0,0.53,-back-0.257]}><boxGeometry args={[0.24,0.012,0.006]} /><meshStandardMaterial color={trim} /></mesh>
    <mesh position={[0.1,0.53,-back-0.262]}><boxGeometry args={[0.025,0.04,0.012]} /><meshStandardMaterial color="#c9ced0" metalness={0.4} roughness={0.4} /></mesh>
    <mesh position={[0,0.78,-back-0.09]}><torusGeometry args={[0.055,0.014,8,20,Math.PI]} /><meshStandardMaterial color={trim} /></mesh>
    {straps.map((g,i) => <mesh key={i} geometry={g} castShadow><meshStandardMaterial color={trim} roughness={0.95} /></mesh>)}
  </group>
}

/** Sling bag: one strap worn crossbody from the left shoulder to the right hip. The strap is a single smooth
 *  closed loop that hugs the garment (radius follows the shirt profile at each height); the pouch rides on it
 *  across the back, tilted to the strap's angle. */
function SlingBag({ color, trim, profile, zScale }: { color: string; trim: string; profile: THREE.Vector2[] | null; zScale: number }) {
  const { strap, pouch } = useMemo(() => {
    const radiusAt = (y: number) => {
      if (!profile) return 0.255
      for (let k = 1; k < profile.length; k++) { const a = profile[k - 1], b = profile[k]; if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y) }
      return profile[Math.floor(profile.length / 2)].x
    }
    const zs = profile ? zScale : 0.2 / 0.255, gap = 0.016
    const yAt = (phi: number) => 0.59 + 0.165 * Math.sin(phi)
    const at = (phi: number, out = gap) => { const y = yAt(phi), r = radiusAt(y); return new THREE.Vector3(Math.sin(phi) * (r + out), y, Math.cos(phi) * (r * zs + out)) }
    const pts = Array.from({ length: 48 }, (_, k) => at((k / 48) * Math.PI * 2))
    const phi = Math.PI + 0.35, centre = at(phi, gap + 0.05)
    return { strap: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 160, 0.014, 8, true), pouch: { pos: centre, yaw: phi - Math.PI } }
  }, [profile, zScale])
  return <group>
    <mesh geometry={strap} castShadow><meshStandardMaterial color={trim} roughness={0.95} /></mesh>
    <group position={pouch.pos} rotation={[0, pouch.yaw, 0]}><group rotation={[0, 0, 0.56]}>
      <RoundedBox args={[0.3,0.16,0.1]} radius={0.045} smoothness={5} castShadow><meshStandardMaterial color={color} roughness={0.85} /></RoundedBox>
      <mesh position={[0,0.032,-0.052]}><boxGeometry args={[0.24,0.008,0.006]} /><meshStandardMaterial color={trim} /></mesh>
      <mesh position={[0.1,0.032,-0.057]}><boxGeometry args={[0.02,0.032,0.01]} /><meshStandardMaterial color="#c9ced0" metalness={0.4} roughness={0.4} /></mesh>
    </group></group>
  </group>
}

export function Character({
  color = 'cream',
  headwear = 'headband',
  face = 'dots',
  accessory = 'none',
  top = 'none', topColor = '#29292c', bottom = 'none', bottomColor = '#4e526b', jerseyNumber = '12', backpack = false, shoes = 'none', bag = 'none', bagStyle = 'backpack',
  variant = 'normal',
  reach,
  swingAt,
  walk,
  sit,
  sitLift = .23,
  eat,
  work,
  point,
  armsUp = false,
  lean = 0,
  position,
  rotation,
  scale = 1,
  children,
}: CharacterProps) {
  const bodyHex = variant === 'rival' ? '#555a66' : PALETTE[color]
  const accentHex = variant === 'rival' ? ACCENT.charcoal : ACCENT[color]
  const body = useClay(bodyHex, variant)
  const logo = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256
    const ctx = canvas.getContext('2d')!; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 150px Georgia'; ctx.lineWidth = 9; ctx.strokeStyle = '#231e1b'; ctx.strokeText('KSU', 256, 125)
    ctx.fillStyle = '#ffc629'; ctx.fillText('KSU', 256, 125)
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture
  }, [])

  const jerseyDigits = useMemo(() => {
    const c=document.createElement('canvas'); c.width=256; c.height=256
    const g=c.getContext('2d')!; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 190px sans-serif'
    g.lineWidth=12; g.strokeStyle='#25211a'; g.strokeText(jerseyNumber,128,133); g.fillStyle='#ffc629'; g.fillText(jerseyNumber,128,133)
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t
  }, [jerseyNumber])
  // Garments are closed, roomy shells (the body underneath is not drawn), so nothing pokes through.
  // Their middle section is a straight cylinder so printed graphics can wrap it exactly.
  const hoodieTop = top === 'hoodie' || top === 'ksu-hoodie'
  const pocketColor = useMemo(() => '#' + new THREE.Color(topColor).multiplyScalar(0.86).getHexString(), [topColor])
  const shirtR = hoodieTop ? 0.28 : 0.265, shirtZ = 0.86
  const shirtProfile = useMemo(() => {
    const r = shirtR, hem = hoodieTop ? 0.27 : 0.30
    return [[0,hem],[r-0.045,hem],[r-0.008,hem+0.03],[r,hem+0.10],[r,0.60],[r-0.012,0.68],[r-0.045,0.735],[0.15,0.772],[0,0.772]].map(([x,y]) => new THREE.Vector2(x,y))
  }, [shirtR, hoodieTop])
  const root = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  const phase = useRef(0)
  const rArm = useRef<THREE.Group>(null)
  const lArm = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const seed = useMemo(() => Math.random() * 10, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    if (torso.current) {
      const w = walk?.current ?? 0
      phase.current += w * 0.22
      const seated=THREE.MathUtils.clamp(sit?.current??0,0,1)
      torso.current.position.y = Math.sin(t * 2.2) * 0.012 + Math.abs(Math.sin(phase.current)) * 0.05 * w + seated*sitLift
      legs.current.forEach((l, i) => l && (l.rotation.x = THREE.MathUtils.lerp(Math.sin(phase.current + i * Math.PI) * 0.7 * w,-1.15,seated)))
      if (w > 0.05 && !reach?.current && rArm.current && lArm.current) {
        // arms swing opposite the legs
        rArm.current.rotation.x = Math.sin(phase.current) * 0.6 * w
        lArm.current.rotation.x = -Math.sin(phase.current) * 0.6 * w
      }
      torso.current.rotation.z = THREE.MathUtils.lerp(torso.current.rotation.z, Math.sin(t * 1.1) * 0.02 + lean, 0.2)
    }
    if (armsUp && rArm.current && lArm.current) {
      rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, 0, 0.3)
      rArm.current.rotation.z = THREE.MathUtils.lerp(rArm.current.rotation.z, -2.6, 0.3)
      lArm.current.rotation.z = THREE.MathUtils.lerp(lArm.current.rotation.z, 2.6, 0.3)
      return
    }
    if (lArm.current) lArm.current.rotation.z = THREE.MathUtils.lerp(lArm.current.rotation.z, 0.28, 0.3)
    // a swing overrides the reach: wind back, sweep forward and across, follow through
    // (dev builds can slow the stroke down via window.__swingMs to inspect it)
    const swingMs = (import.meta.env.DEV && (window as any).__swingMs) || 420
    const sw = swingAt ? (performance.now() - swingAt.current) / swingMs : 9
    if (rArm.current && sw >= 0 && sw < 1) {
      const e = Math.sin(sw * Math.PI)
      rArm.current.rotation.x = -0.3 - 2.3 * e // big forward/up stroke, readable from any angle
      rArm.current.rotation.z = -1.3 + 1.7 * sw
      return
    }
    // Pointing: right arm up toward the board with a small emphasis bob, left arm relaxed.
    if ((point?.current??0)>0 && rArm.current && lArm.current) {
      rArm.current.rotation.x=THREE.MathUtils.lerp(rArm.current.rotation.x,-2.25+Math.sin(t*2.4)*.12,.15)
      rArm.current.rotation.z=THREE.MathUtils.lerp(rArm.current.rotation.z,-.12,.15)
      lArm.current.rotation.x=THREE.MathUtils.lerp(lArm.current.rotation.x,-.2,.15)
      return
    }
    // A small repeated gesture reads as eating while the character is seated.
    if ((eat?.current??0)>0 && rArm.current) {
      rArm.current.rotation.x=THREE.MathUtils.lerp(rArm.current.rotation.x,-1.0-Math.max(0,Math.sin(t*2.2))*.8,.15)
      rArm.current.rotation.z=THREE.MathUtils.lerp(rArm.current.rotation.z,-.35,.15)
      return
    }
    // Desk-height gestures for writing, typing, and presenting.
    if ((work?.current??0)>0 && rArm.current && lArm.current) {
      rArm.current.rotation.x=THREE.MathUtils.lerp(rArm.current.rotation.x,-.65+Math.sin(t*2.6)*.22,.15)
      lArm.current.rotation.x=THREE.MathUtils.lerp(lArm.current.rotation.x,-.55+Math.sin(t*2.1+1)*.15,.15)
      rArm.current.rotation.z=THREE.MathUtils.lerp(rArm.current.rotation.z,-.25,.15)
      return
    }
    // right arm IK-lite: aim the arm toward the reach target
    if (rArm.current) {
      const target = reach?.current
      if (target && root.current) {
        tmp.copy(target)
        root.current.worldToLocal(tmp)
        const shoulder = new THREE.Vector3(-0.25, 0.7, 0) // character's right = -x when facing +z
        const d = tmp.sub(shoulder)
        const pitch = Math.atan2(d.z, -d.y) // swing forward
        const roll = Math.atan2(d.x, Math.hypot(d.y, d.z))
        rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, -Math.min(2.2, Math.max(-0.5, pitch)), 0.35)
        rArm.current.rotation.z = THREE.MathUtils.lerp(rArm.current.rotation.z, Math.max(-1.2, Math.min(0.6, roll)), 0.35)
      } else {
        if ((walk?.current ?? 0) <= 0.05) rArm.current.rotation.x = Math.sin(t * 1.3) * 0.08
        rArm.current.rotation.z = -0.28
      }
    }
  })

  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      <group ref={torso}>
        {/* Compact rounded stubs; trousers and shoes share their animated leg groups. */}
        {[-1, 1].map((s, i) => (
          <group key={s} ref={(g) => void (legs.current[i] = g)} position={[s * 0.108, 0.27, 0]}>
            <mesh position={[0,-0.105,0]} scale={[1,0.95,0.94]} castShadow material={body}><capsuleGeometry args={[0.105,0.10,10,20]} /></mesh>
            {/* Relaxed straight-leg fit: a little wider at the hem than the hip, never puffed out. */}
            {bottom === 'pants' && <><mesh position={[0,-0.085,0]} castShadow><cylinderGeometry args={[0.116,0.124,0.24,20]} /><meshStandardMaterial color={bottomColor} roughness={0.95}/></mesh><mesh position={[0,-0.2,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.118,0.012,8,24]} /><meshStandardMaterial color={bottomColor} roughness={0.97}/></mesh></>}
            {bottom === 'shorts' && <><mesh position={[0,-0.035,0]} castShadow><cylinderGeometry args={[0.118,0.13,0.15,20]} /><meshStandardMaterial color={bottomColor} roughness={0.95}/></mesh><mesh position={[0,-0.11,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.124,0.011,8,24]} /><meshStandardMaterial color={bottomColor} roughness={0.97}/></mesh></>}
            {shoes === 'boots' && <group position={[0,-0.255,0.035]}>
              <mesh position={[0,0.09,-0.035]} castShadow><cylinderGeometry args={[0.138,0.134,0.18,24]} /><meshStandardMaterial color="#7a5236" roughness={0.9}/></mesh>
              <mesh position={[0,0.035,0.035]} scale={[1,0.6,1.3]} castShadow><sphereGeometry args={[0.115,24,16]} /><meshStandardMaterial color="#7a5236" roughness={0.9}/></mesh>
              <mesh position={[0,-0.008,0.02]} scale={[1.06,0.2,1.35]}><sphereGeometry args={[0.115,24,16]}/><meshStandardMaterial color="#3a2a20" roughness={0.95}/></mesh>
              <mesh position={[0,0.18,-0.035]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.138,0.013,8,28]} /><meshStandardMaterial color="#5c3c27" /></mesh>
              {[0.07,0.12].map(y=><mesh key={y} position={[0,y,0.097]}><boxGeometry args={[0.07,0.008,0.01]} /><meshStandardMaterial color="#e8d8b8" /></mesh>)}
            </group>}
            {(shoes === 'sneakers' || shoes === 'black') && <group position={[0,-0.255,0.045]}>
              <mesh position={[0,0.035,0]} scale={[1,0.55,1.28]} castShadow><sphereGeometry args={[0.115,24,16]} /><meshStandardMaterial color={shoes === 'black' ? '#282a2a' : '#f2efe9'} roughness={0.85}/></mesh>
              <mesh position={[0,-0.005,0]} scale={[1.05,0.22,1.3]}><sphereGeometry args={[0.115,24,16]}/><meshStandardMaterial color="#dedbd3" roughness={0.95}/></mesh>
              <mesh position={[0,0.085,0.065]} scale={[1,0.15,0.4]}><sphereGeometry args={[0.07,16,12]}/><meshStandardMaterial color="#ddd9d0" /></mesh>
            </group>}
          </group>
        ))}
        {/* Soft chubby base body; the full garment layer conceals it when dressed. */}
        {top === 'none' && <RoundedBox args={[0.51,0.46,0.40]} radius={0.16} smoothness={8} position={[0,0.52,0]} castShadow material={body} />}
        {(bottom === 'shorts' || bottom === 'pants') && <mesh position={[0,0.335,0]} scale={[1,0.55,0.86]}><capsuleGeometry args={[0.22,0.06,8,20]} /><meshStandardMaterial color={bottomColor} roughness={0.95} /></mesh>}
        {bottom === 'skirt' && <mesh position={[0,0.34,0]} scale={[1,1,0.88]}><latheGeometry args={[[new THREE.Vector2(0.20,0.09),new THREE.Vector2(0.23,0.07),new THREE.Vector2(0.28,-0.07),new THREE.Vector2(0.27,-0.10)],32]} /><meshStandardMaterial color={bottomColor} roughness={0.9} side={THREE.DoubleSide} /></mesh>}
        {top !== 'none' && <group>
          <mesh scale={[1,1,shirtZ]} castShadow receiveShadow><latheGeometry args={[shirtProfile,48]} /><meshStandardMaterial color={topColor} roughness={0.92} /></mesh>
          {/* Soft ribbed hem and a rounded collar that hugs the neck. */}
          <mesh position={[0,(hoodieTop ? 0.27 : 0.30)+0.022,0]} rotation={[Math.PI/2,0,0]} scale={[1,shirtZ,0.8]}><torusGeometry args={[shirtR-0.035,0.03,12,48]} /><meshStandardMaterial color={topColor} roughness={0.97} /></mesh>
          {!hoodieTop && <mesh position={[0,0.765,0]} rotation={[Math.PI/2,0,0]} scale={[1,shirtZ,1]}><torusGeometry args={[0.15,0.022,10,36]} /><meshStandardMaterial color={top === 'jersey' ? '#ffc629' : topColor} roughness={0.95}/></mesh>}
          {(top === 'ksu-tee' || top === 'ksu-hoodie' || top === 'jersey') && <Print r={shirtR} z={shirtZ} y={top === 'jersey' ? 0.6 : 0.565} h={0.13} arc={0.95} map={logo} />}
          {top === 'jersey' && <>
            <Print r={shirtR} z={shirtZ} y={0.445} h={0.16} arc={0.55} map={jerseyDigits} />
            {[-1,1].map(side => <mesh key={side} position={[side*(shirtR+0.002),0.5,0]} scale={[1,1,shirtZ]}><boxGeometry args={[0.006,0.3,0.05]} /><meshStandardMaterial color="#ffc629" /></mesh>)}
          </>}
        </group>}
        {hoodieTop && <group>
          {/* Hood resting on the shoulders: a thick rolled collar plus the gathered hood on the upper back. */}
          <mesh position={[0,0.765,-0.015]} rotation={[Math.PI/2,0,0]} scale={[1,0.92,1.1]}><torusGeometry args={[0.18,0.05,14,40]} /><meshStandardMaterial color={topColor} roughness={0.95}/></mesh>
          <mesh position={[0,0.68,-shirtR*shirtZ+0.015]} scale={[0.9,0.62,0.26]} castShadow><sphereGeometry args={[0.2,24,18]} /><meshStandardMaterial color={topColor} roughness={0.95}/></mesh>
          {/* Kangaroo pocket wraps the front of the hoodie. */}
          <Print r={shirtR+0.004} z={shirtZ} y={0.395} h={0.13} arc={0.85} color={pocketColor} />
          {[-0.05,0.05].map(x => <group key={x}><mesh position={[x,0.66,shirtR*shirtZ*0.985]} rotation={[0.18,0,0]}><capsuleGeometry args={[0.007,0.09,4,8]} /><meshStandardMaterial color="#efe8d8" /></mesh><mesh position={[x,0.6,shirtR*shirtZ+0.01]}><sphereGeometry args={[0.012,8,6]} /><meshStandardMaterial color="#d8cfbd" /></mesh></group>)}
        </group>}
        {(backpack || bag !== 'none') && bagStyle === 'sling' && <SlingBag color={bag === 'cream' ? '#e8dfca' : bag === 'black' ? '#2c2e30' : '#8a6248'} trim={bag === 'cream' ? '#c9bba3' : bag === 'black' ? '#1b1c1d' : '#5f4332'} profile={top === 'none' ? null : shirtProfile} zScale={shirtZ} />}
        {(backpack || bag !== 'none') && bagStyle !== 'sling' && <Backpack color={bag === 'cream' ? '#e8dfca' : bag === 'black' ? '#2c2e30' : '#8a6248'} trim={bag === 'cream' ? '#c9bba3' : bag === 'black' ? '#1b1c1d' : '#5f4332'} back={top === 'none' ? 0.2 : shirtR*shirtZ} front={top === 'none' ? 0.2 : shirtR*shirtZ} />}
        <Arm side={-1} body={body} top={top} topColor={topColor} armRef={rArm} />
        <Arm side={1} body={body} top={top} topColor={topColor} armRef={lArm} />
        {/* head */}
        <mesh position={[0, HEAD_Y, 0]} scale={[1, 0.95, 0.95]} castShadow material={body}>
          <sphereGeometry args={[HEAD_R, 48, 48]} />
        </mesh>
        <Eyes face={face} rival={variant === 'rival'} />
        <HeadwearMesh kind={headwear} body={bodyHex} accent={accentHex} />
        {accessory !== 'none' && <Glasses style={accessory} />}
        {children}
      </group>
    </group>
  )
}
