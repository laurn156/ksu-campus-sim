import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bbox, Collider, distToSeg, pointInPoly, type Building, type Campus, type Line, type Pt } from '../campus'
import { facade, parkingTexture, roofTexture, stepsTexture } from './textures'
import { lookFor } from './styles'
import { Props } from './Props'
import { Buses } from './Buses'
import { Scrappy } from './Scrappy'
import { Traffic } from './Traffic'
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

/** A reference-guided entrance prototype. Dimensions are approximate; the OSM footprint
 * remains the collision boundary. Pieces use world coordinates so they share the building's cutaway. */
function studentCenterDetails() {
  const pieces: { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] = []
  const angle = 0.57
  const origin = new THREE.Vector3(-120.4, 0, -231.8)
  const material = (color: string, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide })
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, roughness = 0.85) => {
    geo.translate(x, y, z)
    geo.rotateY(angle)
    geo.translate(origin.x, origin.y, origin.z)
    pieces.push({ geo, mat: material(color, roughness) })
  }
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) =>
    add(new THREE.BoxGeometry(w, h, d), color, x, y, z)
  // Recessed dark entry and individual glazed door panels.
  box(12.4, 3.6, 0.18, '#343b38', 0, 2.15, 0.45)
  for (let x = -4.8; x <= 4.8; x += 1.6) {
    box(1.35, 2.65, 0.12, '#527474', x, 1.7, 0.57)
    box(0.08, 2.75, 0.18, '#d3d0c3', x - 0.7, 1.7, 0.65)
    box(1.35, 0.08, 0.18, '#d3d0c3', x, 1.7, 0.66)
  }
  // Brick piers and broad canopy with an arched, light metal fascia.
  for (const x of [-7, 7]) box(1.5, 5.1, 2.4, '#9e4d38', x, 2.55, 1.25)
  box(15.5, 0.5, 3.6, '#8e4433', 0, 4.25, 1.3)
  const fascia = new THREE.Shape()
  fascia.moveTo(-8, 0); fascia.lineTo(8, 0); fascia.lineTo(8, 0.65)
  fascia.quadraticCurveTo(0, 3.0, -8, 0.65); fascia.closePath()
  add(new THREE.ExtrudeGeometry(fascia, { depth: 3.5, bevelEnabled: false, curveSegments: 32 }), '#e4e4db', 0, 4.48, -0.15)
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#31383a'; ctx.textAlign = 'center'; ctx.font = 'bold 67px sans-serif'
  ctx.fillText('JOE MACK WILSON', 512, 100); ctx.fillText('STUDENT CENTER', 512, 180)
  const sign = new THREE.CanvasTexture(canvas)
  sign.colorSpace = THREE.SRGBColorSpace
  const signGeo = new THREE.PlaneGeometry(8.8, 1.3)
  signGeo.translate(0, 5.15, 3.39); signGeo.rotateY(angle); signGeo.translate(origin.x, 0, origin.z)
  pieces.push({ geo: signGeo, mat: new THREE.MeshStandardMaterial({ map: sign, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }) })
  // Raised brick-edged terraces flank the central staircase. The dimensions and
  // table positions are approximate until ground-level photos become available.
  for (const side of [-1, 1]) {
    const cx = side * 17.5
    box(19, 0.9, 5.4, '#994d3a', cx, 0.45, 2.4)
    box(19, 0.16, 5.5, '#bba38c', cx, 0.98, 2.4)
    box(19, 0.18, 0.32, '#d0cfc5', cx, 1.13, 5.12)
    for (let j = 0; j <= 6; j++) box(0.08, 0.9, 0.08, '#b9bdb8', side * (8 + j * 3.15), 1.65, 5.12)
    box(19, 0.08, 0.08, '#c8cbc5', cx, 2.08, 5.12)
    for (const x of [side * 14, side * 22]) {
      add(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16), '#8e887b', x, 1.85, 2.35)
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), '#676e6b', x, 1.45, 2.35)
    }
  }
  // Side approach: a shallow flight and an adjacent sloped ramp. The available
  // aerial views leave exact grading and placement uncertain.
  for (let i = 0; i < 6; i++) box(0.8, 0.16, 5, '#bab8ad', 32.5 + i * 0.7, 0.96 - i * 0.16, -12)
  const sideRamp = new THREE.BoxGeometry(5, 0.16, 3)
  sideRamp.rotateZ(-0.18)
  add(sideRamp, '#aaa99f', 34.4, 0.48, -19)
  for (const z of [-20.5, -17.5]) {
    for (let i = 0; i < 3; i++) box(0.08, 0.9, 0.08, '#b9bdb8', 32.5 + i * 2, 1.25 - i * 0.3, z)
    const rail = new THREE.BoxGeometry(4.7, 0.08, 0.08)
    rail.rotateZ(-0.18)
    add(rail, '#c8cbc5', 34.4, 1.4, z)
  }
  // Broad approach steps and metal handrails; dimensions are visual estimates.
  for (let i = 0; i < 6; i++) box(16 + i * 0.65, 0.18, 1.0, '#b9b6a9', 0, 1.08 - i * 0.18, 3.8 + i * 0.85)
  for (const x of [-6, 0, 6]) {
    for (let i = 0; i < 3; i++) box(0.08, 1.0, 0.08, '#9b9f9b', x, 1.5 - i * 0.3, 4 + i * 1.5)
    const rail = new THREE.BoxGeometry(0.09, 0.09, 5.2)
    rail.rotateX(-0.2)
    add(rail, '#b7bcb9', x, 1.9, 5.5)
  }
  return pieces
}

function addStingersLocal(geo:THREE.BufferGeometry,x:number,y:number,z:number,angle:number,origin:THREE.Vector3){
  geo.translate(x,y,z);geo.rotateY(angle);geo.translate(origin.x,0,origin.z)
}

/** Approximate the distinctive 806 entrance and curved dining-room glazing from reference photos.
 * The mapped footprint remains the source of the building location and collision boundary. */
function stingersDetails(b: Building) {
  const pieces: {geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const material=(color:string,roughness=0.8)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide})
  const brick=material('#a74630'), white=material('#e4e5de'), trim=material('#bdc4c1'), glass=material('#396b6d',0.26), dark=material('#394948')
  const a=b.poly[27], c=b.poly[28]
  const dx=c[0]-a[0], dz=c[1]-a[1], length=Math.hypot(dx,dz), angle=Math.atan2(-dz,dx)
  const origin=new THREE.Vector3((a[0]+c[0])/2,0,(a[1]+c[1])/2)
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
    const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);geo.rotateY(angle);geo.translate(origin.x,0,origin.z);pieces.push({geo,mat})
  }
  // Entrance volume, silver-framed double doors, upper glass and a broad white overhang.
  box(length,9.3,.18,0,4.65,.08,brick)
  box(5.4,6.2,.18,-.45,4.3,.22,glass)
  for(const x of [-3.15,-1.8,-.45,.9,2.25])box(.10,6.25,.20,x,4.3,.35,trim)
  for(const y of [1.2,3.35,5.1,7.42])box(5.55,.11,.22,-.45,y,.36,trim)
  box(3.4,2.9,.22,-.45,1.55,.42,dark)
  for(const x of [-1.3,.4]){box(1.55,2.7,.12,x,1.55,.56,glass);box(.09,2.8,.18,x-.79,1.55,.64,white);box(.08,.55,.16,x+.45,1.48,.67,white)}
  box(3.6,.12,.18,-.45,2.9,.65,white)
  // Entry canopy and roof fascia stand out in the reference photographs.
  box(6.2,.18,2.0,-.45,3.05,1.1,trim)
  box(length+1.1,.23,1.4,0,9.05,.55,white)
  box(length+1.45,.24,1.85,0,8.78,.75,white)
  box(length+1.65,.16,2.0,0,8.55,.82,trim)
  // Building number plaque.
  box(1.45,.72,.08,3.15,7.0,.36,material('#e9b42f'))
  const numberCanvas=document.createElement('canvas');numberCanvas.width=256;numberCanvas.height=128
  const numberCtx=numberCanvas.getContext('2d')!;numberCtx.fillStyle='#e9b42f';numberCtx.fillRect(0,0,256,128);numberCtx.fillStyle='#202a28';numberCtx.textAlign='center';numberCtx.font='bold 78px sans-serif';numberCtx.fillText('806',128,91)
  const numberTexture=new THREE.CanvasTexture(numberCanvas);numberTexture.colorSpace=THREE.SRGBColorSpace
  const numberGeo=new THREE.PlaneGeometry(1.4,.68);numberGeo.translate(3.15,7,.42);numberGeo.rotateY(angle);numberGeo.translate(origin.x,0,origin.z)
  pieces.push({geo:numberGeo,mat:new THREE.MeshStandardMaterial({map:numberTexture,side:THREE.DoubleSide})})
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128
  const ctx=signCanvas.getContext('2d')!;ctx.fillStyle='#f2f3ec';ctx.font='bold 40px sans-serif';ctx.textAlign='center';ctx.fillText('STINGERS RESTAURANT',256,52);ctx.font='bold 27px sans-serif';ctx.fillText('AT THE X',256,89)
  const texture=new THREE.CanvasTexture(signCanvas);texture.colorSpace=THREE.SRGBColorSpace
  const label=new THREE.PlaneGeometry(4.6,1.1);label.translate(-.45,3.55,.75);label.rotateY(angle);label.translate(origin.x,0,origin.z)
  pieces.push({geo:label,mat:new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide})})
  // Polygon edges 13–25 trace the round bay in the mapped footprint.
  // Overlay full-height glazing, vertical mullions, and the pale curved fascia.
  for(let i=13;i<26;i++){
    const p=b.poly[i],q=b.poly[i+1],ex=q[0]-p[0],ez=q[1]-p[1],len=Math.hypot(ex,ez);if(len<.01)continue
    const edgeAngle=Math.atan2(-ez,ex),mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2
    const slab=(w:number,h:number,depth:number,y:number,offset:number,mat:THREE.MeshStandardMaterial)=>{const g=new THREE.BoxGeometry(w,h,depth);g.translate(0,y,offset);g.rotateY(edgeAngle);g.translate(mx,0,mz);pieces.push({geo:g,mat})}
    slab(len+.08,6.35,.16,3.55,.1,glass)
    for(const y of [.45,2.35,4.25,6.65])slab(len+.1,.09,.22,y,.22,trim)
    slab(len+.1,.8,.4,7.05,.2,white)
    const mullion=new THREE.BoxGeometry(.09,6.35,.2);mullion.translate(-len/2,3.55,.24);mullion.rotateY(edgeAngle);mullion.translate(mx,0,mz);pieces.push({geo:mullion,mat:trim})
  }
  // Outdoor dining terrace: rail follows the same rounded outline as the glass bay.
  // The footprint is clockwise, so a negative inset puts the rail outside the building.
  const railing=offsetPoly(b.poly,-4.2)
  const railMat=material('#aeb7b4',.48), furniture=material('#59625d'), paving=material('#c9b4a1')
  const beam=(from:THREE.Vector3,to:THREE.Vector3,radius:number,mat:THREE.MeshStandardMaterial)=>{
    const direction=new THREE.Vector3().subVectors(to,from),geo=new THREE.CylinderGeometry(radius,radius,direction.length(),8)
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()))
    geo.translate((from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2);pieces.push({geo,mat})
  }
  // A narrow terrace surface remains just above the existing map paths.
  const terrace=b.poly.slice(13,27).concat(railing.slice(13,27).reverse())
  pieces.push({geo:flatGeometry(terrace,.095),mat:paving})
  for(let i=13;i<26;i++){
    const p=railing[i],q=railing[i+1]
    for(const y of [.55,1.08])beam(new THREE.Vector3(p[0],y,p[1]),new THREE.Vector3(q[0],y,q[1]),.045,railMat)
    beam(new THREE.Vector3(p[0],.1,p[1]),new THREE.Vector3(p[0],1.1,p[1]),.045,railMat)
  }
  // Small outdoor tables and seats sit between the glass and the railing.
  for(const i of [14,17,20,23]){
    const x=(b.poly[i][0]+railing[i][0])/2,z=(b.poly[i][1]+railing[i][1])/2
    const tabletop=new THREE.CylinderGeometry(.62,.62,.07,20);tabletop.translate(x,.77,z);pieces.push({geo:tabletop,mat:furniture})
    beam(new THREE.Vector3(x,.1,z),new THREE.Vector3(x,.74,z),.055,railMat)
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const sx=x+Math.cos(a)*.95,sz=z+Math.sin(a)*.95;const seat=new THREE.CylinderGeometry(.26,.26,.07,12);seat.translate(sx,.43,sz);pieces.push({geo:seat,mat:furniture});beam(new THREE.Vector3(sx,.1,sz),new THREE.Vector3(sx,.4,sz),.035,railMat)}
  }
  // Bench and bin by the entrance approach, leaving the central doorway clear.
  box(1.8,.12,.48,4.35,.48,3.4,furniture)
  box(1.8,.58,.09,4.35,.83,3.65,furniture)
  for(const x of [3.65,5.05])box(.08,.48,.08,x,.24,3.42,railMat)
  const bin=new THREE.CylinderGeometry(.35,.31,.95,16);addStingersLocal(bin,5.8,.5,3.4,angle,origin);pieces.push({geo:bin,mat:dark})
  const lid=new THREE.CylinderGeometry(.37,.37,.08,16);addStingersLocal(lid,5.8,1.01,3.4,angle,origin);pieces.push({geo:lid,mat:trim})
  return pieces
}

/** Shallow concrete ribs give the Mathematics Building's upper screen real depth. */
function mathematicsScreen(b:Building){
  const concrete=new THREE.MeshStandardMaterial({color:'#d1d2c8',roughness:.9,side:THREE.DoubleSide})
  const pieces:THREE.BufferGeometry[]=[]
  for(let i=0;i<b.poly.length;i++){
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz)
    if(len<9)continue
    const angle=Math.atan2(-dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);geo.rotateY(angle);geo.translate(mx,0,mz);pieces.push(geo)}
    // Ground-floor canopy / floor slab and regularly spaced supporting piers.
    box(len,.22,.55,0,3.75,-.18)
    for(let x=-len/2+1.6;x<len/2;x+=3.2)box(.18,3.7,.27,x,1.85,-.13)
    // Slim vertical and horizontal concrete screen members over dark recesses.
    const bays=Math.max(1,Math.round(len/0.8))
    for(let j=0;j<=bays;j++)box(.09,3.65,.22,-len/2+j*len/bays,5.72,-.13)
    for(let y=3.94;y<7.5;y+=.92)box(len,.1,.22,0,y,-.13)
    box(len,.15,.4,0,7.53,-.15)
  }
  const merged=mergeGeometries(pieces)
  const details: {geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=merged?[{geo:merged,mat:concrete}]:[]
  // Main courtyard side, matching the pictured entrance. Positions are approximate
  // within the mapped long facade; the building footprint and collision stay unchanged.
  const a=b.poly[14],c=b.poly[15],angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
  const transform=(geo:THREE.BufferGeometry,x:number,y:number,z:number)=>{geo.translate(x,y,z);geo.rotateY(angle);geo.translate(mx,0,mz);return geo}
  const add=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>details.push({geo:transform(new THREE.BoxGeometry(w,h,d),x,y,z),mat})
  const frame=new THREE.MeshStandardMaterial({color:'#dedfd4',roughness:.72,side:THREE.DoubleSide})
  const doorGlass=new THREE.MeshStandardMaterial({color:'#304b47',roughness:.3,side:THREE.DoubleSide})
  const metal=new THREE.MeshStandardMaterial({color:'#b8c0b7',roughness:.5,side:THREE.DoubleSide})
  // Entrances under the marked courtyard sections, plus one at each end.
  // Details sit just outside the mapped walls; they are visual entrances only.
  const entrance=(edge:number,offset:number)=>{
    const p=b.poly[edge],q=b.poly[(edge+1)%b.poly.length]
    const edgeAngle=Math.atan2(-(q[1]-p[1]),q[0]-p[0]),x=(p[0]+q[0])/2,z=(p[1]+q[1])/2
    const part=(w:number,h:number,d:number,cx:number,cy:number,cz:number,mat:THREE.MeshStandardMaterial)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(cx,cy,cz);geo.rotateY(edgeAngle);geo.translate(x,0,z);details.push({geo,mat})}
    part(3.3,3.15,.10,offset,1.58,-.21,frame)
    for(const x of [offset-.77,offset+.77]){
      part(1.35,2.85,.10,x,1.55,-.30,doorGlass)
      part(.07,2.9,.12,x-.7,1.55,-.37,metal)
      part(.06,.42,.14,x+.47,1.4,-.4,metal)
    }
    part(3.3,.1,.13,offset,3.12,-.36,metal)
  }
  entrance(21,0);entrance(14,-3.2);entrance(14,3.2);entrance(9,0)
  // End entrances are centered on the inner end faces, rather than the offset outer wings.
  entrance(8,0);entrance(22,0)
  // The photo shows a short brick inset below a run of upper windows.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#d0c3aa';ctx.fillRect(0,0,512,128)
  for(let y=0;y<128;y+=16)for(let x=(y/16)%2?-24:0;x<512;x+=48){ctx.fillStyle=(x+y)%3?'#a66b4e':'#b77a57';ctx.fillRect(x+1,y+1,46,14)}
  const brickTexture=new THREE.CanvasTexture(canvas);brickTexture.colorSpace=THREE.SRGBColorSpace
  const brickMat=new THREE.MeshStandardMaterial({map:brickTexture,roughness:.95,side:THREE.DoubleSide})
  // Repeated glazed insets interrupt the concrete screen; brick sits below each
  // window instead of appearing as isolated patches pasted over the grid.
  const insetGlass=new THREE.MeshStandardMaterial({color:'#697c70',roughness:.42,side:THREE.DoubleSide})
  const placeInset=(edge:number,offset:number,width:number)=>{
    const p=b.poly[edge],q=b.poly[(edge+1)%b.poly.length],edgeAngle=Math.atan2(-(q[1]-p[1]),q[0]-p[0]),x=(p[0]+q[0])/2,z=(p[1]+q[1])/2
    const part=(w:number,h:number,d:number,cx:number,cy:number,cz:number,mat:THREE.MeshStandardMaterial)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(cx,cy,cz);geo.rotateY(edgeAngle);geo.translate(x,0,z);details.push({geo,mat})}
    part(width,3.4,.12,offset,5.65,-.38,insetGlass)
    part(width,1.05,.14,offset,4.55,-.48,brickMat)
    for(const y of [4.02,5.1,6.35,7.35])part(width,.1,.17,offset,y,-.57,frame)
    for(const dx of [-width/2,0,width/2])part(.1,3.4,.17,offset+dx,5.65,-.57,frame)
  }
  placeInset(21,0,4.2)
  placeInset(14,0,8.0)
  placeInset(9,0,4.2)
  // Freestanding campus wayfinding sign in the lawn outside the door.
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=256
  const signCtx=signCanvas.getContext('2d')!;signCtx.fillStyle='#26312d';signCtx.fillRect(0,0,512,256);signCtx.fillStyle='#f5f3e9';signCtx.textAlign='center';signCtx.font='bold 38px sans-serif';signCtx.fillText('Mathematics',256,92);signCtx.fillText('Building (D)',256,143);signCtx.fillStyle='#e5b129';signCtx.fillRect(0,184,512,9)
  const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace
  const signMat=new THREE.MeshStandardMaterial({map:signTexture,side:THREE.DoubleSide,roughness:.85})
  add(2,.10,.14,-10,1.33,-3.8,metal);add(.09,1.35,.12,-11,.68,-3.8,metal);add(.09,1.35,.12,-9,.68,-3.8,metal)
  details.push({geo:transform(new THREE.PlaneGeometry(1.9,.93).rotateY(Math.PI),-10,.83,-3.88),mat:signMat})
  return details
}

