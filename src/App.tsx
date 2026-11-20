import { ActivityWorld, CampusActivities } from './activities/CampusActivities'
import { ActivityMenu } from './activities/ActivityMenu'
import { VehicleWorld, VehicleActivities } from './activities/VehicleActivities'
import { ParkingWorld, ParkingActivities } from './activities/ParkingActivities'
import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { installSfx } from './audio/sfx'
import { loadCampus, type Campus } from './campus'
import { CampusScene } from './scene/Campus'
import { Labels } from './scene/Labels'
import { Player, Sun } from './scene/Player'
import { BuildingInteriors } from './scene/Interiors'
import { Hud } from './ui/Hud'
import { Entry } from './ui/GameFlow'
import { CampusStudents } from './scene/Community'
import { Auth } from './connect/Auth'
import { supabase } from './connect/client'
import { useConnectWorld, OnlinePlayers, ConnectChat } from './connect/World'
import { useSocial, SocialPanel } from './connect/Social'
import { useOfflinePlayers } from './connect/OfflineFriends'
import type { User } from '@supabase/supabase-js'
import { useLife } from './life/useLife'
import { LifeUI } from './life/LifeUI'
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
  const [screen,setScreen] = useState<'entry'|'create'|'play'>('entry')
  const [user,setUser]=useState<User|null>(null),[guest,setGuest]=useState(false),[authLoading,setAuthLoading]=useState(!!supabase),[authError,setAuthError]=useState(''),[recovery,setRecovery]=useState(false),[newPassword,setNewPassword]=useState('')
  useEffect(() => { loadCampus().then(setCampus); installSfx() }, [])
  useEffect(()=>{
    if(!supabase)return
    const client=supabase
    const apply=async(next:User|null)=>{
      setUser(next);setAuthError('')
      if(!next){setAuthLoading(false);return}
      setAuthLoading(true)
      const {data,error}=await client.from('campus_profiles').select('username,appearance').eq('id',next.id).maybeSingle()
      if(error){setAuthError(error.message);setAuthLoading(false);return}
      if(data){setUsername(data.username);const parsed=savedProfile(JSON.stringify({name:data.username,look:data.appearance}));setProfile(parsed??{...DEFAULT_PROFILE,name:data.username});setScreen('play')}
      else {
        const name=String(next.user_metadata.username??'')
        if(!/^[A-Za-z0-9_]{3,24}$/.test(name)){setAuthError('Your account needs a valid username. Contact the demo organizer.');setAuthLoading(false);return}
        const initial={...DEFAULT_PROFILE,name,look:{...DEFAULT_PROFILE.look}}
        const {error:insertError}=await client.from('campus_profiles').insert({id:next.id,username:name,appearance:initial.look})
        if(insertError){setAuthError(insertError.code==='23505'?'That name is already taken. Go back and choose another name.':'Could not create your profile: '+insertError.message);setAuthLoading(false);return}
        setUsername(name);setProfile(initial);setScreen('create')
      }
      setGuest(false);setAuthLoading(false)
    }
    void client.auth.getSession().then(({data})=>apply(data.session?.user??null))
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>void apply(session?.user??null),0)})
    return()=>subscription.unsubscribe()
  },[])
  const create = (name:string) => {setUsername(name);setProfile({...DEFAULT_PROFILE,name,look:{...DEFAULT_PROFILE.look}});setScreen('create')}
  const login = (name:string) => {setUsername(name);setProfile(accounts[name]);setScreen('play')}
  const saveCharacter = async () => {
    if(user&&supabase){const {error}=await supabase.from('campus_profiles').update({appearance:profile.look}).eq('id',user.id);if(error){setAuthError('Could not save your character: '+error.message);return}setAuthError('');setScreen('play');return}
    const updated = {...accounts,[username]:profile}
    setAccounts(updated)
    try {localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(updated))} catch { /* session remains usable */ }
    setScreen('play')
  }
  if(authLoading)return <div className="loading">Loading account…</div>
  if(recovery)return <main className="flow"><form className="entry-card" onSubmit={async e=>{e.preventDefault();const {error}=await supabase!.auth.updateUser({password:newPassword});if(error)setAuthError(error.message);else{setRecovery(false);setAuthError('')}}}><h2>Choose a new password</h2><input type="password" minLength={6} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><button className="flow-primary">Save password</button>{authError&&<p role="alert">{authError}</p>}</form></main>
  if(authError)return <main className="flow"><div className="entry-card"><p role="alert">{authError}</p><button onClick={()=>{setAuthError('');void supabase?.auth.signOut();setUser(null);setScreen('entry')}}>Back to login</button></div></main>
  if (screen === 'entry' && !guest && !user) return <Auth onGuest={()=>setGuest(true)}/>
  if (screen === 'entry') return <Entry users={Object.keys(accounts)} onLogin={login} onCreate={create}/>
  if (screen === 'create') return <Welcome screen="create" profile={profile} hasSaved={false} onChange={setProfile} onCreate={()=>{}} onPlay={saveCharacter} onBack={()=>setScreen(user || (username && accounts[username]) ? 'play' : 'entry')}/>
  if (!campus) return <div className="loading">Loading campus…</div>
  const logout=()=>{if(user)void supabase?.auth.signOut();setUser(null);setGuest(false);setScreen('entry')}
  return user ? <OnlineCampus campus={campus} user={user} profile={profile} username={username} onEdit={()=>setScreen('create')} onLogout={logout}/> : <LifeSession campus={campus} username={username} profile={profile} onEdit={()=>setScreen('create')} onModes={logout}/>

}

