import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Character, type Headwear, type Face, type Accessory } from '../characters/Character'
import type { PaletteName } from '../characters/palette'
import { centroid, Collider, westDeckGroundHeight, type Campus } from '../campus'
import { busCaller, busPositions } from './Buses'
import { indoorState } from './indoorState'
import { activityState } from '../activities/activityState'

/** Shared, mutable player state (read by the HUD / minimap without re-rendering React every frame). */
export const player = { x: 0, z: 0, heading: 0, yaw: 0.6, pitch: 1.0, moving: false, tp: null as null | { x: number; z: number; yaw: number; buildingId?:string }, travelOrigin: null as null | { x: number; z: number }, travelBuilding: null as string | null, view: null as null | { x:number; z:number; yaw:number; buildingId?:string }, viewChanged: false, busRide: null as null | { index: number; until: number }, rides: 0, speedMultiplier: 1 }

const WALK = 5 // m/s (a brisk, game-paced walk)
const RUN = 9.5

export interface AvatarLook {
  color: PaletteName
  headwear: Headwear
  face: Face
  accessory: Accessory
  top: 'none' | 'tee' | 'hoodie' | 'ksu-tee' | 'ksu-hoodie' | 'jersey'
  topColor: string
  bottom: 'none' | 'shorts' | 'skirt' | 'pants'
  bottomColor: string
  jerseyNumber: string
  shoes: 'none' | 'sneakers' | 'black' | 'boots'
  bag: 'none' | 'black' | 'cream' | 'brown'
  bagStyle?: 'backpack' | 'sling'
  backpack: boolean
}

/** A clear spot just outside a building (toward the middle of campus), facing it. */
export function approach(campus: Campus, poly: [number, number][]): { x: number; z: number; yaw: number } {
  const collider = new Collider(campus.buildings)
  const [cx, cz] = centroid(poly)
  const len = Math.hypot(cx, cz) || 1
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 2, -2, Math.PI]) {
    const ux = (-cx / len) * Math.cos(turn) - (-cz / len) * Math.sin(turn)
    const uz = (-cx / len) * Math.sin(turn) + (-cz / len) * Math.cos(turn)
    for (let r = 3; r < 200; r += 2) {
      const x = cx + ux * r
      const z = cz + uz * r
      if (!collider.blocked(x, z, 0.5)) {
        if (collider.blocked(x + ux * 4, z + uz * 4, 1.5)) break // squeezed into a gap; try another side
        return { x: x + ux * 5, z: z + uz * 5, yaw: Math.atan2(ux, uz) }
      }
    }
  }
  return { x: cx, z: cz + 30, yaw: 0 }
}

/** Start on the Globe plaza, just in front of the sculpture, looking past it toward the Student Center
 *  (the same view as the main menu). Falls back to outside the Student Center if the Globe is missing. */
export function spawnPoint(campus: Campus): [number, number, number] {
  const collider = new Collider(campus.buildings)
  const globe = campus.features.find((f) => f.kind === 'sculpture' && f.name === 'Globe')
  if (globe) for (let r = 8; r < 20; r += 1) {
    const x = globe.x, z = globe.z + r
    if (!collider.blocked(x, z, 1.5)) return [x, z, 0]
  }
  const sc = campus.buildings.find((b) => b.code === 'A') ?? campus.buildings[0]
  const [cx, cz] = centroid(sc.poly)
  const len = Math.hypot(cx, cz) || 1
  const ux = -cx / len
  const uz = -cz / len // toward the campus centre (origin)
  for (let r = 5; r < 300; r += 2) {
    const x = cx + ux * r
    const z = cz + uz * r
    if (!collider.blocked(x, z, 4)) {
      // camera goes on the far side from the building, looking at it past the player
      return [x + ux * 6, z + uz * 6, Math.atan2(ux, uz)]
    }
  }
  return [cx, cz + 40, 0]
}

