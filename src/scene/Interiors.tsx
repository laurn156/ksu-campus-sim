import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { distToSeg, type Building, type Campus } from '../campus'
import { player, type AvatarLook } from './Player'
import './interiors.css'
import { indoorState } from './indoorState'
import { DetailedRoom, type InteriorKind } from './DetailedInteriors'
import { OnlinePlayers, type Peer } from '../connect/World'

function interiorKind(b: Building): InteriorKind {
  const n=(b.name+' '+b.short+' '+b.kind).toLowerCase()
  if (b.code==='A') return 'student'
  if (b.code==='P60'||/parking|deck|garage parking/.test(n)) return 'parking'
  if (n.includes('greenhouse')) return 'greenhouse'
  if (n.includes('hornet hub') || b.id==='1504299650' || b.code==='O' || n.includes('competition')) return 'garage'
  if (b.code==='S1'||b.code==='S2'||n.includes('recreation')||n.includes('gymnasium')) return 'recreation'
  if (b.code==='C'||n.includes('library')) return 'library'
  if (/dormitory|apartments|residence|hornet village|courtyard|commons|columns/.test(n)) return 'dorm'
  if (b.code==='X'||/dining|stingers/.test(n)) return 'dining'
  if (/lab|engineering|innovation|textile|architecture|design|science|soils/.test(n)||['Q','G','E','L','L1','I1','I2','M','N'].includes(b.code)) return 'lab'
  if (/admin|office|housing|uits/.test(n)||b.code==='B') return 'office'
  return 'classroom'
}
function Room({building,look}:{building:Building;look:AvatarLook}) {
 return <DetailedRoom kind={interiorKind(building)} look={look}/>
}
export function BuildingInteriors({campus,look,peers=[]}:{campus:Campus;look:AvatarLook;peers?:Peer[]}) {
 const [near,setNear]=useState<Building|null>(null),[inside,setInside]=useState<Building|null>(null)
 useEffect(()=>{const id=setInterval(()=>{if(indoorState.active||player.view||player.busRide){setNear(null);return}let best:Building|null=null,dist=10;for(const b of campus.buildings)for(let i=0,j=b.poly.length-1;i<b.poly.length;j=i++){const d=distToSeg(player.x,player.z,b.poly[j],b.poly[i]);if(d<dist){dist=d;best=b}}setNear(old=>old?.id===best?.id?old:best)},200);return()=>clearInterval(id)},[campus])
 useEffect(()=>()=>{indoorState.active=false;indoorState.location='campus'},[])
 const enter=()=>{if(!near)return;indoorState.location='building:'+near.id;indoorState.x=0;indoorState.z=9;indoorState.active=true;setInside(near)}
 const exit=()=>{indoorState.active=false;indoorState.location='campus';setInside(null)}
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.key==='Escape'&&inside)exit();else if(e.key.toLowerCase()==='g'&&!inside&&near)enter()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[inside,near])
 return <>{!inside&&near&&<div className="enter-building"><span>{near.short||near.name||'Building'}</span><button onClick={enter}>Go inside <kbd>G</kbd></button></div>}{inside&&<div className="interior-screen"><Canvas camera={{position:[12,19,24],fov:45,near:.1,far:150}}><Room building={inside} look={look}/><OnlinePlayers peers={peers.filter(p=>p.location===`building:${inside.id}`)}/></Canvas><div className="interior-header"><div><small>INSIDE</small><strong>{inside.short||inside.name||'Building'}</strong></div><button onClick={exit}>← Exit building</button></div><div className="interior-controls"><b>WASD</b> move · <b>Shift</b> run · <b>Esc</b> exit</div></div>}</>
}
