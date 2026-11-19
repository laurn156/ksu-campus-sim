import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Character, type Headwear } from '../characters/Character'
import type { PaletteName } from '../characters/palette'
import { centroid, Collider, type Campus } from '../campus'
import { occluders } from './Campus'

/** Shared, mutable player state (read by the HUD / minimap without re-rendering React every frame). */
export const player = { x: 0, z: 0, heading: 0, yaw: 0.6, moving: false }

const WALK = 5 // m/s (a brisk, game-paced walk)
const RUN = 9.5

export interface AvatarLook {
  color: PaletteName
  headwear: Headwear
}

/** Start just outside the Student Center, on the side that faces the middle of campus. */
export function spawnPoint(campus: Campus): [number, number, number] {
  const collider = new Collider(campus.buildings)
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

export function Player({ campus, look }: { campus: Campus; look: AvatarLook }) {
  const collider = useMemo(() => new Collider(campus.buildings), [campus])
  const body = useRef<THREE.Group>(null)
  const marker = useRef<THREE.Mesh>(null)
  const walk = useRef(0)
  const keys = useRef(new Set<string>())
  const target = useRef<THREE.Vector2 | null>(null)
  const dist = useRef(30)
  const cut = useRef(0)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const drag = useRef<{ x: number } | null>(null)
  const { camera, gl } = useThree()

  useEffect(() => {
    // dev: window.__tp(x, z, yaw?, dist?) teleports the player (for screenshots / debugging)
    if (import.meta.env.DEV)
      (window as any).__tp = (x: number, z: number, yaw?: number, d?: number) => {
        player.x = x
        player.z = z
        if (yaw !== undefined) player.yaw = yaw
        if (d !== undefined) dist.current = d
        target.current = null
      }
    const [x, z, yaw] = spawnPoint(campus)
    player.x = x
    player.z = z
    player.yaw = yaw
    player.heading = yaw + Math.PI
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      keys.current.add(e.key.toLowerCase())
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) target.current = null
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const wheel = (e: WheelEvent) => (dist.current = THREE.MathUtils.clamp(dist.current * (1 + Math.sign(e.deltaY) * 0.1), 8, 140))
    const pdown = (e: PointerEvent) => {
      if (e.button === 2) drag.current = { x: e.clientX }
    }
    const pmove = (e: PointerEvent) => {
      if (!drag.current) return
      player.yaw -= (e.clientX - drag.current.x) * 0.008
      drag.current.x = e.clientX
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
    const k = keys.current
    if (k.has('q')) player.yaw += dt * 1.6
    if (k.has('e')) player.yaw -= dt * 1.6
    // camera-relative movement: "forward" points away from the camera
    const fwd = new THREE.Vector2(-Math.sin(player.yaw), -Math.cos(player.yaw))
    const right = new THREE.Vector2(-fwd.y, fwd.x)
    const dir = new THREE.Vector2()
    if (k.has('w') || k.has('arrowup')) dir.add(fwd)
    if (k.has('s') || k.has('arrowdown')) dir.sub(fwd)
    if (k.has('d') || k.has('arrowright')) dir.add(right)
    if (k.has('a') || k.has('arrowleft')) dir.sub(right)
    if (dir.lengthSq() === 0 && target.current) {
      dir.set(target.current.x - player.x, target.current.y - player.z)
      if (dir.length() < 0.6) target.current = null
    }
    const moving = dir.lengthSq() > 0.0001
    if (moving) {
      dir.normalize()
      const speed = k.has('shift') ? RUN : WALK
      const nx = player.x + dir.x * speed * dt
      const nz = player.z + dir.y * speed * dt
      // move, or slide along the wall if blocked
      if (!collider.blocked(nx, nz)) {
        player.x = nx
        player.z = nz
      } else if (!collider.blocked(nx, player.z)) player.x = nx
      else if (!collider.blocked(player.x, nz)) player.z = nz
      else target.current = null
      const want = Math.atan2(dir.x, dir.y)
      let d = want - player.heading
      d = Math.atan2(Math.sin(d), Math.cos(d))
      player.heading += d * Math.min(1, dt * 12)
    }
    player.moving = moving
    walk.current = THREE.MathUtils.lerp(walk.current, moving ? (k.has('shift') ? 1 : 0.75) : 0, Math.min(1, dt * 10))
    if (body.current) {
      body.current.position.set(player.x, 0, player.z)
      body.current.rotation.y = player.heading
    }
    if (marker.current) {
      marker.current.visible = !!target.current
      if (target.current) marker.current.position.set(target.current.x, 0.12, target.current.y)
    }
    // Sims-style camera: high three-quarter view that follows smoothly
    const pitch = 1.02
    const want = new THREE.Vector3(
      player.x + Math.sin(player.yaw) * Math.cos(pitch) * dist.current,
      Math.sin(pitch) * dist.current,
      player.z + Math.cos(player.yaw) * Math.cos(pitch) * dist.current,
    )
    camera.position.lerp(want, Math.min(1, dt * 6))
    camera.lookAt(player.x, 1.2, player.z)
    // cutaway: buildings between the camera and the player fade out
    cut.current += dt
    if (cut.current > 0.08) {
      cut.current = 0
      const from = camera.position.clone()
      const to = new THREE.Vector3(player.x, 1.0, player.z)
      ray.set(from, to.clone().sub(from).normalize())
      ray.far = from.distanceTo(to)
      const hit = new Set(ray.intersectObjects(occluders.meshes, false).map((h) => h.object.parent))
      for (const m of occluders.meshes) {
        const mat = m.material as THREE.MeshStandardMaterial
        const target = hit.has(m.parent) ? 0.18 : 1
        mat.opacity += (target - mat.opacity) * 0.5
        if (target === 1 && mat.opacity > 0.97) mat.opacity = 1
        // only fading buildings are transparent: opaque ones keep proper depth (no see-through roofs)
        const tr = mat.opacity < 1
        if (tr !== mat.transparent) {
          mat.transparent = tr
          mat.depthWrite = !tr
          mat.needsUpdate = true
        }
      }
    }
  })

  const onGround = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    target.current = new THREE.Vector2(e.point.x, e.point.z)
  }

  return (
    <group>
      <group ref={body}>
        <Character color={look.color} headwear={look.headwear} face="happy" walk={walk} scale={1.15} />
      </group>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.6, 0.85, 32]} />
        <meshBasicMaterial color="#FFC629" transparent opacity={0.9} />
      </mesh>
      {/* click-to-walk catcher: an invisible ground plane over the whole map */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} onPointerDown={onGround}>
        <planeGeometry args={[6000, 6000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
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
