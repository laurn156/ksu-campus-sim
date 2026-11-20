import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import { useEffect, useRef, useState } from 'react'
import type { Campus } from '../campus'
import { approach, player } from '../scene/Player'
import { community } from '../scene/Community'
import { landmarkSpots } from '../scene/Landmarks'
import { STUDENTS, scheduleFor, moodFor, type StudentId } from './students'
import { isMemoryQuestion, level, npcOpener, relation, stageProgress, UNLOCK, type Outing, type SocialAction } from './simulation'
import { optionalDialogue, type DialogueTurn } from './dialogue'
import type { LifeController } from './useLife'
import './life.css'

type Category = 'Friendly' | 'Playful' | 'Activities' | 'Mean'
const CATEGORIES: { label: Category; icon: string; items: { id: SocialAction; label: string }[] }[] = [
  { label: 'Friendly', icon: '😊', items: [{ id: 'introduce', label: 'Introduce yourself' }, { id: 'chat', label: 'Chat' }, { id: 'day', label: 'Ask about their day' }, { id: 'know', label: 'Get to know' }, { id: 'compliment', label: 'Compliment' }, { id: 'interests', label: 'Talk interests' }, { id: 'gossip', label: 'Gossip' }, { id: 'apologize', label: 'Apologize' }, { id: 'friend', label: 'Become friends' }, { id: 'secret', label: 'Share secrets' }] },
  { label: 'Playful', icon: '😜', items: [{ id: 'joke', label: 'Tell a joke' }, { id: 'story', label: 'Funny story' }, { id: 'tease', label: 'Tease' }, { id: 'drama', label: 'Ask about drama' }, { id: 'flirt', label: 'Flirt' }] },
  { label: 'Activities', icon: '🎯', items: [{ id: 'lunch', label: 'Invite to lunch' }, { id: 'study', label: 'Study together' }, { id: 'hangout', label: 'Hang out' }, { id: 'challenge', label: 'Challenge to a game' }, { id: 'favor', label: 'Offer to help' }] },
  { label: 'Mean', icon: '😠', items: [{ id: 'disagree', label: 'Disagree' }, { id: 'complain', label: 'Complain' }, { id: 'argue', label: 'Argue' }, { id: 'insult', label: 'Insult' }] },
]
const LABEL = Object.fromEntries(CATEGORIES.flatMap(c => c.items.map(i => [i.id, i.label]))) as Record<SocialAction, string>
type Line = { who: 'npc' | 'you' | 'note'; text: string; tone?: 'good' | 'bad' }
type Plan = { id: StudentId; kind: Outing; label: string; goal: { x: number; z: number } | null; phase: 'going' | 'return' | 'hangout' | 'playing'; until?: number; npcScore?: number }

