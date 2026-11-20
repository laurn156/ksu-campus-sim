import { useEffect, useRef, useState } from 'react'
import type { Campus, Pt } from '../campus'
import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import { discGolfSpots } from '../scene/discGolf'
import { bathtubCourse } from '../activities/bathtubRace'
import type { DemoWorld } from './DemoWorld'

type Kind='disc'|'race'
type RaceResult={time:number;coins:number}
type Result=number|RaceResult
type Match={id:string;peer:string;game:Kind;phase:'incoming'|'waiting'|'countdown'|'playing'|'result'|'left';turn?:boolean;own?:Result;other?:Result;opponentFinished?:boolean}
export function useCampusContest(demo:DemoWorld,campus:Campus){
 const [match,setMatch]=useState<Match|null>(null),[notice,setNotice]=useState(''),ref=useRef<Match|null>(null),send=useRef(demo.transmit),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);send.current=demo.transmit
 const change=(m:Match|null)=>{ref.current=m;setMatch(m)}
 const invite=(peer:string,game:Kind)=>{if(ref.current){setNotice('Finish your current challenge first.');return}if(!send.current({type:'contest-invite',to:peer,game}))setNotice('Connect to campus first.');else setNotice('Sending invitation…')}
 useEffect(()=>{
  const message=(event:Event)=>{const m=(event as CustomEvent).detail as {type:string;session:string;from:string;game:Kind;delay:number;slot:number;turn:boolean;wind:Pt[];own:Result;other:Result};const current=ref.current
   if(m.type==='contest-unavailable'){setNotice('That player is already in a challenge.');return}
   if(m.type==='contest-invite'){if(current){send.current({type:'contest-leave',session:m.session});return}setNotice('');change({id:m.session,peer:m.from,game:m.game,phase:'incoming'});return}
   if(m.type==='contest-wait'){setNotice('');change({id:m.session,peer:m.from,game:m.game,phase:'waiting'});return}
   if(!current||current.id!==m.session)return
   if(m.type==='contest-start'){
    if(activityState.mode||activityState.locked||indoorState.active){send.current({type:'contest-leave',session:m.session});change(null);setNotice('Exit your current activity first.');return}
    const basket=discGolfSpots(campus)[0];if((m.game==='disc'&&!basket)||(m.game==='race'&&bathtubCourse(campus).length<2)){send.current({type:'contest-leave',session:m.session});change(null);setNotice('That activity is unavailable.');return}
    window.dispatchEvent(new Event('close-phone'));change({...current,phase:'countdown',turn:m.turn})
    timer.current=setTimeout(()=>{if(activityState.mode||activityState.locked||indoorState.active){send.current({type:'contest-leave',session:m.session});change(null);setNotice('Could not start the challenge.');return}
     window.dispatchEvent(new CustomEvent('contest-activity-start',{detail:{game:m.game,slot:m.slot,turn:m.turn,wind:m.wind,basket}}));change({...current,phase:'playing',turn:m.turn})
    },m.delay);return
   }
   if(m.type==='contest-turn'){window.dispatchEvent(new CustomEvent('contest-disc-turn',{detail:{turn:m.turn}}));change({...current,turn:m.turn,own:m.own,other:m.other});return}
   if(m.type==='contest-result'){window.dispatchEvent(new Event('contest-activity-result'));change({...current,phase:'result',own:m.own,other:m.other});return}
   if(m.type==='contest-opponent-finished'){change({...current,opponentFinished:true});return}
   if(m.type==='contest-left'){clearTimeout(timer.current);window.dispatchEvent(new Event('contest-activity-result'));change({...current,phase:'left'});return}
  }
  const disc=(event:Event)=>{const current=ref.current;if(current?.phase==='playing'&&current.game==='disc'){const v=(event as CustomEvent<{round:number;hit:boolean}>).detail;send.current({type:'contest-throw',session:current.id,...v})}}
  const race=(event:Event)=>{const current=ref.current;if(current?.phase==='playing'&&current.game==='race'){const v=(event as CustomEvent<RaceResult>).detail;send.current({type:'contest-finish',session:current.id,...v})}}
  const exit=()=>{const current=ref.current;if(current&&['countdown','playing'].includes(current.phase)){send.current({type:'contest-leave',session:current.id});change(null)}}
  window.addEventListener('demo-contest-message',message);window.addEventListener('contest-disc-throw',disc);window.addEventListener('contest-race-finish',race);window.addEventListener('contest-activity-exit',exit)
  return()=>{clearTimeout(timer.current);window.removeEventListener('demo-contest-message',message);window.removeEventListener('contest-disc-throw',disc);window.removeEventListener('contest-race-finish',race);window.removeEventListener('contest-activity-exit',exit)}
 },[campus])
 const accept=()=>{const m=ref.current;if(!m)return;if(activityState.mode||activityState.locked||indoorState.active){setNotice('Exit your current activity first.');return}send.current({type:'contest-accept',session:m.id})}
 const leave=()=>{const m=ref.current;if(m&&m.phase!=='result'&&m.phase!=='left')send.current({type:'contest-leave',session:m.id});clearTimeout(timer.current);window.dispatchEvent(new Event('contest-activity-result'));change(null);setNotice('')}
 return {match,notice,invite,accept,leave}
}
export function CampusContestPanel({game,demo}:{game:ReturnType<typeof useCampusContest>;demo:DemoWorld}){
 const m=game.match;if(!m)return game.notice?<div className="match-note" role="status">{game.notice}</div>:null
 const name=demo.world.peers.find(p=>p.id===m.peer)?.name??'Other player',title=m.game==='disc'?'Disc Golf':'Bathtub Race'
 let result=''
 if(m.phase==='result'&&m.own!==undefined&&m.other!==undefined){
  if(typeof m.own==='number'&&typeof m.other==='number')result=(m.own===m.other?'Tie!':m.own>m.other?'You win!':name+' wins!')+' You: '+m.own+' / 5 · '+name+': '+m.other+' / 5'
  else if(typeof m.own==='object'&&typeof m.other==='object')result=(Math.abs(m.own.time-m.other.time)<.05?'Tie!':m.own.time<m.other.time?'You win!':name+' wins!')+' You: '+m.own.time.toFixed(1)+'s ('+m.own.coins+' coins) · '+name+': '+m.other.time.toFixed(1)+'s ('+m.other.coins+' coins)'
 }
 return <section className="match-panel" role="dialog" aria-label={title+' challenge'}><header><strong>{title} · {name}</strong><button onClick={game.leave}>{m.phase==='playing'?'Leave':'Close'}</button></header>{m.phase==='incoming'?<><p>{name} invited you to {title}. {m.game==='race'?'Fastest time wins; coins are shown separately.':'Take turns; most baskets out of five wins.'}</p>{game.notice&&<p>{game.notice}</p>}<button onClick={game.accept}>Accept</button> <button onClick={game.leave}>Decline</button></>:m.phase==='waiting'?<p>Waiting for {name}…</p>:m.phase==='countdown'?<p>Get ready! Starting in 3 seconds…</p>:m.phase==='playing'?<p>{m.game==='disc'?(m.turn?'Your turn to throw.':name+' is taking a turn.'):(m.opponentFinished?name+' finished! Complete your two laps.':'Fastest two laps wins. Collect owl coins along the way.')}</p>:m.phase==='left'?<p>{name} left the challenge.</p>:<p>{result}</p>}</section>
}