function LifeSession({campus,username,profile,onEdit,onModes}:{campus:Campus;username:string;profile:Profile;onEdit:()=>void;onModes:()=>void}) {
  const life=useLife(username,profile.name||username)
  return <>
    <Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}>
      <color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/>
      <hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={profile.look}/><CampusStudents campus={campus} minute={life.state.minute}/><ActivityWorld campus={campus}/><VehicleWorld campus={campus}/><ParkingWorld campus={campus}/>
    </Canvas>
    <CampusActivities campus={campus} identity={username}/><VehicleActivities campus={campus}/><ParkingActivities campus={campus}/><BuildingInteriors campus={campus} look={profile.look}/><Hud campus={campus} onEdit={onEdit} mode="life" onModes={onModes}/><ActivityMenu campus={campus}/><LifeUI campus={campus} life={life} playerName={profile.name||username} onEdit={onEdit}/>
  </>
}

function OnlineCampus({campus,user,profile,username,onEdit,onLogout}:{campus:Campus;user:User;profile:Profile;username:string;onEdit:()=>void;onLogout:()=>void}){
 const world=useConnectWorld(user.id,username)
 const social=useSocial(user.id)
 const offline=useOfflinePlayers(campus,user.id,world.onlineIds,world.status==='Connected')
 const peers=[...world.peers,...offline].filter(p=>!social.blocked.includes(p.id))
 const life=useLife(username,profile.name||username)
 return <><Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}><color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/><hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={profile.look}/><CampusStudents campus={campus} minute={life.state.minute}/><ActivityWorld campus={campus}/><VehicleWorld campus={campus}/><ParkingWorld campus={campus}/><OnlinePlayers peers={peers.filter(p=>p.location==='campus')}/></Canvas><CampusActivities campus={campus} identity={user.id}/><VehicleActivities campus={campus}/><ParkingActivities campus={campus}/><BuildingInteriors campus={campus} look={profile.look} peers={peers}/><Hud campus={campus} onEdit={onEdit} mode="life" onModes={onLogout}/><ActivityMenu campus={campus}/><LifeUI campus={campus} life={life} playerName={profile.name||username} onEdit={onEdit}/><ConnectChat world={world}/><SocialPanel userId={user.id} peers={peers} onlineIds={world.onlineIds} social={social} wave={world.wave} allowRoaming={!user.is_anonymous}/></>
}
