import { useEffect, useRef, useState } from 'react'
import { activityState } from '../activities/activityState'
import { sfx } from '../audio/sfx'
import { indoorState } from '../scene/indoorState'
import { player } from '../scene/Player'
import { scrappy } from '../scene/Scrappy'

type Line={role:'user'|'assistant';content:string}
type Options={warm:string;playful:string;blunt:string}
const startOptions:Options={warm:'How have you been?',playful:'What have you been up to, Scrappy?',blunt:'Tell me about campus.'}
function fallback(text:string){
 const t=text.toLowerCase()
 if(/how.*(you|been)|how('|’)s.*(day|going)/.test(t))return 'I’ve been doing great, thanks for asking! It’s always fun seeing Owls around campus.'
 if(/scrappy hour|event|hour/.test(t))return 'Come hang out at Scrappy Hour! Check the campus event listings for the details.'
 if(/food|eat|lunch|hungry/.test(t))return 'Stingers is a good spot to grab a bite. What are you in the mood for?'
 if(/class|study|school|exam/.test(t))return 'You’ve got this! Take a break when you need one, and keep going.'
 if(/how|what|where|when|why|who/.test(t))return 'Hmm, I’m not sure about that one. What else would you like to know?'
 return 'That sounds fun! What else have you been up to?'
}
function playGreeting(){
 if(sfx.muted)return
 try{
  const sound=new Audio('/audio/scrappy-hooty.wav');sound.volume=.85
  void sound.play().catch(()=>{if('speechSynthesis' in window&&!sfx.muted){const speech=new SpeechSynthesisUtterance('Hooty hoo!');speech.rate=.9;speech.pitch=1.25;window.speechSynthesis.speak(speech)}})
 }catch{/* The conversation remains usable if the device has no audio. */}
}
export function ScrappyChat({playerName}:{playerName:string}){
 const [open,setOpen]=useState(false),[lines,setLines]=useState<Line[]>([]),[text,setText]=useState(''),[thinking,setThinking]=useState(false),[options,setOptions]=useState<Options>(startOptions)
 const abortRef=useRef<AbortController|null>(null),ownsLock=useRef(false),openRef=useRef(false),history=useRef<Line[]>([])
 const close=()=>{abortRef.current?.abort();abortRef.current=null;openRef.current=false;setOpen(false);setThinking(false);if(ownsLock.current){activityState.locked=false;ownsLock.current=false}}
 useEffect(()=>{
  const greet=()=>{if(openRef.current||activityState.locked||indoorState.active||player.view||Math.hypot(scrappy.x-player.x,scrappy.z-player.z)>=5)return
   openRef.current=true;ownsLock.current=true;activityState.locked=true;history.current=[];setLines([{role:'assistant',content:'Hooty Hoo! How’s it going?'}]);setOptions(startOptions);setText('');setOpen(true);playGreeting()
   window.dispatchEvent(new CustomEvent('campus-action',{detail:{kind:'scrappy',allowed:!player.travelOrigin}}))
  }
  window.addEventListener('open-scrappy',greet)
  return()=>{window.removeEventListener('open-scrappy',greet);abortRef.current?.abort();if(ownsLock.current)activityState.locked=false}
 },[])
 const say=(raw:string)=>{
  const value=raw.trim().slice(0,240);if(!value||thinking)return
  setText('');setThinking(true);setLines(old=>[...old,{role:'user',content:value}]);const prior=history.current.slice(-6)
  const controller=new AbortController();abortRef.current=controller;const timeout=window.setTimeout(()=>controller.abort(),30000)
  const finish=(reply:string,next:Options|null)=>{if(!openRef.current||abortRef.current!==controller)return;setLines(old=>[...old,{role:'assistant',content:reply}]);history.current=[...prior,{role:'user' as const,content:value},{role:'assistant' as const,content:reply}].slice(-8);setOptions(next??startOptions)}
  void fetch('/api/campus-dialogue',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({student:{name:'Scrappy',role:'mascot'},playerName,playerDid:value,history:prior})})
   .then(async r=>{if(!r.ok)throw Error('Dialogue unavailable');return await r.json() as {reply?:unknown;options?:Partial<Options>}})
   .then(data=>{const o=data.options;const next=o&&typeof o.warm==='string'&&typeof o.playful==='string'&&typeof o.blunt==='string'?{warm:o.warm.slice(0,90),playful:o.playful.slice(0,90),blunt:o.blunt.slice(0,90)}:null;finish(typeof data.reply==='string'&&data.reply.trim()?data.reply.trim().slice(0,400):fallback(value),next)})
   .catch(()=>finish(fallback(value),null))
   .finally(()=>{clearTimeout(timeout);if(abortRef.current===controller){abortRef.current=null;setThinking(false)}})
 }
 if(!open)return null
 return <section className="chat scrappy-chat" role="dialog" aria-label="Talking with Scrappy"><header><div><h2>Scrappy 🦉</h2><small>KSU’s campus mascot</small></div><button onClick={close} aria-label="End conversation">✕</button></header><div className="chat-log">{lines.map((line,i)=><p key={i} className={'line '+(line.role==='user'?'you':'npc')}>{line.content}</p>)}{thinking&&<p className="line npc">Thinking…</p>}</div>{!thinking&&<div className="chat-replies">{(['warm','playful','blunt'] as const).map(tone=><button key={tone} onClick={()=>say(options[tone])}>{options[tone]}</button>)}</div>}<form onSubmit={e=>{e.preventDefault();say(text)}}><input aria-label="Say something to Scrappy" placeholder="Ask Scrappy something…" maxLength={240} value={text} onChange={e=>setText(e.target.value)}/><button disabled={thinking||!text.trim()}>Send</button></form></section>
}
