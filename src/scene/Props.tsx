import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bbox, pointInPoly, type Building, type Campus, type Pt } from '../campus'

let seed = 777
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** Low parapet wall around each roof edge, in a light stone trim. */
function parapetGeometry(b: Building): THREE.BufferGeometry {
  const pos: number[] = []
  const p = b.poly
  const y0 = b.h
  const y1 = b.h + 0.7
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i]
    const [x2, z2] = p[(i + 1) % p.length]
    pos.push(x1, y0, z1, x2, y0, z2, x2, y1, z2, x1, y0, z1, x2, y1, z2, x1, y1, z1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

function longestEdgeAngle(poly: Pt[]): number {
  let best = 0
  let ang = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i]
    const [x2, z2] = poly[(i + 1) % poly.length]
    const l = Math.hypot(x2 - x1, z2 - z1)
    if (l > best) {
      best = l
      ang = Math.atan2(x2 - x1, z2 - z1)
    }
  }
  return ang
}

export function Props({ campus, cars: showCars = true, roofUnits = true }: { campus: Campus; cars?: boolean; roofUnits?: boolean }) {
  const built = useMemo(() => {
    seed = 777
    // --- parapets + rooftop AC units
    const parapet = mergeGeometries(campus.buildings.filter((b) => b.h > 4 && b.kind !== 'greenhouse' && b.id !== '1504299650' && b.id !== '589314482' && b.code !== 'H' && b.code !== 'S2' && b.code !== 'P60').map(parapetGeometry))
    const acSpots: [number, number, number, number][] = []
    for (const b of campus.buildings) {
      if (b.h < 6 || b.kind === 'greenhouse' || b.id === '1504299650' || b.id === '589314482' || b.code === 'H' || b.code === 'S2' || b.code === 'P60') continue
      const [x0, z0, x1, z1] = bbox(b.poly)
      const n = Math.min(6, Math.floor(((x1 - x0) * (z1 - z0)) / 500) + 1)
      for (let k = 0, tries = 0; k < n && tries < 40; tries++) {
        const x = x0 + rnd() * (x1 - x0)
        const z = z0 + rnd() * (z1 - z0)
        if (pointInPoly(x, z, b.poly)) {
          acSpots.push([x, b.h, z, rnd() * Math.PI])
          k++
        }
      }
    }
    // --- parked cars, lined up along each lot's long axis
    const cars: [number, number, number, number?][] = []
    // the parking deck's open top level gets parked cars too
    const deck = campus.buildings.find((b) => b.code === 'P60')
    if (deck) {
      const [dx0, dz0, dx1, dz1] = bbox(deck.poly)
      const ang = longestEdgeAngle(deck.poly)
      for (let x = dx0; x < dx1; x += 3.2)
        for (let z = dz0; z < dz1; z += 3.2)
          if (rnd() < 0.5 && pointInPoly(x, z, deck.poly)) cars.push([x, z, ang + (rnd() < 0.5 ? 0 : Math.PI), deck.h + 0.05])
    }
    // on-campus lots first (the cap would otherwise go to big off-campus lots)
    const lots = campus.areas
      .filter((a) => a.kind === 'parking' && a.a >= 200)
      .map((a) => {
        const [x0, z0, x1, z1] = bbox(a.poly)
        return { a, on: pointInPoly((x0 + x1) / 2, (z0 + z1) / 2, campus.boundary) }
      })
      .sort((p, q) => Number(q.on) - Number(p.on))
      .map((l) => l.a)
    for (const a of lots) {
      const ang = longestEdgeAngle(a.poly)
      const ux = Math.sin(ang)
      const uz = Math.cos(ang)
      const vx = uz
      const vz = -ux
      const [x0, z0, x1, z1] = bbox(a.poly)
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      const R = Math.hypot(x1 - x0, z1 - z0) / 2
      for (let s = -R; s < R; s += 2.8) // along the row
        for (let r = -R; r < R; r += 6.5) { // rows (car length + aisle share)
          if (rnd() < 0.42) continue
          const x = cx + ux * s + vx * r
          const z = cz + uz * s + vz * r
          if (pointInPoly(x, z, a.poly)) cars.push([x, z, ang + (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2)])
          if (cars.length > 3500) break
        }
    }
    // --- lamp posts along walkways
    const lamps: [number, number][] = []
    for (const p of campus.paths) {
      let acc = 0
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [xa, za] = p.pts[i]
        const [xb, zb] = p.pts[i + 1]
        const len = Math.hypot(xb - xa, zb - za)
        for (let d = 0; d < len; d += 1) {
          acc += 1
          if (acc >= 28) {
            acc = 0
            const t = d / len
            const nx = -(zb - za) / (len || 1)
            const nz = (xb - xa) / (len || 1)
            lamps.push([xa + (xb - xa) * t + nx * (p.w / 2 + 0.6), za + (zb - za) * t + nz * (p.w / 2 + 0.6)])
          }
        }
      }
    }
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const Y = new THREE.Vector3(0, 1, 0)
    // AC units
    const acGeo = new THREE.BoxGeometry(2.4, 1.2, 1.6)
    acGeo.translate(0, 0.6, 0)
    const ac = new THREE.InstancedMesh(acGeo, new THREE.MeshStandardMaterial({ color: '#b9bcbd', roughness: 0.7 }), acSpots.length)
    acSpots.forEach(([x, y, z, r], i) => ac.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, r), new THREE.Vector3(1, 1, 1))))
    ac.castShadow = true
    // cars: body + cabin merged into one geometry
    const body = new THREE.BoxGeometry(1.8, 0.75, 4.3)
    body.translate(0, 0.55, 0)
    const cabin = new THREE.BoxGeometry(1.6, 0.6, 2.2)
    cabin.translate(0, 1.2, -0.2)
    const carGeo = mergeGeometries([body, cabin])
    const car = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }), cars.length)
    const paints = ['#e9e9ea', '#1d1f22', '#8c9196', '#b22d2d', '#2c4f8a', '#c8b48a', '#3f6b4c', '#FFC629'].map((c) => new THREE.Color(c))
    cars.forEach(([x, z, r, y = 0], i) => {
      car.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, r), new THREE.Vector3(1, 1, 1)))
      car.setColorAt(i, paints[Math.floor(rnd() * (rnd() < 0.05 ? paints.length : paints.length - 1))])
    })
    car.castShadow = true
    // lamps: pole + head
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6)
    pole.translate(0, 2.1, 0)
    const head = new THREE.SphereGeometry(0.28, 10, 8)
    head.translate(0, 4.3, 0)
    const lampGeo = mergeGeometries([pole, head])
    const lamp = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: '#2c3033', roughness: 0.6 }), lamps.length)
    lamps.forEach(([x, z], i) => lamp.setMatrixAt(i, m.makeTranslation(x, 0, z)))
    lamp.castShadow = true
    return { parapet, ac, car, lamp }
  }, [campus])
  return (
    <group>
      <mesh geometry={built.parapet} castShadow>
        <meshStandardMaterial color="#d8cbb4" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {roofUnits && <primitive object={built.ac} />}
      {showCars && <primitive object={built.car} />}
      <primitive object={built.lamp} />
    </group>
  )
}
