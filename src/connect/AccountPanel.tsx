import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './client'

type Props={onClose:()=>void;onSignedIn:(user:User)=>Promise<void>;onSignedOut:()=>void}
export function AccountPanel({onClose,onSignedIn,onSignedOut}:Props){
 const [mode,setMode]=useState<'login'|'signup'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[username,setUsername]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[account,setAccount]=useState<User|null>(null)
 useEffect(()=>{if(supabase)void supabase.auth.getSession().then(({data})=>setAccount(data.session?.user??null))},[])
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setMessage('');try{
  if(mode==='signup'){
   const name=username.trim();if(!/^[A-Za-z0-9_]{3,24}$/.test(name))throw Error('Choose a username with 3–24 letters, numbers or underscores.')
   const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{username:name}}});if(error)throw error
   if(data.session&&data.user){await onSignedIn(data.user);onClose()}else setMessage('Check your email to confirm your account, then sign in here.')
  }else{const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;if(!data.user)throw Error('Sign-in did not return an account.');await onSignedIn(data.user);onClose()}
 }catch(error){setMessage(error instanceof Error?error.message:'Could not connect to the account service.')}finally{setBusy(false)}}
 const signOut=async()=>{if(!supabase)return;setBusy(true);const {error}=await supabase.auth.signOut();setBusy(false);if(error)setMessage(error.message);else{setAccount(null);onSignedOut();setMessage('Signed out.')}}
 return <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="Online account"><section className="menu-card account-card"><header><h2>Online account</h2><button onClick={onClose}>Close</button></header><p>Sign in to meet other players, chat and keep your friends across sessions.</p>{account&&!account.is_anonymous?<><p>Signed in as {account.email??'a campus player'}.</p><button disabled={busy} onClick={()=>void signOut()}>Sign out</button></>:<><div className="account-tabs"><button aria-pressed={mode==='login'} onClick={()=>{setMode('login');setMessage('')}}>Sign in</button><button aria-pressed={mode==='signup'} onClick={()=>{setMode('signup');setMessage('')}}>Create account</button></div><form onSubmit={e=>void submit(e)}>{mode==='signup'&&<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} maxLength={24} required autoComplete="username"/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required autoComplete={mode==='signup'?'new-password':'current-password'}/></label><button disabled={busy}>{busy?'Connecting…':mode==='login'?'Sign in':'Create account'}</button></form></>}{message&&<p role="status">{message}</p>}</section></div>
}
