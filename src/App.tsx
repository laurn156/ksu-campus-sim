import { ClassroomActivity } from './activities/ClassroomActivity'
import { ActivityWorld, CampusActivities } from './activities/CampusActivities'
import { ActivityMenu } from './activities/ActivityMenu'
import { VehicleWorld, VehicleActivities } from './activities/VehicleActivities'
import { SlapRockActivity } from './activities/SlapRockActivity'
import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { installSfx } from './audio/sfx'
import { loadCampus, type Campus } from './campus'
import { CampusScene } from './scene/Campus'
import { Labels } from './scene/Labels'
import { Player, Sun } from './scene/Player'
import { BuildingInteriors } from './scene/Interiors'
import { Hud } from './ui/Hud'
import { CampusStudents } from './scene/Community'
import { supabase } from './connect/client'
import { useConnectWorld, OnlinePlayers, ConnectChat } from './connect/World'
import { useSocial, SocialPanel } from './connect/Social'
import { useOfflinePlayers } from './connect/OfflineFriends'
import type { User } from '@supabase/supabase-js'
import { useLife } from './life/useLife'
import { LifeUI } from './life/LifeUI'
import { Welcome, type Profile } from './ui/Welcome'
import { MainMenu, HowToPlay } from './ui/MainMenu'
import { Onboarding, CampusGreeting } from './ui/Onboarding'
import { PRESETS, cleanName, draftProfile, loadNestProfile, saveNestProfile, type NestProfile } from './ui/nestProfile'
import './ui/ui.css'

const DRAFT_KEY = 'nest-life-draft-v1'
function loadDraft(): NestProfile {
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null') as NestProfile | null; if (d && typeof d.playerId === 'string' && d.characterAppearance) return d } catch { /* fall through */ }
  return draftProfile()
}
const saveDraft = (d: NestProfile) => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* optional */ } }

/** A unique, valid multiplayer username derived from the display name (display names may contain spaces and symbols). */
function usernameFor(display: string) {
  const base = display.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 15) || 'Owl'
  return base + '_' + Math.random().toString(36).slice(2, 6)
}

/** Join the existing Supabase multiplayer identity (anonymous session) and store the appearance + display name. */
async function joinOnline(p: NestProfile): Promise<User> {
  const client = supabase!
  let user = (await client.auth.getSession()).data.session?.user ?? null
  if (!user) {
    const { data, error } = await client.auth.signInAnonymously({ options: { data: { username: usernameFor(p.displayName) } } })
    if (error || !data.user) throw error ?? new Error('No session')
    user = data.user
  }
  const appearance = { ...p.characterAppearance, displayName: p.displayName }
  const { data: row, error } = await client.from('campus_profiles').select('id').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (row) {
    const { error: e } = await client.from('campus_profiles').update({ appearance }).eq('id', user.id); if (e) throw e
  } else {
    const preferred = String(user.user_metadata?.username ?? '')
    for (let attempt = 0; attempt < 4; attempt++) {
      const username = attempt === 0 && /^[A-Za-z0-9_]{3,24}$/.test(preferred) ? preferred : usernameFor(p.displayName)
      const { error: e } = await client.from('campus_profiles').insert({ id: user.id, username, appearance })
      if (!e) break
      if (e.code !== '23505' || attempt === 3) throw e
    }
  }
  return user
}

