import { useEffect, useRef, useState } from 'react'
import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import type { DemoWorld } from './DemoWorld'

type Session={id:string;peer:string;phase:'incoming'|'waiting'|'active'|'left';host:boolean}
export function usePhotoSession(demo:DemoWorld){
 const [session,setSession]=useState<Session|null>(null),[notice,setNotice]=useState(''),ref=useRef<Session|null>(null),send=useRef(demo.transmit);send.current=demo.transmit
 const change=(s:Session|null)=>{ref.current=s;setSession(s)}
 const invite=(peer:string)=>{if(ref.current){setNotice('Finish your current photo session first.');return}if(!send.current({type:'photo-invite',to:peer}))setNotice('Connect to campus first.');else setNotice('Sending photo invitation…')}
 const leave=()=>{const s=ref.current;if(s)send.current({type:'photo-leave',session:s.id});change(null);setNotice('')}
 useEffect(()=>{
  const message=(event:Event)=>{const m=(event as CustomEvent).detail as {type:string;session:string;from:string;host:boolean;state:unknown};const current=ref.current
   if(m.type==='photo-invite'){if(current){send.current({type:'photo-leave',session:m.session});return}setNotice('');change({id:m.session,peer:m.from,phase:'incoming',host:false});return}
   if(m.type==='photo-unavailable'){setNotice('That player is already in a photo session.');return}
   if(m.type==='photo-wait'){setNotice('');change({id:m.session,peer:m.from,phase:'waiting',host:true});return}
   if(!current||current.id!==m.session)return
   if(m.type==='photo-start'){if(activityState.mode||activityState.locked||indoorState.active){send.current({type:'photo-leave',session:m.session});change(null);setNotice('Exit your current activity before opening the photo booth.');return}window.dispatchEvent(new Event('close-phone'));change({...current,phase:'active',host:m.host});return}
   if(m.type==='photo-ready')window.dispatchEvent(new Event('shared-photo-ready'))
   if(m.type==='photo-state')window.dispatchEvent(new CustomEvent('shared-photo-state',{detail:m.state}))
   if(m.type==='photo-shoot')window.dispatchEvent(new Event('shared-photo-shoot'))
   if(m.type==='photo-left'){if(current.phase==='active')window.dispatchEvent(new Event('close-shared-photo'));change({...current,phase:'left'});return}
  }
  window.addEventListener('demo-photo-message',message);return()=>window.removeEventListener('demo-photo-message',message)
 },[])
 const accept=()=>{const s=ref.current;if(!s)return;if(activityState.mode||activityState.locked||indoorState.active){setNotice('Exit your current activity first.');return}send.current({type:'photo-accept',session:s.id})}
 const transmit=(type:'photo-state'|'photo-shoot'|'photo-ready',state?:unknown)=>{const s=ref.current;if(s?.phase==='active'&&(s.host||type==='photo-ready'))send.current({type,session:s.id,state})}
 return {session,notice,invite,accept,leave,transmit}
}
export function PhotoSessionPanel({game,demo}:{game:ReturnType<typeof usePhotoSession>;demo:DemoWorld}){
 const s=game.session;if(!s)return game.notice?<div className="match-note" role="status">{game.notice}</div>:null
 if(s.phase==='active')return null
 const name=demo.world.peers.find(p=>p.id===s.peer)?.name??'The other player'
 return <section className="match-panel" role="dialog" aria-label="Photo invitation"><header><strong>📸 Photo booth · {name}</strong><button onClick={game.leave}>Close</button></header>{s.phase==='incoming'?<><p>{name} invited you to take a picture together.</p>{game.notice&&<p>{game.notice}</p>}<button onClick={game.accept}>Join photo</button> <button onClick={game.leave}>Decline</button></>:<p>{s.phase==='waiting'?`Waiting for ${name}…`:`${name} left the photo session.`}</p>}</section>
}