/** ETC's east-facing entrance is approximated from the campus footprint and reference photos. */
function engineeringCenterDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const a=b.poly[3],c=b.poly[4],length=Math.hypot(c[0]-a[0],c[1]-a[1])
  const angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
  const material=(color:string,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide})
  const white=material('#e7e7e0'),silver=material('#b5c2bd',.5),glass=material('#487c79',.25),concrete=material('#c8c5b9'),dark=material('#465451')
  const transform=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z);g.rotateY(angle);g.translate(mx,0,mz);return g}
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>out.push({geo:transform(new THREE.BoxGeometry(w,h,d),x,y,z),mat})
  // Ground-floor entrance on the shorter end facade, below a projecting header.
  const sideA=b.poly[2],sideB=b.poly[3],sideLen=Math.hypot(sideB[0]-sideA[0],sideB[1]-sideA[1])
  const sideAngle=Math.atan2(-(sideB[1]-sideA[1]),sideB[0]-sideA[0])
  const sx=sideA[0]+(sideB[0]-sideA[0])*.22,sz=sideA[1]+(sideB[1]-sideA[1])*.22
  const sideBox=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
    const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);geo.rotateY(sideAngle);geo.translate(sx,0,sz);out.push({geo,mat})
  }
  sideBox(7.4,.48,1.5,0,3.5,.65,white)
  sideBox(5.7,2.75,.16,0,1.4,.12,glass)
  for(const x of [-2.85,-1.42,0,1.42,2.85])sideBox(.08,2.8,.2,x,1.4,.23,silver)
  sideBox(5.7,.1,.2,0,2.78,.23,silver)
  sideBox(.08,.55,.15,.55,1.3,.3,white)
  const sideCanvas=document.createElement('canvas');sideCanvas.width=1024;sideCanvas.height=128
  const sideCtx=sideCanvas.getContext('2d')!;sideCtx.fillStyle='#f4f4ef';sideCtx.font='bold 45px sans-serif';sideCtx.textAlign='center';sideCtx.fillText('ENGINEERING TECHNOLOGY CENTER',512,80)
  const sideTexture=new THREE.CanvasTexture(sideCanvas);sideTexture.colorSpace=THREE.SRGBColorSpace
  const sideText=new THREE.PlaneGeometry(Math.min(7,sideLen*.2),.75);sideText.rotateY(sideAngle);sideText.translate(sx,3.1,sz);sideText.translate(Math.sin(sideAngle)*1.44,0,Math.cos(sideAngle)*1.44)
  out.push({geo:sideText,mat:new THREE.MeshStandardMaterial({map:sideTexture,transparent:true,depthWrite:false,side:THREE.DoubleSide})})
  // Long curtain wall is topped by the deep, light roof edge in the photographs.
  box(length+.4,.36,1.0,0,b.h-.1,.32,white)
  box(length+.7,.20,1.45,0,b.h-.42,.47,white)
  // Elevated entry landing, glazed vestibule, metal mullions and double doors.
  // Continuous upper pavement, with a wider landing where the side stairs meet it.
  // Solid retaining base supports the elevated pavement all the way to ground.
  box(length,3.56,4.4,0,1.78,2.15,concrete)
  box(length,.24,4.4,0,3.68,2.15,concrete)
  box(4,3.56,3.3,-11.6,1.78,5.85,concrete)
  box(4,.24,3.3,-11.6,3.68,5.85,concrete)
  // At the far end the pavement descends gradually toward the surrounding paths.
  const ramp=new THREE.BufferGeometry()
  ramp.setAttribute('position',new THREE.Float32BufferAttribute([
    length/2,3.8,0,length/2+17,0,0,length/2+17,0,4.35,
    length/2,3.8,0,length/2+17,0,4.35,length/2,3.8,4.35,
    length/2,0,0,length/2+17,0,0,length/2,3.8,0,
    length/2,0,4.35,length/2,3.8,4.35,length/2+17,0,4.35,
    length/2,0,0,length/2,3.8,0,length/2,3.8,4.35,
    length/2,0,0,length/2,3.8,4.35,length/2,0,4.35],3))
  ramp.computeVertexNormals();ramp.rotateY(angle);ramp.translate(mx,0,mz);out.push({geo:ramp,mat:concrete})
  box(9.2,3.25,.14,0,5.5,.16,glass)
  for(const x of [-4.55,-3.03,-1.52,0,1.52,3.03,4.55])box(.08,3.25,.18,x,5.5,.27,silver)
  for(const y of [3.88,5.1,7.1])box(9.2,.09,.18,0,y,.27,silver)
  for(const x of [-1.05,1.05]){
    box(1.85,2.85,.16,x,5.32,.35,glass)
    for(const offset of [-.94,.94])box(.09,2.9,.2,x+offset,5.32,.48,white)
    box(.09,.54,.2,x+.66,5.2,.52,silver)
  }
  box(10.2,.38,3.4,0,7.35,1.75,white)
  box(10.6,.14,3.55,0,7.12,1.8,silver)
  // Thin lettering stands above the projecting entry canopy.
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=160
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f2f2ed';ctx.textAlign='center';ctx.font='bold 79px sans-serif';ctx.fillText('ENGINEERING TECHNOLOGY CENTER',1024,108)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  const letters=transform(new THREE.PlaneGeometry(18,1.35),0,8.18,3.49)
  out.push({geo:letters,mat:new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide})})
  // Slender poles adjacent to the entry frame.
  for(const x of [-8.9,-8.5,-8.1])box(.11,8.4,.11,x,7.85,3.5,silver)
  // Sideways stairs rise parallel to the facade, approaching the entrance from the left.
  // The flat game terrain does not yet support walking on this elevated geometry.
  for(let step=0;step<19;step++){
    const height=(step+1)*.2,x=-24.05+step*.66
    box(.69,height,3.3,x,height/2,5.85,concrete)
  }
  // Narrow planted strips sit against the facade, leaving a clear route to the doors.
  const planterSoil=material('#725c48'),planterGreen=material('#718f56')
  for(const [start,end] of [[-length/2+1,-14],[12,length/2-1]]){
    box(end-start,.10,.85,(start+end)/2,3.84,.48,planterSoil)
    for(let x=start+.5;x<end;x+=1.45){
      const g=new THREE.IcosahedronGeometry(.35,1);g.scale(1,.6,.8)
      out.push({geo:transform(g,x,4.01,.48),mat:planterGreen})
    }
  }
  // A planted bank separates the raised entry walk from the lower sidewalk.
  // Its surface slopes down toward the continuous low retaining wall.
  const soil=material('#755b48'),shrub=material('#6c8b4f'),shrubLight=material('#8ba760'),treeBark=material('#705543')
  const bank=new THREE.BufferGeometry()
  const verts=new Float32Array([-10,3.65,4.4, 29,3.65,4.4, 29,1.05,12.8, -10,3.65,4.4, 29,1.05,12.8, -10,1.05,12.8])
  bank.setAttribute('position',new THREE.BufferAttribute(verts,3));bank.computeVertexNormals();bank.rotateY(angle);bank.translate(mx,0,mz);out.push({geo:bank,mat:soil})
  box(39,1.05,.38,9.5,.525,12.9,concrete)
  box(39,.13,.55,9.5,1.1,12.9,white)
  // Low shrubs and a few young trees evoke the planted strip without hiding the entry.
  const foliage:THREE.BufferGeometry[]=[],foliageLight:THREE.BufferGeometry[]=[]
  for(let row=0;row<3;row++)for(let j=0;j<14;j++){
    const x=-8+j*2.65+(row%2)*.8,z=5.7+row*2.3,y=3.65-(z-4.4)*2.6/8.4
    const radius=.45+((j+row)%3)*.09,g=new THREE.IcosahedronGeometry(radius,1)
    g.scale(1,.68,1);transform(g,x,y+.18,z);(j%3===0?foliageLight:foliage).push(g)
  }
  out.push({geo:mergeGeometries(foliage),mat:shrub},{geo:mergeGeometries(foliageLight),mat:shrubLight})
  for(const x of [-3,8,20]){
    const z=9.5,y=3.65-(z-4.4)*2.6/8.4
    const trunk=new THREE.CylinderGeometry(.13,.18,2.9,7);out.push({geo:transform(trunk,x,y+1.45,z),mat:treeBark})
    const crown=new THREE.IcosahedronGeometry(1.45,1);crown.scale(1,1.2,1);out.push({geo:transform(crown,x,y+3.2,z),mat:shrub})
  }
  // Rails follow the sideways staircase and the edge of the upper walk.
  const segment=(p:THREE.Vector3,q:THREE.Vector3)=>{const v=q.clone().sub(p),g=new THREE.CylinderGeometry(.045,.045,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2);g.rotateY(angle);g.translate(mx,0,mz);out.push({geo:g,mat:silver})}
  for(const z of [7.45]){
    segment(new THREE.Vector3(-24.3,.9,z),new THREE.Vector3(-11.4,4.7,z))
    for(let j=0;j<5;j++){const x=-24.3+j*3.2,y=.2+j*.95;segment(new THREE.Vector3(x,y,z),new THREE.Vector3(x,y+.8,z))}
  }
  // Keep a clear entrance from the landing onto the stairs.
  segment(new THREE.Vector3(-5,4.6,4.25),new THREE.Vector3(10.5,4.6,4.25))
  for(let x=-5;x<=10.5;x+=2.5)segment(new THREE.Vector3(x,3.8,4.25),new THREE.Vector3(x,4.6,4.25))
  box(1.4,1.0,1.4,32,.5,13.8,dark)
  return out
}


/** A small glazed greenhouse with a brick plinth and a framed pitched roof. */
function greenhouseParts(b:Building){
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const brick=new THREE.MeshStandardMaterial({map:facade('redbrick'),roughness:.9,side:THREE.DoubleSide})
  const glass=new THREE.MeshStandardMaterial({color:'#789492',roughness:.35,metalness:.12,side:THREE.DoubleSide})
  const frame=new THREE.MeshStandardMaterial({color:'#d4d9d2',roughness:.65})
  parts.push({geo:wallsGeometry(b,0,.7),mat:brick},{geo:wallsGeometry(b,.7,3.15),mat:glass})
  const [p0,p1,p2,p3]=b.poly
  const vec=(p:Pt,y:number)=>new THREE.Vector3(p[0],y,p[1])
  const e0=vec(p0,3.15),e1=vec(p1,3.15),e2=vec(p2,3.15),e3=vec(p3,3.15)
  const r0=e0.clone().add(e3).multiplyScalar(.5).setY(4.55),r1=e1.clone().add(e2).multiplyScalar(.5).setY(4.55)
  const vertices:number[]=[]
  const tri=(a:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3)=>vertices.push(...a.toArray(),...c.toArray(),...d.toArray())
  tri(e0,e1,r1);tri(e0,r1,r0);tri(e3,r1,e2);tri(e3,r0,r1);tri(e0,r0,e3);tri(e1,e2,r1)
  const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));roof.computeVertexNormals();parts.push({geo:roof,mat:glass})
  const bars:THREE.BufferGeometry[]=[]
  const bar=(a:THREE.Vector3,c:THREE.Vector3)=>{const v=c.clone().sub(a),g=new THREE.CylinderGeometry(.045,.045,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a.x+c.x)/2,(a.y+c.y)/2,(a.z+c.z)/2);bars.push(g)}
  for(const [a,c] of [[e0,e1],[e1,e2],[e2,e3],[e3,e0],[r0,r1]] as [THREE.Vector3,THREE.Vector3][])bar(a,c)
  for(let i=0;i<=8;i++){
    const t=i/8,left=e0.clone().lerp(e1,t),right=e3.clone().lerp(e2,t),ridge=r0.clone().lerp(r1,t)
    bar(left,ridge);bar(right,ridge);bar(left.clone().setY(.7),left);bar(right.clone().setY(.7),right)
  }
  for(const [a,c] of [[e0,e3],[e1,e2]] as [THREE.Vector3,THREE.Vector3][]){
    for(let i=0;i<=4;i++){const point=a.clone().lerp(c,i/4);bar(point.clone().setY(.7),point)}
  }
  parts.push({geo:mergeGeometries(bars),mat:frame})
  return parts
}


/** Hornet Hub: low metal workshop, a public entrance, and six team garage bays. */
function hornetHubParts(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide})
  const metal=mat('#8b9390'),brick=mat('#a77f78'),roof=mat('#c3c8c1'),trim=mat('#e3e4dc'),glass=mat('#5b7776'),garage=mat('#c4cac4')
  out.push({geo:wallsGeometry(b,0,2.4),mat:brick},{geo:wallsGeometry(b,2.4,b.h),mat:metal},{geo:hipRoofGeometry(b,1.1),mat:roof})
  const wall=(a:Pt,c:Pt,fn:(box:(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>void,len:number,plane:(g:THREE.BufferGeometry,x:number,y:number,z:number)=>THREE.BufferGeometry)=>void)=>{
    const length=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const plane=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z);g.rotateY(angle);g.translate(mx,0,mz);return g}
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>out.push({geo:plane(new THREE.BoxGeometry(w,h,d),x,y,z),mat:m})
    fn(box,length,plane)
  }
  // The north edge faces the ETC. Each bay is kept clear for future team logos.
  wall(b.poly[3],b.poly[2],(box,len)=>{
    const spacing=len/6
    for(let i=0;i<6;i++){
      const x=-len/2+spacing*(i+.5),w=spacing-.65
      box(w,3.3,.16,x,1.65,.11,garage)
      for(let y=.55;y<3.3;y+=.55)box(w,.045,.05,x,y,.22,trim)
      for(const dx of [-w/2,w/2])box(.1,3.45,.2,x+dx,1.72,.15,metal)
    }
  })
  // The long east facade faces the same viewing direction as the ETC entrance.
  wall(b.poly[2],b.poly[1],(box,len,plane)=>{
    const entrance=0
    box(2.2,2.8,.16,entrance,1.4,.14,glass)
    for(const dx of [-1.1,0,1.1])box(.1,2.85,.2,entrance+dx,1.43,.25,trim)
    box(2.2,.12,.2,entrance,2.84,.25,trim)
    for(const x of [-len*.32,-len*.18,len*.3]){
      box(2.4,1,.16,x,1.85,.14,glass)
      box(2.5,.09,.2,x,1.32,.25,trim)
    }
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f2f2ed';ctx.font='bold 100px sans-serif';ctx.textAlign='center';ctx.fillText('HORNET HUB',512,112)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
    out.push({geo:plane(new THREE.PlaneGeometry(9,1.3),len*.23,4.05,.2),mat:new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide})})
  })
  return out
}

/** Entrance, rear glazing, and the monument sign at the Johnson Library. */
function libraryDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const material=(color:string,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide})
  const concrete=material('#dddcd2'),glass=material('#587b76',.3),dark=material('#253b38'),frame=material('#c1c8bd'),brick=material('#965b4c')
  const edge=(a:Pt,c:Pt,fn:(box:(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>void,len:number,place:(g:THREE.BufferGeometry,x:number,y:number,z:number)=>THREE.BufferGeometry)=>void)=>{
    const len=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const place=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z);g.rotateY(angle);g.translate(mx,0,mz);return g}
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>out.push({geo:place(new THREE.BoxGeometry(w,h,d),x,y,z),mat:m})
    fn(box,len,place)
  }
  // The long southwest wall looks over the courtyard toward Mathematics.
  edge(b.poly[23],b.poly[26],(box,len,place)=>{
    box(len,.36,1.25,0,b.h-.15,.5,concrete)
    box(len-.8,1.05,.1,0,b.h-1,.12,glass)
    for(let x=-len/2+1;x<len/2;x+=1.25)box(.055,1.1,.16,x,b.h-1,.2,frame)
    // Recessed-looking dark glazed doorway and deep shelter, with low brick planters.
    box(13,3.25,.16,0,1.8,.12,dark)
    for(const x of [-6.5,-4.35,-2.2,0,2.2,4.35,6.5])box(.1,3.25,.2,x,1.8,.25,frame)
    box(13,.12,.22,0,3.35,.25,frame)
    box(16,.4,3.2,0,3.65,1.7,concrete)
    for(const x of [-5,5])box(.35,3.5,.35,x,1.75,2.85,concrete)
    for(const x of [-9,9]){box(3,1.1,2.4,x,.55,2.2,brick);box(3.15,.13,2.55,x,1.15,2.2,concrete)}
    for(let i=0;i<3;i++)box(12,.15,1.0,0,.075+i*.15,4.9-i*.95,concrete)
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f6f5ef';ctx.textAlign='center';ctx.font='bold 70px sans-serif';ctx.fillText('L. V. JOHNSON LIBRARY',512,91)
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
    out.push({geo:place(new THREE.PlaneGeometry(12,1.4),0,5.1,1.25),mat:new THREE.MeshStandardMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide})})
    // Stone monument stands on the lawn to the entrance's right as viewed from the courtyard.
    const signX=len/2+11,signZ=13
    box(5.5,1.8,.45,signX,.9,signZ,concrete)
    box(3.0,1.1,.45,signX,2.05,signZ,concrete)
    const sign=document.createElement('canvas');sign.width=1024;sign.height=512
    const sg=sign.getContext('2d')!;sg.fillStyle='#eeeee9';sg.fillRect(0,0,1024,512);sg.fillStyle='#343c3a';sg.textAlign='center';sg.font='bold 60px serif';sg.fillText('LAWRENCE V. JOHNSON',512,225);sg.fillText('LIBRARY',512,310)
    const st=new THREE.CanvasTexture(sign);st.colorSpace=THREE.SRGBColorSpace
    out.push({geo:place(new THREE.PlaneGeometry(5.25,1.55),signX,.95,signZ+.24),mat:new THREE.MeshStandardMaterial({map:st,side:THREE.DoubleSide})})
    const medallion=new THREE.CylinderGeometry(.54,.54,.12,24);medallion.rotateX(Math.PI/2)
    out.push({geo:place(medallion,signX,2.05,signZ+.26),mat:frame})
  })
  // Two entrances along the adjoining brick wall beside the library lawn.
  edge(b.poly[21],b.poly[22],(box,len)=>{
    for(const x of [-len*.24,len*.24]){
      box(2.5,2.8,.18,x,1.4,.2,dark)
      for(const dx of [-1.25,0,1.25])box(.1,2.9,.24,x+dx,1.45,.34,frame)
      box(2.6,.12,.24,x,2.85,.34,frame)
      box(.08,.55,.12,x+.42,1.35,.42,concrete)
    }
  })
  // Green glass and pale horizontal bands trace the curved rear footprint.
  for(let i=8;i<=17;i++)edge(b.poly[i],b.poly[i+1],(box,len)=>{
    box(len,7.5,.2,0,4.55,.16,glass)
    for(let x=-len/2+.8;x<len/2;x+=1.6)box(.075,7.5,.24,x,4.55,.3,frame)
    for(const y of [.8,2.2,3.7,5.2,6.7,8.3])box(len,.09,.24,0,y,.3,frame)
    box(len,.55,.25,0,4.1,.34,concrete)
    box(len,.65,.25,0,b.h-1,.22,glass)
    box(len,.24,.9,0,b.h-.05,.36,concrete)
  })
  return out
}

