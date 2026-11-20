import { useEffect, useRef, useState } from 'react'
import type { Campus } from '../campus'
import { landmarkSpots } from '../scene/Landmarks'
import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import type { DemoWorld } from './DemoWorld'

type Challenge={id:string;peer:string;phase:'incoming'|'waiting'|'countdown'|'playing'|'result'|'left';own?:number;other?:number}
export function useRockChallenge(demo:DemoWorld,campus:Campus){
 const [match,setMatch]=useState<Challenge|null>(null),[note,setNote]=useState(''),ref=useRef<Challenge|null>(null),send=useRef(demo.transmit),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);send.current=demo.transmit
 const change=(m:Challenge|null)=>{ref.current=m;setMatch(m)}
 const invite=(peer:string)=>{if(ref.current){setNote('Finish your current rock challenge first.');return}if(!send.current({type:'rock-invite',to:peer}))setNote('Connect to campus first.');else setNote('Sending challenge…')}
 useEffect(()=>{
  const message=(event:Event)=>{const m=(event as CustomEvent).detail as {type:string;challenge:string;from:string;delay:number;own:number;other:number};const current=ref.current
   if(m.type==='rock-invite'){if(current){send.current({type:'rock-leave',challenge:m.challenge});return}setNote('');change({id:m.challenge,peer:m.from,phase:'incoming'});return}
   if(m.type==='rock-unavailable'){setNote('That player is already in a rock challenge.');return}
   if(m.type==='rock-wait'){setNote('');change({id:m.challenge,peer:m.from,phase:'waiting'});return}
   if(!current||current.id!==m.challenge)return
   if(m.type==='rock-start'){
    if(activityState.mode||indoorState.active){send.current({type:'rock-leave',challenge:m.challenge});change(null);setNote('Finish your current activity before starting.');return}
    window.dispatchEvent(new Event('close-phone'));change({...current,phase:'countdown'});timer.current=setTimeout(()=>{const rock=landmarkSpots(campus).find(p=>p.name==='Slap the Rock')?.at;if(!rock||activityState.mode||indoorState.active){send.current({type:'rock-leave',challenge:m.challenge});change(null);setNote('Could not start the challenge.');return}window.dispatchEvent(new CustomEvent('activity-start',{detail:{name:'Slap the Rock Battle',target:{x:rock[0]+3,z:rock[1]+3}}}));change({...current,phase:'playing'})},m.delay);return
   }
   if(m.type==='rock-result'){change({...current,phase:'result',own:m.own,other:m.other});return}
   if(m.type==='rock-left'){clearTimeout(timer.current);change({...current,phase:'left'});return}
  }
  const finish=(event:Event)=>{const current=ref.current;if(current?.phase==='playing')send.current({type:'rock-score',challenge:current.id,score:(event as CustomEvent<{count:number}>).detail.count})}
  const cancel=()=>{const current=ref.current;if(current?.phase==='playing'){send.current({type:'rock-leave',challenge:current.id});change(null)}}
  window.addEventListener('demo-rock-message',message);window.addEventListener('rock-round-finished',finish);window.addEventListener('rock-round-cancelled',cancel)
  return()=>{clearTimeout(timer.current);window.removeEventListener('demo-rock-message',message);window.removeEventListener('rock-round-finished',finish);window.removeEventListener('rock-round-cancelled',cancel)}
 },[campus])
 const accept=()=>{const m=ref.current;if(!m)return;if(activityState.mode||indoorState.active){setNote('Leave your current activity first.');return}send.current({type:'rock-accept',challenge:m.id})}
 const leave=()=>{const m=ref.current;if(m)send.current({type:'rock-leave',challenge:m.id});clearTimeout(timer.current);change(null);setNote('')}
 return {match,note,invite,accept,leave}
}
export function RockChallengePanel({game,demo}:{game:ReturnType<typeof useRockChallenge>;demo:DemoWorld}){
 const m=game.match;if(!m)return game.note?<div className="match-note">{game.note}</div>:null
 const name=demo.world.peers.find(p=>p.id===m.peer)?.name??'Other player'
 return <section className="match-panel" role="dialog" aria-label="Slap the Rock challenge"><header><strong>🪨 Slap the Rock · {name}</strong><button onClick={game.leave}>Close</button></header>{m.phase==='incoming'?<><p>{name} challenged you to a 20-second slap battle!</p><button onClick={game.accept}>Accept</button> <button onClick={game.leave}>Decline</button></>:m.phase==='waiting'?<p>Waiting for {name}…</p>:m.phase==='countdown'?<p>Get ready! Starting in 3 seconds…</p>:m.phase==='playing'?<p>Slap as fast as you can! Waiting for both scores.</p>:m.phase==='left'?<p>{name} left the challenge.</p>:<p>{m.own===m.other?'It’s a tie!':m.own!>m.other!?'You win!':`${name} wins!`} You: {m.own} · {name}: {m.other}</p>}</section>
}
