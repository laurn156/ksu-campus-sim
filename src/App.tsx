import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { installSfx } from './audio/sfx'
import { loadCampus, type Campus } from './campus'
import { CampusScene, type GroundStyle } from './scene/Campus'
import { Labels } from './scene/Labels'
import { Player, Sun, type AvatarLook } from './scene/Player'
import { Hud } from './ui/Hud'
import './ui/ui.css'

export default function App() {
  const [campus, setCampus] = useState<Campus | null>(null)
  const [look] = useState<AvatarLook>({ color: 'blue', headwear: 'cap' })
  // G cycles the ground: illustrated (from the aerial photo) -> photo -> drawn (OpenStreetMap only)
  const [ground, setGround] = useState<GroundStyle>('illustrated')
  useEffect(() => {
    const order: GroundStyle[] = ['illustrated', 'photo', 'drawn']
    const k = (e: KeyboardEvent) => e.key.toLowerCase() === 'g' && setGround((g) => order[(order.indexOf(g) + 1) % 3])
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  useEffect(() => {
    loadCampus().then(setCampus)
    installSfx()
  }, [])
  if (!campus) return <div className="loading">Loading campus…</div>
  return (
    <>
      <Canvas shadows="percentage" camera={{ position: [0, 40, 40], fov: 45, near: 0.5, far: 3000 }} dpr={[1, 2]}>
        <color attach="background" args={['#cfe3f0']} />
        <fog attach="fog" args={['#cfe3f0', 180, 900]} />
        <hemisphereLight args={['#e8f3ff', '#8aa86a', 1.1]} />
        <Sun />
        <CampusScene campus={campus} ground={ground} />
        <Labels campus={campus} />
        <Player campus={campus} look={look} />
      </Canvas>
      <Hud campus={campus} />
    </>
  )
}