/** Crawford's screen, glazed frontage, brick ends and outdoor tables. */
function crawfordDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.8,side:THREE.DoubleSide})
  const pale=mat('#e1e2da'),glass=mat('#4e6c68'),frame=mat('#bdc9c2'),gold=mat('#f1c52c'),ink=mat('#28332e'),soil=mat('#8f7863'),plant=mat('#839957')
  const brick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.9,side:THREE.DoubleSide})
  const edge=(a:Pt,c:Pt,fn:(box:(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>void,len:number,place:(g:THREE.BufferGeometry,x:number,y:number,z:number)=>THREE.BufferGeometry)=>void)=>{
    const len=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const place=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z);g.rotateY(angle);g.translate(mx,0,mz);return g}
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>out.push({geo:place(new THREE.BoxGeometry(w,h,d),x,y,z),mat:m})
    fn(box,len,place)
  }
  // Long glazed wall faces the lawn; two projecting vestibules mark the entrances.
  edge(b.poly[2],b.poly[1],(box,len,place)=>{
    box(len,.25,.8,0,b.h-.1,.32,pale)
    for(const x of [-len*.27,len*.22]){
      box(4,3,.15,x,1.55,.2,glass)
      for(const dx of [-2,-1,0,1,2])box(.1,3.05,.2,x+dx,1.55,.32,frame)
      box(4.7,.22,1.7,x,3.15,.85,pale)
    }
    // The paved rectangle and planted beds sit between Crawford and the walk.
    box(28,.08,6,0,.045,7.6,pale)
    for(const x of [-8,0,8]){
      const top=new THREE.CylinderGeometry(.9,.9,.1,16);out.push({geo:place(top,x,.78,7.6),mat:pale})
      const leg=new THREE.CylinderGeometry(.08,.08,.75,8);out.push({geo:place(leg,x,.38,7.6),mat:frame})
      for(const [dx,dz] of [[-1.35,0],[1.35,0],[0,-1.35],[0,1.35]]){
        box(.55,.1,.55,x+dx,.44,7.6+dz,ink)
        box(.08,.4,.08,x+dx,.2,7.6+dz,frame)
      }
    }
    for(const x of [-21,21]){
      box(11,.08,2.1,x,.05,6.5,soil)
      for(let dx=-4;dx<=4;dx+=1.2){const g=new THREE.IcosahedronGeometry(.32,1);g.scale(1,.55,1);out.push({geo:place(g,x+dx,.23,6.5),mat:plant})}
    }
  })
  // The short brick end has the 846 marker and building name from the photo.
  edge(b.poly[1],b.poly[0],(box,len,place)=>{
    box(len-.5,3.4,.16,0,5.8,.14,brick)
    for(const x of [-len/2+.2,len/2-.2])box(.35,7.5,.3,x,3.8,.25,pale)
    box(len,.3,.7,0,7.45,.3,pale)
    box(3,2.8,.2,-len*.28,1.4,.2,glass)
    for(const dx of [-1.5,0,1.5])box(.1,2.8,.25,-len*.28+dx,1.4,.32,frame)
    box(2.4,1.1,.15,-len*.3,5.3,.32,gold)
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f6f6ed';ctx.textAlign='center';ctx.font='bold 62px sans-serif';ctx.fillText('G. L. CRAWFORD',512,95);ctx.fillText('LABORATORY BUILDING',512,176)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
    out.push({geo:place(new THREE.PlaneGeometry(10,2.4),1.8,5.2,.35),mat:new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide})})
    const number=document.createElement('canvas');number.width=256;number.height=128
    const nc=number.getContext('2d')!;nc.fillStyle='#f1c52c';nc.fillRect(0,0,256,128);nc.fillStyle='#18221c';nc.font='bold 80px sans-serif';nc.textAlign='center';nc.fillText('846',128,92)
    const nt=new THREE.CanvasTexture(number);nt.colorSpace=THREE.SRGBColorSpace
    out.push({geo:place(new THREE.PlaneGeometry(2.3,1),-len*.3,5.3,.42),mat:new THREE.MeshStandardMaterial({map:nt,side:THREE.DoubleSide})})
  })
  edge(b.poly[3],b.poly[2],(box,len,place)=>{
    box(len-.5,3.4,.16,0,5.8,.14,brick);box(len,.3,.7,0,7.45,.3,pale)
    const x=len*.27
    box(2.8,2.8,.18,x,1.4,.18,glass)
    for(const dx of [-1.4,0,1.4])box(.1,2.85,.24,x+dx,1.43,.32,frame)
    box(2.9,.12,.24,x,2.85,.32,frame)
    const number=document.createElement('canvas');number.width=256;number.height=128
    const ctx=number.getContext('2d')!;ctx.fillStyle='#f1c52c';ctx.fillRect(0,0,256,128);ctx.fillStyle='#18221c';ctx.font='bold 80px sans-serif';ctx.textAlign='center';ctx.fillText('846',128,92)
    const tex=new THREE.CanvasTexture(number);tex.colorSpace=THREE.SRGBColorSpace
    out.push({geo:place(new THREE.PlaneGeometry(2.3,1),x,5.2,.34),mat:new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide})})
  })
  return out
}

/** Engineering Lab's courtyard elevation and its two-storey rear elevation. */
function engineeringLabDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.75,side:THREE.DoubleSide})
  const pale=mat('#e0e1d8'),glass=mat('#557573'),dark=mat('#354e4b'),brick=mat('#a57864')
  const screen=new THREE.MeshStandardMaterial({map:facade('mathscreen'),roughness:.85,side:THREE.DoubleSide})
  const edge=(a:Pt,c:Pt,fn:(box:(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>void,len:number)=>void)=>{
    const len=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);g.rotateY(angle);g.translate(mx,0,mz);out.push({geo:g,mat:m})}
    fn(box,len)
  }
  // South/courtyard side follows each step in the real footprint.
  for(let i=9;i<25;i++)edge(b.poly[i],b.poly[i+1],(box,len)=>{
    if(len<3)return
    box(len,3.6,.16,0,1.8,.15,glass)
    for(let x=-len/2+.8;x<len/2;x+=1.6)box(.1,3.6,.2,x,1.8,.26,pale)
    if(i%4===1||i%4===2)box(len,3.3,.18,0,5.65,.15,screen)
    else{box(len,3.3,.18,0,5.65,.15,dark);box(len,.5,.22,0,4.25,.28,brick);box(len,.12,.25,0,6.5,.28,pale)}
    box(len,.22,.5,0,7.48,.25,pale)
  })
  // Rear: repeated window over brick spandrel on each of the two levels.
  edge(b.poly[4],b.poly[5],(box,len)=>{
    box(len,7.45,.16,0,3.72,.15,pale)
    for(let x=-len/2+2;x<len/2-1;x+=4.1){
      for(const y of [1.9,5.65]){
        box(3.2,1.75,.2,x,y+.25,.26,glass)
        box(3.2,.55,.2,x,y-1.05,.26,brick)
        for(const dx of [-1.6,0,1.6])box(.08,1.75,.24,x+dx,y+.25,.38,pale)
      }
    }
    box(len,.2,.3,0,3.8,.3,pale)
  })
  // Enclosed glazed connector bridges the gap to the adjacent Science Lab Annex.
  const connector=new THREE.BoxGeometry(7.5,3.8,10.8);connector.translate(-252.3,5.1,-39.3)
  out.push({geo:connector,mat:glass})
  for(const x of [-256,-252.3,-248.6]){const post=new THREE.BoxGeometry(.16,3.8,.18);post.translate(x,5.1,-44.65);out.push({geo:post,mat:pale})}
  const roof=new THREE.BoxGeometry(8,.25,11);roof.translate(-252.3,7.1,-39.3);out.push({geo:roof,mat:pale})
  return out
}

/** The neighboring Design 1 block repeats the Engineering Lab rear elevation. */
function matchingLabElevation(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const pale=new THREE.MeshStandardMaterial({color:'#e0e1d8',roughness:.75}),glass=new THREE.MeshStandardMaterial({color:'#557573',roughness:.35}),brick=new THREE.MeshStandardMaterial({color:'#a57864',roughness:.8})
  for(let i=0;i<b.poly.length;i++){
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<40)continue
    const angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    // Determine which side faces away from the building centroid.
    const center=b.poly.reduce((v,p)=>[v[0]+p[0]/b.poly.length,v[1]+p[1]/b.poly.length],[0,0])
    const side=((mx-center[0])*Math.sin(angle)+(mz-center[1])*Math.cos(angle))>=0?1:-1
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z*side);g.rotateY(angle);g.translate(mx,0,mz);out.push({geo:g,mat:m})}
    box(len,7.45,.16,0,3.72,.15,pale)
    for(let x=-len/2+2;x<len/2-1;x+=4.1)for(const y of [1.9,5.65]){
      box(3.2,1.75,.2,x,y+.25,.26,glass);box(3.2,.55,.2,x,y-1.05,.26,brick)
      for(const dx of [-1.6,0,1.6])box(.08,1.75,.24,x+dx,y+.25,.38,pale)
    }
    box(len,.2,.3,0,3.8,.3,pale)
  }
  return out
}

/** Brick-screen ends of the projecting Design 2 wings, above the glazed base. */
function designTwoDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const brick=new THREE.MeshStandardMaterial({map:facade('brickscreen'),roughness:.9,side:THREE.DoubleSide})
  const trim=new THREE.MeshStandardMaterial({color:'#e5e4da',roughness:.8})
  for(const i of [3,7,11,16]){
    const a=b.poly[i],c=b.poly[i+1],len=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0]),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const panel=wallsGeometry({...b,poly:[a,c]},3.8,b.h)
    // A shallow offset keeps the screen visible over the glazed wall.
    panel.translate(Math.sin(angle)*.12,0,Math.cos(angle)*.12);out.push({geo:panel,mat:brick})
    const cap=new THREE.BoxGeometry(len+.15,.22,.38);cap.rotateY(angle);cap.translate(mx+Math.sin(angle)*.18,b.h-.05,mz+Math.cos(angle)*.18);out.push({geo:cap,mat:trim})
  }
  // West end faces the ETC: glazed entrance with a slim Design II name band.
  const glass=new THREE.MeshStandardMaterial({color:'#557671',roughness:.35,side:THREE.DoubleSide})
  const dark=new THREE.MeshStandardMaterial({color:'#394a44',roughness:.8})
  const white=new THREE.MeshStandardMaterial({color:'#e5e5dd',roughness:.8,side:THREE.DoubleSide})
  const concrete=new THREE.MeshStandardMaterial({color:'#c7c1b2',roughness:.9})
  const soil=new THREE.MeshStandardMaterial({color:'#786457',roughness:.95})
  const worldBox=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);out.push({geo,mat})}
  worldBox(.17,3.1,3,-252.03,1.55,43,glass)
  for(const z of [41.5,43,44.5])worldBox(.25,3.15,.1,-252.16,1.58,z,white)
  worldBox(.28,.16,3.1,-252.16,3.14,43,white)
  worldBox(.3,.5,12,-252.14,5.25,43,white)
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#e9e9e1';ctx.fillRect(0,0,1024,192);ctx.fillStyle='#343c39';ctx.font='bold 120px sans-serif';ctx.textAlign='center';ctx.fillText('DESIGN II',512,142)
  const text=new THREE.CanvasTexture(canvas);text.colorSpace=THREE.SRGBColorSpace
  const label=new THREE.PlaneGeometry(7,1.4);label.rotateY(-Math.PI/2);label.translate(-252.65,5.75,43)
  out.push({geo:label,mat:new THREE.MeshStandardMaterial({map:text,side:THREE.DoubleSide})})
  // Roof terrace sits above the lower linking wing between the two buildings.
  worldBox(67,.18,3.3,-214,3.91,33.4,concrete)
  for(const x of [-235,-227,-203,-187]){
    worldBox(3.4,.48,1.5,x,4.2,31.55,white)
    worldBox(3.08,.08,1.2,x,4.48,31.55,soil)
  }
  for(const x of [-238,-220,-202,-185]){
    const top=new THREE.CylinderGeometry(.75,.75,.1,16);top.translate(x,4.78,33.4);out.push({geo:top,mat:white})
    const stem=new THREE.CylinderGeometry(.06,.06,.75,8);stem.translate(x,4.34,33.4);out.push({geo:stem,mat:dark})
    for(const dx of [-1.1,1.1])worldBox(.55,.1,.55,x+dx,4.4,33.4,dark)
  }
  // Seating in the three open pockets between the projecting Design 2 wings.
  const chairColors=['#3984c7','#e5be31','#55a568','#d95c4f','#3984c7','#e5be31']
  const chairs=chairColors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.75}))
  for(const [bay,x] of [-236.5,-222,-207].entries())for(let side=0;side<2;side++){
    const cx=x+(side===0?-.8:.8),z=40.2,mat=chairs[bay*2+side]
    // A rounded molded shell: a low seat and a curved back that opens toward -Z.
    const seat=new THREE.SphereGeometry(.52,24,12);seat.scale(1,.34,.9);seat.translate(cx,4.05,z);out.push({geo:seat,mat})
    const profile=[new THREE.Vector2(.35,.03),new THREE.Vector2(.49,.1),new THREE.Vector2(.53,.4),new THREE.Vector2(.49,.77),new THREE.Vector2(.39,.76),new THREE.Vector2(.37,.4),new THREE.Vector2(.27,.2)]
    const shell=new THREE.LatheGeometry(profile,32,-Math.PI*.72,Math.PI*1.44);shell.translate(cx,3.94,z);out.push({geo:shell,mat})
  }
  // Upper portions of Design 1 project from the facade above the terrace.
  // They leave the terrace level open beneath them, without freestanding canopies.
  const upperScreen=new THREE.MeshStandardMaterial({map:facade('mathscreen'),roughness:.85,side:THREE.DoubleSide})
  for(const [x,width] of [[-238,9],[-218,13],[-195,9]]){
    worldBox(width,2.35,3.3,x,6.45,31.15,upperScreen)
    worldBox(width+.2,.18,3.45,x,7.72,31.15,white)
  }
  // Two flights turn at a landing instead of running directly into the building.
  for(let i=0;i<10;i++){
    const h=(i+1)*.2
    worldBox(.66,h,2.6,-264+i*.65,h/2,39,concrete)
  }
  worldBox(3,2,3,-257.5,1,39,concrete)
  for(let i=0;i<9;i++){
    const h=2.2+i*.2
    worldBox(2.6,h,.66,-257.5,h/2,37.3-i*.65,concrete)
  }
  worldBox(5.4,3.8,2.8,-254.8,1.9,32.2,concrete)
  // Handrails follow both flights and turn around the landing.
  const rail=(a:THREE.Vector3,c:THREE.Vector3)=>{const v=c.clone().sub(a),g=new THREE.CylinderGeometry(.055,.055,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a.x+c.x)/2,(a.y+c.y)/2,(a.z+c.z)/2);out.push({geo:g,mat:dark})}
  rail(new THREE.Vector3(-264,1,40.25),new THREE.Vector3(-258,2.85,40.25))
  rail(new THREE.Vector3(-256.2,2.85,39),new THREE.Vector3(-256.2,4.65,32.2))
  for(const [x,y,z] of [[-264,0,40.25],[-261,1,40.25],[-258,2,40.25],[-256.2,2,39],[-256.2,2.9,35.8],[-256.2,3.8,32.2]])rail(new THREE.Vector3(x,y,z),new THREE.Vector3(x,y+.85,z))
  // The lawn rises with the approach instead of leaving the stairs as a freestanding block.
  const lawn=new THREE.MeshStandardMaterial({color:'#a0b876',roughness:1,side:THREE.DoubleSide})
  const slope=new THREE.BufferGeometry()
  slope.setAttribute('position',new THREE.Float32BufferAttribute([
    -170,3.8,35,-170,0,66,-154,0,66, -170,3.8,35,-154,0,66,-154,3.8,35,
    -154,3.8,35,-154,0,66,-146,0,66, -154,3.8,35,-146,0,66,-146,0,35],3))
  slope.computeVertexNormals();out.push({geo:slope,mat:lawn})
  // A narrow inclined path sits directly beside the glazing, above a low
  // retaining wall; the main paved pedestrian route stays clear in front.
  const ramp=new THREE.BufferGeometry()
  ramp.setAttribute('position',new THREE.Float32BufferAttribute([
    -204,.08,59.05,-179,1.1,59.05,-179,1.1,60.9,
    -204,.08,59.05,-179,1.1,60.9,-204,.08,60.9],3))
  ramp.computeVertexNormals();out.push({geo:ramp,mat:concrete})
  const wall=new THREE.BufferGeometry()
  wall.setAttribute('position',new THREE.Float32BufferAttribute([
    -204,0,60.95,-179,0,60.95,-179,1.1,60.95,
    -204,0,60.95,-179,1.1,60.95,-204,.08,60.95],3))
  wall.computeVertexNormals();out.push({geo:wall,mat:white})
  const whiteRail=(a:THREE.Vector3,c:THREE.Vector3)=>{const v=c.clone().sub(a),g=new THREE.CylinderGeometry(.045,.045,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a.x+c.x)/2,(a.y+c.y)/2,(a.z+c.z)/2);out.push({geo:g,mat:white})}
  // Only the exposed retaining-wall edge has a rail; it does not cross the path.
  whiteRail(new THREE.Vector3(-204,.9,60.9),new THREE.Vector3(-179,1.92,60.9))
  whiteRail(new THREE.Vector3(-204,.5,60.9),new THREE.Vector3(-179,1.52,60.9))
  for(let i=0;i<=6;i++){const x=-204+i*25/6,y=.08+i*1.02/6;whiteRail(new THREE.Vector3(x,y,60.9),new THREE.Vector3(x,y+.82,60.9))}
  // The ramp and stair foot share a small landing, with planting beside the wall.
  worldBox(6,1.1,2.1,-176,.55,59.95,concrete)
  const shrub=new THREE.MeshStandardMaterial({color:'#718f57',roughness:.9})
  for(let x=-202;x<=-181;x+=2){const y=.08+(x+204)*1.02/25;const g=new THREE.IcosahedronGeometry(.35,1);g.scale(1,.7,1);g.translate(x,y+.22,58.85);out.push({geo:g,mat:shrub})}
  // Three flights each have a broad, level landing before the next flight.
  for(let flight=0;flight<3;flight++){
    const start=59-flight*8.1
    for(let step=0;step<6;step++){
      const h=1.1+(flight*6+step+1)*.15,z=start-step*.8
      worldBox(3.5,h,.82,-171.8,h/2,z,concrete)
    }
    const h=1.1+(flight+1)*.9,z=start-6.3
    worldBox(3.5,h,3.35,-171.8,h/2,z,concrete)
    const y0=1.1+flight*.9,y1=y0+.9
    for(const x of [-173.6,-170]){
      whiteRail(new THREE.Vector3(x,y0+.85,start+.4),new THREE.Vector3(x,y1+.85,start-4.4))
      whiteRail(new THREE.Vector3(x,y1+.85,start-4.4),new THREE.Vector3(x,y1+.85,start-8))
      for(const [zPost,yPost] of [[start,y0],[start-4.4,y1],[start-8,y1]])whiteRail(new THREE.Vector3(x,yPost,zPost),new THREE.Vector3(x,yPost+.85,zPost))
    }
  }
  // Top landing meets the terrace at the same height, with no open seam.
  worldBox(8,3.8,4.5,-175.5,1.9,36.7,concrete)
  // The adjacent Design 1 end is a solid brick wall with a recessed entrance.
  const endBrick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.9,side:THREE.DoubleSide})
  worldBox(.18,7.35,8.7,-262.35,3.68,24,endBrick)
  worldBox(.25,2.8,2.6,-262.5,1.4,24,glass)
  for(const z of [22.7,24,25.3])worldBox(.28,2.85,.1,-262.65,1.43,z,white)
  worldBox(.28,.14,2.7,-262.65,2.85,24,white)
  return out
}

