import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Collider, type Campus, type Pt } from '../campus'

// Shared position lets the HUD locate the mascot at the instant the menu is used.
export const scrappy = { x: -105, z: -197 }

function makeFace() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512
  const g = c.getContext('2d')!
  // White feathered cheek patches wrap around a dark owl mask.
  g.fillStyle = '#f0eee4'
  g.beginPath(); g.moveTo(60,155); g.quadraticCurveTo(24,350,256,455); g.quadraticCurveTo(488,350,452,155); g.lineTo(383,204); g.quadraticCurveTo(376,327,256,390); g.quadraticCurveTo(136,327,129,204); g.closePath(); g.fill()
  g.fillStyle = '#e7b619'
  for (const side of [-1,1]) {
    g.save(); g.translate(256,0); g.scale(side,1)
    g.beginPath(); g.moveTo(24,156); g.lineTo(205,84); g.quadraticCurveTo(169,158,79,185); g.closePath(); g.fill()
    // eyes sit inside the black mask rather than on round white eyeballs
    g.fillStyle = '#d6ad48'; g.beginPath(); g.ellipse(80,205,20,13,-0.25,0,Math.PI*2); g.fill()
    g.fillStyle = '#121313'; g.beginPath(); g.ellipse(80,205,9,11,0,0,Math.PI*2); g.fill()
    g.fillStyle = '#e7b619'; g.restore()
  }
  g.fillStyle = '#eab816'; g.beginPath(); g.moveTo(256,195); g.bezierCurveTo(182,202,186,276,256,289); g.bezierCurveTo(326,276,330,202,256,195); g.fill()
  g.fillStyle = '#292723'; g.beginPath(); g.moveTo(205,276); g.quadraticCurveTo(256,309,307,276); g.quadraticCurveTo(288,344,256,348); g.quadraticCurveTo(224,344,205,276); g.fill()
  g.fillStyle = '#f2c52b'; g.beginPath(); g.moveTo(222,300); g.quadraticCurveTo(256,320,290,300); g.lineTo(256,329); g.closePath(); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function makeShirt() {
  const c=document.createElement('canvas'); c.width=512; c.height=240
  const g=c.getContext('2d')!; g.fillStyle='#151515'; g.fillRect(20,25,472,180)
  g.strokeStyle='#f4efe0'; g.lineWidth=10; g.strokeRect(20,25,472,180)
  g.fillStyle='#f4c326'; g.textAlign='center'; g.font='bold 76px sans-serif'; g.fillText('KENNESAW',256,107)
  g.fillStyle='#fff'; g.font='bold 50px sans-serif'; g.fillText('STATE UNIVERSITY',256,176)
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t
}

function makeShortsLogo() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const g = c.getContext('2d')!
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 92px serif'
  g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 16; g.strokeText('KS',128,115)
  g.strokeStyle = '#111'; g.lineWidth = 9; g.strokeText('KS',128,115)
  g.fillStyle = '#e5b31b'; g.fillText('KS',128,115)
  g.font = 'bold 50px sans-serif'; g.fillStyle = '#111'; g.fillText('U',128,197)
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Build a walkable network from mapped paths. Connecting nearby endpoints allows
// the mascot to choose distant destinations without walking through buildings.
export function makePathNetwork(campus: Campus, collider: Collider) {
  const nodes: Pt[] = [], edges: number[][] = []
  const clear = (a: Pt, b: Pt) => {
    const n = Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / 1.5)
    for (let i=0; i<=n; i++) if (collider.blocked(a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n, 0.65)) return false
    return true
  }
  const connect = (a: number, b: number) => { if (a !== b && !edges[a].includes(b)) { edges[a].push(b); edges[b].push(a) } }
  for (const path of campus.paths) {
    let prev = -1
    for (const point of path.pts) {
      if (collider.blocked(point[0],point[1],0.65)) { prev = -1; continue }
      const index = nodes.length; nodes.push(point); edges.push([])
      if (prev >= 0 && clear(nodes[prev], point)) connect(prev,index)
      prev = index
    }
  }
  const cells = new Map<string,number[]>()
  const size = 4
  for (let i=0; i<nodes.length; i++) {
    const [x,z] = nodes[i], cx=Math.floor(x/size), cz=Math.floor(z/size)
    for (let dx=-1; dx<=1; dx++) for (let dz=-1; dz<=1; dz++) for (const j of cells.get(`${cx+dx},${cz+dz}`) ?? []) {
      if (Math.hypot(x-nodes[j][0],z-nodes[j][1]) < 3 && clear(nodes[j],nodes[i])) connect(i,j)
    }
    const key=`${cx},${cz}`; const cell=cells.get(key) ?? []; cell.push(i); cells.set(key,cell)
  }
  // Start on the largest connected component to avoid roaming in an isolated path.
  const seen = new Set<number>(); let largest: number[] = []
  for (let i=0; i<nodes.length; i++) if (!seen.has(i)) {
    const component=[i]; seen.add(i)
    for (let k=0; k<component.length; k++) for (const n of edges[component[k]]) if (!seen.has(n)) { seen.add(n); component.push(n) }
    if (component.length > largest.length) largest=component
  }
  return { nodes, edges, largest }
}

