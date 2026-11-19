import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { installSfx } from './audio/sfx'
import { loadCampus, type Campus } from './campus'
import { CampusScene } from './scene/Campus'
import { Labels } from './scene/Labels'
import { Player, Sun } from './scene/Player'
import { Hud } from './ui/Hud'
import { Entry, ModeSelect, type Mode } from './ui/GameFlow'
import { CampusStudents, LocalPlayers } from './scene/Community'
import { Welcome, DEFAULT_PROFILE, type Profile } from './ui/Welcome'
import './ui/ui.css'

const STORAGE_KEY = 'ksu-campus-profile-v1'
function savedProfile(raw: string | null): Profile | null {
  try {
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
const ACCOUNTS_KEY = 'ksu-campus-demo-profiles-v1'
function readProfiles(): Record<string,Profile> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: Record<string,Profile> = Object.create(null)
    for (const [name, entry] of Object.entries(value)) {
      const parsed = savedProfile(JSON.stringify(entry)); if (parsed) result[name] = parsed
    }
    const legacy = savedProfile(localStorage.getItem(STORAGE_KEY))
    if (legacy && !Object.keys(result).length) result['OwlExplorer'] = legacy
    return result
  } catch { return {} }
}
export default function App() {
  const [campus, setCampus] = useState<Campus | null>(null)
  const [accounts,setAccounts] = useState(readProfiles)
  const [username,setUsername] = useState('')
  const [profile,setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [screen,setScreen] = useState<'entry'|'create'|'modes'|'play'>('entry')
  const [mode,setMode] = useState<Mode>('life')
  useEffect(() => { loadCampus().then(setCampus); installSfx() }, [])
  const create = (name:string) => {setUsername(name);setProfile({...DEFAULT_PROFILE,name,look:{...DEFAULT_PROFILE.look}});setScreen('create')}
  const login = (name:string) => {setUsername(name);setProfile(accounts[name]);setScreen('modes')}
  const saveCharacter = () => {
    const updated = {...accounts,[username]:profile}
    setAccounts(updated)
    try {localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(updated))} catch { /* session remains usable */ }
    setScreen('modes')
  }
  if (screen === 'entry') return <Entry users={Object.keys(accounts)} onLogin={login} onCreate={create}/>
  if (screen === 'create') return <Welcome screen="create" profile={profile} hasSaved={false} onChange={setProfile} onCreate={()=>{}} onPlay={saveCharacter} onBack={()=>setScreen(username && accounts[username] ? 'modes' : 'entry')}/>
  if (screen === 'modes') return <ModeSelect name={username} onSelect={m=>{setMode(m);setScreen('play')}} onEdit={()=>setScreen('create')} onLogout={()=>setScreen('entry')}/>
  if (!campus) return <div className="loading">Loading campus…</div>
  return <>
    <Canvas shadows="percentage" camera={{ position: [0, 40, 40], fov: 45, near: 0.5, far: 3000 }} dpr={[1, 2]}>
      <color attach="background" args={['#cfe3f0']} /><fog attach="fog" args={['#cfe3f0', 180, 900]} />
      <hemisphereLight args={['#e8f3ff', '#8aa86a', 1.1]} /><Sun /><CampusScene campus={campus} /><Labels campus={campus} /><Player campus={campus} look={profile.look} />
      {mode==='life' ? <CampusStudents campus={campus}/> : <LocalPlayers profile={{...profile,name:profile.name || username}}/>}
    </Canvas>
    <Hud campus={campus} onEdit={() => setScreen('create')} mode={mode} onModes={()=>setScreen('modes')} />
  </>
}