/** Glass and brick annex facade, matching the attached science building. */
function scienceAnnexDetails(){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const pale=new THREE.MeshStandardMaterial({color:'#e1e2da',roughness:.8}),brick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.9})
  for(const [x,z] of [[-268.3,-55],[-244,-55]]){const g=new THREE.BoxGeometry(2,7.6,.3);g.translate(x,3.8,z);out.push({geo:g,mat:brick})}
  const band=new THREE.BoxGeometry(12,.28,.35);band.translate(-256,4.05,-61.1);out.push({geo:band,mat:pale})
  return out
}

/** Recreation and Wellness Center: two tall halls and a lower brick entrance. */
function recreationParts(b:Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.88,side:THREE.DoubleSide})
  const tan=solid('#e2d5bc'),white=solid('#e9e8df'),metal=solid('#b9c2bc'),dark=solid('#344b48')
  const brick=new THREE.MeshStandardMaterial({map:facade('atriumbrick'),roughness:.95,side:THREE.DoubleSide})
  const glass=new THREE.MeshStandardMaterial({map:facade('etcglass'),roughness:.4,side:THREE.DoubleSide})
  const flat=new THREE.MeshStandardMaterial({map:roofTexture(),color:'#eeeae1',roughness:.95,side:THREE.DoubleSide})
  const roof=new THREE.MeshStandardMaterial({map:facade('metal'),color:'#e2e5df',roughness:.9,side:THREE.DoubleSide})
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);parts.push({geo,mat})}
  // Light plaster walls sit over a banded brick base; the main building stays low between halls.
  parts.push({geo:wallsGeometry(b,0,1.35),mat:brick},{geo:wallsGeometry(b,1.35,b.h),mat:tan},{geo:flatGeometry(b.poly,b.h+.02,8),mat:flat})
  // Main gym volume and its broad, gently pitched metal roof.
  box(38.7,3.6,39.8,118.1,9.4,-360.7,tan)
  const gable=new THREE.Shape();gable.moveTo(98.7,11.2);gable.lineTo(118.1,13.1);gable.lineTo(137.45,11.2);gable.closePath()
  const mainRoof=new THREE.ExtrudeGeometry(gable,{depth:39.8,bevelEnabled:false});mainRoof.translate(0,0,-380.6);parts.push({geo:mainRoof,mat:roof})
  // The smaller south hall and central connector have shallow curved metal roofs.
  box(29.7,2.6,19.4,128.5,8.9,-299.6,tan)
  const barrel=(x0:number,x1:number,z0:number,depth:number,y:number,rise:number)=>{
    const shape=new THREE.Shape();shape.moveTo(x0,y)
    for(let i=0;i<=32;i++){const t=i/32,x=x0+(x1-x0)*t;shape.lineTo(x,y+rise*Math.sin(Math.PI*t))}
    shape.lineTo(x1,y);shape.closePath()
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.translate(0,0,z0);parts.push({geo,mat:roof})
  }
  barrel(113.65,143.35,-309.3,19.4,10.2,2.1)
  barrel(117,127,-340,30.5,7.8,1.2)
  let area=0;for(let i=0;i<b.poly.length;i++){const a=b.poly[i],c=b.poly[(i+1)%b.poly.length];area+=a[0]*c[1]-c[0]*a[1]}
  const edge=(i:number)=>{
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),sign=area>0?-1:1
    const angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
      const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz);parts.push({geo,mat})
    }
    const label=(texture:THREE.Texture,x:number,y:number,z:number,w:number,h:number)=>{
      const geo=new THREE.PlaneGeometry(w,h);if(sign<0)geo.rotateY(Math.PI);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz)
      parts.push({geo,mat:new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide})})
    }
    return {length,box,label}
  }
  // The entrance-facing sides use brick bands; the distant hall walls stay tan.
  for(const i of [8,9,10,12,13,14]) {
    const e=edge(i);if(e.length<3)continue
    e.box(e.length,6.4,.16,0,3.2,.08,brick)
    for(const y of [1.35,2.1,3.05,4.05,5.05,6])e.box(e.length,.1,.2,0,y,.18,white)
  }
  // Brick entrance wall faces the commuter parking lot, with a recessed glazed doorway.
  const entry=edge(11),w=Math.min(20,entry.length-.6)
  entry.box(w,6.6,.18,0,3.3,.1,brick)
  for(const y of [1.35,2.1,3.05,4.05,5.05,6.0])entry.box(w,.12,.24,0,y,.22,white)
  entry.box(5,3.5,.2,w*.23,1.75,.23,glass)
  for(const dx of [-2.4,-1.2,0,1.2,2.4])entry.box(.1,3.5,.26,w*.23+dx,1.75,.35,white)
  for(const y of [.12,1.7,3.35])entry.box(4.9,.1,.26,w*.23,y,.35,white)
  entry.box(5.3,.2,2,w*.23,3.7,1,white)
  for(const x of [-w*.35,-w*.1]){
    entry.box(3.4,2,.16,x,1.75,.24,white);entry.box(2.9,1.55,.2,x,1.7,.35,glass)
  }
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=220
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#202924';ctx.textAlign='center';ctx.font='bold 112px sans-serif';ctx.fillText('RECREATION & WELLNESS CENTER',1024,145,1990)
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
  entry.box(w*.78,.9,.1,-w*.11,5.55,.3,white)
  entry.label(tex,-w*.11,5.55,.39,w*.75,.7)
  const number=document.createElement('canvas');number.width=256;number.height=128
  const n=number.getContext('2d')!;n.fillStyle='#edc832';n.fillRect(0,0,256,128);n.fillStyle='#1c2922';n.textAlign='center';n.font='bold 84px sans-serif';n.fillText('955',128,94)
  const nt=new THREE.CanvasTexture(number);nt.colorSpace=THREE.SRGBColorSpace
  entry.box(1.2,.6,.1,-w*.35,6.45,.25,new THREE.MeshStandardMaterial({map:nt,side:THREE.DoubleSide}))
  // Glazed end openings and discrete service doors on the other sides.
  for(const i of [28,33]){
    const e=edge(i);e.box(5.5,4.6,.15,0,3.35,.1,glass)
    for(const x of [-2.7,-1.35,0,1.35,2.7])e.box(.12,4.6,.22,x,3.35,.2,white)
    e.box(5.7,.15,.25,0,5.7,.22,white)
  }
  const rear=edge(30);rear.box(1.7,2.5,.15,0,1.25,.1,dark);rear.box(1.5,2.25,.18,0,1.2,.22,metal)
  rear.box(3.2,1.5,1.8,5,.75,1.1,metal)
  return parts
}

/** Robin and Doug Shore Innovation Center, including its perforated brick entrance. */
function innovationCenterParts(b:Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.88,side:THREE.DoubleSide})
  const brick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.95,side:THREE.DoubleSide})
  const perforated=new THREE.MeshStandardMaterial({map:facade('innovationscreen'),roughness:.9,side:THREE.DoubleSide})
  const glass=new THREE.MeshStandardMaterial({map:facade('etcglass'),roughness:.28,metalness:.12,side:THREE.DoubleSide})
  const white=solid('#e3e5df'),dark=solid('#243b39'),frame=solid('#a4b5ac'),stone=solid('#d1cec2')
  const roof=new THREE.MeshStandardMaterial({map:roofTexture(),color:'#f4f3ec',roughness:.95,side:THREE.DoubleSide})
  parts.push({geo:wallsGeometry(b),mat:brick},{geo:flatGeometry(b.poly,b.h+.03,8),mat:roof})
  let area=0;for(let i=0;i<b.poly.length;i++){const a=b.poly[i],c=b.poly[(i+1)%b.poly.length];area+=a[0]*c[1]-c[0]*a[1]}
  const edge=(i:number)=>{
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),sign=area>0?-1:1
    const angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{
      const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz);parts.push({geo,mat:m})
    }
    const label=(tex:THREE.Texture,x:number,y:number,z:number,w:number,h:number)=>{
      const geo=new THREE.PlaneGeometry(w,h);if(sign<0)geo.rotateY(Math.PI);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz)
      parts.push({geo,mat:new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide})})
    }
    return {length,box,label}
  }
  // A two-storey glazed corner sits inside the perforated brick frame.
  for(const i of [12,13]){
    const e=edge(i),w=e.length-1
    e.box(w,7.1,.16,0,4.3,.1,glass)
    e.box(e.length,2.4,.28,0,10.1,.15,perforated)
    for(const x of [-e.length/2+.45,e.length/2-.45])e.box(.9,b.h,.3,x,b.h/2,.16,perforated)
    e.box(w,.65,.28,0,4.25,.24,dark)
    for(let x=-w/2+.1;x<=w/2;x+=1.5)e.box(.1,7.2,.25,x,4.3,.25,dark)
    for(const y of [.75,4.25,7.8])e.box(w,.1,.26,0,y,.25,frame)
  }
  const front=edge(13)
  front.box(4.4,3,.25,front.length*.18,1.55,.3,glass)
  for(const x of [-2.15,-1.07,0,1.07,2.15])front.box(.1,3,.3,front.length*.18+x,1.55,.44,dark)
  front.box(6,.18,2,front.length*.18,3.3,1,frame)
  front.box(3.6,.12,2,front.length*.18,.06,1.3,stone)
  // Building name on a dark fascia above the main doors.
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=180
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f0f1eb';ctx.textAlign='center';ctx.font='bold 87px sans-serif';ctx.fillText('ROBIN AND DOUG SHORE INNOVATION CENTER',1024,120,2000)
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
  front.box(15,.9,.12,0,4.25,.32,dark);front.label(tex,0,4.25,.41,14.5,.68)
  // Narrow vertically proportioned windows in the brick side and rear wings.
  for(const i of [3,8,11]){
    const e=edge(i)
    for(let x=-e.length/2+2;x<e.length/2-1;x+=3.4)for(const y of [5.2,8.8]){
      e.box(1.45,2.75,.14,x,y,.08,dark)
      e.box(.07,2.75,.2,x,y,.18,frame)
    }
  }
  // The service side has white stair and rooftop equipment volumes.
  const side=edge(3);side.box(5.4,b.h,.14,-side.length*.3,b.h/2,.08,white)
  const [x0,z0,x1,z1]=bbox(b.poly),cx=(x0+x1)/2,cz=(z0+z1)/2
  const mechanical=new THREE.BoxGeometry(11,2.2,8);mechanical.translate(cx,12.5,cz);parts.push({geo:mechanical,mat:white})
  return parts
}

/** Administration Building: low brick wings with pale framing and screened upper bays. */
function administrationParts(b:Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.88,side:THREE.DoubleSide})
  const brick=new THREE.MeshStandardMaterial({map:facade('textilebrick'),roughness:.95,side:THREE.DoubleSide})
  const screen=new THREE.MeshStandardMaterial({map:facade('administrationscreen'),roughness:.9,side:THREE.DoubleSide})
  const glass=new THREE.MeshStandardMaterial({map:facade('etcglass'),roughness:.35,side:THREE.DoubleSide})
  const pale=solid('#e6e6de'),dark=solid('#425450'),stone=solid('#cdcac0'),metal=solid('#aeb9b1')
  const roof=new THREE.MeshStandardMaterial({map:roofTexture(),color:'#f1f0e9',roughness:.95,side:THREE.DoubleSide})
  parts.push({geo:wallsGeometry(b,0,3.4),mat:pale},{geo:wallsGeometry(b,3.4,b.h),mat:brick},{geo:flatGeometry(b.poly,b.h+.03,8),mat:roof})
  let area=0;for(let i=0;i<b.poly.length;i++){const a=b.poly[i],c=b.poly[(i+1)%b.poly.length];area+=a[0]*c[1]-c[0]*a[1]}
  const edge=(i:number)=>{
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),sign=area>0?-1:1
    const angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
      const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz);parts.push({geo,mat})
    }
    return {length,box}
  }
  // Pale perimeter columns and caps outline each wing.
  for(let i=0;i<b.poly.length;i++){
    const e=edge(i);e.box(e.length,.28,.35,0,b.h-.12,.12,pale)
    if(e.length>6)for(const x of [-e.length/2+.25,e.length/2-.25])e.box(.42,b.h,.38,x,b.h/2,.12,pale)
  }
  // Tall screens sit above the lower ribbon windows, following the long outside wings.
  for(const i of [2,13,17]){
    const e=edge(i),w=Math.max(3,e.length-1)
    e.box(w,3,.18,0,5.35,.12,screen)
    for(const x of [-w/2,w/2])e.box(.22,3.2,.28,x,5.35,.22,pale)
    for(let x=-w/2+2.4;x<w/2-1;x+=5.2){
      e.box(3.65,1.35,.13,x,1.95,.09,dark)
      for(const d of [-1.8,-.6,.6,1.8])e.box(.09,1.4,.2,x+d,1.95,.19,metal)
      e.box(3.7,.1,.2,x,2.68,.19,pale)
    }
  }
  // A full-height perforated concrete panel wraps the short end facing the walk.
  const end=edge(3);end.box(3.5,b.h-.35,.2,-end.length/2+1.9,b.h/2,.14,screen)
  // Recessed glazed entrance on the courtyard-facing wing.
  const entry=edge(4)
  entry.box(7,3.1,.15,0,1.55,.1,glass)
  for(const x of [-3.45,-2.3,-1.15,0,1.15,2.3,3.45])entry.box(.1,3.1,.22,x,1.55,.22,pale)
  for(const y of [.12,1.5,3])entry.box(7,.09,.22,0,y,.22,pale)
  entry.box(7.5,.2,1.45,0,3.2,.7,pale)
  for(let i=0;i<4;i++)entry.box(6,.12*(i+1),.5,0,.06*(i+1),2.9-i*.5,stone)
  // A second service entrance, adjacent windows and a small mechanical unit.
  const back=edge(10)
  back.box(2,2.6,.16,0,1.3,.12,dark);back.box(1.75,2.35,.2,0,1.24,.23,glass)
  for(const x of [-back.length*.33,back.length*.33])back.box(1.8,1.2,.14,x,1.9,.1,glass)
  const equipment=edge(7);equipment.box(2.2,1.1,1.6,0,.55,1.05,metal)
  return parts
}

