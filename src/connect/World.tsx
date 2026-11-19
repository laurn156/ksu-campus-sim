import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Character } from '../characters/Character'
import { player, type AvatarLook } from '../scene/Player'
import { supabase } from './client'
import { DEFAULT_PROFILE } from '../ui/Welcome'
import './connect.css'
type Peer={id:string;name:string;look:AvatarLook;x:number;z:number;heading:number;moving:boolean}
type Chat={id:string;name:string;text:string}
type World={peers:Peer[];messages:Chat[];status:string;send:(text:string)=>void;error:string}
export function useConnectWorld(userId:string,username:string):World {
 const [peers,setPeers]=useState<Peer[]>([]),[messages,setMessages]=useState<Chat[]>([]),[status,setStatus]=useState('Connecting…'),[error,setError]=useState('')
 const sendRef=useRef<(text:string)=>void>(()=>{}),lastChat=useRef(0)
 useEffect(()=>{
  if(!supabase)return
  const client=supabase,channels=new Map<string,RealtimeChannel>(),presence=client.channel('campus-presence',{config:{private:true,presence:{key:userId}}}), own=client.channel('campus-player:'+userId,{config:{private:true}})
  let alive=true,joined=false
  const synchronize=()=>{
   const ids=new Set(Object.keys(presence.presenceState()).filter(id=>id!==userId && /^[0-9a-f-]{36}$/i.test(id)))
   for(const [id,ch] of channels)if(!ids.has(id)){void client.removeChannel(ch);channels.delete(id);setPeers(p=>p.filter(x=>x.id!==id))}
   for(const id of ids)if(!channels.has(id)){
    const ch=client.channel('campus-player:'+id,{config:{private:true}});channels.set(id,ch)
    void client.from('campus_profiles').select('username,appearance').eq('id',id).maybeSingle().then(({data})=>{
     if(!alive||!data||!channels.has(id))return
     const name=String(data.username).slice(0,24),raw=data.appearance as Partial<AvatarLook>|null
     if(!raw || typeof raw!=='object')return
     const allowed=(value:unknown,options:string[],fallback:string)=>typeof value==='string'&&options.includes(value)?value:fallback
     const look={...DEFAULT_PROFILE.look,...raw,
      color:allowed(raw.color,['orange','yellow','cream','green','blue','purple','slate','charcoal'],'blue'),
      headwear:allowed(raw.headwear,['none','cap','beanie','bucket','headphones','headband'],'none'),
      face:allowed(raw.face,['happy','dots','wink','surprised','angry'],'happy'),
      accessory:allowed(raw.accessory,['none','glasses','square','rectangle'],'none'),
      top:allowed(raw.top,['none','tee','hoodie','ksu-tee','ksu-hoodie','jersey'],'none'),
      bottom:allowed(raw.bottom,['none','shorts','skirt','pants'],'none'),
      shoes:allowed(raw.shoes,['none','sneakers','black'],'none'),bag:allowed(raw.bag,['none','black','cream','brown'],'none'),
      topColor:typeof raw.topColor==='string'&&/^#[0-9a-f]{6}$/i.test(raw.topColor)?raw.topColor:'#29292c',
      bottomColor:typeof raw.bottomColor==='string'&&/^#[0-9a-f]{6}$/i.test(raw.bottomColor)?raw.bottomColor:'#4e526b',
      jerseyNumber:typeof raw.jerseyNumber==='string'&&/^\d{1,2}$/.test(raw.jerseyNumber)?raw.jerseyNumber:'12',backpack:false} as AvatarLook
     ch.on('broadcast',{event:'move'},({payload})=>{
      if(!Number.isFinite(payload?.x)||!Number.isFinite(payload?.z)||!Number.isFinite(payload?.heading)||Math.abs(payload.x)>10000||Math.abs(payload.z)>10000)return
      setPeers(old=>[...old.filter(p=>p.id!==id),{id,name,look,x:payload.x,z:payload.z,heading:payload.heading,moving:payload.moving===true}])
     }).on('broadcast',{event:'chat'},({payload})=>{
      if(typeof payload?.text!=='string')return;const text=payload.text.trim().slice(0,200);if(!text)return
      setMessages(old=>[...old,{id:crypto.randomUUID(),name,text}].slice(-50))
     }).subscribe()
    })
   }
  }
  presence.on('presence',{event:'sync'},synchronize).subscribe(async state=>{
   if(!alive)return
   if(state==='SUBSCRIBED'){await presence.track({online:true});setStatus('Connected · limited test')}
   else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){setStatus('Disconnected · reconnecting');setPeers([])}
  })
  own.subscribe(state=>{joined=state==='SUBSCRIBED'})
  const interval=setInterval(()=>{if(joined)void own.send({type:'broadcast',event:'move',payload:{x:player.x,z:player.z,heading:player.heading,moving:player.moving}})},200)
  sendRef.current=(raw)=>{const text=raw.trim().slice(0,200);if(!text)return;if(!joined){setError('Chat is disconnected.');return}if(Date.now()-lastChat.current<1500){setError('Please wait a moment before sending another message.');return}lastChat.current=Date.now();setError('');void own.send({type:'broadcast',event:'chat',payload:{text}});setMessages(old=>[...old,{id:crypto.randomUUID(),name:username,text}].slice(-50))}
  return()=>{alive=false;clearInterval(interval);sendRef.current=()=>{};void presence.untrack();void client.removeChannel(presence);void client.removeChannel(own);for(const ch of channels.values())void client.removeChannel(ch)}
 },[userId,username])
 return {peers,messages,status,send:text=>sendRef.current(text),error}
}
function Remote({peer}:{peer:Peer}){
 const ref=useRef<THREE.Group>(null),walk=useRef(0)
 useFrame((_,dt)=>{if(ref.current){ref.current.position.lerp(new THREE.Vector3(peer.x,0,peer.z),Math.min(1,dt*10));ref.current.rotation.y=peer.heading}walk.current=THREE.MathUtils.lerp(walk.current,peer.moving?.75:0,Math.min(1,dt*8))})
 return <group ref={ref} position={[peer.x,0,peer.z]}><Character {...peer.look} walk={walk} scale={1.15}/><Html position={[0,2,0]} center distanceFactor={18}><div className="student-label">● {peer.name}</div></Html></group>
}
export function OnlinePlayers({peers}:{peers:Peer[]}){return <>{peers.map(p=><Remote key={p.id} peer={p}/>)}</>}
export function ConnectChat({world}:{world:World}){const [open,setOpen]=useState(true),[text,setText]=useState('');return <div className="connect-chat"><button onClick={()=>setOpen(!open)}>💬 Campus chat {open?'−':'+'}</button><small>{world.status} · {world.peers.length} other players</small>{open&&<><div className="connect-messages">{world.messages.length===0?<p>No messages yet. Say hello!</p>:world.messages.map(m=><p key={m.id}><b>{m.name}:</b> {m.text}</p>)}</div><form onSubmit={e=>{e.preventDefault();if(text.trim()){world.send(text);setText('')}}}><input aria-label="Campus chat message" maxLength={200} value={text} onChange={e=>setText(e.target.value)} placeholder="Message everyone…"/><button>Send</button></form>{world.error&&<small role="alert">{world.error}</small>}</>}</div>}
