import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { type Building, type Campus } from '../campus'
import { nearbyInterior } from './nearbyInterior'
import { player, type AvatarLook } from './Player'
import { busPositions } from './Buses'
import './interiors.css'
import { indoorState } from './indoorState'
import { DetailedRoom, type InteriorKind } from './DetailedInteriors'
import { OnlinePlayers, type Peer } from '../connect/World'

function interiorKind(b: Building): InteriorKind {
  const n=(b.name+' '+b.short+' '+b.kind).toLowerCase()
  if (b.code==='A') return 'student'
  if (b.code==='B') return 'admin'
  if (b.code==='D') return 'math'
  if (b.code==='E') return 'crawford'
  if (b.code==='G') return 'engineering'
  if (b.code==='H') return 'academic'
  if (b.code==='I1') return 'design1'
  if (b.code==='I2') return 'design2'
  if (b.code==='J') return 'atrium'
  if (b.code==='L') return 'civil'
  if (b.code==='L1') return 'soils'
  if (b.code==='M') return 'textile'
  if (b.code==='N') return 'architecture'
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
 const [nearUits,setNearUits]=useState(false),[insideUits,setInsideUits]=useState(false),[insideBus,setInsideBus]=useState(false)
 useEffect(()=>{const id=setInterval(()=>{if(indoorState.active||player.view||player.busRide){setNear(null);setNearUits(false);return}setNearUits(Math.hypot(player.x+135.2,player.z+49.5)<7);const best=nearbyInterior(campus.buildings,player.x,player.z);setNear(old=>old?.id===best?.id?old:best)},200);return()=>clearInterval(id)},[campus])
 useEffect(()=>()=>{indoorState.active=false;indoorState.location='campus'},[])
 const enter=()=>{const b=nearUits?(campus.buildings.find(b=>b.code==='H')??near):near;if(!b)return;indoorState.location=nearUits?'building:uits':'building:'+b.id;indoorState.x=0;indoorState.z=nearUits?6:9;indoorState.active=true;setInsideUits(nearUits);setInside(b)}
 const exit=()=>{if(insideBus&&player.busRide){const bus=busPositions[player.busRide.index];if(bus){player.x=bus.x+Math.cos(bus.h)*3.2;player.z=bus.z-Math.sin(bus.h)*3.2}player.busRide=null};indoorState.active=false;indoorState.location='campus';setInside(null);setInsideUits(false);setInsideBus(false)}
 useEffect(()=>{const id=setInterval(()=>{if(player.busRide&&!indoorState.active){indoorState.location='bus:'+player.busRide.index;indoorState.x=0;indoorState.z=9;indoorState.active=true;setInsideBus(true)}},150);return()=>clearInterval(id)},[])
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(e.key==='Escape'&&(inside||insideBus))exit();else if(e.key.toLowerCase()==='g'&&!inside&&!insideBus&&(near||nearUits))enter()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[inside,near,nearUits,insideBus])
 return <>{!inside&&!insideBus&&(near||nearUits)&&<div className="enter-building"><span>{nearUits?'UITS':near?.short||near?.name||'Building'}</span><button onClick={enter}>Go inside <kbd>G</kbd></button></div>}{(inside||insideBus)&&<div className="interior-screen"><Canvas shadows camera={{position:[12,19,24],fov:45,near:.1,far:150}}>{insideBus?<DetailedRoom kind="bus" look={look}/>:insideUits?<DetailedRoom kind="uits" look={look}/>:inside&&<Room building={inside} look={look}/>}<OnlinePlayers peers={peers.filter(p=>p.location===indoorState.location)}/></Canvas><div className="interior-header"><div><small>INSIDE</small><strong>{insideBus?'Big Owl Bus':insideUits?'UITS':inside?.short||inside?.name||'Building'}</strong></div><button onClick={exit}>← {insideBus?'Exit bus':'Exit building'}</button></div><div className="interior-controls"><b>WASD</b> move · <b>drag</b> look · <b>middle drag</b> pan · <b>wheel</b> zoom · <b>Q/E</b> turn · <b>Esc</b> exit</div></div>}</>
}