export function Player({ campus, look, name }: { campus: Campus; look: AvatarLook; name?: string }) {
  const collider = useMemo(() => new Collider(campus.buildings), [campus])
  const body = useRef<THREE.Group>(null)
  const walk = useRef(0)
  const seated = useRef(0)
  const throwing = useRef(0)
  const slapSwing = useRef(-1000)
  const keys = useRef(new Set<string>())
  const dist = useRef(30)
  const preRaceDistance = useRef<number|null>(null)
  const snap = useRef(false)
  const drag = useRef<{ x: number; y: number; pan: boolean } | null>(null)
  const pan = useRef(new THREE.Vector2())
  const cameraTarget = useRef(new THREE.Vector3())
  const { camera, gl } = useThree()

  useEffect(() => {
    // dev: window.__tp(x, z, yaw?, dist?) teleports the player (for screenshots / debugging)
    if (import.meta.env.DEV)
      (window as any).__tp = (x: number, z: number, yaw?: number, d?: number, pitch?: number) => {
        if (pitch !== undefined) player.pitch = pitch
        player.x = x
        player.z = z
        if (yaw !== undefined) player.yaw = yaw
        if (d !== undefined) dist.current = d
      }
    player.travelOrigin = null
    player.travelBuilding = null
    player.view = null
    const [x, z, yaw] = spawnPoint(campus)
    player.x = x
    player.z = z
    player.yaw = yaw
    player.heading = yaw + Math.PI
    cameraTarget.current.set(x, 1.2, z)
    snap.current = true
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      keys.current.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const wheel = (e: WheelEvent) => (dist.current = THREE.MathUtils.clamp(dist.current * (1 + Math.sign(e.deltaY) * 0.1), 8, 140))
    const pdown = (e: PointerEvent) => {
      // Disc golf uses left click on the world to aim and throw.
      if (activityState.mode === 'disc' && e.button === 0) return
      // left or right drag looks around (no click-to-walk)
      if (e.button <= 2) { e.preventDefault(); gl.domElement.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, pan: e.button === 1 || e.shiftKey } }
    }
    const pmove = (e: PointerEvent) => {
      if (!drag.current) return
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
      if (drag.current.pan) {
        const scale = dist.current * 0.0018
        pan.current.x += (-Math.cos(player.yaw)*dx - Math.sin(player.yaw)*dy) * scale
        pan.current.y += (Math.sin(player.yaw)*dx - Math.cos(player.yaw)*dy) * scale
      } else {
        player.yaw -= dx * 0.008
        player.pitch = THREE.MathUtils.clamp(player.pitch + dy * 0.005, 0.3, 1.45)
      }
      drag.current.x = e.clientX
      drag.current.y = e.clientY
    }
    const pup = () => (drag.current = null)
    const ctx = (e: Event) => e.preventDefault()
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    gl.domElement.addEventListener('wheel', wheel, { passive: true })
    gl.domElement.addEventListener('pointerdown', pdown)
    addEventListener('pointermove', pmove)
    addEventListener('pointerup', pup)
    gl.domElement.addEventListener('contextmenu', ctx)
    return () => {
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
      gl.domElement.removeEventListener('wheel', wheel)
      gl.domElement.removeEventListener('pointerdown', pdown)
      removeEventListener('pointermove', pmove)
      removeEventListener('pointerup', pup)
      gl.domElement.removeEventListener('contextmenu', ctx)
    }
  }, [campus, gl])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    if((activityState.mode==='bathtub'||activityState.mode==='rock')&&preRaceDistance.current===null){preRaceDistance.current=dist.current;dist.current=activityState.mode==='rock'?7:Math.min(dist.current,18)}
    else if(activityState.mode!=='bathtub'&&activityState.mode!=='rock'&&preRaceDistance.current!==null){dist.current=preRaceDistance.current;preRaceDistance.current=null}
    seated.current = activityState.mode === 'bathtub' || activityState.mode === 'busdrive' ? 1 : 0
    throwing.current = (activityState.mode === 'disc' || activityState.mode === 'rock') && performance.now() < activityState.throwUntil ? 1 : 0
    if(activityState.mode==='rock'&&performance.now()<activityState.throwUntil&&performance.now()-slapSwing.current>330)slapSwing.current=performance.now()
    busCaller.riding = player.busRide?.index ?? -1
    if (indoorState.active) { busCaller.x = NaN; busCaller.z = NaN } else { busCaller.x = player.x; busCaller.z = player.z }
    if (indoorState.active) { if(player.busRide){const bus=busPositions[player.busRide.index];if(bus){player.x=bus.x;player.z=bus.z}} keys.current.clear(); player.moving = false; return }
    const k = keys.current
    if (player.viewChanged) { pan.current.set(0,0); snap.current=true; player.viewChanged=false }
    if (player.tp) {
      // teleport (from the "Go to" menu): jump there and snap the camera
      pan.current.set(0, 0)
      player.travelOrigin = { x: player.tp.x, z: player.tp.z }
      player.travelBuilding = player.tp.buildingId ?? null
      player.busRide = null
      player.x = player.tp.x
      player.z = player.tp.z
      player.yaw = player.tp.yaw
      player.heading = player.tp.yaw + Math.PI
      player.tp = null
      snap.current = true
    }
    if (player.travelOrigin && Math.hypot(player.x-player.travelOrigin.x,player.z-player.travelOrigin.z)>12) player.travelBuilding = null
    if (player.travelOrigin && Math.hypot(player.x-player.travelOrigin.x,player.z-player.travelOrigin.z)>80) player.travelOrigin = null
    if (player.busRide) {
      const bus = busPositions[player.busRide.index]
      if (!bus || performance.now()>player.busRide.until) player.busRide=null
      else { player.x=bus.x; player.z=bus.z; snap.current=true }
    }
    if (k.has('q') && !activityState.locked) player.yaw += dt * 1.6
    if (k.has('e') && !activityState.mode && !activityState.locked && !activityState.near) player.yaw -= dt * 1.6
    // camera-relative movement: "forward" points away from the camera
    const fwd = new THREE.Vector2(-Math.sin(player.yaw), -Math.cos(player.yaw))
    const right = new THREE.Vector2(-fwd.y, fwd.x)
    const dir = new THREE.Vector2()
    if (k.has('w') || k.has('arrowup')) dir.add(fwd)
    if (k.has('s') || k.has('arrowdown')) dir.sub(fwd)
    if (k.has('d') || k.has('arrowright')) dir.add(right)
    if (k.has('a') || k.has('arrowleft')) dir.sub(right)
    if(activityState.locked)keys.current.clear()
    const moving = !activityState.locked && !player.view && !player.busRide && dir.lengthSq() > 0.0001
    if (moving) {
      pan.current.set(0, 0)
      dir.normalize()
      const speed = (k.has('shift') ? RUN : WALK) * player.speedMultiplier
      const nx = player.x + dir.x * speed * dt
      const nz = player.z + dir.y * speed * dt
      // move, or slide along the wall if blocked
      if (!collider.blocked(nx, nz)) {
        player.x = nx
        player.z = nz
      } else if (!collider.blocked(nx, player.z)) player.x = nx
      else if (!collider.blocked(player.x, nz)) player.z = nz
      const want = Math.atan2(dir.x, dir.y)
      let d = want - player.heading
      d = Math.atan2(Math.sin(d), Math.cos(d))
      player.heading += d * Math.min(1, dt * 12)
    }
    player.moving = moving
    walk.current = THREE.MathUtils.lerp(walk.current, moving ? (k.has('shift') ? 1 : 0.75) : 0, Math.min(1, dt * 10))
    const groundY = westDeckGroundHeight(campus, player.x, player.z)
    if (body.current) {
      body.current.visible = activityState.mode !== 'busdrive' && activityState.mode !== 'parking'
      body.current.position.set(player.x, groundY, player.z)
      body.current.rotation.y = player.heading
    }
    // Sims-style camera: high three-quarter view that follows smoothly
    const pitch = player.pitch
    const viewX=(player.view?.x ?? player.x)+pan.current.x,viewZ=(player.view?.z ?? player.z)+pan.current.y
    const viewY=westDeckGroundHeight(campus,viewX,viewZ)
    const want = new THREE.Vector3(
      (player.view?.x ?? player.x) + pan.current.x + Math.sin(player.yaw) * Math.cos(pitch) * dist.current,
      viewY + Math.sin(pitch) * dist.current,
      (player.view?.z ?? player.z) + pan.current.y + Math.cos(player.yaw) * Math.cos(pitch) * dist.current,
    )
    const focus = new THREE.Vector3((player.view?.x ?? player.x) + pan.current.x, viewY + 1.2, (player.view?.z ?? player.z) + pan.current.y)
    if (snap.current) {
      camera.position.copy(want)
      cameraTarget.current.copy(focus)
      snap.current = false
    } else {
      // Smooth position and target together; smoothing just position makes the view wobble while panning.
      const smoothing = 1 - Math.exp(-dt * 12)
      camera.position.lerp(want, smoothing)
      cameraTarget.current.lerp(focus, smoothing)
    }
    camera.lookAt(cameraTarget.current)

  })

  return (
    <group>
      <group ref={body}>
        <Character {...look} walk={walk} point={throwing} swingAt={slapSwing} sit={seated} sitLift={.112} scale={1.15} />
        {name && <Html position={[0, 2.25, 0]} center zIndexRange={[20, 0]}><div className="player-tag">{name}</div></Html>}
      </group>
    </group>
  )
}

/** Sun with a shadow box that follows the player (the campus is ~1.5 km wide). */
export function Sun() {
  const light = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()
  useEffect(() => {
    if (light.current) scene.add(light.current.target)
  }, [scene])
  useFrame(() => {
    const l = light.current
    if (!l) return
    l.position.set(player.x + 60, 110, player.z + 40)
    l.target.position.set(player.x, 0, player.z)
  })
  return (
    <directionalLight
      ref={light}
      intensity={2.2}
      color="#fff1dc"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
      shadow-camera-far={400}
      shadow-bias={-0.0006}
    />
  )
}
