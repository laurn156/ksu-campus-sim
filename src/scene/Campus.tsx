import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bbox, Collider, distToSeg, pointInPoly, type Building, type Campus, type Line, type Pt } from '../campus'
import { facade, parkingTexture, roofTexture, stepsTexture } from './textures'
import { lookFor } from './styles'
import { Props } from './Props'
import { Landmarks } from './Landmarks'

let aerialTex: THREE.Texture | null = null
/** The public-domain aerial photo, loaded once and shared (ground + roofs). */
export function aerial(): THREE.Texture {
  if (!aerialTex) {
    aerialTex = new THREE.TextureLoader().load('/aerial.jpg')
    aerialTex.colorSpace = THREE.SRGBColorSpace
    aerialTex.anisotropy = 8
  }
  return aerialTex
}

const BAY = 3.2 // m per window bay (texture repeat)
const FLOOR = 3.8 // m per floor

/** Outer walls between heights y0..y1: one quad per footprint edge, UVs in bays x floors so
 *  windows tile at real scale. */
function wallsGeometry(b: Building, y0 = 0, y1 = b.h): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const p = b.poly
  let u = 0
  const v0 = y0 / FLOOR
  const v1 = y1 / FLOOR
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i]
    const [x2, z2] = p[(i + 1) % p.length]
    const len = Math.hypot(x2 - x1, z2 - z1)
    const u2 = u + len / BAY
    pos.push(x1, y0, z1, x2, y0, z2, x2, y1, z2, x1, y0, z1, x2, y1, z2, x1, y1, z1)
    uv.push(u, v0, u2, v0, u2, v1, u, v0, u2, v1, u, v1)
    u = Math.round(u2) // restart each wall on a whole bay so windows line up at corners
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Inward offset of a polygon by d (mitred corners). */
function offsetPoly(poly: Pt[], d: number): Pt[] {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i]
    const [x2, z2] = poly[(i + 1) % poly.length]
    area += x1 * z2 - x2 * z1
  }
  const sgn = area > 0 ? 1 : -1 // inward normal side depends on winding
  const n = poly.length
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n]
    const p1 = poly[i]
    const p2 = poly[(i + 1) % n]
    const e1 = [p1[0] - p0[0], p1[1] - p0[1]]
    const e2 = [p2[0] - p1[0], p2[1] - p1[1]]
    const l1 = Math.hypot(e1[0], e1[1]) || 1
    const l2 = Math.hypot(e2[0], e2[1]) || 1
    const n1 = [(-e1[1] / l1) * sgn, (e1[0] / l1) * sgn]
    const n2 = [(-e2[1] / l2) * sgn, (e2[0] / l2) * sgn]
    const bx = n1[0] + n2[0]
    const bz = n1[1] + n2[1]
    const bl = Math.hypot(bx, bz) || 1
    const cos = (bx / bl) * n1[0] + (bz / bl) * n1[1]
    const m = d / Math.max(0.35, cos) // mitre length, capped on sharp corners
    out.push([p1[0] + (bx / bl) * m, p1[1] + (bz / bl) * m])
  }
  return out
}

/** Hipped roof: every eave slopes up and in to an inset ridge outline, which is capped flat. */
function hipRoofGeometry(b: Building, rise: number): THREE.BufferGeometry {
  const [x0, z0, x1, z1] = bbox(b.poly)
  const d = Math.min(7, Math.min(x1 - x0, z1 - z0) * 0.42)
  const inner = offsetPoly(b.poly, d)
  const y0 = b.h
  const y1 = b.h + rise
  const pos: number[] = []
  const n = b.poly.length
  for (let i = 0; i < n; i++) {
    const a = b.poly[i]
    const c = b.poly[(i + 1) % n]
    const ai = inner[i]
    const ci = inner[(i + 1) % n]
    pos.push(a[0], y0, a[1], c[0], y0, c[1], ci[0], y1, ci[1], a[0], y0, a[1], ci[0], y1, ci[1], ai[0], y1, ai[1])
  }
  const sides = new THREE.BufferGeometry()
  sides.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  sides.computeVertexNormals()
  const cap = flatGeometry(inner, y1).toNonIndexed()
  cap.deleteAttribute('uv')
  return mergeGeometries([sides, cap])
}

