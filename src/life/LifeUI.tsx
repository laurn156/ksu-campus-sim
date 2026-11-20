import { activityState } from '../activities/activityState'
import { indoorState } from '../scene/indoorState'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Campus } from '../campus'
import { approach, player } from '../scene/Player'
import { community } from '../scene/Community'
import { landmarkSpots } from '../scene/Landmarks'
import { STUDENTS, moodFor, type StudentId } from './students'
import { isMemoryQuestion, level, npcOpener, relation, stageProgress, UNLOCK, type Outing, type SocialAction } from './simulation'
import { fallbackOptions, optionalDialogue, TONE_ACTION, type DialogueTurn, type ReplyOptions } from './dialogue'
import type { LifeController } from './useLife'
import { loadPhonePhotos, deletePhonePhoto } from './phonePhotos'
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

export function LifeUI({campus,life,playerName,players}:{campus:Campus;life:LifeController;playerName:string;onEdit:()=>void;players?:(selected:string)=>ReactNode}) {
  const [talking,setTalking]=useState<StudentId|null>(null),[menu,setMenu]=useState<'relationships'|'players'|'photos'|null>(null)
  const [message,setMessage]=useState(''),[feedback,setFeedback]=useState(''),[invitation,setInvitation]=useState<{id:StudentId;line:string;suggest?:SocialAction}|null>(null)
  const [open,setOpen]=useState<Category|null>('Friendly'),[suggest,setSuggest]=useState<SocialAction|null>(null),[replies,setReplies]=useState<ReplyOptions|null>(null),[more,setMore]=useState(false)
  const [thinking,setThinking]=useState(false), request=useRef<AbortController|null>(null), lastInvite=useRef(Date.now()-60000)
  const [lines,setLines]=useState<Line[]>([]), logs=useRef<Partial<Record<StudentId,Line[]>>>({}), history=useRef<Partial<Record<StudentId,DialogueTurn[]>>>({})
  const [plan,setPlan]=useState<Plan|null>(null), planRef=useRef<Plan|null>(null), [now,setNow]=useState(Date.now())
  const scroll=useRef<HTMLDivElement>(null)
  const [photos,setPhotos]=useState(loadPhonePhotos)
  useEffect(()=>{const refresh=()=>setPhotos(loadPhonePhotos());window.addEventListener('phone-photos-changed',refresh);return()=>window.removeEventListener('phone-photos-changed',refresh)},[])
  const [selectedPlayer,setSelectedPlayer]=useState('')
  useEffect(()=>{const toggle=()=>setMenu(v=>v?null:'relationships');window.addEventListener('hardware-phone',toggle);return()=>window.removeEventListener('hardware-phone',toggle)},[])
  useEffect(()=>{const openPlayers=(event:Event)=>{setSelectedPlayer((event as CustomEvent<string>).detail);setMenu('players')};const closePhone=()=>setMenu(null);window.addEventListener('connect-player',openPlayers);window.addEventListener('close-phone',closePhone);return()=>{window.removeEventListener('connect-player',openPlayers);window.removeEventListener('close-phone',closePhone)}},[])
  const npc=STUDENTS.find(s=>s.id===talking)
  const r=npc?relation(life.state,npc.id):null
  const state=useRef(life.state);state.current=life.state
  const say=(id:StudentId,line:Line)=>{logs.current[id]=[...(logs.current[id]??[]),line].slice(-24);if(id===talking||talkingRef.current===id)setLines(logs.current[id]!)}
  const talkingRef=useRef<StudentId|null>(null);talkingRef.current=talking
  const toast=(text:string)=>{setFeedback(text);setTimeout(()=>setFeedback(f=>f===text?'':f),4500)}
  const startTalk=(id:StudentId,opener?:{line:string;suggest?:SocialAction})=>{
    const rel=relation(state.current,id)
    if(!logs.current[id]?.length)logs.current[id]=[{who:'npc',text:opener?.line??(rel.met?['Oh, hey.','Hey, what’s up?','Hey! How’s it going?','Oh hi. What’s new?'][rel.interactions%4]:'Hi! I don’t think we’ve met.')}]
    else if(opener)logs.current[id]=[...logs.current[id]!,{who:'npc',text:opener.line}]
    const npcP=STUDENTS.find(s=>s.id===id)!;setReplies(fallbackOptions(npcP,'neutral',rel.met,rel.interactions));setMore(false)
    setLines(logs.current[id]!);setSuggest(opener?.suggest??null);setTalking(id);setOpen(opener?.suggest?(CATEGORIES.find(c=>c.items.some(i=>i.id===opener.suggest))?.label??'Friendly'):'Friendly')
  }
  const endTalk=()=>{request.current?.abort();setThinking(false);setTalking(null);setSuggest(null)}
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})},[lines,thinking])

  useEffect(()=>{
    const openEv=(e:Event)=>{const id=(e as CustomEvent<StudentId>).detail;const found=community.students.find(s=>s.id===id);if(found&&!player.view&&!activityState.locked&&Math.hypot(found.x-player.x,found.z-player.z)<5)startTalk(id)}
    addEventListener('open-student',openEv);return()=>removeEventListener('open-student',openEv)
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

  const interact=(action:SocialAction,text='',shown?:string)=>{
    if(!npc||thinking)return
    request.current?.abort()
    const before=level(relation(life.state,npc.id).score)
    const result=life.interact(npc.id,action,text)
    const after=relation(result.state,npc.id), o=result.outcome
    const playerLine=shown??(action==='custom'?text:LABEL[action]??action)
    say(npc.id,{who:'you',text:playerLine});setSuggest(null);setMessage('');setReplies(null)
    const previous=history.current[npc.id]??[]
    const finish=(spoken:string,options?:ReplyOptions|null)=>{
      setReplies(options??fallbackOptions(npc,o.reaction,true,after.interactions*7+o.delta))
      history.current[npc.id]=[...previous,{role:'user' as const,content:playerLine},{role:'assistant' as const,content:spoken}].slice(-8)
      say(npc.id,{who:'npc',text:spoken})
      if(o.delta)say(npc.id,{who:'note',text:`${o.delta>0?'+':'−'}${Math.abs(o.delta)} friendship`,tone:o.delta>0?'good':'bad'})
      const now=level(after.score);if(now!==before)say(npc.id,{who:'note',text:`You and ${npc.name} are now: ${now}`,tone:after.score>=relation(life.state,npc.id).score?'good':'bad'})
      if(o.accepted&&o.outing){say(npc.id,{who:'note',text:o.outing==='favor'?'Favor accepted — go to Stingers.':o.outing==='game'?`${npc.name} accepted your challenge!`:`${npc.name} is coming with you.`,tone:'good'});setTimeout(()=>{endTalk();startPlan(npc.id,o.outing!)},1300)}
      setThinking(false)
    }
    if(action==='custom'&&isMemoryQuestion(text)){finish(result.reply);return}
    const controller=new AbortController();request.current=controller;setThinking(true)
    void optionalDialogue(npc,result.state,action,text,playerName,result.reply,previous,controller.signal,o).then(ai=>{if(!controller.signal.aborted)finish(ai?.reply||result.reply,ai?.options)})
  }

  const mood=npc&&r?moodFor(npc,life.state.minute,r.score):''
  const planLeft=plan?.until?Math.max(0,Math.ceil((plan.until-now)/1000)):0
  const dist=plan?.goal?Math.round(Math.hypot(plan.goal.x-player.x,plan.goal.z-player.z)):0
  return <>
    <button className="life-phone-button" onClick={()=>setMenu('relationships')}>☰ Phone</button>
    {feedback&&<div className="life-feedback" role="status">{feedback}</div>}
    {plan&&!talking&&<div className="life-plan" role="status"><span>{plan.kind==='lunch'?'🍔':plan.kind==='study'?'📚':plan.kind==='game'?'🪨':plan.kind==='favor'?'☕':'🚶'}</span><b>{plan.label}</b>{plan.goal&&plan.phase==='going'&&<small>{dist} m</small>}{plan.phase==='hangout'&&<small>{planLeft}s</small>}{plan.phase!=='playing'&&<button onClick={cancelPlan}>Cancel</button>}</div>}
    {invitation&&!talking&&<div className="life-invite"><b>{STUDENTS.find(s=>s.id===invitation.id)?.name}</b> walks over: “{invitation.line}”<div><button onClick={()=>{startTalk(invitation.id,{line:invitation.line,suggest:invitation.suggest});setInvitation(null)}}>Talk</button><button onClick={()=>setInvitation(null)}>Not now</button></div></div>}
    {talking&&npc&&r&&<section className="chat" role="dialog" aria-label={'Talking with '+npc.name}>
      <header><div><h2>{npc.name}</h2><small>{npc.major} · {mood}</small></div><button onClick={endTalk} aria-label="End conversation">✕</button></header>
      <div className="chat-rel"><span className={'stage'+(r.score<=-15?' rival':'')}>{level(r.score)}</span><div className="bar"><i style={{width:Math.round(stageProgress(r.score)*100)+'%'}}/></div></div>
      <div className="chat-log" ref={scroll}>{lines.map((l,i)=><p key={i} className={'line '+l.who+(l.tone?' '+l.tone:'')}>{l.text}</p>)}{thinking&&<p className="line npc typing"><span/><span/><span/></p>}</div>
      {suggest&&!thinking&&<button className="chat-suggest" onClick={()=>interact(suggest)}>💬 {LABEL[suggest]}</button>}
      {replies&&!thinking&&<div className="chat-replies">{(['warm','playful','blunt'] as const).map(tone=><button key={tone} className={tone} onClick={()=>{const said=replies[tone];interact(r.met?TONE_ACTION[tone]:'introduce',r.met?said:'',said)}}><span aria-hidden="true">{tone==='warm'?'😊':tone==='playful'?'😜':'😐'}</span>{replies[tone]}</button>)}</div>}
      <button className="chat-more" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'Hide actions ▴':'More actions ▾'}</button>
      {more&&<div className="chat-cats">{CATEGORIES.map(c=><button key={c.label} aria-expanded={open===c.label} onClick={()=>setOpen(open===c.label?null:c.label)}>{c.icon} {c.label}</button>)}</div>}
      {more&&open&&<div className="chat-actions">{CATEGORIES.find(c=>c.label===open)!.items.map(a=>{const need=UNLOCK[a.id],locked=need!==undefined&&r.score<need;return <button key={a.id} disabled={locked||thinking} title={locked?`Unlocks at ${level(need!)}`:undefined} onClick={()=>interact(a.id)}>{locked?'🔒 ':''}{a.label}</button>})}</div>}
      <form onSubmit={e=>{e.preventDefault();if(message.trim())interact('custom',message)}}><input aria-label="Say something" maxLength={240} placeholder={`Say something to ${npc.name}…`} value={message} onChange={e=>setMessage(e.target.value)}/><button type="submit" disabled={thinking||!message.trim()}>Send</button></form>
    </section>}
    {menu&&<div className="life-modal-back"><section className="life-phone" role="dialog" aria-modal="true" aria-label="Campus phone"><header><div><small>NEST LIFE</small><h2>Your phone</h2></div><button onClick={()=>setMenu(null)}>✕</button></header><nav>{(['relationships',...(players?['players' as const]:[]),'photos'] as const).map(t=><button key={t} aria-pressed={menu===t} onClick={()=>setMenu(t)}>{t}</button>)}</nav>
      <div className="phone-content">{menu==='players'&&players?.(selectedPlayer)}{menu==='relationships'&&<><h3>Relationships</h3>{STUDENTS.filter(s=>relation(life.state,s.id).met).length===0&&<p>Meet a student to see them here.</p>}{STUDENTS.filter(s=>relation(life.state,s.id).met).map(s=>{const rel=relation(life.state,s.id);return <div className="relationship" key={s.id}><b>{s.name}</b><span>{level(rel.score)}</span><div><i style={{width:Math.max(0,Math.min(100,rel.score))+'%'}}/></div><small>{s.major} · {s.personality}</small></div>})}</>}
      {menu==='photos'&&<><h3>Photos</h3>{photos.length===0?<p>Photos you save in the photo booth will appear here.</p>:<div className="phone-photo-grid">{photos.map(photo=><article key={photo.id}><img src={photo.image} alt={photo.caption}/><p>{photo.caption}</p><a href={photo.image} download={`nest-life-${photo.created}.jpg`}>Download</a><button onClick={()=>deletePhonePhoto(photo.id)}>Delete</button></article>)}</div>}</>}
</div>
    </section></div>}
  </>
}