export function Scrappy({ campus }: { campus: Campus }) {
  const group = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const route = useRef<number[]>([])
  const current = useRef(-1)
  const face = useMemo(makeFace, [])
  const shirt = useMemo(makeShirt, [])
  const shortsLogo = useMemo(makeShortsLogo, [])
  const collider = useMemo(() => new Collider(campus.buildings), [campus])
  const network = useMemo(() => makePathNetwork(campus, collider), [campus, collider])
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05)
    if (!network.largest.length) return
    if (current.current < 0) {
      current.current = network.largest.reduce((best, i) => Math.hypot(network.nodes[i][0]-scrappy.x,network.nodes[i][1]-scrappy.z) < Math.hypot(network.nodes[best][0]-scrappy.x,network.nodes[best][1]-scrappy.z) ? i : best, network.largest[0])
      ;[scrappy.x,scrappy.z] = network.nodes[current.current]
    }
    if (!route.current.length) {
      // Select a distant random point in the connected campus path network.
      const start = current.current
      const far = network.largest.filter(i => Math.hypot(network.nodes[i][0]-scrappy.x,network.nodes[i][1]-scrappy.z) > 150)
      const choices = far.length ? far : network.largest
      const goal = choices[Math.floor(Math.random()*choices.length)]
      const queue = [start], parent = new Int32Array(network.nodes.length).fill(-1); parent[start]=start
      for (let q=0; q<queue.length && parent[goal] < 0; q++) for (const n of network.edges[queue[q]]) if (parent[n] < 0) { parent[n]=queue[q]; queue.push(n) }
      if (parent[goal] >= 0) { let n=goal; while (n !== start) { route.current.unshift(n); n=parent[n] } }
    }
    const next = route.current[0]
    if (next !== undefined) {
      const [x,z] = network.nodes[next], dx=x-scrappy.x, dz=z-scrappy.z, length=Math.hypot(dx,dz)
      if (length < 0.1) { scrappy.x=x; scrappy.z=z; current.current=next; route.current.shift() }
      else {
        const step=Math.min(length,2.5*dt); scrappy.x+=dx/length*step; scrappy.z+=dz/length*step
        if (group.current) { const desired=Math.atan2(dx,dz); const delta=Math.atan2(Math.sin(desired-group.current.rotation.y),Math.cos(desired-group.current.rotation.y)); group.current.rotation.y+=delta*Math.min(1,dt*5) }
      }
    }
    if (group.current) group.current.position.set(scrappy.x,0,scrappy.z)
    const swing=Math.sin(clock.elapsedTime*7)*0.28
    if (leftLeg.current) leftLeg.current.rotation.x=swing
    if (rightLeg.current) rightLeg.current.rotation.x=-swing
  })
  return <group ref={group} scale={1.35}>
    {/* Black furry legs, gold shorts and broad gold-soled sneakers. */}
    <group>
      {[-0.23,0.23].map((x, i) => <group ref={i === 0 ? leftLeg : rightLeg} key={x} position={[x,0,0]}>
        <mesh position={[0,0.34,0]}><capsuleGeometry args={[0.12,0.36,4,8]} /><meshStandardMaterial color="#161616" /></mesh>
        <mesh position={[0,0.12,0.12]}><boxGeometry args={[0.34,0.22,0.5]} /><meshStandardMaterial color="#171717" /></mesh>
        <mesh position={[0,0.035,0.12]}><boxGeometry args={[0.36,0.07,0.52]} /><meshStandardMaterial color="#e8ae13" /></mesh>
        <mesh position={[0,0.59,0]}><boxGeometry args={[0.4,0.37,0.46]} /><meshStandardMaterial color="#edb818" /></mesh>
        {i === 0 && <mesh position={[0,0.6,0.235]}><planeGeometry args={[0.23,0.21]} /><meshBasicMaterial map={shortsLogo} transparent alphaTest={0.05} /></mesh>}
        <mesh position={[0,0.4,0]}><boxGeometry args={[0.4,0.045,0.47]} /><meshStandardMaterial color="#f3eee2" /></mesh>
      </group>)}
    </group>
    {/* Loose yellow shirt, white hem, black arms and gold shoulder sleeves. */}
    <mesh position={[0,1.05,0]} castShadow><boxGeometry args={[0.94,0.74,0.56]} /><meshStandardMaterial color="#f2ba16" /></mesh>
    <mesh position={[0,0.7,0]}><boxGeometry args={[0.96,0.065,0.57]} /><meshStandardMaterial color="#f5eee0" /></mesh>
    {[-1,1].map(side => <group key={side}>
      <mesh position={[side*0.56,1.23,0]} rotation={[0,0,side*0.5]}><capsuleGeometry args={[0.15,0.2,4,8]} /><meshStandardMaterial color="#f0b917" /></mesh>
      <mesh position={[side*0.66,0.98,0]} rotation={[0,0,side*0.3]}><capsuleGeometry args={[0.13,0.38,4,8]} /><meshStandardMaterial color="#151515" /></mesh>
    </group>)}
    {/* A single illustrated mask avoids protruding, staring eyes. */}
    <mesh position={[0,1.82,0]} castShadow><sphereGeometry args={[0.59,24,18]} /><meshStandardMaterial color="#101111" /></mesh>
    {[-1,1].map(side => <mesh key={side} position={[side*0.4,2.24,0]} rotation={[0,0,-side*0.55]}><coneGeometry args={[0.19,0.34,5]} /><meshStandardMaterial color="#101111" /></mesh>)}
    <mesh position={[0,1.82,0.605]}><planeGeometry args={[1.05,1.0]} /><meshBasicMaterial map={face} transparent alphaTest={0.05} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0,1.08,0.286]}><planeGeometry args={[0.68,0.32]} /><meshBasicMaterial map={shirt} transparent alphaTest={0.05} /></mesh>
  </group>
}
