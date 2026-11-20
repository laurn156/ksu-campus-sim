import { HardwarePanel } from './hardware/HardwarePanel'
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
import { useDemoWorld, DemoSocial } from './connect/DemoWorld'
import { useRockChallenge, RockChallengePanel } from './connect/RockChallenge'
import { usePhotoSession, PhotoSessionPanel } from './connect/PhotoSession'
import { useCampusContest, CampusContestPanel } from './connect/CampusContest'
import { NearbyPlayer } from './connect/NearbyPlayer'
import { useConnectWorld, OnlinePlayers, ConnectChat } from './connect/World'
import { useSocial, SocialPanel } from './connect/Social'
import { useOfflinePlayers } from './connect/OfflineFriends'
import { useMultiplayerGame, MultiplayerGamePanel } from './connect/MultiplayerGame'
import type { User } from '@supabase/supabase-js'
import { useLife } from './life/useLife'
import { LifeUI } from './life/LifeUI'
import { CasualStudentChat } from './life/CasualStudentChat'
import { ScrappyChat } from './life/ScrappyChat'
import { Welcome, type Profile } from './ui/Welcome'
import { MainMenu, HowToPlay } from './ui/MainMenu'
import { Onboarding, CampusGreeting } from './ui/Onboarding'
import { PhotoBooth, type BoothFriend } from './activities/PhotoBooth'
import { PRESETS, cleanName, draftProfile, loadNestProfile, saveNestProfile, type NestProfile } from './ui/nestProfile'
import './ui/ui.css'

const DRAFT_KEY = 'nest-life-draft-v1'
function loadDraft(): NestProfile {
  try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null') as NestProfile | null; if (d && typeof d.playerId === 'string' && d.characterAppearance) return d } catch { /* fall through */ }
  return draftProfile()
}
const saveDraft = (d: NestProfile) => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* optional */ } }

// Classmates who can join booth photos when no other real players are around.
const CLASSMATES: BoothFriend[] = ['Maya', 'Jordan', 'Priya', 'Leo', 'Sam', 'Ava'].map((name, i) => ({ name, look: PRESETS[i].look }))

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
  const [user] = useState<User | null>(null)
  const [joinError, setJoinError] = useState('')
  const [notice, setNotice] = useState('')
  const snapshot = useRef<NestProfile | null>(null)
  useEffect(() => { loadCampus().then(setCampus); installSfx() }, [])
  const setDraft = useCallback((d: NestProfile) => { setDraftState(d); if (!saved) saveDraft(d) }, [saved])

  const persist = (p: NestProfile) => { saveNestProfile(p); setSaved(p); setDraftState(p) }
  const enter = async (p: NestProfile) => {
    setJoinError(''); setNotice('')
    persist(p)
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
  const demo=useDemoWorld(profile.displayName,look)
  const game=useMultiplayerGame(demo.id,demo.world.onlineIds,demo.world.sendGame,[])
  const rockGame=useRockChallenge(demo,campus)
  const contest=useCampusContest(demo,campus)
  const photoGame=usePhotoSession(demo)
  const photoPeer=demo.world.peers.find(p=>p.id===photoGame.session?.peer)
  return <>
    <HardwarePanel/>
    <Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}>
      <color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/>
      <hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={look} name={profile.displayName}/><CampusStudents campus={campus} minute={life.state.minute}/><ActivityWorld campus={campus}/><VehicleWorld campus={campus}/><OnlinePlayers peers={demo.world.peers.filter(p=>p.location==='campus')}/>
    </Canvas>
    <CampusActivities campus={campus} identity={profile.playerId}/><VehicleActivities campus={campus}/><SlapRockActivity campus={campus} identity={profile.playerId}/><BuildingInteriors campus={campus} look={look} peers={demo.world.peers}/><Hud campus={campus} onEdit={onEdit} mode="life" onModes={onMenu}/><ActivityMenu campus={campus}/><PhotoBooth look={look} name={profile.displayName} friends={[...demo.world.peers.map(p=>({name:p.name,look:p.look})),...CLASSMATES]} shared={photoGame.session?.phase==='active'&&photoPeer?{host:photoGame.session.host,companion:{name:photoPeer.name,look:photoPeer.look},send:photoGame.transmit,leave:photoGame.leave}:undefined}/><ClassroomActivity globalLauncher/><LifeUI campus={campus} life={life} playerName={profile.displayName} onEdit={onEdit} players={selected=><DemoSocial demo={demo} onChallenge={game.start} onRock={rockGame.invite} onPhoto={photoGame.invite} onContest={contest.invite} selectedPlayer={selected}/>}/><ConnectChat world={demo.world}/><MultiplayerGamePanel game={game} peers={demo.world.peers} onlineIds={demo.world.onlineIds}/><RockChallengePanel game={rockGame} demo={demo}/><PhotoSessionPanel game={photoGame} demo={demo}/><NearbyPlayer peers={demo.world.peers}/><CasualStudentChat/><ScrappyChat playerName={profile.displayName}/><CampusContestPanel game={contest} demo={demo}/>
  </>
}

function OnlineCampus({campus,user,profile,onEdit,onMenu}:{campus:Campus;user:User;profile:NestProfile;onEdit:()=>void;onMenu:()=>void}){
 const world=useConnectWorld(user.id,profile.displayName)
 const look=profile.characterAppearance
 const social=useSocial(user.id)
 const multiplayerGame=useMultiplayerGame(user.id,world.onlineIds,world.sendGame,social.blocked)
 const offline=useOfflinePlayers(campus,user.id,world.onlineIds,world.status==='Connected')
 const peers=[...world.peers,...offline].filter(p=>!social.blocked.includes(p.id))
 const life=useLife(user.id,profile.displayName)
 return <><HardwarePanel/><Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}><color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/><hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={look} name={profile.displayName}/><CampusStudents campus={campus} minute={life.state.minute}/><ActivityWorld campus={campus}/><VehicleWorld campus={campus}/><OnlinePlayers peers={peers.filter(p=>p.location==='campus')}/></Canvas><CampusActivities campus={campus} identity={user.id}/><VehicleActivities campus={campus}/><SlapRockActivity campus={campus} identity={profile.playerId}/><BuildingInteriors campus={campus} look={look} peers={peers}/><Hud campus={campus} onEdit={onEdit} mode="life" onModes={onMenu}/><ActivityMenu campus={campus}/><PhotoBooth look={look} name={profile.displayName} friends={[...peers.filter(p=>p.online!==false).slice(0,6).map(p=>({name:p.name,look:p.look})),...CLASSMATES]}/><ClassroomActivity globalLauncher/><LifeUI campus={campus} life={life} playerName={profile.displayName} onEdit={onEdit}/><ConnectChat world={world}/><SocialPanel userId={user.id} peers={peers} onlineIds={world.onlineIds} social={social} wave={world.wave} allowRoaming={!user.is_anonymous} onChallenge={multiplayerGame.start}/><MultiplayerGamePanel game={multiplayerGame} peers={peers} onlineIds={world.onlineIds}/></>
}
