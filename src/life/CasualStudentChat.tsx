import { useEffect, useRef, useState } from 'react'
import { community } from '../scene/Community'
import { indoorState } from '../scene/indoorState'
import { activityState } from '../activities/activityState'
import { campusStudentName } from './campusNames'

type Target={kind:'ambient'|'indoor'|'patio';id:number;name?:string}
type Line={who:'you'|'student';text:string}
function fallback(text:string){
 const t=text.toLowerCase()
 if(/food|eat|lunch|hungry/.test(t))return 'Stingers is a good place to grab something between classes.'
 if(/class|study|homework|major/.test(t))return 'Classes have been keeping me busy. What are you studying?'
 if(/bus|shuttle/.test(t))return 'The Big Owl Bus makes it easier to get around campus.'
 if(/hello|hey|hi\b/.test(t))return 'Hey! How is your day going?'
 if(/campus|here|marietta/.test(t))return 'There is always something happening around campus.'
 return 'That is interesting. How has your day been going?'
}
export function CasualStudentChat(){
 const [target,setTarget]=useState<Target|null>(null),[lines,setLines]=useState<Line[]>([]),[text,setText]=useState(''),[thinking,setThinking]=useState(false)
 const controller=useRef<AbortController|null>(null),ownsLock=useRef(false)
 const close=()=>{controller.current?.abort();controller.current=null;setThinking(false);setTarget(null);community.ambientTalking=null;indoorState.talkingNpc=null;if(ownsLock.current){activityState.locked=false;ownsLock.current=false}}
 useEffect(()=>{
  const open=(event:Event)=>{const d=(event as CustomEvent<Target>).detail;if(!d||activityState.locked)return
   if(d.kind==='ambient'){if(indoorState.active||!community.ambient[d.id])return;community.ambientTalking=d.id}
   else if(d.kind==='patio'){if(indoorState.active||!community.patio[d.id])return}
   else {if(!indoorState.active||!indoorState.npcIds.includes(d.id))return;indoorState.talkingNpc=d.id}
   activityState.locked=true;ownsLock.current=true;setTarget({...d,name:campusStudentName(d.kind,d.id,d.kind==='indoor'?indoorState.location:'campus')});setLines([{who:'student',text:'Hey! How is your day going?'}]);setText('')
  }
  window.addEventListener('open-casual-student',open)
  return()=>{window.removeEventListener('open-casual-student',open);controller.current?.abort();community.ambientTalking=null;indoorState.talkingNpc=null;if(ownsLock.current){activityState.locked=false;ownsLock.current=false}}
 },[])
 useEffect(()=>{if(!target)return;const timer=setInterval(()=>{if(target.kind==='indoor'&&!indoorState.active)close()},300);return()=>clearInterval(timer)},[target])
 const say=(raw:string)=>{const value=raw.trim().slice(0,240);if(!value||thinking)return;setText('');setLines(old=>[...old,{who:'you',text:value}]);setThinking(true)
  const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),12000)
  void fetch('/api/campus-dialogue',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({student:{name:target?.name??'Student',personality:'friendly college student',background:'A student spending time at KSU Marietta'},playerDid:value,history:lines.slice(-6).map(l=>({role:l.who==='you'?'user':'assistant',content:l.text}))})}).then(async r=>r.ok?await r.json():null).then(data=>{if(!abort.signal.aborted)setLines(old=>[...old,{who:'student',text:typeof data?.reply==='string'&&data.reply.trim()?data.reply.slice(0,400):fallback(value)}])}).catch(()=>{if(controller.current===abort)setLines(old=>[...old,{who:'student',text:fallback(value)}])}).finally(()=>{clearTimeout(timeout);if(controller.current===abort){controller.current=null;setThinking(false)}})
 }
 if(!target)return null
 return <section className="chat visitor-chat" role="dialog" aria-label={'Talking with '+target.name}><header><div><h2>{target.name}</h2><small>Campus conversation</small></div><button onClick={close} aria-label="End conversation">✕</button></header><div className="chat-log">{lines.map((line,i)=><p key={i} className={'line '+(line.who==='you'?'you':'npc')}>{line.text}</p>)}{thinking&&<p className="line npc">Thinking…</p>}</div><div className="chat-actions"><button disabled={thinking} onClick={()=>say('How is your day going?')}>How is your day?</button><button disabled={thinking} onClick={()=>say('What do you like about campus?')}>Talk about campus</button></div><form onSubmit={e=>{e.preventDefault();say(text)}}><input aria-label={'Say something to '+target.name} maxLength={240} placeholder="Say something…" value={text} onChange={e=>setText(e.target.value)}/><button disabled={thinking||!text.trim()}>Send</button></form></section>
}
