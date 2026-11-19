import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { installSfx } from './audio/sfx'
import { loadCampus, type Campus } from './campus'
import { CampusScene } from './scene/Campus'
import { Labels } from './scene/Labels'
import { Player, Sun } from './scene/Player'
import { Hud } from './ui/Hud'
import { Entry, ModeSelect, type Mode } from './ui/GameFlow'
import { CampusStudents } from './scene/Community'
import { Auth } from './connect/Auth'
import { supabase } from './connect/client'
import { useConnectWorld, OnlinePlayers, ConnectChat } from './connect/World'
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
  const [screen,setScreen] = useState<'entry'|'create'|'modes'|'play'>('entry')
  const [mode,setMode] = useState<Mode>('life')
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
      if(data){setUsername(data.username);const parsed=savedProfile(JSON.stringify({name:data.username,look:data.appearance}));setProfile(parsed??{...DEFAULT_PROFILE,name:data.username});setScreen('modes')}
      else {
        const name=String(next.user_metadata.username??'')
        if(!/^[A-Za-z0-9_]{3,24}$/.test(name)){setAuthError('Your account needs a valid username. Contact the demo organizer.');setAuthLoading(false);return}
        const initial={...DEFAULT_PROFILE,name,look:{...DEFAULT_PROFILE.look}}
        const {error:insertError}=await client.from('campus_profiles').insert({id:next.id,username:name,appearance:initial.look})
        if(insertError){setAuthError('Could not create your profile: '+insertError.message);setAuthLoading(false);return}
        setUsername(name);setProfile(initial);setScreen('create')
      }
      setGuest(false);setAuthLoading(false)
    }
    void client.auth.getSession().then(({data})=>apply(data.session?.user??null))
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>void apply(session?.user??null),0)})
    return()=>subscription.unsubscribe()
  },[])
  const create = (name:string) => {setUsername(name);setProfile({...DEFAULT_PROFILE,name,look:{...DEFAULT_PROFILE.look}});setScreen('create')}
  const login = (name:string) => {setUsername(name);setProfile(accounts[name]);setScreen('modes')}
  const saveCharacter = async () => {
    if(user&&supabase){const {error}=await supabase.from('campus_profiles').update({appearance:profile.look}).eq('id',user.id);if(error){setAuthError('Could not save your character: '+error.message);return}setAuthError('');setScreen('modes');return}
    const updated = {...accounts,[username]:profile}
    setAccounts(updated)
    try {localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(updated))} catch { /* session remains usable */ }
    setScreen('modes')
  }
  if(authLoading)return <div className="loading">Loading account…</div>
  if(recovery)return <main className="flow"><form className="entry-card" onSubmit={async e=>{e.preventDefault();const {error}=await supabase!.auth.updateUser({password:newPassword});if(error)setAuthError(error.message);else{setRecovery(false);setAuthError('')}}}><h2>Choose a new password</h2><input type="password" minLength={6} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><button className="flow-primary">Save password</button>{authError&&<p role="alert">{authError}</p>}</form></main>
  if(authError)return <main className="flow"><div className="entry-card"><p role="alert">{authError}</p><button onClick={()=>{setAuthError('');void supabase?.auth.signOut();setUser(null);setScreen('entry')}}>Back to login</button></div></main>
  if (screen === 'entry' && !guest && !user) return <Auth onGuest={()=>setGuest(true)}/>
  if (screen === 'entry') return <Entry users={Object.keys(accounts)} onLogin={login} onCreate={create}/>
  if (screen === 'create') return <Welcome screen="create" profile={profile} hasSaved={false} onChange={setProfile} onCreate={()=>{}} onPlay={saveCharacter} onBack={()=>setScreen(username && accounts[username] ? 'modes' : 'entry')}/>
  if (screen === 'modes') return <ModeSelect name={username} online={!!user} onSelect={m=>{setMode(m);setScreen('play')}} onEdit={()=>setScreen('create')} onLogout={()=>{if(user)void supabase?.auth.signOut();setUser(null);setGuest(false);setScreen('entry')}}/>
  if (!campus) return <div className="loading">Loading campus…</div>
  if (mode === 'life') return <LifeSession campus={campus} username={username} profile={profile} onEdit={()=>setScreen('create')} onModes={()=>setScreen('modes')} />
  if(!user)return <div className="loading">Please log in to use Connect.</div>
  return <ConnectSession campus={campus} user={user} profile={profile} username={username} onEdit={()=>setScreen('create')} onModes={()=>setScreen('modes')}/>

}

function LifeSession({campus,username,profile,onEdit,onModes}:{campus:Campus;username:string;profile:Profile;onEdit:()=>void;onModes:()=>void}) {
  const life=useLife(username,profile.name||username)
  return <>
    <Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}>
      <color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/>
      <hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={profile.look}/><CampusStudents campus={campus} minute={life.state.minute}/>
    </Canvas>
    <Hud campus={campus} onEdit={onEdit} mode="life" onModes={onModes}/><LifeUI campus={campus} life={life} playerName={profile.name||username} onEdit={onEdit}/>
  </>
}

function ConnectSession({campus,user,profile,username,onEdit,onModes}:{campus:Campus;user:User;profile:Profile;username:string;onEdit:()=>void;onModes:()=>void}){
 const [allowed,setAllowed]=useState<boolean|null>(null)
 useEffect(()=>{let live=true;void supabase!.from('campus_testers').select('id').eq('id',user.id).maybeSingle().then(({data})=>{if(live)setAllowed(!!data)});return()=>{live=false}},[user.id])
 if(allowed===null)return <div className="loading">Checking test access…</div>
 if(!allowed)return <main className="flow"><div className="entry-card"><h2>Limited testing</h2><p>This account has not been approved for the Connect test yet. Ask the organizer to enable access.</p><button onClick={onModes}>Back to modes</button></div></main>
 return <ConnectedCampus campus={campus} user={user} profile={profile} username={username} onEdit={onEdit} onModes={onModes}/>
}
function ConnectedCampus({campus,user,profile,username,onEdit,onModes}:{campus:Campus;user:User;profile:Profile;username:string;onEdit:()=>void;onModes:()=>void}){
 const world=useConnectWorld(user.id,username)
 return <><Canvas shadows="percentage" camera={{position:[0,40,40],fov:45,near:.5,far:3000}} dpr={[1,2]}><color attach="background" args={['#cfe3f0']}/><fog attach="fog" args={['#cfe3f0',180,900]}/><hemisphereLight args={['#e8f3ff','#8aa86a',1.1]}/><Sun/><CampusScene campus={campus}/><Labels campus={campus}/><Player campus={campus} look={profile.look}/><OnlinePlayers peers={world.peers}/></Canvas><Hud campus={campus} onEdit={onEdit} mode="connect" onModes={onModes}/><ConnectChat world={world}/></>
}
