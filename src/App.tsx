import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { installSfx } from './audio/sfx'
import { loadCampus, type Campus } from './campus'
import { CampusScene } from './scene/Campus'
import { Labels } from './scene/Labels'
import { Player, Sun } from './scene/Player'
import { Hud } from './ui/Hud'
import { Welcome, DEFAULT_PROFILE, type Profile } from './ui/Welcome'
import './ui/ui.css'

const STORAGE_KEY = 'ksu-campus-profile-v1'
function savedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Profile
    const l = data?.look
    if (typeof data.name !== 'string' || !l || !['orange','yellow','cream','green','blue','purple','slate','charcoal'].includes(l.color) ||
      !['none','cap','beanie','bucket','bun','headphones','headband'].includes(l.headwear) ||
      !['happy','dots','wink','surprised','angry'].includes(l.face) || !['none','glasses','square','rectangle','sunglasses'].includes(l.accessory) ||
      !['none','tee','hoodie','ksu-tee','ksu-hoodie','jersey'].includes(l.top) || !['none','shorts','skirt','pants'].includes(l.bottom) || typeof l.backpack !== 'boolean') return null
    return { ...data, look: { ...data.look, headwear: l.headwear === 'bun' ? 'none' : l.headwear, accessory: l.accessory === 'sunglasses' ? 'rectangle' : l.accessory, bottomColor: /^#[0-9a-f]{6}$/i.test(l.bottomColor ?? '') ? l.bottomColor : '#4e526b', jerseyNumber: /^\d{1,2}$/.test(l.jerseyNumber ?? '') ? l.jerseyNumber : '12', shoes: ['none','sneakers','black'].includes(l.shoes) ? l.shoes : 'none', bag: ['none','black','cream','brown'].includes(l.bag) ? l.bag : l.backpack ? 'brown' : 'none', backpack: false, topColor: /^#[0-9a-f]{6}$/i.test(l.topColor ?? '') ? l.topColor : '#29292c' } }
  } catch { return null }
}
export default function App() {
  const [campus, setCampus] = useState<Campus | null>(null)
  const [profile, setProfile] = useState<Profile>(() => savedProfile() ?? DEFAULT_PROFILE)
  const [hasSaved, setHasSaved] = useState(() => savedProfile() !== null)
  const [screen, setScreen] = useState<'welcome' | 'create' | 'play'>('welcome')
  useEffect(() => { loadCampus().then(setCampus); installSfx() }, [])
  const play = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); setHasSaved(true) } catch { /* storage unavailable: play for this session */ }
    setScreen('play')
  }
  if (screen !== 'play') return <Welcome screen={screen} profile={profile} hasSaved={hasSaved} onChange={setProfile} onCreate={() => setScreen('create')} onPlay={play} onBack={() => setScreen('welcome')} />
  if (!campus) return <div className="loading">Loading campus…</div>
  return <>
    <Canvas shadows="percentage" camera={{ position: [0, 40, 40], fov: 45, near: 0.5, far: 3000 }} dpr={[1, 2]}>
      <color attach="background" args={['#cfe3f0']} /><fog attach="fog" args={['#cfe3f0', 180, 900]} />
      <hemisphereLight args={['#e8f3ff', '#8aa86a', 1.1]} /><Sun /><CampusScene campus={campus} /><Labels campus={campus} /><Player campus={campus} look={profile.look} />
    </Canvas>
    <Hud campus={campus} onEdit={() => setScreen('create')} />
  </>
}