/** Howell and Norton Halls: light window bays with brick piers and distinct entries. */
function residenceHallParts(b:Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide})
  const facadeMat=new THREE.MeshStandardMaterial({map:facade('residencehall'),roughness:.9,side:THREE.DoubleSide})
  const glass=new THREE.MeshStandardMaterial({map:facade('etcglass'),roughness:.4,side:THREE.DoubleSide})
  const screen=new THREE.MeshStandardMaterial({map:facade('mathscreen'),roughness:.9,side:THREE.DoubleSide})
  const blocks=new THREE.MeshStandardMaterial({map:facade('residenceblocks'),roughness:.9,side:THREE.DoubleSide})
  const redBrick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.95,side:THREE.DoubleSide})
  const white=solid('#eee7d4'),brick=solid('#af795f'),paving=solid('#d5d1c4'),metal=solid('#a8b3ac')
  const roof=new THREE.MeshStandardMaterial({map:roofTexture(),color:'#f1f0ea',roughness:.95,side:THREE.DoubleSide})
  parts.push({geo:wallsGeometry(b),mat:facadeMat},{geo:flatGeometry(b.poly,b.h+.02,8),mat:roof})
  let area=0;for(let i=0;i<b.poly.length;i++){const a=b.poly[i],c=b.poly[(i+1)%b.poly.length];area+=a[0]*c[1]-c[0]*a[1]}
  const edge=(i:number)=>{
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),sign=area>0?-1:1
    const angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{
      const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz);parts.push({geo,mat:m})
    }
    const label=(text:string,x:number,y:number,z:number,w:number,h:number,color='#f7f4e9')=>{
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256
      const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.font='bold 125px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,165,990)
      const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
      const geo=new THREE.PlaneGeometry(w,h);if(sign<0)geo.rotateY(Math.PI);geo.translate(x,y,z*sign);geo.rotateY(angle);geo.translate(mx,0,mz)
      parts.push({geo,mat:new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide})})
    }
    return {length,box,label}
  }
  const entry=(e:ReturnType<typeof edge>,x:number)=>{
    e.box(3.7,3.1,.2,x,1.55,.1,white);e.box(3.35,2.85,.22,x,1.43,.24,glass)
    for(const dx of [-1.65,-.83,0,.83,1.65])e.box(.09,2.85,.27,x+dx,1.43,.36,white)
    for(const y of [.15,1.45,2.8])e.box(3.4,.09,.27,x,y,.36,white)
    e.box(4.25,.2,1.5,x,3.15,.75,white)
  }
  if(b.code==='R2') {
    // The lawn-facing entrance has cream breeze-block screens and a brick name panel.
    const front=edge(2),center=front.length*.13
    front.box(4.2,11.8,.14,center,9.25,.08,redBrick)
    front.label('NORTON HALL',center,9.0,.25,3.7,.65)
    front.box(13,3.35,2.1,center,1.68,1.02,white)
    for(const x of [center-4.25,center+4.25])front.box(3.45,3.1,.15,x,1.55,2.13,blocks)
    front.box(3.8,3.0,.16,center,1.5,2.14,glass)
    for(const x of [-1.85,-.93,0,.93,1.85])front.box(.1,3.05,.22,center+x,1.53,2.26,white)
    for(const y of [.12,1.5,2.95])front.box(3.8,.1,.22,center,y,2.26,white)
    front.box(13.4,.22,2.5,center,3.42,1.12,white)
    front.box(1.9,.48,.12,center,2.45,2.31,white)
    front.label('POLICE',center,2.45,2.4,1.6,.3,'#26332f')
    for(const x of [-front.length*.36,front.length*.36]) if(Math.abs(x-center)>8)entry(front,x)
    const rear=edge(11)
    rear.box(7.2,b.h-.6,.14,rear.length*.33,b.h/2,.1,screen)
    entry(rear,rear.length*.3)
  } else {
    // Howell's courtyard elevations have the same pale piers and narrow window bands.
    for(const i of [0,2,4]){const e=edge(i);e.box(e.length,.16,.25,0,b.h-.1,.12,white)}
    // Courtyard entry matches the cream screened porch and central Howell Hall lettering.
    const courtyard=edge(2)
    courtyard.box(12.5,3.3,1.9,0,1.65,.95,white)
    for(const x of [-4.2,4.2])courtyard.box(3.6,3.05,.15,x,1.53,1.94,blocks)
    courtyard.box(3.5,2.85,.18,0,1.43,1.95,glass)
    for(const x of [-1.7,-.85,0,.85,1.7])courtyard.box(.1,2.85,.22,x,1.43,2.07,white)
    courtyard.box(12.8,.22,2.2,0,3.4,1.02,white)
    courtyard.box(4.4,.9,.16,0,7.75,.12,white)
    courtyard.label('HOWELL HALL',0,7.78,.25,3.9,.5,'#202d29')
    for(let i=0;i<4;i++)courtyard.box(4.8,.14*(i+1),.55,0,.07*(i+1),4-i*.55,paving)
    // Brick end wall with narrow stacked windows and the 634 address.
    const end=edge(5)
    end.box(end.length,b.h,.12,0,b.h/2,.08,redBrick)
    end.box(2.15,b.h-.8,.16,0,b.h/2,.18,white)
    for(const y of [5.1,8.8,12.5]){
      end.box(1.8,2.25,.18,0,y,.3,glass)
      end.box(2.1,.13,.7,0,y+1.2,.55,white)
    }
    end.box(1.55,2.45,.2,0,1.23,.32,glass)
    end.label('HOWELL RESIDENCE HALL',-2.1,3.7,.28,3.5,.45)
    end.box(1.3,.65,.12,-2.1,2.95,.25,solid('#eecb35'))
    end.label('634',-2.1,2.95,.35,1.05,.48,'#18221d')
    // A full-height glazed stair tower faces the parking-side entry.
    const tower=edge(12)
    tower.box(tower.length,b.h,.18,0,b.h/2,.1,white)
    tower.box(tower.length-1,b.h-1,.2,0,b.h/2,.23,glass)
    for(let x=-tower.length/2+.55;x<tower.length/2;x+=1.05)tower.box(.1,b.h-1,.26,x,b.h/2,.35,white)
    for(let y=.5;y<b.h;y+=1.5)tower.box(tower.length-1,.08,.26,0,y,.35,white)
    entry(tower,0)
    const side=edge(6)
    // Enclosed equipment yard and steps beside the projecting stair tower.
    side.box(9,1.25,4.5,-side.length*.3,.63,2.35,brick)
    side.box(8.7,.12,4.2,-side.length*.3,1.3,2.35,paving)
    side.box(3.5,1.35,2,-side.length*.3,1.98,2.35,metal)
    for(let i=0;i<7;i++)side.box(3,.14*(i+1),.5,side.length*.34,.07*(i+1),3.9-i*.5,paving)
  }
  return parts
}

/** Wilder Communications: simple tan one-storey workshop with a ribbed roof. */
function wilderParts(b:Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.9,side:THREE.DoubleSide})
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128
  const g=canvas.getContext('2d')!;g.fillStyle='#c5b69a';g.fillRect(0,0,128,128)
  g.fillStyle='rgba(82,74,59,.1)';for(let x=0;x<128;x+=16)g.fillRect(x,0,2,128)
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping
  const wall=new THREE.MeshStandardMaterial({map:tex,roughness:.95,side:THREE.DoubleSide})
  const roof=new THREE.MeshStandardMaterial({map:facade('metal'),color:'#f0f0e8',roughness:.9,side:THREE.DoubleSide})
  const trim=solid('#e8e7de'),glass=solid('#526663'),door=solid('#d3d4ca'),lines=solid('#afb6b0')
  parts.push({geo:wallsGeometry(b),mat:wall},{geo:flatGeometry(b.poly,b.h+.03,4),mat:roof})
  // The road-facing facade steps in and out along these three parallel wall sections.
  const edge=(i:number)=>{
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz)
    const angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const panel=(w:number,h:number,d:number,x:number,y:number,out:number,mat:THREE.MeshStandardMaterial)=>{
      const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,-out);geo.rotateY(angle);geo.translate(mx,0,mz);parts.push({geo,mat})
    }
    return {length,panel}
  }
  const left=edge(5),middle=edge(3),right=edge(1)
  for(const e of [left,middle,right])e.panel(e.length,.17,.3,0,b.h-.04,.1,trim)
  // Windows span the middle section and the pedestrian entrance is at the left.
  for(const x of [-middle.length*.3,0,middle.length*.3]) {
    middle.panel(1.4,1.5,.15,x,1.9,.08,trim)
    middle.panel(1.16,1.26,.17,x,1.9,.19,glass)
    middle.panel(.07,1.26,.2,x,1.9,.3,lines)
  }
  left.panel(1.55,2.5,.16,0,1.25,.1,trim)
  left.panel(1.25,2.25,.18,0,1.2,.21,door)
  left.panel(.08,.4,.21,.42,1.22,.32,glass)
  // The garage occupies the far-right section of the front, not the side wall.
  right.panel(4,2.75,.16,0,1.38,.1,trim)
  right.panel(3.75,2.55,.18,0,1.35,.21,door)
  for(const y of [.55,1.05,1.55,2.05,2.55])right.panel(3.65,.035,.2,0,y,.32,lines)
  return parts
}

/** Civil engineering buildings and the student competition workshop. */
function civilBuildingsParts(b: Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.9,side:THREE.DoubleSide})
  const siding=new THREE.MeshStandardMaterial({map:facade('metal'),color:b.code==='L'?'#e3e4dc':'#d0d5d0',roughness:.9,side:THREE.DoubleSide})
  const concrete=material('#d0d3cd'),dark=material('#455653'),frame=material('#bbc6c0'),door=material('#a5adaa')
  const roof=b.code==='O'?new THREE.MeshStandardMaterial({map:facade('metal'),color:'#d5d8d3',roughness:.9,side:THREE.DoubleSide}):material(b.code==='L1'?'#8c928b':'#e4e5dc')
  const brick=new THREE.MeshStandardMaterial({map:facade('textilebrick'),roughness:.95,side:THREE.DoubleSide})
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);parts.push({geo:g,mat:m})}
  const lowerHeight=b.code==='L'?3.05:b.code==='L1'?1.2:2.15
  const redBrick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.95,side:THREE.DoubleSide})
  parts.push({geo:wallsGeometry(b,0,lowerHeight),mat:b.code==='L'||b.code==='O'?redBrick:brick})
  parts.push({geo:wallsGeometry(b,lowerHeight,b.h),mat:siding},{geo:flatGeometry(b.poly,b.h+.03,4),mat:roof})
  let area=0;for(let i=0;i<b.poly.length;i++){const a=b.poly[i],c=b.poly[(i+1)%b.poly.length];area+=a[0]*c[1]-c[0]*a[1]}
  const edge=(index:number)=>{
    const a=b.poly[index],c=b.poly[(index+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz)
    const angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2,sign=area>0?-1:1
    const panel=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
      const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z*sign);g.rotateY(angle);g.translate(mx,0,mz);parts.push({geo:g,mat})
    }
    const place=(g:THREE.BufferGeometry,x:number,y:number,z:number)=>{g.translate(x,y,z*sign);g.rotateY(angle);g.translate(mx,0,mz);return g}
    return {length,panel,place}
  }
  // Keep trim and openings attached to the building's mapped edges.
  if(b.code==='L') {
    const front=edge(9)
    // Light dividing trim separates the red brick from the ribbed metal above.
    front.panel(front.length,.12,.22,0,3.08,.1,frame)
    front.panel(front.length,.18,.4,0,b.h-.08,.2,frame)
    // Two tall window compositions, including the pale square glass-block centers.
    const blockCanvas=document.createElement('canvas');blockCanvas.width=256;blockCanvas.height=256
    const gc=blockCanvas.getContext('2d')!;gc.fillStyle='#8eaaa7';gc.fillRect(0,0,256,256)
    for(let y=0;y<256;y+=32)for(let x=0;x<256;x+=32){gc.fillStyle=(x/32+y/32)%2?'#a6bcb6':'#b2c6c0';gc.fillRect(x+2,y+2,28,28);gc.fillStyle='rgba(255,255,255,.25)';gc.fillRect(x+3,y+3,26,4)}
    const blockTex=new THREE.CanvasTexture(blockCanvas);blockTex.colorSpace=THREE.SRGBColorSpace
    const glassBlock=new THREE.MeshStandardMaterial({map:blockTex,roughness:.55,side:THREE.DoubleSide})
    for(const x of [-front.length*.28,front.length*.27]){
      front.panel(4.3,3.2,.14,x,1.9,.08,frame)
      front.panel(2.7,2.7,.16,x,1.75,.18,glassBlock)
      for(const dx of [-1.78,1.78])front.panel(.56,2.75,.18,x+dx,1.77,.2,dark)
      front.panel(4.05,.45,.18,x,3.25,.2,dark)
      front.panel(.1,3.15,.21,x-2.1,1.9,.27,frame)
      front.panel(.1,3.15,.21,x+2.1,1.9,.27,frame)
    }
    // Projecting white frame and glazed double entrance between the windows.
    front.panel(5.4,3.25,.14,0,1.65,.1,frame)
    front.panel(5.1,3.05,.16,0,1.65,.21,dark)
    for(const x of [-2.45,-1.25,0,1.25,2.45])front.panel(.11,3.05,.2,x,1.65,.3,frame)
    for(const y of [.2,2.45,3.1])front.panel(5,.1,.21,0,y,.31,frame)
    front.panel(5.8,.22,2.5,0,3.5,1.22,frame)
    for(const x of [-2.55,2.55])front.panel(.23,3.5,.23,x,1.75,2.25,frame)
    // Thin translucent-looking transom above the entrance, with a modest raised gable.
    front.panel(5.2,.55,.2,0,3.9,.3,frame)
    front.panel(4.8,.35,.23,0,3.9,.42,dark)
    // Additional windows and a service door along the opposite elevation.
    const rear=edge(3)
    for(const x of [-rear.length*.28,0,rear.length*.28])rear.panel(2,1.25,.14,x,1.8,.12,dark)
    rear.panel(1.25,2.2,.16,rear.length*.4,1.1,.12,door)
    // Multiple small ventilators on the broad low roof.
    const [x0,z0,x1,z1]=bbox(b.poly)
    let vents=0
    for(let x=x0+3;x<x1-2;x+=9)for(let z=z0+3;z<z1-2;z+=9)if(vents<8&&pointInPoly(x,z,b.poly)){
      box(.85,.55,.85,x,b.h+.3,z,frame);box(.95,.1,.95,x,b.h+.62,z,concrete);vents++
    }
    // The end entrance opens toward the front approach as well.
    const approach=edge(0)
    approach.panel(2.2,2.55,.16,0,1.28,.12,frame)
    approach.panel(1.85,2.3,.2,0,1.2,.24,dark)
    approach.panel(.09,2.3,.24,0,1.2,.36,frame)
    // Competition concrete canoe displayed on a freestanding steel truss.
    const canoe=material('#5c4535'),truss=material('#4c5752'),gold=material('#e2bb53')
    const support=edge(0),u=-17,v=4
    const hull=new THREE.Shape();hull.moveTo(-5.7,.58);hull.quadraticCurveTo(-4.5,-.35,-3.2,-.35);hull.lineTo(3.2,-.35);hull.quadraticCurveTo(4.5,-.35,5.7,.58);hull.closePath()
    const hullGeo=new THREE.ExtrudeGeometry(hull,{depth:.65,bevelEnabled:false});parts.push({geo:support.place(hullGeo,u,1.45,v),mat:canoe})
    for(const z of [v-.45,v+1.1]) {
      support.panel(11.8,.08,.08,u,.8,z,truss);support.panel(9.5,.08,.08,u,2.85,z,truss)
      for(const x of [-4.4,-2.2,0,2.2,4.4])support.panel(.08,2.1,.08,u+x,1.83,z,truss)
    }
    for(const x of [-4,4])support.panel(.15,.8,.15,u+x,.4,v+.3,truss)
    const banner=document.createElement('canvas');banner.width=1024;banner.height=128
    const bc=banner.getContext('2d')!;bc.fillStyle='#e3c25c';bc.textAlign='center';bc.font='bold 70px serif';bc.fillText('KENNESAW STATE UNIVERSITY',512,88)
    const bt=new THREE.CanvasTexture(banner);bt.colorSpace=THREE.SRGBColorSpace
    const textMat=new THREE.MeshStandardMaterial({map:bt,transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide})
    support.panel(7,.42,.025,u,1.45,v+.68,textMat)
    support.panel(1.8,.06,.08,u,2.92,v+.3,gold)
  } else if(b.code==='O') {
    // The short end faces the service court and has two broad workshop doors.
    const front=edge(0)
    for(const x of [-front.length*.25,front.length*.25]){
      front.panel(4.1,3,.16,x,1.5,.12,door)
      front.panel(4.3,.13,.22,x,3.08,.19,frame)
      for(const y of [.55,1.1,1.65,2.2,2.75])front.panel(3.9,.035,.2,x,y,.22,frame)
    }
    front.panel(1.15,2.2,.15,0,1.1,.13,dark)
    // Continue the brick and ribbed upper cladding around both long elevations.
    for(const index of [2,4]) {
      const side=edge(index)
      side.panel(1.5,2.3,.16,-side.length*.32,1.15,.13,frame)
      side.panel(1.22,2.1,.18,-side.length*.32,1.15,.24,door)
      for(const t of [-.12,.1,.32]) {
        side.panel(2.5,1.3,.14,side.length*t,2.15,.1,frame)
        side.panel(2.28,1.08,.16,side.length*t,2.15,.2,dark)
        side.panel(.07,1.08,.2,side.length*t,2.15,.31,frame)
      }
    }
  } else {
    const entry=edge(0)
    entry.panel(1.5,2.4,.16,0,1.2,.12,frame)
    entry.panel(1.22,2.15,.2,0,1.15,.24,door)
    entry.panel(.09,.42,.22,.42,1.2,.36,dark)
    const front=edge(1)
    front.panel(1.4,2.25,.15,-front.length*.22,1.13,.12,door)
    front.panel(2.3,1.2,.14,front.length*.2,2.15,.12,dark)
    // Small low utility annex beside the main flat-roofed volume.
    const side=edge(2)
    side.panel(side.length*.72,2.45,2.1,0,1.23,1.05,concrete)
    side.panel(side.length*.76,.2,2.3,0,2.56,1.1,frame)
    side.panel(1.2,2,.12,side.length*.12,1.02,2.16,door)
    side.panel(2,1.1,.12,-side.length*.18,1.55,2.16,dark)
  }
  return parts
}

/** Gymnasium: brick upper walls, pale base, glazed entrance and service sides. */
function gymnasiumParts(b:Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide})
  const wallBrick=new THREE.MeshStandardMaterial({map:facade('textilebrick'),roughness:.95,side:THREE.DoubleSide})
  const pale=solid('#d5d8d1'),trim=solid('#eaebe4'),metal=solid('#aeb8b2'),dark=solid('#344846'),soil=solid('#897968')
  const glass=new THREE.MeshStandardMaterial({map:facade('etcglass'),roughness:.35,side:THREE.DoubleSide})
  const roof=new THREE.MeshStandardMaterial({map:roofTexture(),color:'#f4f3ed',roughness:.95,side:THREE.DoubleSide})
  // Windowless gym hall: light lower wall and warm brick above.
  parts.push({geo:wallsGeometry(b,0,2.8),mat:pale},{geo:wallsGeometry(b,2.8,b.h),mat:wallBrick},{geo:flatGeometry(b.poly,b.h+.02,8),mat:roof})
  const onEdge=(index:number)=>{
    const a=b.poly[index],c=b.poly[(index+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1]
    const len=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const place=(geo:THREE.BufferGeometry,x:number,y:number,z:number)=>{geo.translate(x,y,-z);geo.rotateY(angle);geo.translate(mx,0,mz);return geo}
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>parts.push({geo:place(new THREE.BoxGeometry(w,h,d),x,y,z),mat})
    return {len,box,place}
  }
  // Street-facing entrance: three glass doors beneath a wide canopy and upper windows.
  const front=onEdge(2)
  front.box(front.len,3.35,.12,0,1.68,.08,glass)
  front.box(front.len,.32,2.3,0,3.55,1.05,trim)
  front.box(front.len,.13,2.45,0,3.35,1.05,metal)
  for(let x=-front.len/2;x<=front.len/2;x+=2.2)front.box(.11,3.4,.2,x,1.7,.2,trim)
  for(const y of [1.25,2.55,3.18])front.box(front.len,.09,.2,0,y,.2,metal)
  for(const x of [-7,0,7]){
    front.box(2.3,2.9,.14,x,1.45,.26,dark)
    front.box(2.05,2.65,.16,x,1.43,.36,glass)
    front.box(.09,2.65,.2,x,1.43,.46,trim)
    front.box(2.5,.12,1,x,3.14,.62,trim)
  }
  for(let x=-front.len/2+1.5;x<front.len/2;x+=4.4){
    front.box(3.15,1.9,.12,x,5.7,.1,dark)
    front.box(3,.12,.18,x,6.7,.15,trim)
  }
  // Both long sides have evenly spaced brick bays over a pale service level.
  for(const edge of [6,12]) {
    const side=onEdge(edge)
    side.box(side.len,.25,.5,0,7.25,.2,trim)
    side.box(side.len,.18,.35,0,2.82,.16,metal)
    for(let x=-side.len/2+1;x<side.len/2;x+=4.8)side.box(.22,4.3,.28,x,5.04,.13,metal)
    for(const x of [-side.len*.3,side.len*.3]) {
      side.box(1.3,2.3,.18,x,1.15,.12,metal)
      side.box(1.05,2.05,.2,x,1.15,.25,dark)
      side.box(.1,.45,.22,x+.35,1.15,.38,trim)
    }
    // Short flights connect each side door to the surrounding pavement.
    for(let i=0;i<5;i++) side.box(3.2,.1*(i+1),.52,-side.len*.3,.05*(i+1),3.0-i*.5,pale)
  }
  // Rear elevation has a long horizontal louver and sparse utility doors.
  const rear=onEdge(9)
  rear.box(rear.len*.58,1.15,.22,0,1.8,.16,metal)
  for(let y=1.35;y<=2.3;y+=.17)rear.box(rear.len*.58,.045,.28,0,y,.26,trim)
  for(const x of [-rear.len*.38,rear.len*.38])rear.box(1.25,2.15,.16,x,1.08,.1,metal)
  // Small service shelter on the parking side and a few ground-level planters.
  const side=onEdge(12)
  side.box(7.2,2.4,3.3,0,1.2,3.2,pale)
  side.box(7.5,.24,3.6,0,2.52,3.2,trim)
  side.box(2,1.5,.12,-1.7,1.2,4.92,dark)
  for(const x of [-11,9]) {
    side.box(3,.15,1.25,x,.08,1.15,soil)
    side.box(2.2,.55,.75,x,.38,1.15,solid('#72865b'))
  }
  // The two large mechanical housings are anchored to the roof near the entrance.
  for(const x of [-6.7,6.7]){
    const unit=onEdge(2)
    unit.box(5.5,1.65,2.3,x,b.h+.83,-4,trim)
    unit.box(5.65,.16,2.45,x,b.h+1.7,-4,metal)
  }
  return parts
}

