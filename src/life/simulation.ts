import { STUDENTS, type StudentId } from './students'
export type Needs = { hunger:number; energy:number; social:number; fun:number }
export type Relation = { score:number; met:boolean; memories:string[]; interactions:number; story:number; lastDay:number }
export type LifeState = { version:1; minute:number; day:number; needs:Needs; academics:number; involvement:number; relations:Record<string,Relation>; journal:string[] }
export type SocialAction = 'introduce'|'chat'|'know'|'day'|'joke'|'compliment'|'interests'|'hangout'|'lunch'|'study'|'clubs'|'friend'|'tease'|'challenge'|'story'|'disagree'|'complain'|'argue'|'custom'
export type Activity = 'eat'|'rest'|'sleep'|'study'|'class'|'project'|'read'|'recreation'|'club'
const clamp=(n:number)=>Math.max(0,Math.min(100,n))
export function freshLife():LifeState{return {version:1,minute:8*60,day:1,needs:{hunger:80,energy:85,social:75,fun:75},academics:0,involvement:0,relations:{},journal:[]}}
export function loadLife(user:string):LifeState {
  try {const value=JSON.parse(localStorage.getItem('campusverse-life-v1:'+user.toLowerCase())||'null')
    if(value?.version===1 && Number.isFinite(value.minute) && Number.isInteger(value.day) && value.needs && value.relations && Array.isArray(value.journal)){
      const base=freshLife()
      return {...base,...value,minute:Math.max(0,Math.min(1439,value.minute)),day:Math.max(1,value.day),needs:Object.fromEntries(Object.entries(base.needs).map(([k,v])=>[k,clamp(Number.isFinite(value.needs[k])?value.needs[k]:v)])),relations:typeof value.relations==='object'?value.relations:{},journal:value.journal.filter((v:unknown)=>typeof v==='string').slice(-30)}
    }
  } catch { /* fallback to fresh save */ }
  return freshLife()
}
export function saveLife(user:string,state:LifeState){try{localStorage.setItem('campusverse-life-v1:'+user.toLowerCase(),JSON.stringify(state))}catch{/* gameplay remains available for the session */}}
export function advance(state:LifeState,minutes:number):LifeState {
  const elapsed=Math.max(0,minutes), total=state.minute+elapsed, factor=elapsed/60
  return {...state,minute:total%1440,day:state.day+Math.floor(total/1440),needs:{hunger:clamp(state.needs.hunger-factor*2.4),energy:clamp(state.needs.energy-factor*1.6),social:clamp(state.needs.social-factor*1.1),fun:clamp(state.needs.fun-factor*1.2)}}
}
export function level(score:number){return score<=-15?'Disliked':score>=70?'Close Friend':score>=35?'Friend':score>=8?'Acquaintance':'Stranger'}
export function relation(state:LifeState,id:StudentId):Relation{return state.relations[id]??{score:0,met:false,memories:[],interactions:0,story:0,lastDay:0}}
const activityInfo:Record<Activity,{minutes:number; label:string; delta:Partial<Needs>; academics?:number; involvement?:number}> = {
  eat:{minutes:25,label:'Had a meal at Stingers',delta:{hunger:38,energy:2}},rest:{minutes:30,label:'Took a break',delta:{energy:20,fun:4}},sleep:{minutes:360,label:'Got some sleep',delta:{energy:75,hunger:-8}},study:{minutes:50,label:'Studied on campus',delta:{energy:-8,fun:-4},academics:5},class:{minutes:60,label:'Attended class',delta:{energy:-8,fun:-3},academics:8},project:{minutes:60,label:'Worked on a project',delta:{energy:-9,fun:3},academics:5,involvement:2},read:{minutes:35,label:'Read at the library',delta:{energy:-3,fun:5},academics:2},recreation:{minutes:45,label:'Enjoyed campus recreation',delta:{energy:-6,fun:30,social:5}},club:{minutes:60,label:'Joined a campus club activity',delta:{energy:-5,fun:12,social:15},involvement:8},
}
export function doActivity(state:LifeState,id:Activity):LifeState {
  const info=activityInfo[id], next=advance(state,info.minutes), needs={...next.needs}
  for(const k of Object.keys(info.delta) as (keyof Needs)[])needs[k]=clamp(needs[k]+(info.delta[k]??0))
  return {...next,needs,academics:Math.min(999,next.academics+(info.academics??0)),involvement:Math.min(999,next.involvement+(info.involvement??0)),journal:[...next.journal,`Day ${state.day}: ${info.label}.`].slice(-30)}
}
export function isMemoryQuestion(text:string){return /\b(?:remember|recall)\b.{0,30}\b(?:me|my name|who i am)\b|\b(?:met|meet)\b.{0,20}\bbefore\b|\bknow who i am\b/i.test(text)}
export function talk(state:LifeState,id:StudentId,action:SocialAction,text='',playerName='student'):{state:LifeState;reply:string} {
  const npc=STUDENTS.find(s=>s.id===id);if(!npc)return {state,reply:'See you around!'}
  const prev=relation(state,id), negative=['tease','disagree','complain','argue'].includes(action), invite=['hangout','lunch','study','friend'].includes(action)
  const custom=text.trim().slice(0,240), lower=custom.toLowerCase()
  const rude=/(stupid|hate|idiot|shut up)/i.test(lower), positive=/(thank|nice|help|friend|great|love)/i.test(lower)
  const topic=npc.likes.find(l=>lower.includes(l)) ?? (/robot/i.test(lower)?'robotics':/game|play/i.test(lower)?'games':/club/i.test(lower)?'clubs':/study|class|exam/i.test(lower)?'studying':undefined)
  const accepted= !invite || (prev.score >= (action==='friend'?35:action==='hangout'?8:3) && prev.score > -5)
  const delta=action==='introduce'&&!prev.met?5:negative||rude?-6:invite?(accepted?5:-1):action==='custom'?(positive?3:1):2
  const score=Math.max(-100,Math.min(100,prev.score+delta))
  let reply:string
  if(action==='introduce')reply=prev.met?`We’ve met, ${playerName}! Good to see you again.`:`Hi, ${playerName}! I’m ${npc.name}. I study ${npc.major}. ${npc.background}`
  else if(action==='custom' && isMemoryQuestion(custom)){
    if(!prev.met)reply=`I don’t think we’ve met yet. I’m ${npc.name} — it’s nice to meet you!`
    else if(prev.memories.length){const memory=prev.memories[prev.memories.length-1];reply=[`Yeah, ${playerName}. I remember ${memory}.`,`Yeah, ${playerName}. We talked about ${memory}.`,`I do, ${playerName}. I remember ${memory} from before.`][prev.interactions%3]}
    else reply=[`Yeah, ${playerName}, we’ve met. I’m still getting to know you.`,`I remember meeting you, ${playerName}. We haven’t talked about much yet.`,`Yeah, ${playerName}. Good to see you again.`][prev.interactions%3]
  }
  else if(!prev.met)reply=`Hi! I’m ${npc.name}. Before we make plans, what should I call you?`
  else if(invite&&!accepted)reply=action==='friend'?`I’d like to get to know you better first, ${playerName}.`:`Maybe another time, ${playerName}. Let’s chat a little more first.`
  else if(action==='know'||action==='interests'||action==='clubs')reply=`I’m into ${npc.likes.join(', ')}. ${npc.background}`
  else if(negative||rude)reply=npc.id==='marisol'?'Ouch. I can take a joke, but let’s not make it mean.': 'That didn’t feel great. Can we try a different conversation?'
  else if(action==='joke'||action==='story')reply=npc.id==='marisol'?'Okay, that one was pretty good.':npc.id==='devon'?'Okay, that was surprisingly funny.':'That was pretty good.'
  else if(action==='challenge')reply=npc.id==='nico'?'Sure, I’m up for a challenge sometime.':'I’m not quite ready to compete, but I’d cheer you on.'
  else if(invite&&accepted)reply=action==='lunch'?'Lunch sounds good! Let’s take a break together.':action==='study'?'A study session sounds great. We can compare notes.':'I’d like that. Thanks for asking!'
  else if(action==='custom'&&topic)reply=`${topic[0].toUpperCase()+topic.slice(1)}? ${npc.likes.includes(topic)?'That’s one of my favorite things.':'That reminds me of something on campus.'} I’ll remember you brought it up.`
  else if(action==='custom')reply=`I hear you, ${playerName}. ${npc.id==='devon'?'Let me think about that.':npc.id==='marisol'?'That gives me an idea for a story.':'Tell me more when we meet again.'}`
  else if(prev.memories.length)reply=`Hey ${playerName}! I remember we talked about ${prev.memories[prev.memories.length-1]}. ${npc.id==='imani'?'How is that going?':'It’s good to see you again.'}`
  else reply=`It’s good to see you, ${playerName}. ${npc.id==='imani'?'I’ve been working on a tricky project.':npc.id==='nico'?'I could use a fun challenge.':npc.id==='devon'?'I’m trying to find time for a break.':npc.id==='tess'?'There’s always something happening on campus.':'I’ve heard a few funny stories today.'}`
  const memories=[...prev.memories]
  if(topic && !memories.includes(topic))memories.push(topic)
  if(invite&&accepted)memories.push(action==='lunch'?'lunch together':action==='study'?'studying together':'hanging out')
  // Small social threads advance only through supported interactions and on a later day.
  const startsStory = prev.met && (id==='imani' && (topic==='robotics'||action==='interests') || id==='nico' && action==='challenge' || id==='devon' && (action==='study'||action==='day') || id==='tess' && action==='clubs' || id==='marisol' && (action==='joke'||action==='story'))
  const story = startsStory && prev.story===0 ? 1 : prev.story===1 && state.day>prev.lastDay ? 2 : prev.story
  if(story===1 && prev.story===0) reply += ({imani:' I am trying to get a robot project working.',nico:' I will remember that challenge.',devon:' I have been feeling overwhelmed with studying lately.',tess:' Our club is planning a gathering at the Student Center.',marisol:' I have a campus story to tell you next time.'} as const)[id]
  if(story===2 && prev.story===1) reply += ({imani: score>=0?' My robot is finally moving; thanks for remembering the project!':' My robot is moving now. Maybe we can start over sometime.',nico:' Still up for that challenge? The recreation center is a good place to unwind.',devon: score>=0?' Your company helped me take a breather.':' I am taking some time to focus on myself.',tess:' The club gathering is coming together at the Student Center.',marisol:' Remember that joke? I told it to someone else and they groaned even louder.'} as const)[id]
  const updated:Relation={score,met:true,memories:memories.slice(-8),interactions:prev.interactions+1,story,lastDay:story!==prev.story?state.day:prev.lastDay}
  const next=advance(state,invite&&accepted?25:5)
  next.needs={...next.needs,social:clamp(next.needs.social+(negative||rude?-3:8)),fun:clamp(next.needs.fun+(action==='joke'||action==='story'?5:invite&&accepted?7:0))}
  next.relations={...next.relations,[id]:updated}
  next.journal=[...next.journal,`Day ${state.day}: ${npc.name} — ${topic?('talked about '+topic):action==='introduce'?'met on campus':action==='custom'?'shared a conversation':action}.`].slice(-30)
  return {state:next,reply}
}

