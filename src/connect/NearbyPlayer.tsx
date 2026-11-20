import { useEffect, useRef, useState } from 'react'
import { player } from '../scene/Player'
import { indoorState } from '../scene/indoorState'
import { activityState } from '../activities/activityState'
import { community } from '../scene/Community'
import { scrappy } from '../scene/Scrappy'
import type { Peer } from './World'

type Target={kind:'player'|'student'|'ambient'|'patio'|'indoor'|'scrappy';id:string|number;name:string;distance:number}
export function NearbyPlayer({peers}:{peers:Peer[]}){
 const peersRef=useRef(peers);peersRef.current=peers
 const [nearest,setNearest]=useState<Target|null>(null)
 const find=():Target|null=>{
  if(activityState.locked||activityState.mode||indoorState.activity||indoorState.talkingNpc!==null||player.view||document.querySelector('[aria-modal="true"]'))return null
  const pos=indoorState.active?indoorState:player,location=indoorState.active?indoorState.location:'campus',candidates:Target[]=[]
  peersRef.current.filter(p=>p.location===location).forEach(p=>{const distance=Math.hypot(p.x-pos.x,p.z-pos.z);if(distance<6)candidates.push({kind:'player',id:p.id,name:p.name,distance})})
  if(indoorState.active)indoorState.npcPositions.forEach(([x,z],i)=>{const distance=Math.hypot(x-pos.x,z-pos.z),id=indoorState.npcIds[i];if(distance<2.6&&id!==undefined)candidates.push({kind:'indoor',id,name:'student',distance})})
  else{
   community.students.forEach(p=>{const distance=Math.hypot(p.x-pos.x,p.z-pos.z);if(distance<5)candidates.push({kind:'student',id:p.id,name:'student',distance})})
   community.ambient.forEach((p,id)=>{const distance=Math.hypot(p.x-pos.x,p.z-pos.z);if(distance<5)candidates.push({kind:'ambient',id,name:'student',distance})})
   community.patio.forEach((p,id)=>{const distance=Math.hypot(p.x-pos.x,p.z-pos.z);if(distance<5)candidates.push({kind:'patio',id,name:'student',distance})})
   const distance=Math.hypot(scrappy.x-pos.x,scrappy.z-pos.z);if(distance<5)candidates.push({kind:'scrappy',id:'scrappy',name:'Scrappy',distance})
  }
  return candidates.sort((a,b)=>a.distance-b.distance)[0]??null
 }
 const open=()=>{const p=find();if(!p)return;const event=p.kind==='player'?'connect-player':p.kind==='student'?'open-student':p.kind==='scrappy'?'open-scrappy':'open-casual-student';window.dispatchEvent(new CustomEvent(event,{detail:p.kind==='ambient'||p.kind==='indoor'||p.kind==='patio'?{kind:p.kind,id:p.id}:p.id}))}
 useEffect(()=>{const timer=setInterval(()=>{const p=find();setNearest(old=>old?.id===p?.id&&old?.kind===p?.kind?old:p)},200);const key=(e:KeyboardEvent)=>{if(e.key.toLowerCase()!=='t'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLElement&&e.target.isContentEditable)return;if(find()){e.preventDefault();open()}};window.addEventListener('keydown',key);return()=>{clearInterval(timer);window.removeEventListener('keydown',key)}},[])
 return nearest?<button className="nearby-player-prompt" onClick={open}>Press <b>T</b> to talk to {nearest.name}</button>:null
}
