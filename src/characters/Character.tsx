import { useFrame } from '@react-three/fiber'
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
export type Accessory = 'none' | 'glasses' | 'square' | 'sunglasses'

export interface CharacterProps {
  color?: PaletteName
  headwear?: Headwear
  face?: Face
  accessory?: Accessory
  top?: 'none' | 'tee' | 'hoodie' | 'ksu-tee' | 'ksu-hoodie' | 'jersey'
  topColor?: string
  bottom?: 'none' | 'shorts' | 'skirt' | 'pants'
  shoes?: 'none' | 'sneakers' | 'black'
  bag?: 'none' | 'black' | 'cream' | 'brown'
  backpack?: boolean
  /** world-space point the right hand reaches toward (in this character's parent space) */
  reach?: React.MutableRefObject<THREE.Vector3 | null>
  /** performance.now() of the latest swing; the right arm sweeps through a stroke for ~0.4 s */
  swingAt?: React.MutableRefObject<number>
  /** walking speed 0..1 (drives the walk cycle) */
  walk?: React.MutableRefObject<number>
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
        <group position={[0, HEAD_Y + 0.08, -0.02]} rotation={[-0.2, 0, 0]}>
          {/* crown: hugs the top of the head; tilted back so the forehead opening clears the eyes */}
          <mesh scale={[1.06, 0.92, 1.05]} material={hat}>
            <sphereGeometry args={[HEAD_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* panel seams */}
          {[0, Math.PI / 3, -Math.PI / 3].map((ry) => (
            <mesh key={ry} rotation={[0, ry, 0]} scale={[1.07, 0.93, 1.06]} material={seam}>
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
          <group rotation={[0, 1.3, 0]}>
            <mesh position={[0, -0.01, -HEAD_R * 0.85]} rotation={[-0.38, 0, 0]} scale={[1.1, 1, 1.75]} material={brimMat}>
              <cylinderGeometry args={[0.26, 0.26, 0.035, 36, 1, false, Math.PI / 2, Math.PI]} />
            </mesh>
          </group>
        </group>
      )
    case 'beanie': // sits high and pushed back so the eyes show
      return (
        <group position={[0, HEAD_Y + 0.13, -0.05]} rotation={[-0.38, 0, 0]}>
          <mesh scale={[1.05, 0.95, 1.03]} material={hat}>
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

function Glasses({ style }: { style: Accessory }) {
  return (
    <group>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={onHead(s * 0.3, 0.06, 1.02)} rotation={[0, s * 0.3, 0]} material={ink}>
          <torusGeometry args={[0.075, 0.012, 8, style === 'square' ? 4 : 24]} />
          {style === 'sunglasses' && <mesh position={[0,0,-0.006]}><circleGeometry args={[0.064,24]} /><meshBasicMaterial color="#25252b" /></mesh>}
        </mesh>
      ))}
      <mesh position={onHead(0, 0.08, 1.03)} rotation={[0, 0, Math.PI / 2]} material={ink}>
        <capsuleGeometry args={[0.008, 0.06, 4, 6]} />
      </mesh>
    </group>
  )
}

function Arm({ side, body, accent, armRef }: { side: -1 | 1; body: THREE.Material; accent: THREE.Material; armRef?: React.Ref<THREE.Group> }) {
  return (
    <group ref={armRef} position={[side * 0.25, 0.7, 0]} rotation={[0, 0, side * 0.28]}>
      <mesh position={[0, -0.15, 0]} material={body}>
        <capsuleGeometry args={[0.075, 0.16, 8, 16]} />
      </mesh>
      <mesh position={[0, -0.24, 0]} rotation={[0, 0, 0]} material={accent}>
        <cylinderGeometry args={[0.083, 0.083, 0.05, 20]} />
      </mesh>
      <mesh position={[0, -0.33, 0.01]} scale={[1, 1.05, 0.95]} material={body}>
        <sphereGeometry args={[0.1, 24, 24]} />
      </mesh>
    </group>
  )
}

export function Character({
  color = 'cream',
  headwear = 'headband',
  face = 'dots',
  accessory = 'none',
  top = 'none', topColor = '#29292c', bottom = 'none', backpack = false, shoes = 'none', bag = 'none',
  variant = 'normal',
  reach,
  swingAt,
  walk,
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
  const accent = useClay(accentHex, variant)
  const logo = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256
    const ctx = canvas.getContext('2d')!; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'bold 150px Georgia'; ctx.lineWidth = 9; ctx.strokeStyle = '#231e1b'; ctx.strokeText('KSU', 256, 125)
    ctx.fillStyle = '#ffc629'; ctx.fillText('KSU', 256, 125)
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture
  }, [])

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
      torso.current.position.y = Math.sin(t * 2.2) * 0.012 + Math.abs(Math.sin(phase.current)) * 0.05 * w // breathing + step bounce
      legs.current.forEach((l, i) => l && (l.rotation.x = Math.sin(phase.current + i * Math.PI) * 0.7 * w))
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
        {/* legs */}
        {[-1, 1].map((s, i) => (
          <group key={s} ref={(g) => void (legs.current[i] = g)} position={[s * 0.115, 0.36, 0]}>
            {(bottom === 'shorts' || bottom === 'pants') && <mesh position={[0, bottom === 'pants' ? -0.12 : -0.04, 0]}><capsuleGeometry args={[0.117, bottom === 'pants' ? 0.25 : 0.11, 8, 16]} /><meshStandardMaterial color="#4e526b" roughness={0.9} /></mesh>}
            {shoes !== 'none' && <group position={[0,-0.285,0.055]}><mesh scale={[1,0.7,1.3]}><sphereGeometry args={[0.12,20,14]} /><meshStandardMaterial color={shoes === 'black' ? '#282a2a' : '#f1eee6'} roughness={0.85}/></mesh><mesh position={[0,-0.055,0]} scale={[1,0.24,1.3]}><sphereGeometry args={[0.122,20,10]} /><meshStandardMaterial color="#e4ded1" /></mesh></group>}
            <mesh position={[0, -0.16, 0]} castShadow material={body}>
              <capsuleGeometry args={[0.105, 0.2, 8, 16]} />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh position={[0, 0.56, 0]} scale={[0.86, 1.12, 0.76]} castShadow material={body}>
          <sphereGeometry args={[0.29, 32, 24]} />
        </mesh>
        {top !== 'none' && <group>
          <mesh position={[0, 0.57, 0]} scale={[0.94, 1.17, 0.82]} castShadow><sphereGeometry args={[0.285, 32, 24]} /><meshStandardMaterial color={topColor} roughness={0.9} /></mesh>
          {[-1,1].map(side => <mesh key={side} position={[side*0.245,0.66,0]} rotation={[0,0,-side*0.35]}><capsuleGeometry args={[0.095, top.includes('hoodie') ? 0.20 : 0.06, 6, 12]} /><meshStandardMaterial color={topColor} roughness={0.9} /></mesh>)}
          {(top === 'ksu-tee' || top === 'ksu-hoodie' || top === 'jersey') && <mesh position={[0,0.62,0.245]}><planeGeometry args={[0.32,0.16]} /><meshBasicMaterial map={logo} transparent alphaTest={0.1} /></mesh>}
          {top === 'jersey' && <mesh position={[0,0.49,0.245]}><planeGeometry args={[0.3,0.025]} /><meshBasicMaterial color="#ffc629" /></mesh>}
        </group>}
        {top.includes('hoodie') && <group>
          <mesh position={[0,0.49,0.245]}><boxGeometry args={[0.22,0.09,0.035]} /><meshStandardMaterial color={topColor} /></mesh>
          {[-0.045,0.045].map(x => <mesh key={x} position={[x,0.73,0.245]}><boxGeometry args={[0.012,0.11,0.01]} /><meshBasicMaterial color="#e6dfcf" /></mesh>)}
        </group>}
        {bottom === 'skirt' && <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.2, 0.3, 0.21, 12]} /><meshStandardMaterial color="#706383" /></mesh>}
        {(backpack || bag !== 'none') && <group position={[0,0.6,-0.27]}><mesh scale={[1,1.15,0.65]}><capsuleGeometry args={[0.17,0.15,8,16]} /><meshStandardMaterial color={bag === 'cream' ? '#e8dfca' : bag === 'black' ? '#282a2b' : '#805b45'} roughness={0.85} /></mesh><mesh position={[0,-0.08,-0.11]} scale={[1,0.6,0.45]}><capsuleGeometry args={[0.13,0.08,8,16]} /><meshStandardMaterial color={bag === 'cream' ? '#d7cbb7' : '#5d514b'} /></mesh></group>}
        <Arm side={-1} body={body} accent={top === 'none' ? body : accent} armRef={rArm} />
        <Arm side={1} body={body} accent={top === 'none' ? body : accent} armRef={lArm} />
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