/** Architecture: glazed studio wing, white finned entry and stepped forecourt. */
function architectureParts(b: Building) {
  const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const solid=(color:string,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide})
  const glass=new THREE.MeshStandardMaterial({map:facade('etcglass'),roughness:.35,metalness:.08,side:THREE.DoubleSide})
  const white=solid('#e5e8e2'),dark=solid('#344b49'),stone=solid('#c6c8c2'),brick=solid('#b18c79')
  // Continuous curtain wall over a recessed, darker ground floor; the tall entrance wall is white.
  for(let i=0;i<b.poly.length;i++){
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length],seg={...b,poly:[a,c]}
    const facadeMat=i===11?white:glass
    parts.push({geo:wallsGeometry(seg,0,3.25),mat:i===11?white:dark})
    parts.push({geo:wallsGeometry(seg,3.25,b.h),mat:facadeMat})
  }
  parts.push({geo:flatGeometry(b.poly,b.h+.02,8),mat:white})
  const onEdge=(index:number)=>{
    const a=b.poly[index],c=b.poly[(index+1)%b.poly.length],dx=c[0]-a[0],dz=c[1]-a[1]
    const len=Math.hypot(dx,dz), angle=-Math.atan2(dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
      const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);geo.rotateY(angle);geo.translate(mx,0,mz);parts.push({geo,mat})
    }
    return {len,box}
  }
  // Repeated horizontal projecting shades and a fine grid on the long studio facade.
  const wing=onEdge(8)
  for(const y of [3.35,7.1,10.9,14.7]) wing.box(wing.len,.17,1.15,0,y,.52,white)
  for(let x=-wing.len/2+2;x<wing.len/2;x+=4.7)wing.box(.16,3.15,.35,x,1.6,.18,stone)
  wing.box(wing.len,.35,.8,0,15.12,.33,white)
  // Deep white fins frame the stacked studio windows on the entrance block.
  const entry=onEdge(11)
  for(let x=-entry.len/2+1;x<entry.len/2;x+=3.1){
    entry.box(.48,14.5,1.15,x,7.3,.48,white)
    for(const y of [4.8,8.4,12]){
      entry.box(2.35,2.3,.12,x+1.3,y,.09,glass)
      entry.box(2.55,.17,.9,x+1.3,y+1.25,.45,white)
    }
  }
  // Broad stairs lead toward the recessed gap between the two wings.
  for(let i=0;i<10;i++) entry.box(10,.16*(i+1),.8,-1,.08*(i+1),7.9-i*.78,stone)
  entry.box(10,.2,1.2,-1,1.72,.65,stone)
  // The shorter glazed wing has a brick-coloured plinth and roof terrace edge.
  const shortWing=onEdge(16)
  shortWing.box(shortWing.len,1.15,.2,0,.58,.08,brick)
  shortWing.box(shortWing.len,.28,.55,0,b.h-.1,.25,white)
  // The concrete monument angles away from the glass corner, with a tree behind it.
  const sa=b.poly[8],sb=b.poly[9],theta=-Math.atan2(sb[1]-sa[1],sb[0]-sa[0])
  const mx=(sa[0]+sb[0])/2,mz=(sa[1]+sb[1])/2,tx=wing.len/2-5,tz=4
  const place=(geo:THREE.BufferGeometry,x:number,y:number,z:number)=>{geo.translate(x,y,z);geo.rotateY(theta);geo.translate(mx,0,mz);return geo}
  const monument=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial)=>{
    const geo=new THREE.BoxGeometry(w,h,d);geo.rotateY(.55);geo.translate(tx,0,tz);parts.push({geo:place(geo,x,y,z),mat})
  }
  monument(8,.12,3,0,.07,-.7,brick)
  monument(7,1.45,.3,0,.78,0,stone)
  const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256
  const sc=signCanvas.getContext('2d')!;sc.clearRect(0,0,1024,256)
  sc.fillStyle='#323a36';sc.font='bold 112px sans-serif';sc.textAlign='left';sc.fillText('ARCHITECTURE',18,108)
  sc.fillStyle='#e9bd2c';sc.fillRect(22,135,180,91);sc.fillStyle='#202724';sc.font='bold 70px sans-serif';sc.fillText('640',48,208)
  const signTex=new THREE.CanvasTexture(signCanvas);signTex.colorSpace=THREE.SRGBColorSpace
  const sg=new THREE.PlaneGeometry(6.4,1.2);sg.translate(0,0,.17);sg.rotateY(.55);sg.translate(tx,.82,tz)
  parts.push({geo:place(sg,0,0,0),mat:new THREE.MeshStandardMaterial({map:signTex,transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide})})
  const shrubs=solid('#637b47'),bark=solid('#73513c'),leaves=solid('#695049')
  wing.box(.34,3.2,.34,tx-1,1.6,tz-2,bark)
  const tree=new THREE.IcosahedronGeometry(2.4,1);tree.scale(1,.8,1);parts.push({geo:place(tree,tx-1,4.15,tz-2),mat:leaves})
  for(const [x,z] of [[tx-3,tz-1],[tx+3,tz-1],[tx+2,tz-2]]) {
    const bush=new THREE.IcosahedronGeometry(.75,1);bush.scale(1,.7,1);parts.push({geo:place(bush,x,.58,z),mat:shrubs})
  }
  // Light upper service volume, set back from the principal glass roofline.
  const volume=new THREE.BoxGeometry(16,3.5,10);volume.translate(9,16.95,202);parts.push({geo:volume,mat:white})
  const cap=new THREE.BoxGeometry(16.4,.2,10.4);cap.translate(9,18.75,202);parts.push({geo:cap,mat:white})
  return parts
}

/** W. Clair Harris Textile Center: tiled wings, brick base and raised roof spine. */
function textileCenterParts(b: Building) {
  const parts: {geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide})
  const tile=new THREE.MeshStandardMaterial({map:facade('textiletile'),roughness:.95,side:THREE.DoubleSide})
  const brick=new THREE.MeshStandardMaterial({map:facade('textilebrick'),roughness:.95,side:THREE.DoubleSide})
  const roof=mat('#e4e6df'),dark=mat('#354443'),metal=mat('#cad0ca'),garage=mat('#939b98')
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);parts.push({geo,mat:m})}
  // Retain tile on the curved end and the projecting rear wing; use brick elsewhere.
  // Stop the lower walls at the tower opening while keeping the upper walls and roof.
  const openingZ=203.4
  for(let i=0;i<b.poly.length;i++) {
    const a=b.poly[i],c=b.poly[(i+1)%b.poly.length]
    const upperMat=(i>=14 && i<=21)||(i>=5 && i<=11) ? tile : brick
    const segment=(p:Pt,q:Pt,y0:number,y1:number,m:THREE.MeshStandardMaterial)=>parts.push({geo:wallsGeometry({...b,poly:[p,q]},y0,y1),mat:m})
    segment(a,c,3.35,b.h,upperMat)
    if(a[1]>openingZ && c[1]>openingZ) continue
    let p=a,q=c
    if((a[1]>openingZ)!==(c[1]>openingZ)) {
      const t=(openingZ-a[1])/(c[1]-a[1]),cut:Pt=[a[0]+(c[0]-a[0])*t,openingZ]
      if(a[1]>openingZ)p=cut;else q=cut
    }
    segment(p,q,0,1.3,brick);segment(p,q,1.3,3.35,upperMat)
  }
  parts.push({geo:flatGeometry(b.poly,b.h+.02,8),mat:roof})
  // Raised, long metal gable over the central circulation spine.
  box(6.1,.28,80.5,-88.8,8.75,172.25,metal)
  const shape=new THREE.Shape();shape.moveTo(-92,8.85);shape.lineTo(-88.8,11.35);shape.lineTo(-85.6,8.85);shape.closePath()
  const gable=new THREE.ExtrudeGeometry(shape,{depth:80.5,bevelEnabled:false});gable.translate(0,0,132);parts.push({geo:gable,mat:roof})
  for(const x of [-91.85,-85.75]){
    box(.18,1.25,80.5,x,8.08,172.25,metal)
    box(.21,.28,80.5,x,8.52,172.25,dark)
    // Vertical seams give the white metal fascia a ribbed surface.
    for(let z=132;z<212;z+=1.25)box(.04,1.16,.045,x+(x< -88.8?-.12:.12),8.06,z,roof)
  }
  // Open end frame: brick piers support the high roof above the walk-through.
  for(const x of [-91.4,-86.2])box(.8,8.6,.85,x,4.3,212.1,brick)
  box(6,.7,.9,-88.8,7.05,212.1,brick)
  // Rear loading and service bays follow the angled west wall.
  const backA=b.poly[b.poly.length-1],backB=b.poly[0]
  const bdx=backB[0]-backA[0],bdz=backB[1]-backA[1]
  const backAngle=-Math.atan2(bdz,bdx),bx=(backA[0]+backB[0])/2,bz=(backA[1]+backB[1])/2
  const backBox=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{
    const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,-z);geo.rotateY(backAngle);geo.translate(bx,0,bz);parts.push({geo,mat:m})
  }
  for(const x of [-14,-8,-2,4,10]){
    backBox(4.1,2.65,.12,x,1.55,.08,garage)
    backBox(4.25,.14,.18,x,2.95,.14,metal)
    for(const y of [.6,1.2,1.8,2.4])backBox(3.95,.035,.14,x,y,.16,metal)
  }
  backBox(1.5,2.4,.15,15.5,1.2,.1,metal)
  backBox(1.16,2.1,.17,15.5,1.15,.2,dark)
  backBox(.1,.5,.2,15.9,1.2,.31,roof)
  // Refuse bins stand in the service area, clear of the loading doors.
  const bin=mat('#49614d'),lid=mat('#273b31')
  for(const x of [-8,2]) {
    backBox(2.5,1.4,1.45,x,.7,4,bin);backBox(2.6,.16,1.55,x,1.47,4,lid)
    for(const dx of [-.9,.9])backBox(.22,.22,.3,x+dx,.12,4.5,dark)
  }
  // Small glazed entrance on the projecting tiled wing, plus rear windows.
  const edgeBox=(index:number,t:number,w:number,h:number,y:number,material:THREE.MeshStandardMaterial,off=.1)=>{
    const p=b.poly[index],q=b.poly[(index+1)%b.poly.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz)
    const geo=new THREE.BoxGeometry(w,h,.12);geo.rotateY(-Math.atan2(dz,dx));geo.translate(p[0]+dx*t+dz/length*off,y,p[1]+dz*t-dx/length*off);parts.push({geo,mat:material})
  }
  edgeBox(8,.55,1.8,2.5,1.25,metal);edgeBox(8,.55,1.5,2.2,1.2,dark,.2)
  for(const t of [.16,.36,.56,.76]) edgeBox(4,t,2.2,1.3,4.55,dark)
  edgeBox(4,.9,1.25,2.35,1.18,metal);edgeBox(4,.9,1,2.1,1.15,dark,.2)
  // Wall lettering follows a straight section of the curved wing footprint.
  const a=b.poly[15],c=b.poly[16], dx=c[0]-a[0], dz=c[1]-a[1],len=Math.hypot(dx,dz)
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#202927';ctx.textAlign='center';ctx.font='bold 64px sans-serif'
  ctx.fillText('W. CLAIR HARRIS',512,103);ctx.font='bold 46px sans-serif';ctx.fillText('APPAREL AND TEXTILE CENTER',512,182)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  const sign=new THREE.PlaneGeometry(Math.min(5.8,len*.95),1.65)
  sign.rotateY(-Math.atan2(dz,dx)+Math.PI);sign.translate((a[0]+c[0])/2+dx/len*.25+dz/len*.06,4.3,(a[1]+c[1])/2+dz/len*.25-dx/len*.06)
  parts.push({geo:sign,mat:new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.1,depthWrite:false,side:THREE.DoubleSide,roughness:.9})})
  // Building number on the end of the brick support.
  const number=document.createElement('canvas');number.width=256;number.height=128
  const n=number.getContext('2d')!;n.fillStyle='#edc22c';n.fillRect(0,0,256,128);n.fillStyle='#171c19';n.font='bold 84px sans-serif';n.textAlign='center';n.fillText('650',128,94)
  const nt=new THREE.CanvasTexture(number);nt.colorSpace=THREE.SRGBColorSpace
  const plaque=new THREE.PlaneGeometry(1.5,.75);plaque.translate(-88.8,7.06,212.58);parts.push({geo:plaque,mat:new THREE.MeshStandardMaterial({map:nt,side:THREE.DoubleSide})})
  return parts
}

/** K3 pump house: low brick walls, rooftop trim, owl mural and patio seating. */
function pumpHouseParts(b: Building) {
  const out: {geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial}[] = []
  const material = (color: string) => new THREE.MeshStandardMaterial({color, roughness: .9, side: THREE.DoubleSide})
  const brick = new THREE.MeshStandardMaterial({map: facade('librarybrick'), roughness: .9, side: THREE.DoubleSide})
  const trim = material('#d4d1c8'), roof = material('#a5a29a'), metal = material('#a4aaa5')
  const dark = material('#242c2c'), pavement = material('#c6c1b5'), canopy = material('#242928')
  const box = (w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.MeshStandardMaterial) => {
    const geo = new THREE.BoxGeometry(w,h,d); geo.translate(x,y,z); out.push({geo,mat})
  }
  out.push({geo:wallsGeometry(b),mat:brick}, {geo:flatGeometry(b.poly,b.h+.02),mat:roof})
  // A light coping runs around the flat, weathered roof.
  for (let i=0;i<b.poly.length;i++) {
    const a=b.poly[i], c=b.poly[(i+1)%b.poly.length]
    const dx=c[0]-a[0], dz=c[1]-a[1], len=Math.hypot(dx,dz)
    const geo=new THREE.BoxGeometry(len,.18,.22);geo.rotateY(-Math.atan2(dz,dx));geo.translate((a[0]+c[0])/2,b.h+.12,(a[1]+c[1])/2)
    out.push({geo,mat:trim})
  }
  const vent=new THREE.CylinderGeometry(.23,.32,.65,8);vent.translate(-187,4.12,99.3);out.push({geo:vent,mat:metal})
  for(const [x,z] of [[-189.9,97],[-184.4,102.3]]){const v=new THREE.CylinderGeometry(.09,.09,.22,8);v.translate(x,3.92,z);out.push({geo:v,mat:dark})}
  // Rotate the wall details and patio together one face clockwise.
  const detailsStart = out.length
  // Service door and utility panels on the opposite wall.
  box(.1,2.35,1.3,-191.67,1.18,100.2,metal)
  box(.13,2.05,1.05,-191.75,1.18,100.2,dark)
  box(.16,1.85,.9,-191.82,1.19,100.2,metal)
  box(.15,.55,.65,-191.72,2.75,98.2,trim)
  // The owl mural follows the actual south wall, including its slight angle.
  const c=document.createElement('canvas');c.width=1024;c.height=512
  const g=c.getContext('2d')!;g.clearRect(0,0,1024,512)
  const poly=(points:number[][],color:string) => {g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()}
  // Angular, layered owl head and radiating geometric shards from the mural.
  const black='#1b1d1c', white='#eae9e2', grey='#a7aaa6', gold='#f8c500'
  for(const [x,y,flip] of [[45,110,1],[110,205,-1],[65,330,1],[210,135,-1],[185,345,1],[930,110,-1],[865,205,1],[940,330,-1],[815,135,1],[840,345,-1]]) {
    poly([[x,y],[x+flip*75,y+20],[x+flip*20,y+65]],white)
    poly([[x,y+83],[x+flip*62,y+94],[x+flip*15,y+122]],gold)
    poly([[x,y+47],[x+flip*44,y+50],[x+flip*12,y+78]],grey)
  }
  poly([[300,42],[375,92],[512,66],[648,92],[724,42],[697,189],[708,329],[641,401],[512,455],[382,401],[315,329],[326,189]],black)
  poly([[305,46],[404,131],[344,167]],white);poly([[719,46],[620,131],[680,167]],white)
  poly([[383,111],[512,75],[641,111],[598,147],[512,123],[426,147]],grey)
  poly([[348,171],[438,157],[512,197],[586,157],[676,171],[611,220],[553,224],[512,194],[471,224],[413,220]],white)
  poly([[357,184],[440,180],[494,213],[448,260],[404,250]],gold)
  poly([[667,184],[584,180],[530,213],[576,260],[620,250]],gold)
  poly([[389,195],[442,192],[468,214],[445,244],[410,236]],black)
  poly([[635,195],[582,192],[556,214],[579,244],[614,236]],black)
  // Bright irises and downward brows give the face the owl's distinctive stare.
  for (const x of [426,598]) {
    g.fillStyle=gold;g.beginPath();g.ellipse(x,216,17,20,0,0,Math.PI*2);g.fill()
    g.fillStyle=black;g.beginPath();g.ellipse(x,216,7,15,0,0,Math.PI*2);g.fill()
    g.fillStyle=white;g.beginPath();g.arc(x-4,210,3,0,Math.PI*2);g.fill()
  }
  poly([[340,154],[425,153],[510,192],[492,209],[425,178],[355,181]],black)
  poly([[684,154],[599,153],[514,192],[532,209],[599,178],[669,181]],black)
  poly([[336,224],[385,262],[448,274],[487,256],[465,334],[391,351],[342,309]],white)
  poly([[688,224],[639,262],[576,274],[537,256],[559,334],[633,351],[682,309]],white)
  poly([[474,259],[512,281],[550,259],[532,336],[512,358],[492,336]],gold)
  poly([[354,328],[410,354],[471,340],[512,377],[553,340],[614,354],[670,328],[632,391],[512,432],[392,391]],grey)
  poly([[410,355],[471,345],[512,379],[553,345],[614,355],[598,385],[512,412],[426,385]],black)
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace
  const mural=new THREE.PlaneGeometry(7.7,3.15)
  const left=b.poly[3], right=b.poly[2]
  mural.rotateY(-Math.atan2(right[1]-left[1],right[0]-left[0]))
  mural.translate((left[0]+right[0])/2,2.02,(left[1]+right[1])/2+.025)
  out.push({geo:mural,mat:new THREE.MeshStandardMaterial({map:tex,transparent:true,side:THREE.DoubleSide,roughness:.95})})
  // Patio and two dark umbrellas beside the north end, clear of the doorway.
  box(10.8,.08,5.2,-187,.04,92.9,pavement)
  for(const x of [-189.2,-185]) {
    const z=92.8
    const table=new THREE.CylinderGeometry(.72,.72,.1,16);table.translate(x,.76,z);out.push({geo:table,mat:dark})
    const pole=new THREE.CylinderGeometry(.045,.045,2.7,8);pole.translate(x,1.35,z);out.push({geo:pole,mat:metal})
    const shade=new THREE.ConeGeometry(1.45,.45,8,1,true);shade.translate(x,2.68,z);out.push({geo:shade,mat:canopy})
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4, rib=new THREE.BoxGeometry(.035,.035,1.45)
      rib.rotateX(-.15);rib.translate(0,2.62,.7);rib.rotateY(angle);rib.translate(x,0,z);out.push({geo:rib,mat:trim})
    }
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      box(.5,.08,.5,x+dx,.43,z+dz,dark);box(.07,.43,.07,x+dx,.21,z+dz,metal)
    }
  }
  for (let i=detailsStart;i<out.length;i++) {
    if(i===detailsStart+4) continue // mural is already aligned to the wall
    const geo=out[i].geo
    geo.translate(187.1,0,-99.7)
    geo.rotateY(-Math.PI/2)
    geo.translate(-187.1,0,99.7)
    // Account for the slightly rectangular footprint when moving between walls.
    if(i<detailsStart+4) geo.translate(0,0,.5)
  }
  return out
}