/** Flat polygon at height y (footprints, lawns, lots...). Shape is built in (x, -z) and laid flat. */
function flatGeometry(poly: Pt[], y: number, uvScale = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ShapeGeometry(shape)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  if (uvScale) {
    const pos = g.getAttribute('position')
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / uvScale
      uv[i * 2 + 1] = pos.getZ(i) / uvScale
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  return g
}

/** Ribbon along a polyline (roads, walkways). */
function ribbonGeometry(line: Line, y: number): THREE.BufferGeometry | null {
  const pts = line.pts
  if (pts.length < 2) return null
  const hw = line.w / 2
  const pos: number[] = []
  const uv: number[] = []
  let d = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[i + 1]
    const len = Math.hypot(x2 - x1, z2 - z1) || 1
    const nx = (-(z2 - z1) / len) * hw
    const nz = ((x2 - x1) / len) * hw
    pos.push(x1 + nx, y, z1 + nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz, x1 + nx, y, z1 + nz, x2 - nx, y, z2 - nz, x1 - nx, y, z1 - nz)
    const v1 = d / 0.35
    const v2 = (d + len) / 0.35
    uv.push(0, v1, 0, v2, 1, v2, 0, v1, 1, v2, 1, v1)
    d += len
  }
  // round joints: a small disc at each vertex hides the gaps between segments
  for (const [x, z] of pts) {
    const n = 8
    for (let k = 0; k < n; k++) {
      const a1 = (k / n) * Math.PI * 2
      const a2 = ((k + 1) / n) * Math.PI * 2
      pos.push(x, y, z, x + Math.cos(a2) * hw, y, z + Math.sin(a2) * hw, x + Math.cos(a1) * hw, y, z + Math.sin(a1) * hw)
      uv.push(0, 0, 0, 0, 0, 0)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

const mat = (color: string, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide })

const AREA_STYLE: Record<string, { color: string; y: number }> = {
  wood: { color: '#5f8a4a', y: 0.02 },
  grass: { color: '#8dbb62', y: 0.03 },
  water: { color: '#6aa3c9', y: 0.035 },
  track: { color: '#c0654f', y: 0.045 },
}

/** Buildings are separate meshes (walls + roof each) so the ones between the camera and the player
 *  can turn see-through, like The Sims' cutaway walls. */
export const occluders: { meshes: THREE.Mesh[] } = { meshes: [] }

function Buildings({ campus }: { campus: Campus }) {
  const items = useMemo(() => {
    const wallMat = new Map<string, THREE.MeshStandardMaterial>()
    const getWall = (style: string) => {
      if (!wallMat.has(style)) wallMat.set(style, new THREE.MeshStandardMaterial({ map: facade(style), roughness: 0.85, side: THREE.DoubleSide }))
      return wallMat.get(style)!.clone() // per building so it can fade on its own
    }
    const roofTex = roofTexture()
    return campus.buildings.map((b) => {
      const look = lookFor(b.code, b.name, b.kind)
      if (look.floors) {
        b.levels = look.floors
        b.h = look.floors * FLOOR
      }
      const parts: { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] = []
      const split = look.base && b.h > FLOOR * 1.5 ? FLOOR : 0
      if (split) parts.push({ geo: wallsGeometry(b, 0, split), mat: getWall(look.base!) })
      parts.push({ geo: wallsGeometry(b, split, b.h), mat: getWall(look.wall) })
      if (look.roof === 'hip') {
        parts.push({ geo: hipRoofGeometry(b, 4.2), mat: new THREE.MeshStandardMaterial({ color: look.roofColor ?? '#6b6966', roughness: 0.9, flatShading: true, side: THREE.DoubleSide }) })
      } else {
        const m = new THREE.MeshStandardMaterial({ map: roofTex, color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide })
        parts.push({ geo: flatGeometry(b.poly, b.h + 0.02, 8), mat: m })
      }
      return { b, parts, flat: look.roof === 'flat' }
    })
  }, [campus])
  return (
    <group>
      {items.map(({ b, parts }) => (
        <group key={b.id} userData={{ building: b.id }}>
          {parts.map((p, i) => (
            <mesh key={i} geometry={p.geo} material={p.mat} castShadow receiveShadow ref={(m) => void (m && !occluders.meshes.includes(m) && occluders.meshes.push(m))} />
          ))}
        </group>
      ))}
    </group>
  )
}

let groundTex: THREE.Texture | null = null
function illustrated(): THREE.Texture {
  if (!groundTex) {
    groundTex = new THREE.TextureLoader().load('/ground.jpg')
    groundTex.colorSpace = THREE.SRGBColorSpace
    groundTex.anisotropy = 8
  }
  return groundTex
}

/** Ground image over the exact campus extent: the public-domain aerial photo (USDA NAIP) or our
 *  illustrated map derived from it (scripts/stylize_aerial.py). */
function AerialGround({ campus, style }: { campus: Campus; style: 'photo' | 'illustrated' }) {
  const tex = useMemo(() => (style === 'photo' ? aerial() : illustrated()), [style])
  const [x0, z0, x1, z1] = campus.extent
  return (
    <group>
      {/* soft green beyond the photo's edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, -0.02, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[(x1 - x0) * 4, (z1 - z0) * 4]} />
        <meshStandardMaterial color="#6f8f55" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.01, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        {/* slight warm/bright grade so the photo sits with the illustrated buildings */}
        {/* toned down so the sunlit photo sits with the illustrated buildings */}
        <meshStandardMaterial map={tex} color={style === 'photo' ? '#c9d0bf' : '#e6e9e0'} roughness={1} />
      </mesh>
    </group>
  )
}

function Ground({ campus, overlay = false }: { campus: Campus; overlay?: boolean }) {
  const g = useMemo(() => {
    const groups: Record<string, THREE.BufferGeometry[]> = {}
    const add = (k: string, geo: THREE.BufferGeometry | null) => {
      if (!geo) return
      ;(groups[k] ??= []).push(geo)
    }
    for (const a of campus.areas) {
      if (a.kind === 'parking') add('parking', flatGeometry(a.poly, 0.05, 2.7))
      else if (a.kind.startsWith('pitch:')) {
        const sport = a.kind.slice(6)
        add(sport === 'baseball' || sport === 'softball' ? 'diamond' : 'pitch', flatGeometry(a.poly, 0.055))
      } else if (AREA_STYLE[a.kind]) add(a.kind, flatGeometry(a.poly, AREA_STYLE[a.kind].y))
    }
    for (const r of campus.roads) add(r.kind === 'service' ? 'service' : 'road', ribbonGeometry(r, r.kind === 'service' ? 0.06 : 0.065))
    for (const p of campus.paths) add(p.kind === 'steps' ? 'steps' : 'path', ribbonGeometry(p, p.kind === 'steps' ? 0.085 : 0.075))
    const merged: Record<string, THREE.BufferGeometry> = {}
    for (const [k, gs] of Object.entries(groups)) merged[k] = mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => {
      if (!x.getAttribute('uv')) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2))
      return x
    }))
    return merged
  }, [campus])
  const mats = useMemo(() => {
    const parking = new THREE.MeshStandardMaterial({ map: parkingTexture(), roughness: 0.95 })
    return {
      wood: mat(AREA_STYLE.wood.color), grass: mat(AREA_STYLE.grass.color), water: mat(AREA_STYLE.water.color, 0.3),
      track: mat(AREA_STYLE.track.color), pitch: mat('#7fb85a'), diamond: mat('#d9a172'), parking,
      road: mat('#5b5d61'), service: mat('#6a6c70'), path: mat('#e2dccf'),
      steps: new THREE.MeshStandardMaterial({ map: stepsTexture(), roughness: 0.9, side: THREE.DoubleSide }),
    } as Record<string, THREE.Material>
  }, [])
  const [x0, z0, x1, z1] = campus.extent
  return (
    <group>
      {!overlay && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} receiveShadow>
          <planeGeometry args={[(x1 - x0) * 3, (z1 - z0) * 3]} />
          <meshStandardMaterial color="#9cc46e" roughness={1} />
        </mesh>
      )}
      {Object.entries(g).map(([k, geo]) => (
        <mesh key={k} geometry={geo} material={mats[k]} receiveShadow />
      ))}
    </group>
  )
}

