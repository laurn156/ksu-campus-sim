import { useEffect, useRef, useState } from 'react'
import { player } from '../scene/Player'
import { indoorState } from '../scene/indoorState'
import { activityState } from '../activities/activityState'
import type { Peer } from './World'

export function NearbyPlayer({peers}:{peers:Peer[]}){
 const peersRef=useRef(peers);peersRef.current=peers
 const [nearest,setNearest]=useState<Peer|null>(null)
 const find=()=>{if(activityState.locked||activityState.mode||player.view||document.querySelector('[aria-modal="true"]'))return null;const pos=indoorState.active?indoorState:player,location=indoorState.active?indoorState.location:'campus';return peersRef.current.filter(p=>p.location===location).map(p=>({p,d:Math.hypot(p.x-pos.x,p.z-pos.z)})).filter(x=>x.d<6).sort((a,b)=>a.d-b.d)[0]?.p??null}
 const open=()=>{const p=find();if(p)window.dispatchEvent(new CustomEvent('connect-player',{detail:p.id}))}
 useEffect(()=>{const timer=setInterval(()=>{const p=find();setNearest(old=>old?.id===p?.id?old:p)},250);const key=(e:KeyboardEvent)=>{if(e.key.toLowerCase()!=='t'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;const p=find();if(p){e.preventDefault();window.dispatchEvent(new CustomEvent('connect-player',{detail:p.id}))}};window.addEventListener('keydown',key);return()=>{clearInterval(timer);window.removeEventListener('keydown',key)}},[])
 return nearest?<button className="nearby-player-prompt" onClick={open}>Press <b>T</b> to talk to {nearest.name}</button>:null
}
