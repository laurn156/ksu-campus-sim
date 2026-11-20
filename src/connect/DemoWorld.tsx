import { useEffect, useRef, useState } from 'react'
import { player, type AvatarLook } from '../scene/Player'
import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import type { Peer, World, GamePacket } from './World'
import { validLook } from '../ui/nestProfile'
import { DEFAULT_PROFILE } from '../ui/Welcome'

type Direct={id:string;from:string;to:string;text:string}
type Event={type:string;id?:string;from?:string;to?:string;peer?:Peer;peers?:Peer[];name?:string;text?:string;payload?:GamePacket}
export function useDemoWorld(name:string,look:AvatarLook) {
 const [id,setId]=useState(''),[peers,setPeers]=useState<Peer[]>([]),[messages,setMessages]=useState<{id:string;name:string;text:string}[]>([]),[status,setStatus]=useState('Connecting…'),[requests,setRequests]=useState<string[]>([]),[sent,setSent]=useState<string[]>([]),[friends,setFriends]=useState<string[]>([]),[direct,setDirect]=useState<Direct[]>([])
 const socket=useRef<WebSocket|null>(null)
 const transmit=(data:object)=>{if(socket.current?.readyState!==WebSocket.OPEN)return false;socket.current.send(JSON.stringify(data));return true}
 useEffect(()=>{
  let alive=true,retry:ReturnType<typeof setTimeout>|undefined,ws:WebSocket
  const connect=()=>{
   if(!alive)return;setStatus('Connecting…');ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/demo-world`);socket.current=ws
   ws.onopen=()=>ws.send(JSON.stringify({type:'join',name,look}))
   ws.onmessage=e=>{let m:Event;try{m=JSON.parse(e.data)}catch{return}
    if(m.type==='welcome'&&m.id){setId(m.id);setPeers((m.peers??[]).map(p=>({...p,look:validLook(p.look)??DEFAULT_PROFILE.look}))); setStatus('Connected')}
    else if(m.type==='peer'&&m.peer){const p={...m.peer,look:validLook(m.peer.look)??DEFAULT_PROFILE.look};setPeers(old=>[...old.filter(x=>x.id!==p.id),p])}
    else if(m.type==='leave'&&m.id){const gone=m.id;setPeers(old=>old.filter(p=>p.id!==gone));setRequests(old=>old.filter(x=>x!==gone));setSent(old=>old.filter(x=>x!==gone));setFriends(old=>old.filter(x=>x!==gone))}
    else if(m.type==='chat'&&m.id&&m.name&&m.text){const {id,name,text}=m;setMessages(old=>[...old,{id,name,text}].slice(-50))}
    else if(m.type.startsWith('photo-'))window.dispatchEvent(new CustomEvent('demo-photo-message',{detail:m}))
    else if(m.type.startsWith('rock-'))window.dispatchEvent(new CustomEvent('demo-rock-message',{detail:m}))
    else if(m.type==='game'&&m.from&&m.payload)window.dispatchEvent(new CustomEvent('campus-game-packet',{detail:{from:m.from,payload:m.payload}}))
    else if(m.type==='friend-request'&&m.from){const from=m.from;setRequests(old=>old.includes(from)?old:[...old,from])}
    else if(m.type==='friend-sent'&&m.to){const to=m.to;setSent(old=>old.includes(to)?old:[...old,to])}
    else if(m.type==='friend-accepted'&&m.from){const from=m.from;setFriends(old=>old.includes(from)?old:[...old,from]);setRequests(old=>old.filter(x=>x!==from));setSent(old=>old.filter(x=>x!==from))}
    else if(m.type==='friend-declined'&&m.from){const from=m.from;setSent(old=>old.filter(x=>x!==from))}
    else if(m.type==='dm'&&m.id&&m.from&&m.to&&m.text){const {id,from,to,text}=m;setDirect(old=>[...old,{id,from,to,text}].slice(-100))}
   }
   ws.onclose=()=>{if(!alive)return;setStatus('Reconnecting…');setPeers([]);setRequests([]);setSent([]);setFriends([]);setId('');retry=setTimeout(connect,2000)}
  }
  connect();const interval=setInterval(()=>{const p=indoorState.active?indoorState:player;transmit({type:'move',x:p.x,y:indoorState.active?0:player.y,z:p.z,heading:p.heading,moving:p.moving,slapping:activityState.mode==='rock'&&performance.now()<activityState.throwUntil,location:indoorState.active?indoorState.location:'campus'})},200)
  return()=>{alive=false;clearInterval(interval);clearTimeout(retry);ws?.close();socket.current=null}
 },[name,look])
 const world:World={peers,onlineIds:peers.map(p=>p.id),messages,status,error:'',send:async text=>transmit({type:'chat',text}),wave:()=>{transmit({type:'wave'})},sendGame:packet=>transmit({type:'game',to:packet.to,packet})}
 return {id,world,requests,sent,friends,direct,transmit}
}
export type DemoWorld=ReturnType<typeof useDemoWorld>
export function DemoSocial({demo,onChallenge,onRock,onPhoto,selectedPlayer}:{demo:DemoWorld;onChallenge:(id:string)=>void;onRock:(id:string)=>void;onPhoto:(id:string)=>void;selectedPlayer:string}){
 const [selected,setSelected]=useState(selectedPlayer),[text,setText]=useState('')
 useEffect(()=>{setSelected(selectedPlayer)},[selectedPlayer])
 const peer=demo.world.peers.find(p=>p.id===selected)
 return <section className="phone-players"><h3>Campus players</h3><small>Demo session · friends and messages last while connected</small>{demo.world.peers.length===0?<p>No other players connected yet.</p>:demo.world.peers.map(p=><button key={p.id} onClick={()=>setSelected(p.id)}>● {p.name} {demo.requests.includes(p.id)?'· request':''}{demo.friends.includes(p.id)?' · friend':''}</button>)}{peer&&<div className="social-card"><h3>{peer.name} · online</h3>{demo.requests.includes(peer.id)?<><button onClick={()=>demo.transmit({type:'friend-accept',to:peer.id})}>Accept friend request</button><button onClick={()=>{demo.transmit({type:'friend-decline',to:peer.id});setSelected('')}}>Decline</button></>:demo.friends.includes(peer.id)?<p>Friends ✓</p>:<button disabled={demo.sent.includes(peer.id)} onClick={()=>demo.transmit({type:'friend-request',to:peer.id})}>{demo.sent.includes(peer.id)?'Request sent':'Add friend'}</button>}<button onClick={()=>onChallenge(peer.id)}>Play tic-tac-toe</button><button onClick={()=>onRock(peer.id)}>Challenge to Slap the Rock</button><button onClick={()=>onPhoto(peer.id)}>Invite to photo booth</button><div className="social-messages">{demo.direct.filter(m=>m.from===peer.id||m.to===peer.id).map(m=><p key={m.id}><b>{m.from===demo.id?'You':peer.name}:</b> {m.text}</p>)}</div><form onSubmit={e=>{e.preventDefault();if(text.trim()&&demo.transmit({type:'dm',to:peer.id,text})){setText('')}}}><input value={text} onChange={e=>setText(e.target.value)} maxLength={200} placeholder="Private message…" aria-label="Private message"/><button>Send</button></form></div>}</section>
}
