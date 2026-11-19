// Campus data (generated from OpenStreetMap by scripts/osm_to_campus.py) + geometry helpers.
// World units are meters: x = east, z = south (so -z is north).

export type Pt = [number, number]

export interface Building {
  id: string
  name: string
  code: string
  short: string
  poly: Pt[]
  h: number
  levels: number
  style: 'brick' | 'modern' | 'concrete' | 'plain'
  kind: string
}
export interface Line {
  pts: Pt[]
  w: number
  kind: string
  name?: string
}
export interface Area {
  kind: string
  poly: Pt[]
  name: string
  a: number
}
export interface Campus {
  origin: { lat: number; lon: number }
  boundary: Pt[]
  buildings: Building[]
  paths: Line[]
  roads: Line[]
  areas: Area[]
  trees: Pt[]
  extent: [number, number, number, number]
  attribution: string
}

export async function loadCampus(): Promise<Campus> {
  const r = await fetch('/campus.json')
  return r.json()
}

export function pointInPoly(x: number, z: number, poly: Pt[]): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) c = !c
  }
  return c
}

export function distToSeg(px: number, pz: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz + 1e-9)))
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz)
}

export function centroid(poly: Pt[]): Pt {
  let x = 0
  let z = 0
  for (const p of poly) {
    x += p[0]
    z += p[1]
  }
  return [x / poly.length, z / poly.length]
}

export function bbox(poly: Pt[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const [x, z] of poly) {
    a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z)
  }
  return [a, b, c, d]
}

/** Collision against building footprints (with the player's radius). */
export class Collider {
  private items: { poly: Pt[]; bb: [number, number, number, number] }[]
  constructor(buildings: Building[]) {
    this.items = buildings.map((b) => ({ poly: b.poly, bb: bbox(b.poly) }))
  }
  blocked(x: number, z: number, r = 0.45): boolean {
    for (const it of this.items) {
      const [a, b, c, d] = it.bb
      if (x < a - r || x > c + r || z < b - r || z > d + r) continue
      if (pointInPoly(x, z, it.poly)) return true
      for (let i = 0, j = it.poly.length - 1; i < it.poly.length; j = i++) if (distToSeg(x, z, it.poly[j], it.poly[i]) < r) return true
    }
    return false
  }
}

/** Is this an actual campus building (lettered code like "A", "R100", "S1")? */
export const isCampusBuilding = (b: Building) => /^[A-Z]\d*$/.test(b.code) || b.name.startsWith('University Columns') || b.name === 'Science Lab Annex'
