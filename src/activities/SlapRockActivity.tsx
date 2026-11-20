import { useEffect, useMemo, useRef, useState } from 'react'
import type { Campus } from '../campus'
import { landmarkSpots } from '../scene/Landmarks'
import { indoorState } from '../scene/indoorState'
import { player } from '../scene/Player'
import { activityState } from './activityState'

type Round = { started: number; count: number; finished: boolean }
const ROUND_MS = 20_000

/** A short personal-best challenge at the existing campus rock. */
export function SlapRockActivity({campus,identity}:{campus:Campus;identity:string}) {
 const rock=useMemo(()=>landmarkSpots(campus).find(p=>p.name==='Slap the Rock')?.at,[campus])
 const [near,setNear]=useState(false),[round,setRound]=useState<Round|null>(null),[remaining,setRemaining]=useState(20)
 const [best,setBest]=useState(()=>{try{return Number(localStorage.getItem('nest-rock-best:'+identity))||0}catch{return 0}})
 const current=useRef<Round|null>(null),bestRef=useRef(best),savedView=useRef<{yaw:number;pitch:number}|null>(null)
 const close=()=>{current.current=null;setRound(null);window.dispatchEvent(new Event('rock-paint-finish'));if(savedView.current){player.yaw=savedView.current.yaw;player.pitch=savedView.current.pitch;savedView.current=null;player.view=null;player.viewChanged=true}if(activityState.mode==='rock'){activityState.mode=null;activityState.locked=false}activityState.throwUntil=0}
 const start=()=>{
  if(!rock||activityState.mode||indoorState.active||player.busRide)return
  const angle=Math.atan2(rock[0]-player.x,rock[1]-player.z)
  // Stand beside the rock and face it, including when the menu starts the game.
  savedView.current={yaw:player.yaw,pitch:player.pitch};player.x=rock[0]-Math.sin(angle)*3;player.z=rock[1]-Math.cos(angle)*3;player.heading=angle;player.yaw=angle+Math.PI+.4;player.pitch=.45;player.view={x:(player.x+rock[0])/2,z:(player.z+rock[1])/2,yaw:player.yaw};player.viewChanged=true;window.dispatchEvent(new Event('rock-paint-reset'))
  const next={started:performance.now(),count:0,finished:false};current.current=next;setRound(next);setRemaining(20);activityState.mode='rock';activityState.locked=true
 }
 const slap=()=>{const r=current.current;if(!r||r.finished||performance.now()-r.started>=ROUND_MS)return;const next={...r,count:r.count+1};current.current=next;setRound(next);activityState.throwUntil=performance.now()+220;window.dispatchEvent(new CustomEvent('rock-paint-slap',{detail:{x:player.x,z:player.z,count:next.count}}))}
 useEffect(()=>{const id=setInterval(()=>{setNear(!!rock&&!indoorState.active&&!player.view&&!player.busRide&&Math.hypot(player.x-rock[0],player.z-rock[1])<7);const r=current.current;if(!r||r.finished)return;const left=Math.max(0,(ROUND_MS-(performance.now()-r.started))/1000);setRemaining(left);if(left===0){const result={...r,finished:true};current.current=result;setRound(result);if(result.count>bestRef.current){bestRef.current=result.count;setBest(result.count);try{localStorage.setItem('nest-rock-best:'+identity,String(result.count))}catch{/* optional */}}}},100);return()=>{clearInterval(id);if(activityState.mode==='rock'){activityState.mode=null;activityState.locked=false;window.dispatchEvent(new Event('rock-paint-finish'));if(savedView.current){player.yaw=savedView.current.yaw;player.pitch=savedView.current.pitch;player.view=null;player.viewChanged=true}}}},[rock,identity])
 useEffect(()=>{const onStart=(event:Event)=>{const detail=(event as CustomEvent<{name:string;target:{x:number;z:number}}>).detail;if(detail.name!=='Slap the Rock Battle'||activityState.mode)return;player.x=detail.target.x;player.z=detail.target.z;start()};window.addEventListener('activity-start',onStart);return()=>window.removeEventListener('activity-start',onStart)},[rock])
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;if(e.key==='Escape'&&current.current){close();return}if(e.code==='Space'&&current.current){e.preventDefault();if(!e.repeat)slap();return}if(e.key.toLowerCase()==='e'&&!e.repeat&&near&&!activityState.mode)start()};window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down)},[near,rock])
 return <>{near&&!round&&!activityState.mode&&<div className="activity-prompt">Press <b>E</b> to play Slap the Rock</div>}{round&&<section className="activity-panel"><header><strong>Slap the Rock Battle</strong><button onClick={close}>Exit</button></header>{round.finished?<><p>Time! {round.count} slaps</p><small>Personal best: {best} slaps</small><p><button onClick={()=>{close();start()}}>Play again</button></p></>:<><p>{Math.ceil(remaining)}s · {round.count} slaps</p><small>Tap Space as fast as you can. Beat your personal best of {best}!</small><p><button onClick={slap}>Slap!</button></p></>}</section>}</>
}