/** Lawrence V. Johnson Atrium Building: brick towers, entry, and side stairs. */
function atriumDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.82,side:THREE.DoubleSide})
  const stone=mat('#e2d6c3'),dark=mat('#304744'),concrete=mat('#c9c5b8'),gold=mat('#edc32c'),railMat=mat('#c8cec7')
  const brick=new THREE.MeshStandardMaterial({map:facade('atriumbrick'),roughness:.9,side:THREE.DoubleSide})
  const solidBrick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.9,side:THREE.DoubleSide})
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);out.push({geo:g,mat:m})}
  // The two square towers stand taller than the main body; their tops are open frames.
  for(const z of [50.5,77.4]){
    box(8,3.1,9,-133.2,9.85,z,brick)
    for(const x of [-137,-129.5])for(const dz of [-4.1,4.1])box(.65,3.4,.65,x,13.1,z+dz,solidBrick)
    for(const y of [11.55,14.65]){
      box(8,.34,.55,-133.2,y,z-4.1,stone);box(8,.34,.55,-133.2,y,z+4.1,stone)
      box(.55,.34,8.6,-137,y,z,stone);box(.55,.34,8.6,-129.5,y,z,stone)
    }
  }
  // A separate square brick pavilion stands in front of the glazed entrance.
  box(4.5,3.8,1.45,-139.5,1.9,60.8,solidBrick);box(4.5,3.8,1.45,-139.5,1.9,68.2,solidBrick)
  box(4.6,1.6,8.9,-139.5,4.55,64.5,solidBrick)
  box(4.8,.2,9.2,-139.5,5.35,64.5,stone)
  box(.18,3.1,5.9,-133.5,1.55,64.5,dark)
  for(const z of [61.6,63.05,64.5,65.95,67.4])box(.2,3.1,.09,-133.64,1.55,z,stone)
  box(.24,.12,5.9,-133.64,3.08,64.5,stone)
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#a46d59';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#f1e9da';ctx.font='bold 75px sans-serif';ctx.textAlign='center';ctx.fillText('ATRIUM BUILDING',512,100);ctx.fillStyle='#f4c629';ctx.fillRect(420,132,184,82);ctx.fillStyle='#222b27';ctx.font='bold 67px sans-serif';ctx.fillText('680',512,195)
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
  const sign=new THREE.PlaneGeometry(6,1.5);sign.rotateY(-Math.PI/2);sign.translate(-141.83,4.6,64.5)
  out.push({geo:sign,mat:new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide})})
  // Matching rear towers and a smaller open square feature at the roof center.
  for(const z of [50.5,77.4]){
    box(8,3.1,9,-102.8,9.85,z,brick)
    for(const x of [-106.6,-99])for(const dz of [-4.1,4.1])box(.65,3.4,.65,x,13.1,z+dz,solidBrick)
    for(const y of [11.55,14.65]){
      box(8,.34,.55,-102.8,y,z-4.1,stone);box(8,.34,.55,-102.8,y,z+4.1,stone)
      box(.55,.34,8.6,-106.6,y,z,stone);box(.55,.34,8.6,-99,y,z,stone)
    }
  }
  for(const x of [-119.8,-113.2])for(const z of [61.2,67.8])box(.48,2.7,.48,x,12.75,z,solidBrick)
  for(const z of [61.2,67.8])box(7,.3,.45,-116.5,14.05,z,stone)
  for(const x of [-119.8,-113.2])box(.45,.3,7,x,14.05,64.5,stone)
  // Rear glass doors and a second detached, open-sided brick entrance pavilion.
  box(.18,3.1,5.9,-102.3,1.55,64.5,dark)
  for(const z of [61.6,63.05,64.5,65.95,67.4])box(.2,3.1,.09,-102.16,1.55,z,stone)
  box(.24,.12,5.9,-102.16,3.08,64.5,stone)
  box(4.5,3.8,1.45,-95,1.9,60.8,solidBrick);box(4.5,3.8,1.45,-95,1.9,68.2,solidBrick)
  box(4.6,1.6,8.9,-95,4.55,64.5,solidBrick);box(4.8,.2,9.2,-95,5.35,64.5,stone)
  const rearSign=new THREE.PlaneGeometry(6,1.5);rearSign.rotateY(Math.PI/2);rearSign.translate(-92.67,4.6,64.5)
  out.push({geo:rearSign,mat:new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide})})
  // Low brick planters with small trees sit on either side of the entry.
  const soil=new THREE.MeshStandardMaterial({color:'#72594b',roughness:1})
  const bark=new THREE.MeshStandardMaterial({color:'#6c5140',roughness:.9})
  const foliage=new THREE.MeshStandardMaterial({color:'#63894e',roughness:.9,flatShading:true})
  for(const z of [48.5,80.5]){
    box(3,.24,12,-140.8,.12,z,solidBrick)
    box(2.7,.09,11.7,-140.8,.27,z,soil)
    for(const dz of [-4,0,4]){
      const trunk=new THREE.CylinderGeometry(.11,.16,1.8,7);trunk.translate(-140.8,1.2,z+dz);out.push({geo:trunk,mat:bark})
      const crown=new THREE.IcosahedronGeometry(1.25,1);crown.scale(1,.75,1);crown.translate(-140.8,2.15,z+dz);out.push({geo:crown,mat:foliage})
    }
  }
  // Concrete tree planters on the rear plaza, set away from the pavilion.
  for(const z of [48.5,80.5]){
    box(3,.28,12,-94.2,.14,z,concrete);box(2.7,.08,11.7,-94.2,.32,z,soil)
    for(const dz of [-4,0,4]){
      const trunk=new THREE.CylinderGeometry(.11,.16,1.8,7);trunk.translate(-94.2,1.25,z+dz);out.push({geo:trunk,mat:bark})
      const crown=new THREE.IcosahedronGeometry(1.25,1);crown.scale(1,.75,1);crown.translate(-94.2,2.2,z+dz);out.push({geo:crown,mat:foliage})
    }
  }
  // Four small tables beside the rear planters, two on each side.
  for(const z of [46.5,50.5,78.5,82.5]){
    const x=-89.4
    const top=new THREE.CylinderGeometry(.65,.65,.1,16);top.translate(x,.75,z);out.push({geo:top,mat:stone})
    const stem=new THREE.CylinderGeometry(.07,.07,.75,8);stem.translate(x,.38,z);out.push({geo:stem,mat:railMat})
    for(const dz of [-1.1,1.1]){
      box(.55,.1,.55,x,.43,z+dz,dark);box(.08,.4,.08,x,.2,z+dz,railMat)
    }
  }
  // Tables are outside the planters and clear of the doorway and tree crowns.
  for(const z of [57,72]){
    const x=-143.4
    const top=new THREE.CylinderGeometry(.8,.8,.1,16);top.translate(x,.75,z);out.push({geo:top,mat:stone})
    const stem=new THREE.CylinderGeometry(.07,.07,.75,8);stem.translate(x,.38,z);out.push({geo:stem,mat:railMat})
    const pole=new THREE.CylinderGeometry(.04,.04,2.8,8);pole.translate(x,1.4,z);out.push({geo:pole,mat:railMat})
    const umbrella=new THREE.ConeGeometry(1.5,.45,12,1,true);umbrella.translate(x,2.75,z);out.push({geo:umbrella,mat:gold})
  }
  // Long stair between the Atrium and Academic Building, with level landings.
  for(let flight=0;flight<2;flight++){
    for(let step=0;step<8;step++){
      const h=(flight*8+step+1)*.15,z=8+flight*9.5+step*.9
      box(4.2,h,.92,-134.7,h/2,z,concrete)
    }
    const h=(flight+1)*1.2;box(4.2,h,2.4,-134.7,h/2,15.8+flight*9.5,concrete)
  }
  const bar=(a:THREE.Vector3,c:THREE.Vector3)=>{const v=c.clone().sub(a),g=new THREE.CylinderGeometry(.045,.045,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a.x+c.x)/2,(a.y+c.y)/2,(a.z+c.z)/2);out.push({geo:g,mat:railMat})}
  for(const x of [-136.9,-132.5]){
    bar(new THREE.Vector3(x,.85,7.6),new THREE.Vector3(x,2.05,15.3));bar(new THREE.Vector3(x,2.05,15.3),new THREE.Vector3(x,2.05,17));bar(new THREE.Vector3(x,2.05,17),new THREE.Vector3(x,3.25,24.7))
    for(const [z,y] of [[8,0],[15.5,1.2],[17,1.2],[25,2.4]])bar(new THREE.Vector3(x,y,z),new THREE.Vector3(x,y+.85,z))
  }
  void b
  return out
}

/** Academic Building entrance: brick facade, glazed doors and a light truss canopy. */
function academicDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const material=(color:string,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide})
  const stone=material('#d9dbd1'),glass=material('#506a66',.32),metal=material('#d8ddd5',.45),soil=material('#826c59'),plant=material('#789354')
  const brick=new THREE.MeshStandardMaterial({map:facade('librarybrick'),roughness:.9,side:THREE.DoubleSide})
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.MeshStandardMaterial)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);out.push({geo:g,mat:m})}
  const bar=(a:THREE.Vector3,c:THREE.Vector3)=>{const v=c.clone().sub(a),g=new THREE.CylinderGeometry(.065,.065,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a.x+c.x)/2,(a.y+c.y)/2,(a.z+c.z)/2);out.push({geo:g,mat:metal})}
  // Build the entrance in local coordinates, then place it on the front-facing west facade.
  const frontX=-140.12,doorZ=-26.5
  const doorPartStart=out.length
  box(.16,3.2,6.7,frontX,1.6,doorZ,glass)
  for(const dz of [-3.35,-2.25,-1.12,0,1.12,2.25,3.35])box(.24,3.25,.09,frontX+.16,1.62,doorZ+dz,stone)
  for(const y of [.12,2.3,3.25])box(.24,.09,6.8,frontX+.16,y,doorZ,stone)
  const doorPartEnd=out.length
  // Open aluminum canopy: top beams and triangular bracing, without glass panels.
  for(const x of [-140.1,-137.5,-134.9]){
    bar(new THREE.Vector3(x,4.45,doorZ-3.6),new THREE.Vector3(x,4.45,doorZ+3.6))
    bar(new THREE.Vector3(x,3.8,doorZ-3.6),new THREE.Vector3(x,3.8,doorZ+3.6))
    for(let i=0;i<4;i++){
      const z=doorZ-3.6+i*1.8
      bar(new THREE.Vector3(x,i%2?4.45:3.8,z),new THREE.Vector3(x,i%2?3.8:4.45,z+1.8))
    }
  }
  for(const dz of [-3.6,-1.8,0,1.8,3.6])bar(new THREE.Vector3(-140.1,4.45,doorZ+dz),new THREE.Vector3(-134.9,4.45,doorZ+dz))
  for(const dz of [-3.6,3.6])bar(new THREE.Vector3(-134.9,.05,doorZ+dz),new THREE.Vector3(-134.9,4.45,doorZ+dz))
  // Lettering sits on the visible outside of the same facade, beside the canopy.
  box(.18,1.4,9.2,frontX+.08,5.35,doorZ-8.9,brick)
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=192
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#9a5d49';ctx.fillRect(0,0,1536,192);ctx.fillStyle='#f2c629';ctx.fillRect(30,30,210,130);ctx.fillStyle='#212a24';ctx.font='bold 115px sans-serif';ctx.textAlign='center';ctx.fillText('830',135,136);ctx.fillStyle='#f3f0e8';ctx.textAlign='left';ctx.font='bold 94px sans-serif';ctx.fillText('ACADEMIC BUILDING',280,130)
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
  const sign=new THREE.PlaneGeometry(9,1.32);sign.rotateY(Math.PI/2);sign.translate(frontX+.2,5.35,doorZ-8.9)
  out.push({geo:sign,mat:new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide})})
  const sub=document.createElement('canvas');sub.width=768;sub.height=256
  const sc=sub.getContext('2d')!;sc.fillStyle='#9a5d49';sc.fillRect(0,0,768,256);sc.fillStyle='#eee6d7';sc.textAlign='center';sc.font='bold 62px sans-serif';sc.fillText('BURRUSS AUDITORIUM',384,110);sc.fillText('COMPLEX',384,185)
  const st=new THREE.CanvasTexture(sub);st.colorSpace=THREE.SRGBColorSpace
  const label=new THREE.PlaneGeometry(4.2,1.4);label.rotateY(Math.PI/2);label.translate(frontX+.2,2.8,doorZ-8.9)
  out.push({geo:label,mat:new THREE.MeshStandardMaterial({map:st,side:THREE.DoubleSide})})
  // Compact planted beds sit beside, not beneath, the entrance approach.
  for(const z of [doorZ-7,doorZ+7]){
    box(2.5,.08,3,-135.8,.06,z,soil)
    for(const dx of [-.6,.6])for(const dz of [-.7,.7]){const g=new THREE.IcosahedronGeometry(.3,1);g.scale(1,.6,1);g.translate(-135.8+dx,.25,z+dz);out.push({geo:g,mat:plant})}
  }
  // Reflect the full entrance to the opposite face of the building. Flip the
  // lettering UVs as well so it reads normally when viewed from the front.
  for(const textPlane of [sign,label]){
    const uv=textPlane.getAttribute('uv')
    for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i))
  }
  for(const [partIndex,part] of out.entries()){
    part.geo.scale(-1,1,1);part.geo.translate(-304.8,0,0)
    // The front facade angles gently; follow it so the entrance and signs
    // sit against the wall instead of floating out in front of it.
    const pos=part.geo.getAttribute('position')
    for(let i=0;i<pos.count;i++)pos.setX(i,pos.getX(i)-1.25-.04623*(pos.getZ(i)+26.5)+(partIndex>=doorPartStart&&partIndex<doorPartEnd?2.5:0))
    pos.needsUpdate=true;part.geo.computeVertexNormals()
  }
  // Back wall: mostly brick, with small separated vertical groups of windows.
  const backWall=new THREE.BoxGeometry(.16,11.4,47.6);backWall.translate(-140.1,5.7,2.2);out.push({geo:backWall,mat:brick})
  for(const z of [-14,0,14,21])for(const y of [1.7,5.5,9.3]){
    box(.18,1.4,1.25,-139.98,y,z,glass)
    box(.22,1.45,.07,-139.86,y,z,stone)
  }
  // Continue the sparse-window brick design around the shorter angled end.
  for(let i=5;i<=13;i++){
    const a=b.poly[i],c=b.poly[i+1],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<3)continue
    const angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0])
    const wall=wallsGeometry({...b,poly:[a,c]},0,7.6)
    wall.translate(Math.sin(angle)*.1,0,Math.cos(angle)*.1);out.push({geo:wall,mat:brick})
    if(i===10)continue // leave the UITS door and its sign clear
    for(const y of [1.8,5.5]){
      const panel=new THREE.BoxGeometry(Math.min(1.1,len*.35),1.35,.13)
      panel.rotateY(angle);panel.translate((a[0]+c[0])/2+Math.sin(angle)*.2,y,(a[1]+c[1])/2+Math.cos(angle)*.2);out.push({geo:panel,mat:glass})
    }
  }
  // A continuous upper facade projects over the walkway along the front.
  // Each section follows the mapped wall and reaches its own roof height.
  const frontWallX=(z:number)=>z<=-1.78?-164.58-.04623*(z+1.78):-164.58-.0203*(z+1.78)
  for(const [z0,z1,top] of [[-44.5,-22,7.6],[-22,-1.78,11.4],[-1.78,21.5,11.4]]){
    const middle=(z0+z1)/2,dx=frontWallX(z1)-frontWallX(z0),angle=Math.atan2(dx,z1-z0),length=Math.hypot(dx,z1-z0)
    const upper=new THREE.BoxGeometry(2.5,top-3.6,length);upper.rotateY(angle);upper.translate(frontWallX(middle)-1.25,(top+3.6)/2,middle);out.push({geo:upper,mat:brick})
    const fascia=new THREE.BoxGeometry(2.6,.16,length);fascia.rotateY(angle);fascia.translate(frontWallX(middle)-1.25,3.62,middle);out.push({geo:fascia,mat:stone})
    if(top>8){
      // Two long glazed bands continue across the high part of the projection.
      for(const y of [5.5,9.3]){
        const band=new THREE.BoxGeometry(.12,.72,length-.2);band.rotateY(angle);band.translate(frontWallX(middle)-2.53,y,middle);out.push({geo:band,mat:glass})
        for(let z=z0+1;z<z1;z+=2.4)box(.16,.78,.08,frontWallX(z)-2.61,y,z,stone)
      }
    }
  }
  // Posts are under the outer edge, leaving the doorway and name panel clear.
  for(const z of [-44,-41,-20,-11,-2,7,16,21])box(.4,3.6,.4,frontWallX(z)-2.3,1.8,z,stone)
  // A short paved approach connects to the small door around the rear corner.
  box(7,.1,3,-131.9,.07,-49.5,stone)
  box(3,.1,9,-128.9,.07,-53.5,stone)
  box(.18,2.75,2.2,-135.15,1.38,-49.5,glass)
  for(const dz of [-1.1,0,1.1])box(.22,2.8,.08,-135.03,1.4,-49.5+dz,stone)
  box(.22,.1,2.3,-135.03,2.8,-49.5,stone)
  const uits=document.createElement('canvas');uits.width=512;uits.height=160
  const uc=uits.getContext('2d')!;uc.fillStyle='#9a5d49';uc.fillRect(0,0,512,160);uc.fillStyle='#f5f1e8';uc.textAlign='center';uc.font='bold 112px sans-serif';uc.fillText('UITS',256,122)
  const ut=new THREE.CanvasTexture(uits);ut.colorSpace=THREE.SRGBColorSpace
  const us=new THREE.PlaneGeometry(2.4,.75);us.rotateY(Math.PI/2);us.translate(-134.98,3.35,-49.5)
  out.push({geo:us,mat:new THREE.MeshStandardMaterial({map:ut,side:THREE.DoubleSide})})
  return out
}

