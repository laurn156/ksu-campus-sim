import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import { useEffect, useRef, useState } from 'react'
import type { Campus } from '../campus'
import { player } from '../scene/Player'
import { community } from '../scene/Community'
import { STUDENTS, scheduleFor, moodFor, type StudentId } from './students'
import { isMemoryQuestion, level, relation, type SocialAction } from './simulation'
import { optionalDialogue, type DialogueTurn } from './dialogue'
import type { LifeController } from './useLife'
import './life.css'

const interactions:{label:string;items:{id:SocialAction;label:string}[]}[]=[
  {label:'Friendly',items:[{id:'introduce',label:'Introduce yourself'},{id:'chat',label:'Chat'},{id:'know',label:'Get to know'},{id:'day',label:'Ask about their day'},{id:'joke',label:'Tell a joke'},{id:'compliment',label:'Compliment'},{id:'interests',label:'Discuss interests'}]},
  {label:'Social',items:[{id:'hangout',label:'Hang out'},{id:'lunch',label:'Invite to lunch'},{id:'study',label:'Study together'},{id:'clubs',label:'Ask about clubs'},{id:'friend',label:'Become friends'}]},
  {label:'Playful',items:[{id:'tease',label:'Tease'},{id:'challenge',label:'Challenge to game'},{id:'story',label:'Funny story'}]},
  {label:'Disagree',items:[{id:'disagree',label:'Disagree'},{id:'complain',label:'Complain'},{id:'argue',label:'Argue'}]},
]
function timeLabel(minutes:number){const h=Math.floor(minutes/60),m=Math.floor(minutes%60);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM')}
export function LifeUI({life,playerName,onEdit}:{campus:Campus;life:LifeController;playerName:string;onEdit:()=>void}) {
  const [closest,setClosest]=useState<StudentId|null>(null),[talking,setTalking]=useState<StudentId|null>(null),[menu,setMenu]=useState<'relationships'|'schedule'|'stories'|'character'|null>(null)
  const [message,setMessage]=useState(''),[feedback,setFeedback]=useState(''),[invitation,setInvitation]=useState<StudentId|null>(null)
  const [aiReply,setAiReply]=useState(''), [thinking,setThinking]=useState(false), request=useRef<AbortController|null>(null), lastInvite=useRef(0)
  const history=useRef<Partial<Record<StudentId,DialogueTurn[]>>>({})
  const [replySource,setReplySource]=useState<'memory'|'qwen'|'fallback'|null>(null)
  const npc=STUDENTS.find(s=>s.id===talking)
  const r=npc?relation(life.state,npc.id):null
  useEffect(()=>{
    const update=()=>{const nearest=community.students.map(s=>({...s,d:Math.hypot(s.x-player.x,s.z-player.z)})).sort((a,b)=>a.d-b.d)[0]
      setClosest(!indoorState.active&&!activityState.mode&&!activityState.locked&&!player.view&&nearest&&nearest.d<5?nearest.id:null)}
    const interval=setInterval(update,300);update();return()=>clearInterval(interval)
  },[])
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(indoorState.active||activityState.mode||activityState.near||activityState.vehicleNear||activityState.parkingNear||!['e','f'].includes(e.key.toLowerCase())||e.repeat||player.view||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return
      const nearest=community.students.map(s=>({...s,d:Math.hypot(s.x-player.x,s.z-player.z)})).sort((a,b)=>a.d-b.d)[0]
      if(nearest&&nearest.d<5){setTalking(nearest.id);setAiReply('');life.setReply('')}
    }
    const open=(e:Event)=>{const id=(e as CustomEvent<StudentId>).detail;const found=community.students.find(s=>s.id===id);if(found&&!player.view&&Math.hypot(found.x-player.x,found.z-player.z)<5){setTalking(id);setAiReply('');life.setReply('')}}
    addEventListener('keydown',key);addEventListener('open-student',open);return()=>{removeEventListener('keydown',key);removeEventListener('open-student',open)}
  },[life.setReply])
  useEffect(()=>{
    const id=setInterval(()=>{
      if(indoorState.active||talking||menu||invitation||player.view||Date.now()-lastInvite.current<180000)return
      const candidate=community.students.find(s=>Math.hypot(s.x-player.x,s.z-player.z)<6 && relation(life.state,s.id).score>=10)
      if(candidate){lastInvite.current=Date.now();setInvitation(candidate.id)}
    },15000)
    return()=>clearInterval(id)
  },[talking,menu,invitation,life.state.relations])
  useEffect(()=>{community.talking=talking;if(talking)activityState.locked=true;return()=>{community.talking=null;if(talking)activityState.locked=false}},[talking])
  useEffect(()=>()=>request.current?.abort(),[])
  const interact=(action:SocialAction,text='')=>{
    if(!npc)return
    setAiReply('');request.current?.abort();const result=life.interact(npc.id,action,text)
    const controller=new AbortController();request.current=controller;setThinking(true)
    const previous=history.current[npc.id]??[]
    const playerLine=action==='custom'?text:(interactions.flatMap(group=>group.items).find(item=>item.id===action)?.label??action)
    if(action==='custom' && isMemoryQuestion(text)){
      history.current[npc.id]=[...previous,{role:'user' as const,content:playerLine},{role:'assistant' as const,content:result.reply}].slice(-6)
      setReplySource('memory');setAiReply(result.reply);setThinking(false);setMessage('');return
    }
    void optionalDialogue(npc,result.state,action,text,playerName,result.reply,previous,controller.signal).then(reply=>{
      if(controller.signal.aborted)return
      const spoken=reply||result.reply
      history.current[npc.id]=[...previous,{role:'user' as const,content:playerLine},{role:'assistant' as const,content:spoken}].slice(-6)
      setReplySource(reply?'qwen':'fallback');setAiReply(spoken);setThinking(false)
    })
    setMessage('')
  }
  return <>
    <button className="life-phone-button" onClick={()=>setMenu('relationships')}>☰ Phone</button>
    {closest&&!talking&&!menu&&!player.view&&<div className="life-near">Press <b>E</b> to talk to {STUDENTS.find(s=>s.id===closest)?.name}</div>}
    {feedback&&<div className="life-feedback" role="status">{feedback}</div>}
    {invitation&&!talking&&<div className="life-invite"><b>{STUDENTS.find(s=>s.id===invitation)?.name}</b> waves you over. Want to chat?<div><button onClick={()=>{setTalking(invitation);setInvitation(null)}}>Say hello</button><button onClick={()=>setInvitation(null)}>Not now</button></div></div>}
    {talking&&npc&&r&&<div className="life-modal-back"><section className="life-dialog" role="dialog" aria-modal="true" aria-label={'Talk to '+npc.name}><header><div><small>{npc.major} · {moodFor(npc,life.state.minute,r.score)} · {scheduleFor(npc,life.state.minute).label}</small><h2>{npc.name}</h2><span>{npc.personality}</span></div><button onClick={()=>{request.current?.abort();setThinking(false);setTalking(null);life.setReply('');setAiReply('');setReplySource(null)}}>✕</button></header>
      <div className="life-speech"><b>{npc.name}</b><p>{thinking?'Thinking…':aiReply||life.reply||(r.met ? `Hi ${playerName}! Good to see you again.` : 'Hi! Want to introduce yourself?')}</p><small>{level(r.score)} · {r.score} relationship{!thinking&&replySource ? ` · ${replySource==='qwen'?'Local Qwen':replySource==='memory'?'Saved memory':'Offline fallback'}` : ''}</small></div>
      <div className="life-interactions">{interactions.map(group=><div key={group.label}><b>{group.label}</b><div>{group.items.map(a=><button key={a.id} onClick={()=>interact(a.id)}>{a.label}</button>)}</div></div>)}</div>
      <form onSubmit={e=>{e.preventDefault();if(message.trim())interact('custom',message)}}><label htmlFor="life-message">Say something</label><div><input id="life-message" maxLength={240} placeholder="Type a message…" value={message} onChange={e=>setMessage(e.target.value)}/><button type="submit">Send</button></div><small>The campus dialogue service responds when available; otherwise, saved offline replies are shown.</small></form>
    </section></div>}
    {menu&&<div className="life-modal-back"><section className="life-phone" role="dialog" aria-modal="true" aria-label="Campus phone"><header><div><small>CAMPUSVERSE</small><h2>Your phone</h2></div><button onClick={()=>setMenu(null)}>✕</button></header><nav>{(['relationships','schedule','stories','character'] as const).map(t=><button key={t} aria-pressed={menu===t} onClick={()=>setMenu(t)}>{t}</button>)}</nav>
      <div className="phone-content">{menu==='relationships'&&<><h3>Relationships</h3>{STUDENTS.filter(s=>relation(life.state,s.id).met).length===0&&<p>Meet a student to see them here.</p>}{STUDENTS.filter(s=>relation(life.state,s.id).met).map(s=>{const rel=relation(life.state,s.id);return <div className="relationship" key={s.id}><b>{s.name}</b><span>{level(rel.score)}</span><div><i style={{width:Math.max(0,Math.min(100,rel.score))+'%'}}/></div><small>{s.major} · {s.personality}</small></div>})}</>}
      {menu==='schedule'&&<><h3>Day {life.state.day} · {timeLabel(life.state.minute)}</h3><p>Follow your own schedule. Students are heading to their own activities.</p><p><b>Today:</b> {life.state.day%2?'Engineering demonstration at Q':'Club gathering at A'} · 2–5 PM</p>{STUDENTS.filter(s=>relation(life.state,s.id).met).map(s=><p key={s.id}><b>{s.name}</b> · {scheduleFor(s,life.state.minute).label}</p>)}<button onClick={()=>{life.nextDay();setMenu(null);setFeedback('A new campus day begins.')}}>Start next morning</button></>}
      {menu==='stories'&&<><h3>Journal</h3>{life.state.journal.length?life.state.journal.slice().reverse().map((entry,i)=><p key={i}>{entry}</p>):<p>Your campus stories will appear here as you meet people and try activities.</p>}</>}
      {menu==='character'&&<><h3>{playerName||'Your character'}</h3><p>Academics: {life.state.academics} · Campus involvement: {life.state.involvement}</p><p>Explore campus, meet students, and try activities.</p><button onClick={onEdit}>Edit character</button></>}</div>
    </section></div>}
  </>
}