function timeLabel(minutes:number){const h=Math.floor(minutes/60),m=Math.floor(minutes%60);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM')}
export function LifeUI({campus,life,playerName,onEdit}:{campus:Campus;life:LifeController;playerName:string;onEdit:()=>void}) {
  const [closest,setClosest]=useState<StudentId|null>(null),[talking,setTalking]=useState<StudentId|null>(null),[menu,setMenu]=useState<'relationships'|'schedule'|'stories'|'character'|null>(null)
  const [message,setMessage]=useState(''),[feedback,setFeedback]=useState(''),[invitation,setInvitation]=useState<{id:StudentId;line:string;suggest?:SocialAction}|null>(null)
  const [open,setOpen]=useState<Category|null>('Friendly'),[suggest,setSuggest]=useState<SocialAction|null>(null)
  const [thinking,setThinking]=useState(false), request=useRef<AbortController|null>(null), lastInvite=useRef(Date.now()-60000)
  const [lines,setLines]=useState<Line[]>([]), logs=useRef<Partial<Record<StudentId,Line[]>>>({}), history=useRef<Partial<Record<StudentId,DialogueTurn[]>>>({})
  const [plan,setPlan]=useState<Plan|null>(null), planRef=useRef<Plan|null>(null), [now,setNow]=useState(Date.now())
  const scroll=useRef<HTMLDivElement>(null)
  const npc=STUDENTS.find(s=>s.id===talking)
  const r=npc?relation(life.state,npc.id):null
  const state=useRef(life.state);state.current=life.state
  const say=(id:StudentId,line:Line)=>{logs.current[id]=[...(logs.current[id]??[]),line].slice(-24);if(id===talking||talkingRef.current===id)setLines(logs.current[id]!)}
  const talkingRef=useRef<StudentId|null>(null);talkingRef.current=talking
  const toast=(text:string)=>{setFeedback(text);setTimeout(()=>setFeedback(f=>f===text?'':f),4500)}
  const startTalk=(id:StudentId,opener?:{line:string;suggest?:SocialAction})=>{
    const rel=relation(state.current,id)
    if(!logs.current[id]?.length)logs.current[id]=[{who:'npc',text:opener?.line??(rel.met?`Hey ${playerName}! Good to see you again.`:'Hi! I don’t think we’ve met.')}]
    else if(opener)logs.current[id]=[...logs.current[id]!,{who:'npc',text:opener.line}]
    setLines(logs.current[id]!);setSuggest(opener?.suggest??null);setTalking(id);setOpen(opener?.suggest?(CATEGORIES.find(c=>c.items.some(i=>i.id===opener.suggest))?.label??'Friendly'):'Friendly')
  }
  const endTalk=()=>{request.current?.abort();setThinking(false);setTalking(null);setSuggest(null)}
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})},[lines,thinking])

  useEffect(()=>{
    const update=()=>{const nearest=community.students.map(s=>({...s,d:Math.hypot(s.x-player.x,s.z-player.z)})).sort((a,b)=>a.d-b.d)[0]
      setClosest(!indoorState.active&&!activityState.mode&&!activityState.locked&&!player.view&&nearest&&nearest.d<5?nearest.id:null)}
    const interval=setInterval(update,300);update();return()=>clearInterval(interval)
  },[])
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(talkingRef.current||indoorState.active||activityState.mode||activityState.near||activityState.vehicleNear||activityState.parkingNear||!['e','f'].includes(e.key.toLowerCase())||e.repeat||player.view||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return
      const nearest=community.students.map(s=>({...s,d:Math.hypot(s.x-player.x,s.z-player.z)})).sort((a,b)=>a.d-b.d)[0]
      if(nearest&&nearest.d<5)startTalk(nearest.id)
    }
    const openEv=(e:Event)=>{const id=(e as CustomEvent<StudentId>).detail;const found=community.students.find(s=>s.id===id);if(found&&!player.view&&Math.hypot(found.x-player.x,found.z-player.z)<5)startTalk(id)}
    addEventListener('keydown',key);addEventListener('open-student',openEv);return()=>{removeEventListener('keydown',key);removeEventListener('open-student',openEv)}
  },[playerName])
  // Students sometimes walk up and start the conversation themselves.
  useEffect(()=>{
    const id=setInterval(()=>{
      if(indoorState.active||talkingRef.current||menu||invitation||planRef.current||player.view||activityState.mode||activityState.locked||Date.now()-lastInvite.current<120000)return
      const near=community.students.filter(s=>Math.hypot(s.x-player.x,s.z-player.z)<8)
      for(const s of near){const op=npcOpener(state.current,s.id);if(op){lastInvite.current=Date.now();setInvitation({id:s.id,...op});return}}
    },12000)
    return()=>clearInterval(id)
  },[menu,invitation])
  useEffect(()=>{community.talking=talking;if(talking)activityState.locked=true;return()=>{community.talking=null;if(talking)activityState.locked=false}},[talking])
  useEffect(()=>()=>{request.current?.abort();community.companion=null},[])

  // ---- Outings: the game, not the dialogue, carries out what was agreed ----
  const startPlan=(id:StudentId,kind:Outing)=>{
    const name=STUDENTS.find(s=>s.id===id)!.name
    const at=(code:string)=>{const b=campus.buildings.find(x=>x.code===code);return b?approach(campus,b.poly):null}
    const rock=landmarkSpots(campus).find(p=>p.name==='Slap the Rock')?.at
    const p:Plan=kind==='lunch'?{id,kind,label:`Walk to Stingers with ${name}`,goal:at('X'),phase:'going'}
      :kind==='study'?{id,kind,label:`Head to the library with ${name}`,goal:at('C'),phase:'going'}
      :kind==='game'?{id,kind,label:`Go to Slap the Rock with ${name}`,goal:rock?{x:rock[0],z:rock[1]}:null,phase:'going'}
      :kind==='favor'?{id,kind,label:`Grab something from Stingers for ${name}`,goal:at('X'),phase:'going'}
      :{id,kind,label:`Hanging out with ${name}`,goal:null,phase:'hangout',until:Date.now()+60000}
    if(kind!=='favor')community.companion=id
    planRef.current=p;setPlan(p)
  }
  const finishPlan=(text?:string)=>{community.companion=null;planRef.current=null;setPlan(null);if(text)toast(text)}
  useEffect(()=>{
    const id=setInterval(()=>{
      setNow(Date.now())
      const p=planRef.current;if(!p)return
      const name=STUDENTS.find(s=>s.id===p.id)!.name
      if(p.phase==='hangout'&&p.until&&Date.now()>p.until){life.record(p.id,'hanging out around campus',5,'recreation');finishPlan(`You and ${name} hung out around campus. +5`);return}
      if(p.phase==='return'){const s=community.students.find(x=>x.id===p.id);if(s&&Math.hypot(s.x-player.x,s.z-player.z)<4){life.record(p.id,'you doing me a favor',8);say(p.id,{who:'npc',text:'You actually did it! Thank you, seriously.'});finishPlan(`${name} really appreciated the favor. +8`)}return}
      if(p.goal&&p.phase==='going'&&Math.hypot(p.goal.x-player.x,p.goal.z-player.z)<11){
        if(p.kind==='lunch'){life.record(p.id,'having lunch at Stingers together',7,'eat');finishPlan(`Lunch with ${name} at Stingers. +7`)}
        else if(p.kind==='study'){life.record(p.id,'studying together at the library',6,'study');finishPlan(`Studied with ${name} at the library. +6`)}
        else if(p.kind==='favor'){const next={...p,phase:'return' as const,label:`Bring it back to ${name}`,goal:null};planRef.current=next;setPlan(next);toast('Got it! Now bring it back.')}
        else if(p.kind==='game'){
          const npc=STUDENTS.find(s=>s.id===p.id)!, npcScore=Math.round(55+npc.traits.competitive*45+Math.random()*25)
          const next={...p,phase:'playing' as const,npcScore,label:`Beat ${name}'s score: ${npcScore} slaps`};planRef.current=next;setPlan(next)
          window.dispatchEvent(new CustomEvent('activity-start',{detail:{name:'Slap the Rock Battle',target:{x:player.x,z:player.z,yaw:player.yaw}}}))
        }
      }
    },400)
    const finished=(e:Event)=>{const p=planRef.current;if(!p||p.phase!=='playing')return
      const count=(e as CustomEvent<{count:number}>).detail.count,npc=STUDENTS.find(s=>s.id===p.id)!,target=p.npcScore??0
      if(count>target){life.record(p.id,`you beating me at Slap the Rock, ${count} to ${target}`,npc.traits.competitive>.7?2:4);say(p.id,{who:'npc',text:npc.traits.competitive>.7?'No way. I want a rematch.':'Okay, you won fair and square!'});finishPlan(`You beat ${npc.name} ${count}–${target}!`)}
      else{life.record(p.id,`beating you at Slap the Rock, ${target} to ${count}`,4);say(p.id,{who:'npc',text:'Ha! Better luck next time.'});finishPlan(`${npc.name} won ${target}–${count}. Rematch later?`)}
    }
    addEventListener('rock-round-finished',finished)
    return()=>{clearInterval(id);removeEventListener('rock-round-finished',finished)}
  },[campus,life.record])
  const cancelPlan=()=>{const p=planRef.current;if(!p)return;const name=STUDENTS.find(s=>s.id===p.id)!.name;if(p.phase!=='playing')life.record(p.id,'you bailing on our plans',-3);finishPlan(`You bailed on ${name}. −3`)}

  const interact=(action:SocialAction,text='')=>{
    if(!npc||thinking)return
    request.current?.abort()
    const before=level(relation(life.state,npc.id).score)
    const result=life.interact(npc.id,action,text)
    const after=relation(result.state,npc.id), o=result.outcome
    const playerLine=action==='custom'?text:LABEL[action]??action
    say(npc.id,{who:'you',text:playerLine});setSuggest(null);setMessage('')
    const previous=history.current[npc.id]??[]
    const finish=(spoken:string)=>{
      history.current[npc.id]=[...previous,{role:'user' as const,content:playerLine},{role:'assistant' as const,content:spoken}].slice(-8)
      say(npc.id,{who:'npc',text:spoken})
      if(o.delta)say(npc.id,{who:'note',text:`${o.delta>0?'+':'−'}${Math.abs(o.delta)} friendship`,tone:o.delta>0?'good':'bad'})
      const now=level(after.score);if(now!==before)say(npc.id,{who:'note',text:`You and ${npc.name} are now: ${now}`,tone:after.score>=relation(life.state,npc.id).score?'good':'bad'})
      if(o.accepted&&o.outing){say(npc.id,{who:'note',text:o.outing==='favor'?'Favor accepted — go to Stingers.':o.outing==='game'?`${npc.name} accepted your challenge!`:`${npc.name} is coming with you.`,tone:'good'});setTimeout(()=>{endTalk();startPlan(npc.id,o.outing!)},1300)}
      setThinking(false)
    }
    if(action==='custom'&&isMemoryQuestion(text)){finish(result.reply);return}
    const controller=new AbortController();request.current=controller;setThinking(true)
    void optionalDialogue(npc,result.state,action,text,playerName,result.reply,previous,controller.signal,o).then(reply=>{if(!controller.signal.aborted)finish(reply||result.reply)})
  }

  const mood=npc&&r?moodFor(npc,life.state.minute,r.score):''
  const planLeft=plan?.until?Math.max(0,Math.ceil((plan.until-now)/1000)):0
  const dist=plan?.goal?Math.round(Math.hypot(plan.goal.x-player.x,plan.goal.z-player.z)):0
  return <>
    <button className="life-phone-button" onClick={()=>setMenu('relationships')}>☰ Phone</button>
    {closest&&!talking&&!menu&&!player.view&&<div className="life-near">Press <b>E</b> to talk to {STUDENTS.find(s=>s.id===closest)?.name}</div>}
    {feedback&&<div className="life-feedback" role="status">{feedback}</div>}
    {plan&&!talking&&<div className="life-plan" role="status"><span>{plan.kind==='lunch'?'🍔':plan.kind==='study'?'📚':plan.kind==='game'?'🪨':plan.kind==='favor'?'☕':'🚶'}</span><b>{plan.label}</b>{plan.goal&&plan.phase==='going'&&<small>{dist} m</small>}{plan.phase==='hangout'&&<small>{planLeft}s</small>}{plan.phase!=='playing'&&<button onClick={cancelPlan}>Cancel</button>}</div>}
    {invitation&&!talking&&<div className="life-invite"><b>{STUDENTS.find(s=>s.id===invitation.id)?.name}</b> walks over: “{invitation.line}”<div><button onClick={()=>{startTalk(invitation.id,{line:invitation.line,suggest:invitation.suggest});setInvitation(null)}}>Talk</button><button onClick={()=>setInvitation(null)}>Not now</button></div></div>}
    {talking&&npc&&r&&<section className="chat" role="dialog" aria-label={'Talking with '+npc.name}>
      <header><div><h2>{npc.name}</h2><small>{npc.major} · {mood}</small></div><button onClick={endTalk} aria-label="End conversation">✕</button></header>
      <div className="chat-rel"><span className={'stage'+(r.score<=-15?' rival':'')}>{level(r.score)}</span><div className="bar"><i style={{width:Math.round(stageProgress(r.score)*100)+'%'}}/></div></div>
      <div className="chat-log" ref={scroll}>{lines.map((l,i)=><p key={i} className={'line '+l.who+(l.tone?' '+l.tone:'')}>{l.text}</p>)}{thinking&&<p className="line npc typing"><span/><span/><span/></p>}</div>
      {suggest&&<button className="chat-suggest" onClick={()=>interact(suggest)}>💬 {LABEL[suggest]}</button>}
      <div className="chat-cats">{CATEGORIES.map(c=><button key={c.label} aria-expanded={open===c.label} onClick={()=>setOpen(open===c.label?null:c.label)}>{c.icon} {c.label}</button>)}</div>
      {open&&<div className="chat-actions">{CATEGORIES.find(c=>c.label===open)!.items.map(a=>{const need=UNLOCK[a.id],locked=need!==undefined&&r.score<need;return <button key={a.id} disabled={locked||thinking} title={locked?`Unlocks at ${level(need!)}`:undefined} onClick={()=>interact(a.id)}>{locked?'🔒 ':''}{a.label}</button>})}</div>}
      <form onSubmit={e=>{e.preventDefault();if(message.trim())interact('custom',message)}}><input aria-label="Say something" maxLength={240} placeholder={`Say something to ${npc.name}…`} value={message} onChange={e=>setMessage(e.target.value)}/><button type="submit" disabled={thinking||!message.trim()}>Send</button></form>
    </section>}
    {menu&&<div className="life-modal-back"><section className="life-phone" role="dialog" aria-modal="true" aria-label="Campus phone"><header><div><small>CAMPUSVERSE</small><h2>Your phone</h2></div><button onClick={()=>setMenu(null)}>✕</button></header><nav>{(['relationships','schedule','stories','character'] as const).map(t=><button key={t} aria-pressed={menu===t} onClick={()=>setMenu(t)}>{t}</button>)}</nav>
      <div className="phone-content">{menu==='relationships'&&<><h3>Relationships</h3>{STUDENTS.filter(s=>relation(life.state,s.id).met).length===0&&<p>Meet a student to see them here.</p>}{STUDENTS.filter(s=>relation(life.state,s.id).met).map(s=>{const rel=relation(life.state,s.id);return <div className="relationship" key={s.id}><b>{s.name}</b><span>{level(rel.score)}</span><div><i style={{width:Math.max(0,Math.min(100,rel.score))+'%'}}/></div><small>{s.major} · {s.personality}</small></div>})}</>}
      {menu==='schedule'&&<><h3>Day {life.state.day} · {timeLabel(life.state.minute)}</h3><p>Follow your own schedule. Students are heading to their own activities.</p><p><b>Today:</b> {life.state.day%2?'Engineering demonstration at Q':'Club gathering at A'} · 2–5 PM</p>{STUDENTS.filter(s=>relation(life.state,s.id).met).map(s=><p key={s.id}><b>{s.name}</b> · {scheduleFor(s,life.state.minute).label}</p>)}<button onClick={()=>{life.nextDay();setMenu(null);setFeedback('A new campus day begins.')}}>Start next morning</button></>}
      {menu==='stories'&&<><h3>Journal</h3>{life.state.journal.length?life.state.journal.slice().reverse().map((entry,i)=><p key={i}>{entry}</p>):<p>Your campus stories will appear here as you meet people and try activities.</p>}</>}
      {menu==='character'&&<><h3>{playerName||'Your character'}</h3><p>Academics: {life.state.academics} · Campus involvement: {life.state.involvement}</p><p>Explore campus, meet students, and try activities.</p><button onClick={onEdit}>Edit character</button></>}</div>
    </section></div>}
  </>
}