/** Thousands of trees as two instanced meshes: along walkways, on lawns, dense in the woods. */
function Trees({ campus }: { campus: Campus }) {
  const { trunks, crowns } = useMemo(() => {
    const collider = new Collider(campus.buildings)
    // spatial grid of road/path segments so trees stay off pavement
    const CELL = 25
    const grid = new Map<string, [Pt, Pt, number][]>()
    const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
    for (const l of [...campus.roads, ...campus.paths]) {
      for (let i = 0; i < l.pts.length - 1; i++) {
        const a = l.pts[i]
        const b = l.pts[i + 1]
        const [x0, z0, x1, z1] = bbox([a, b])
        for (let gx = Math.floor((x0 - 8) / CELL); gx <= Math.floor((x1 + 8) / CELL); gx++)
          for (let gz = Math.floor((z0 - 8) / CELL); gz <= Math.floor((z1 + 8) / CELL); gz++) {
            const k = `${gx},${gz}`
            if (!grid.has(k)) grid.set(k, [])
            grid.get(k)!.push([a, b, l.w / 2])
          }
      }
    }
    const parking = campus.areas.filter((a) => a.kind === 'parking' || a.kind.startsWith('pitch') || a.kind === 'water')
    const onPavement = (x: number, z: number) => {
      for (const [a, b, hw] of grid.get(key(x, z)) ?? []) if (distToSeg(x, z, a, b) < hw + 2.2) return true
      for (const p of parking) if (pointInPoly(x, z, p.poly)) return true
      return false
    }
    let s = 12345
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const spots: [number, number, number][] = [] // x, z, scale
    const tryAdd = (x: number, z: number, sc: number) => {
      if (spots.length > 14000) return
      if (collider.blocked(x, z, 3) || onPavement(x, z)) return
      spots.push([x, z, sc])
    }
    if (campus.treesFromAerial) {
      // real tree positions detected in the aerial photo
      // keep roughly 1 in 4 detected canopy points: the woods still read as woods, the lawns stay open
      for (const t of campus.trees) if (rnd() < 0.12 || ((t[2] ?? 1) > 1.32 && rnd() < 0.22)) spots.push([t[0], t[1], (t[2] ?? 1) * 1.25])
    } else for (const [x, z] of campus.trees) tryAdd(x, z, 1.2)
    // lines of trees along walkways (like the aerial view)
    if (!campus.treesFromAerial) for (const p of campus.paths) {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [x1, z1] = p.pts[i]
        const [x2, z2] = p.pts[i + 1]
        const len = Math.hypot(x2 - x1, z2 - z1)
        const nx = -(z2 - z1) / (len || 1)
        const nz = (x2 - x1) / (len || 1)
        for (let d = 6; d < len; d += 13) {
          if (rnd() < 0.45) continue
          const t = d / len
          const side = rnd() < 0.5 ? -1 : 1
          tryAdd(x1 + (x2 - x1) * t + nx * 4.5 * side, z1 + (z2 - z1) * t + nz * 4.5 * side, 0.9 + rnd() * 0.4)
        }
      }
    }
    // woods: dense; lawns: scattered
    for (const a of campus.treesFromAerial ? [] : campus.areas) {
      if (a.kind !== 'wood' && a.kind !== 'grass') continue
      const [x0, z0, x1, z1] = bbox(a.poly)
      const step = a.kind === 'wood' ? 7.5 : 22
      for (let x = x0; x < x1; x += step)
        for (let z = z0; z < z1; z += step) {
          const jx = x + (rnd() - 0.5) * step
          const jz = z + (rnd() - 0.5) * step
          if (pointInPoly(jx, jz, a.poly)) tryAdd(jx, jz, a.kind === 'wood' ? 1 + rnd() * 0.6 : 0.9 + rnd() * 0.5)
        }
    }
    const n = spots.length
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3, 6)
    trunkGeo.translate(0, 1.5, 0)
    const crownGeo = new THREE.IcosahedronGeometry(2.6, 1)
    crownGeo.scale(1, 1.15, 1)
    crownGeo.translate(0, 4.6, 0)
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6b4f3a', roughness: 1 }), n)
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), n)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const greens = ['#4f7f3a', '#5d8f43', '#6a9a4b', '#46733a', '#7aa653'].map((c) => new THREE.Color(c))
    spots.forEach(([x, z, sc], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2)
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc * (0.9 + rnd() * 0.3), sc))
      trunks.setMatrixAt(i, m)
      crowns.setMatrixAt(i, m)
      crowns.setColorAt(i, greens[Math.floor(rnd() * greens.length)])
    })
    trunks.castShadow = crowns.castShadow = true
    crowns.receiveShadow = true
    return { trunks, crowns }
  }, [campus])
  return (
    <group>
      <primitive object={trunks} />
      <primitive object={crowns} />
    </group>
  )
}

export type GroundStyle = 'illustrated' | 'photo' | 'drawn'

export function CampusScene({ campus, ground = 'illustrated' }: { campus: Campus; ground?: GroundStyle }) {
  return (
    <group>
      {ground === 'drawn' ? (
        <Ground campus={campus} />
      ) : (
        <>
          <AerialGround campus={campus} style={ground} />
          {ground === 'illustrated' && <Ground campus={campus} overlay />}
        </>
      )}
      <Buildings campus={campus} />
      <Landmarks campus={campus} />
      <Props campus={campus} cars={ground !== 'photo'} roofUnits />
      <Trees campus={campus} />
    </group>
  )
}