/** Campus-side West Deck: rooftop parking above one partly visible level. */
function westDeckDetails(b:Building){
  const out:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
  const curb=new THREE.MeshStandardMaterial({color:'#c8beb1',roughness:.9,side:THREE.DoubleSide})
  const line=new THREE.MeshStandardMaterial({color:'#eeeae0',roughness:.95})
  // Low perimeter parapet, with actual geometry rather than repeated floor textures.
  out.push({geo:wallsGeometry(b,b.h,b.h+.65),mat:curb})
  // Parking bay markings on the accessible top deck; omit markings outside its footprint.
  const marks:THREE.BufferGeometry[]=[]
  for(const z of [23,34,48,60])for(let x=-401;x<=-312;x+=3.2){
    if(!pointInPoly(x,z-2,b.poly)||!pointInPoly(x,z+2,b.poly))continue
    const g=new THREE.BoxGeometry(.09,.025,4);g.translate(x,b.h+.055,z);marks.push(g)
  }
  if(marks.length)out.push({geo:mergeGeometries(marks),mat:line})
  // The low center divider echoes the sunken internal aisle visible from above.
  const divider=new THREE.BoxGeometry(51,.6,.28);divider.translate(-356,b.h+.3,42);out.push({geo:divider,mat:curb})
  // Yellow campus building-number marker on the south elevation.
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f1c629';ctx.fillRect(0,0,256,128);ctx.fillStyle='#273027';ctx.textAlign='center';ctx.font='bold 86px sans-serif';ctx.fillText('810',128,94)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  const [a,c]=[b.poly[3],b.poly[2]],angle=Math.atan2(-(c[1]-a[1]),c[0]-a[0])
  const sign=new THREE.PlaneGeometry(2.4,1.2);sign.rotateY(angle+Math.PI);sign.translate((a[0]+c[0])/2-Math.sin(angle)*.2,2.5,(a[1]+c[1])/2-Math.cos(angle)*.2)
  out.push({geo:sign,mat:new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide})})
  return out
}

function Buildings({ campus }: { campus: Campus }) {
  useEffect(() => () => { occluders.meshes.length = 0 }, [])
  const items = useMemo(() => {
    const wallMat = new Map<string, THREE.MeshStandardMaterial>()
    const getWall = (style: string) => {
      if (!wallMat.has(style)) wallMat.set(style, new THREE.MeshStandardMaterial({ map: facade(style), roughness: 0.85, side: THREE.DoubleSide }))
      return wallMat.get(style)!.clone() // per building so it can fade on its own
    }
    const roofTex = roofTexture()
    return campus.buildings.map((b) => {
      // The curved rear wing is a separate mapped building: give its actual outer
      // walls the glass treatment instead of covering only the wall behind it.
      if (b.code === 'P60') {
        // Keep the top surface and Props' rooftop cars at the same campus-side height.
        b.h=3.2;b.levels=1
        const roof=new THREE.MeshStandardMaterial({color:'#bdbbb4',roughness:.95,side:THREE.DoubleSide})
        return { b, parts: [{geo:wallsGeometry(b),mat:getWall('westdeck')},{geo:flatGeometry(b.poly,b.h+.02),mat:roof},...westDeckDetails(b)], flat: true }
      }
      if (b.id === '589314485') {
        const base = new THREE.MeshStandardMaterial({ color: '#a67762', roughness: .9, side: THREE.DoubleSide })
        const glazing = new THREE.MeshStandardMaterial({ map: facade('mathglass'), color: '#adc4bb', roughness: .25, metalness: .15, side: THREE.DoubleSide })
        const trim = new THREE.MeshStandardMaterial({ color: '#e4e5de', roughness: .7, side: THREE.DoubleSide })
        return { b, parts: [
          { geo: wallsGeometry(b, 0, .65), mat: base },
          { geo: wallsGeometry(b, .65, b.h - .5), mat: glazing },
          { geo: wallsGeometry(b, b.h - .5, b.h), mat: trim },
          { geo: flatGeometry(b.poly, b.h + .02, 8), mat: new THREE.MeshStandardMaterial({ map: roofTex, roughness: .9, side: THREE.DoubleSide }) },
        ], flat: true }
      }
      if (b.id === '589139282') {
        const wall = new THREE.MeshStandardMaterial({ map: facade('plain'), roughness: .85, side: THREE.DoubleSide })
        const slab = new THREE.MeshStandardMaterial({ color: '#dadbd2', roughness: .85, side: THREE.DoubleSide })
        return { b, parts: [{geo:wallsGeometry(b,3.1,b.h),mat:wall},{geo:flatGeometry(b.poly,3.1,8),mat:slab},{geo:flatGeometry(b.poly,b.h+.02,8),mat:slab}], flat: true }
      }
      if (b.id === '1134398612') {
        const glazing = new THREE.MeshStandardMaterial({ map: facade('mathglass'), roughness: .35, side: THREE.DoubleSide })
        const roof = new THREE.MeshStandardMaterial({ map: roofTex, roughness: .9, side: THREE.DoubleSide })
        return { b, parts: [{geo:wallsGeometry(b),mat:glazing},{geo:flatGeometry(b.poly,b.h+.02,8),mat:roof},...scienceAnnexDetails()], flat: true }
      }
      if (b.code === 'H') {
        // The southern wing is lower than the main block. Split the mapped
        // footprint at the transition so both roofs and walls have real heights.
        const clip=(poly:Pt[],low:boolean):Pt[]=>{
          const result:Pt[]=[];const cut=-22
          for(let i=0;i<poly.length;i++){
            const a=poly[i],c=poly[(i+1)%poly.length],aIn=low?a[1]<=cut:a[1]>=cut,cIn=low?c[1]<=cut:c[1]>=cut
            if(aIn)result.push(a)
            if(aIn!==cIn){const t=(cut-a[1])/(c[1]-a[1]);result.push([a[0]+(c[0]-a[0])*t,cut])}
          }
          return result
        }
        const lower=clip(b.poly,true),upper=clip(b.poly,false)
        const highBuilding={...b,poly:upper,h:11.4},lowBuilding={...b,poly:lower,h:7.6}
        const roof=new THREE.MeshStandardMaterial({map:roofTex,roughness:.95,side:THREE.DoubleSide})
        return { b, parts: [
          {geo:wallsGeometry(highBuilding),mat:getWall('academicbrick')},{geo:flatGeometry(upper,11.42,8),mat:roof},
          {geo:wallsGeometry(lowBuilding),mat:getWall('librarybrick')},{geo:flatGeometry(lower,7.62,8),mat:roof},
          ...academicDetails(b),
        ], flat: true }
      }
      if (b.id === '1556621556') return { b, parts: innovationCenterParts(b), flat: true }
      if (b.code === 'S1') return { b, parts: recreationParts(b), flat: true }
      if (b.code === 'B') return { b, parts: administrationParts(b), flat: true }
      if (b.code === 'R1' || b.code === 'R2') return { b, parts: residenceHallParts(b), flat: true }
      if (b.code === 'T') return { b, parts: wilderParts(b), flat: true }
      if (b.code === 'L' || b.code === 'L1' || b.code === 'O') return { b, parts: civilBuildingsParts(b), flat: true }
      if (b.code === 'S2') return { b, parts: gymnasiumParts(b), flat: true }
      if (b.code === 'N') return { b, parts: architectureParts(b), flat: true }
      if (b.code === 'M') return { b, parts: textileCenterParts(b), flat: true }
      if (b.id === '517434198') return { b, parts: pumpHouseParts(b), flat: true }
      if (b.id === '1504299650') {
        b.name = 'Hornet Hub'; b.short = 'Hornet Hub'; b.h = 5
        return { b, parts: hornetHubParts(b), flat: false }
      }
      if (b.kind === 'greenhouse' && b.poly.length === 4) {
        b.h = 4.55
        return { b, parts: greenhouseParts(b), flat: false }
      }
      const look = lookFor(b.code, b.name, b.kind)
      if (look.floors) {
        b.levels = look.floors
        b.h = look.floors * FLOOR
      }
      const parts: { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[] = []
      const split = (look.base || b.code === 'A') && b.code !== 'X' && b.h > FLOOR * 1.5 ? FLOOR : 0
      if (split) parts.push({ geo: wallsGeometry(b, 0, split), mat: getWall(look.base ?? 'redbrick') })
      parts.push({ geo: wallsGeometry(b, split, b.h), mat: getWall(b.code === 'A' ? 'studentmetal' : b.code === 'X' ? 'redbrick' : look.wall) })
      if (look.roof === 'hip') {
        parts.push({ geo: hipRoofGeometry(b, 4.2), mat: new THREE.MeshStandardMaterial({ color: look.roofColor ?? '#6b6966', roughness: 0.9, flatShading: true, side: THREE.DoubleSide }) })
      } else {
        const m = new THREE.MeshStandardMaterial({ map: roofTex, color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide })
        parts.push({ geo: flatGeometry(b.poly, b.h + 0.02, 8), mat: m })
      }
      if (b.code === 'A') parts.push(...studentCenterDetails())
      if (b.code === 'X') parts.push(...stingersDetails(b))
      if (b.code === 'D') parts.push(...mathematicsScreen(b))
      if (b.code === 'C') parts.push(...libraryDetails(b))
      if (b.code === 'E') parts.push(...crawfordDetails(b))
      if (b.code === 'G') parts.push(...engineeringLabDetails(b))
      if (b.code === 'J') parts.push(...atriumDetails(b))
      if (b.code === 'I1') parts.push(...matchingLabElevation(b))
      if (b.code === 'I2') parts.push(...designTwoDetails(b))
      if (b.code === 'Q') parts.push(...engineeringCenterDetails(b))
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
        if (a.name === 'Practice Green') add('practicegrass', flatGeometry(a.poly, 0.055))
        else if (a.name === 'S. Walter Kelly Sr. Memorial Field') {
          add('fieldgrass',flatGeometry(a.poly,0.055))
          // Align the diamond with the field's centerline, with a V-shaped grass interior.
          const pt=(u:number,v:number):Pt=>[-9+u*.966+v*.259,328-u*.259+v*.966]
          const clay:Pt[]=[]
          for(let i=0;i<=40;i++){const t=Math.PI*.11+i*Math.PI*.78/40;clay.push(pt(33*Math.cos(t),20+33*Math.sin(t)))}
          clay.push(pt(-21,20),pt(0,41),pt(21,20))
          add('diamond',flatGeometry(clay,.065))
          const disk=(u:number,v:number,r:number)=>{const p:Pt[]=[];for(let i=0;i<32;i++){const t=i*Math.PI/16;p.push(pt(u+r*Math.cos(t),v+r*Math.sin(t)))}return p}
          add('diamond',flatGeometry(disk(0,22,2.7),.068))
          add('diamond',flatGeometry(disk(0,1,3.2),.068))
          for(const [u,v] of [[-19,20],[0,39],[19,20],[0,1]]) {
            add('base',flatGeometry([pt(u-.55,v),pt(u,v-.55),pt(u+.55,v),pt(u,v+.55)],.075))
          }
        } else add(sport === 'baseball' || sport === 'softball' ? 'diamond' : 'pitch', flatGeometry(a.poly, 0.055))
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
      track: mat(AREA_STYLE.track.color), pitch: mat('#7fb85a'), fieldgrass: mat('#a8b777'), practicegrass: mat('#9cc46e'), base: mat('#f2f0e8'), diamond: mat('#ca865c'), parking,
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
      for (const t of campus.trees) if (Math.hypot(t[0]+81.5,t[1]+75)>8.5 && !campus.areas.some((a) => a.name === 'S. Walter Kelly Sr. Memorial Field' && pointInPoly(t[0], t[1], a.poly)) && (rnd() < 0.12 || ((t[2] ?? 1) > 1.32 && rnd() < 0.22))) spots.push([t[0], t[1], (t[2] ?? 1) * 1.25])
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

/** Small terraced amphitheater between the library and Norton Hall. */
function LibraryAmphitheater() {
  const group=useMemo(()=>{
    const root=new THREE.Group(),cx=-81.5,cz=-75
    const brick=new THREE.MeshStandardMaterial({map:facade('textilebrick'),roughness:.95,side:THREE.DoubleSide})
    const concrete=new THREE.MeshStandardMaterial({color:'#c8c6bb',roughness:.95,side:THREE.DoubleSide})
    const rail=new THREE.MeshStandardMaterial({color:'#cbd1c8',roughness:.65,metalness:.2})
    const add=(geometry:THREE.BufferGeometry,material:THREE.Material)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh)}
    const disc=new THREE.CylinderGeometry(4.4,4.4,.25,48);disc.translate(cx,.125,cz);add(disc,concrete)
    // Three semicircular brick risers with broad concrete seating surfaces.
    const ring=(inner:number,outer:number,height:number,material:THREE.Material)=>{
      const shape=new THREE.Shape()
      for(let i=0;i<=48;i++){const t=Math.PI*i/48,x=outer*Math.cos(t),y=outer*Math.sin(t);if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y)}
      for(let i=48;i>=0;i--){const t=Math.PI*i/48;shape.lineTo(inner*Math.cos(t),inner*Math.sin(t))}
      shape.closePath()
      const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:48})
      geo.rotateX(-Math.PI/2);geo.translate(cx,0,cz);add(geo,material)
    }
    for(const [inner,outer,height] of [[4.4,5.55,.35],[5.55,6.7,.66],[6.7,7.85,.97]]){
      ring(inner,outer,height,brick)
      // A thin cap leaves the brick riser visible below each tier.
      const shape=new THREE.Shape()
      for(let i=0;i<=48;i++){const t=Math.PI*i/48,x=outer*Math.cos(t),y=outer*Math.sin(t);if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y)}
      for(let i=48;i>=0;i--){const t=Math.PI*i/48;shape.lineTo(inner*Math.cos(t),inner*Math.sin(t))}
      shape.closePath();const cap=new THREE.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(cx,height+.012,cz);add(cap,concrete)
    }
    // Steel guardrail follows the outside curve of the upper row.
    const bar=(a:THREE.Vector3,b:THREE.Vector3,r=.035)=>{
      const v=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(r,r,v.length(),7)
      g.rotateZ(Math.PI/2)
      const m=new THREE.Mesh(g,rail);m.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),v.normalize());m.position.copy(a).add(b).multiplyScalar(.5);root.add(m)
    }
    const point=(t:number,y:number)=>new THREE.Vector3(cx+7.85*Math.cos(t),y,cz-7.85*Math.sin(t))
    for(let i=0;i<=16;i++){
      const t=Math.PI*i/16;bar(point(t,.97),point(t,2.05),.04)
      if(i<16)for(const y of [1.28,1.62,1.98])bar(point(t,y),point(t+Math.PI/16,y),.035)
    }
    return root
  },[])
  return <primitive object={group} />
}

/** Two dugouts and stepped spectator seating flanking the baseball diamond. */
function BaseballSeating() {
  const items=useMemo(()=>{
    const parts:{geo:THREE.BufferGeometry;mat:THREE.MeshStandardMaterial}[]=[]
    const steel=new THREE.MeshStandardMaterial({color:'#c7ceca',roughness:.75,side:THREE.DoubleSide})
    const dark=new THREE.MeshStandardMaterial({color:'#56625f',roughness:.9,side:THREE.DoubleSide})
    const wood=new THREE.MeshStandardMaterial({color:'#8c8c80',roughness:.9,side:THREE.DoubleSide})
    const theta=Math.atan2(.259,.966)
    const box=(w:number,h:number,d:number,u:number,y:number,v:number,angle:number,mat:THREE.MeshStandardMaterial)=>{
      const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(u,y,v);g.rotateY(theta);g.translate(-9,0,328);parts.push({geo:g,mat})
    }
    for(const side of [-1,1]) {
      const a=side*.7,u=side*24,v=13
      box(11,.22,3.5,u,2.65,v,a,steel)
      box(11,1.9,.18,u,1.04,v-1.5,a,dark)
      for(const du of [-4.9,4.9])box(.18,2.5,.18,u+du*Math.cos(a),1.25,v-du*Math.sin(a),a,steel)
      box(9,.15,.55,u,.6,v,a,wood)
      // Five low stepped rows face the diamond from behind home plate.
      for(let row=0;row<5;row++)box(13,.14,.7,side*9,.25+row*.28,-6-row*.7,side*.65,steel)
      for(const dx of [-5,5])box(.18,1.5,.18,side*9+dx,.75,-8,0,dark)
    }
    return parts
  },[])
  return <group>{items.map((item,i)=><mesh key={i} geometry={item.geo} material={item.mat} castShadow receiveShadow />)}</group>
}

export type GroundStyle = 'illustrated' | 'photo' | 'drawn'

export function CampusScene({ campus, ground = 'drawn' }: { campus: Campus; ground?: GroundStyle }) {
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
      <BaseballSeating />
      <LibraryAmphitheater />
      <Landmarks campus={campus} />
      <Props campus={campus} cars={ground !== 'photo'} roofUnits />
      <Buses campus={campus} />
      <Traffic campus={campus} />
      <Scrappy campus={campus} />
      <Trees campus={campus} />
    </group>
  )
}