type Screen = 'menu' | 'onboard' | 'customize' | 'joining' | 'play'
export default function App() {
  const [campus, setCampus] = useState<Campus | null>(null)
  const [saved, setSaved] = useState<NestProfile | null>(loadNestProfile)
  const [draft, setDraftState] = useState<NestProfile>(() => loadNestProfile() ?? loadDraft())
  const [screen, setScreen] = useState<Screen>('menu')
  const [help, setHelp] = useState(false)
  const [onboardStep, setOnboardStep] = useState<'welcome' | 'character'>('welcome')
  const [customizeFrom, setCustomizeFrom] = useState<'menu' | 'onboard' | 'play'>('menu')
  const [nameError, setNameError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [joinError, setJoinError] = useState('')
  const [notice, setNotice] = useState('')
  const snapshot = useRef<NestProfile | null>(null)
  useEffect(() => { loadCampus().then(setCampus); installSfx() }, [])
  const setDraft = useCallback((d: NestProfile) => { setDraftState(d); if (!saved) saveDraft(d) }, [saved])

  const persist = (p: NestProfile) => { saveNestProfile(p); setSaved(p); setDraftState(p) }
  const enter = async (p: NestProfile) => {
    setJoinError(''); setNotice('')
    persist(p)
    if (supabase) {
      setScreen(s => s === 'onboard' ? s : 'joining')
      try {
        const u = await joinOnline(p)
        setUser(u)
        if (p.playerId !== u.id) persist({ ...p, playerId: u.id })
      } catch {
        setUser(null); setNotice('Could not reach multiplayer right now, so you are exploring offline.')
      }
    }
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* optional */ }
    setScreen('play')
  }
  const play = () => {
    if (saved) { void enter(saved); return }
    setOnboardStep('welcome'); setScreen('onboard')
  }
  const openCustomize = (from: 'menu' | 'onboard' | 'play') => {
    snapshot.current = draft; setNameError(''); setCustomizeFrom(from); setScreen('customize')
  }
  const leaveCustomize = (keep: boolean) => {
    const current = keep ? draft : snapshot.current ?? draft
    if (!keep) setDraftState(current)
    if (customizeFrom === 'onboard') { setOnboardStep('character'); setScreen('onboard') }
    else setScreen(customizeFrom)
  }
  const saveCustomize = async () => {
    const raw = draft.displayName
    const { name, error } = cleanName(raw)
    const needsName = !!saved || customizeFrom === 'play'
    if (error && (needsName || raw.trim())) { setNameError(error); return }
    const preset = PRESETS.find(p => JSON.stringify(p.look) === JSON.stringify(draft.characterAppearance))
    const next = { ...draft, displayName: error ? '' : name, characterPreset: preset?.id ?? null }
    if (saved) {
      persist(next)
      if (user && supabase) await supabase.from('campus_profiles').update({ appearance: { ...next.characterAppearance, displayName: next.displayName } }).eq('id', user.id)
    } else setDraft(next)
    leaveCustomize(true)
  }

  if (screen === 'customize') {
    const profile: Profile = { name: draft.displayName, look: draft.characterAppearance }
    return <Welcome screen="create" profile={profile} hasSaved={!!saved} nameError={nameError}
      saveLabel={customizeFrom === 'onboard' ? 'Use this look' : 'Save'}
      onChange={p => { setNameError(''); setDraft({ ...draft, displayName: p.name, characterAppearance: p.look }) }}
      onCreate={() => {}} onPlay={() => void saveCustomize()} onBack={() => leaveCustomize(false)} />
  }
  if (screen === 'play' && campus) {
    const p = saved ?? draft
    const greeting = !p.hasSeenWelcome && <CampusGreeting onSeen={() => persist({ ...p, hasSeenWelcome: true })} />
    const toMenu = () => setScreen('menu')
    return <>
      {user ? <OnlineCampus campus={campus} user={user} profile={p} onEdit={() => openCustomize('play')} onMenu={toMenu} />
        : <LifeSession campus={campus} profile={p} onEdit={() => openCustomize('play')} onMenu={toMenu} />}
      {greeting}
      {notice && <div className="controls-toast" role="status" style={{ animationDuration: '7s' }} onAnimationEnd={() => setNotice('')}>{notice}</div>}
    </>
  }
  return <MainMenu campus={campus} look={saved?.characterAppearance} returning={saved?.displayName ?? null}
    onPlay={play} onCustomize={() => openCustomize('menu')} onHelp={() => setHelp(true)}>
    {help && <HowToPlay onBack={() => setHelp(false)} />}
    {screen === 'onboard' && <Onboarding draft={draft} startStep={onboardStep} onChange={setDraft} onCustomize={() => openCustomize('onboard')}
      onCancel={() => setScreen('menu')} onDone={() => void enter({ ...draft })} busy={false} error={joinError} />}
    {(screen === 'joining' || (screen === 'play' && !campus)) && <div className="menu-overlay"><div className="menu-card"><div className="card-owl">🦉</div><h2>Heading to campus…</h2></div></div>}
  </MainMenu>
}

function LifeSession({campus,profile,onEdit,onMenu}:{campus:Campus;profile:NestProfile;onEdit:()=>void;onMenu:()=>void}) {
  const life=useLife(profile.playerId,profile.displayName)
  const look=profile.characterAppearance
  return <>
    <Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}>
      <color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/>
      <hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={look} name={profile.displayName}/><CampusStudents campus={campus} minute={life.state.minute}/><ActivityWorld campus={campus}/><VehicleWorld campus={campus}/>
    </Canvas>
    <CampusActivities campus={campus} identity={profile.playerId}/><VehicleActivities campus={campus}/><SlapRockActivity campus={campus} identity={profile.playerId}/><BuildingInteriors campus={campus} look={look}/><Hud campus={campus} onEdit={onEdit} mode="life" onModes={onMenu}/><ActivityMenu campus={campus}/><ClassroomActivity globalLauncher/><LifeUI campus={campus} life={life} playerName={profile.displayName} onEdit={onEdit}/>
  </>
}

function OnlineCampus({campus,user,profile,onEdit,onMenu}:{campus:Campus;user:User;profile:NestProfile;onEdit:()=>void;onMenu:()=>void}){
 const world=useConnectWorld(user.id,profile.displayName)
 const look=profile.characterAppearance
 const social=useSocial(user.id)
 const offline=useOfflinePlayers(campus,user.id,world.onlineIds,world.status==='Connected')
 const peers=[...world.peers,...offline].filter(p=>!social.blocked.includes(p.id))
 const life=useLife(user.id,profile.displayName)
 return <><Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}><color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/><hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={look} name={profile.displayName}/><CampusStudents campus={campus} minute={life.state.minute}/><ActivityWorld campus={campus}/><VehicleWorld campus={campus}/><OnlinePlayers peers={peers.filter(p=>p.location==='campus')}/></Canvas><CampusActivities campus={campus} identity={user.id}/><VehicleActivities campus={campus}/><SlapRockActivity campus={campus} identity={profile.playerId}/><BuildingInteriors campus={campus} look={look} peers={peers}/><Hud campus={campus} onEdit={onEdit} mode="life" onModes={onMenu}/><ActivityMenu campus={campus}/><ClassroomActivity globalLauncher/><LifeUI campus={campus} life={life} playerName={profile.displayName} onEdit={onEdit}/><ConnectChat world={world}/><SocialPanel userId={user.id} peers={peers} onlineIds={world.onlineIds} social={social} wave={world.wave} allowRoaming={!user.is_anonymous}/></>
}
