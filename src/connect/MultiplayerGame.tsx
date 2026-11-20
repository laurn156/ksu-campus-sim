import { useEffect, useRef, useState } from 'react'
import { boardResult } from '../activities/engineeringGames'
import { localMove, remoteMove, type Match } from './multiplayerTic'
import type { GamePacket, Peer } from './World'

/** A two-player match uses the existing authenticated per-player broadcast channels. */
export function useMultiplayerGame(userId:string,onlineIds:string[],send:(packet:GamePacket)=>boolean,blockedIds:string[]){
 const [match,setMatch]=useState<Match|null>(null),[error,setError]=useState('')
 const ref=useRef<Match|null>(null),sendRef=useRef(send),blockedRef=useRef(blockedIds);sendRef.current=send;blockedRef.current=blockedIds
 const change=(next:Match|null)=>{ref.current=next;setMatch(next)}
 const transmit=(m:Match,kind:string,extra:Partial<GamePacket>={})=>sendRef.current({to:m.peer,match:m.id,kind,...extra})
 const start=(peer:string)=>{
  if(ref.current){setError('Finish or leave your current game first.');return}
  if(peer===userId||blockedRef.current.includes(peer)||!onlineIds.includes(peer)){setError('That player must be online to play.');return}
  const m:Match={id:crypto.randomUUID(),peer,host:true,phase:'inviting',board:Array(9).fill(null),pending:null}
  if(!transmit(m,'invite')){setError('Connect to campus before inviting a player.');return}setError('');change(m)
 }
 const accept=()=>{const m=ref.current;if(!m||m.phase!=='incoming')return;const next={...m,phase:'waiting' as const};change(next);transmit(next,'accept')}
 const leave=()=>{const m=ref.current;if(m)transmit(m,m.phase==='incoming'?'decline':'leave');change(null);setError('')}
 const play=(i:number)=>{const m=ref.current;if(!m)return;const next=localMove(m,i);if(!next)return;change(next);transmit(next,'move',next.pending!)}
 useEffect(()=>{
  const receive=(event:Event)=>{const {from,payload}=((event as CustomEvent).detail??{}) as {from:unknown;payload:Partial<GamePacket>}
   if(typeof from!=='string'||blockedRef.current.includes(from)||!payload||payload.to!==userId||typeof payload.match!=='string'||payload.match.length>64||typeof payload.kind!=='string')return
   const m=ref.current
   if(payload.kind==='invite'){
    if(!m||(m.phase==='inviting'&&m.peer===from&&userId>from)){change({id:payload.match,peer:from,host:false,phase:'incoming',board:Array(9).fill(null),pending:null});return}
    if(m.id===payload.match&&m.peer===from&&!m.host){if(m.phase==='waiting')transmit(m,'accept');else if(m.phase==='active')transmit(m,'readyAck')}
    return
   }
   if(!m||m.peer!==from||m.id!==payload.match)return
   if(payload.kind==='accept'&&m.host&&(m.phase==='inviting'||m.phase==='syncing')){const next={...m,phase:'syncing' as const};change(next);transmit(next,'ready');return}
   if(payload.kind==='ready'&&!m.host&&(m.phase==='waiting'||m.phase==='active')){const next={...m,phase:'active' as const};change(next);transmit(next,'readyAck');return}
   if(payload.kind==='readyAck'&&m.host&&m.phase==='syncing'){change({...m,phase:'active'});return}
   if(payload.kind==='decline'&&m.phase==='inviting'){change({...m,phase:'declined'});return}
   if(payload.kind==='leave'){change({...m,phase:'left',pending:null});return}
   if(payload.kind==='ack'&&m.pending&&payload.revision===m.pending.revision){change({...m,pending:null});return}
   if(payload.kind==='move'&&m.phase==='active'){
    const n=m.board.filter(Boolean).length,mark=m.host?'O':'X'
    if(payload.revision===n&&Number.isInteger(payload.index)&&m.board[Number(payload.index)]===mark){transmit(m,'ack',{revision:n});return}
    const next=remoteMove(m,payload.index,payload.revision);if(next){change(next);transmit(next,'ack',{revision:payload.revision})}
   }
  }
  window.addEventListener('campus-game-packet',receive)
  const timer=setInterval(()=>{const m=ref.current;if(!m)return;if(m.phase==='inviting')transmit(m,'invite');else if(m.phase==='waiting')transmit(m,'accept');else if(m.phase==='syncing')transmit(m,'ready');else if(m.phase==='active'&&m.pending)transmit(m,'move',m.pending)},1500)
  return()=>{window.removeEventListener('campus-game-packet',receive);clearInterval(timer);const m=ref.current;if(m)transmit(m,'leave');ref.current=null}
 },[userId])
 return {match,error,start,accept,leave,play}
}
export type MultiplayerGame=ReturnType<typeof useMultiplayerGame>
export function MultiplayerGamePanel({game,peers,onlineIds}:{game:MultiplayerGame;peers:Peer[];onlineIds:string[]}){
 const m=game.match;if(!m)return game.error?<div className="match-note" role="alert">{game.error}</div>:null
 const name=peers.find(p=>p.id===m.peer)?.name??'Another player',result=boardResult(m.board),own=m.host?'X':'O',turn=(m.board.filter(Boolean).length%2===0?'X':'O')
 const status=result?(result==='tie'?'It’s a tie!':result===own?'You win!':`${name} wins!`):m.phase==='inviting'?`Inviting ${name}…`:m.phase==='incoming'?`${name} challenged you to tic-tac-toe.`:m.phase==='waiting'||m.phase==='syncing'?'Connecting the game…':m.phase==='declined'?`${name} declined the invitation.`:m.phase==='left'?`${name} left the game.`:!onlineIds.includes(m.peer)?`${name} disconnected. Waiting for them to reconnect…`:m.pending?'Sending your move…':turn===own?'Your turn':`${name}’s turn`
 return <section className="match-panel" role="dialog" aria-label="Multiplayer tic-tac-toe"><header><strong>🎲 Tic-tac-toe · {name}</strong><button onClick={game.leave}>Leave</button></header><p role="status">{status}</p>{m.phase==='incoming'?<><button onClick={game.accept}>Accept</button><button onClick={game.leave}>Decline</button></>:m.phase==='active'?<><small>You are {own} · {name} is {own==='X'?'O':'X'}</small><div className="match-board">{m.board.map((v,i)=><button key={i} aria-label={`Row ${Math.floor(i/3)+1}, column ${i%3+1}: ${v??'empty'}`} disabled={!!v||!!result||!!m.pending||turn!==own||!onlineIds.includes(m.peer)} onClick={()=>game.play(i)}>{v??''}</button>)}</div></>:null}</section>
}
