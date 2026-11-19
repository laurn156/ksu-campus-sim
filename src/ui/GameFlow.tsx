import { useState } from 'react'
import './game-flow.css'

export type Mode = 'life' | 'connect'
type EntryProps = { users: string[]; onLogin: (name:string) => void; onCreate: (name:string) => void }
export function Entry({ users, onLogin, onCreate }: EntryProps) {
  const [tab,setTab] = useState<'login'|'create'>(users.length ? 'login' : 'create')
  const [name,setName] = useState('')
  const [error,setError] = useState('')
  const submit = () => {
    const clean = name.trim().replace(/\s+/g,' ')
    if (!/^[a-zA-Z0-9 _-]{2,24}$/.test(clean)) {setError('Use 2–24 letters, numbers, spaces, hyphens, or underscores.'); return}
    const existing = users.find(u => u.toLowerCase() === clean.toLowerCase())
    if (tab==='login' && !existing) {setError('No demo profile with that name on this browser yet. Create one first.');return}
    if (tab==='create' && existing) {setError('That demo name already exists on this browser. Choose Log in.');return}
    setError('')
    if (tab==='create') onCreate(clean); else onLogin(existing!)
  }
  return <main className="flow"><header className="flow-brand"><b>✦ &nbsp; KSU CAMPUS LIFE</b><span>MARIETTA CAMPUS</span></header>
    <section className="entry-layout"><div className="entry-intro"><div className="flow-kicker">YOUR CAMPUS ADVENTURE STARTS HERE</div><h1>Find your place<br/><em>in Owl Nation.</em></h1><p>Make a character, explore Marietta, and discover campus life your way.</p><div className="entry-illustration"><span>✦</span><strong>CAMPUS<br/>LIFE</strong><small>MADE FOR THE KSU COMMUNITY</small></div></div>
      <div className="entry-card"><div className="entry-tabs"><button aria-pressed={tab==='login'} onClick={() => {setTab('login');setError('')}}>Log in</button><button aria-pressed={tab==='create'} onClick={() => {setTab('create');setError('')}}>Create profile</button></div>
        <h2>{tab==='login'?'Welcome back!':'Let’s get started.'}</h2><p>{tab==='login'?'Continue your campus adventure.':'Choose a demo name for your character.'}</p>
        <label htmlFor="demo-name">Demo username</label><input id="demo-name" autoComplete="off" value={name} maxLength={24} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit()}} placeholder="e.g. OwlExplorer" />
        {tab==='login' && users.length>0 && <div className="saved-names">Saved on this browser: {users.map(u => <button key={u} onClick={() => setName(u)}>{u}</button>)}</div>}
        {error && <p className="flow-error" role="alert">{error}</p>}<button className="flow-primary" onClick={submit}>{tab==='login'?'Continue':'Create profile'} <span>→</span></button>
        <div className="flow-note"><b>DEMO MODE</b> Profiles are stored only in this browser. Use a made-up name; there’s no password or real account yet.</div></div></section>
  </main>
}
export function ModeSelect({ name, onSelect, onEdit, onLogout, online }: { name:string; onSelect:(mode:Mode)=>void; onEdit:()=>void; onLogout:()=>void; online:boolean }) {
  return <main className="flow"><header className="flow-brand"><b>✦ &nbsp; KSU CAMPUS LIFE</b><span>{name} &nbsp; · &nbsp; <button onClick={onLogout}>Switch profile</button></span></header>
    <section className="mode-page"><div className="flow-kicker">YOUR ADVENTURE, YOUR CHOICE</div><h1>Choose your experience.</h1><p>Two ways to explore campus life in Marietta.</p>
      <div className="mode-cards"><article className="mode-card"><div className="mode-art life-art"><span>✦</span><b>CAMPUS<br/>LIFE</b><small>A DAY AT KSU</small></div><div className="mode-content"><div className="mode-tag">SINGLE PLAYER</div><h2>Campus Life</h2><p>Meet students, explore campus, and choose how to spend your day.</p><button className="flow-primary" onClick={()=>onSelect('life')}>Play Campus Life <span>→</span></button></div></article>
      <article className="mode-card"><div className="mode-art connect-art"><span>✳</span><b>KSU<br/>CONNECT</b><small>EXPLORE TOGETHER</small></div><div className="mode-content"><div className="mode-tag">LIMITED ONLINE TEST</div><h2>KSU Connect</h2><p>Meet other approved testers on the shared campus. A real account is required.</p><button className="flow-primary green" disabled={!online} onClick={()=>onSelect('connect')}>{online?'Play KSU Connect':'Log in to play KSU Connect'} <span>→</span></button></div></article></div>
      <button className="flow-link" onClick={onEdit}>✦ Edit your character</button></section>
  </main>
}

