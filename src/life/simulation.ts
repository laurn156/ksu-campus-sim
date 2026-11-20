import { STUDENTS, moodFor, scheduleFor, type StudentId, type StudentProfile } from './students'
export type Needs = { hunger:number; energy:number; social:number; fun:number }
export type Relation = { score:number; met:boolean; memories:string[]; interactions:number; story:number; lastDay:number; recent?:string[] }
export type LifeState = { version:1; minute:number; day:number; needs:Needs; academics:number; involvement:number; relations:Record<string,Relation>; journal:string[] }
export type SocialAction = 'introduce'|'chat'|'know'|'day'|'joke'|'compliment'|'interests'|'hangout'|'lunch'|'study'|'clubs'|'friend'|'tease'|'challenge'|'story'|'disagree'|'complain'|'argue'|'custom'|'apologize'|'gossip'|'secret'|'flirt'|'drama'|'favor'|'insult'
/** What the game should do after a reply: start an outing, a game or a favor quest. */
export type Outing = 'lunch'|'study'|'hangout'|'game'|'favor'
export type TalkOutcome = { reaction:'positive'|'neutral'|'negative'; delta:number; accepted?:boolean; outing?:Outing }
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
export const STAGES=[{name:'Stranger',at:-14},{name:'Acquaintance',at:8},{name:'Friend',at:30},{name:'Close Friend',at:55},{name:'Best Friend',at:80}] as const
export function level(score:number){return score<=-15?'Rival':[...STAGES].reverse().find(s=>score>=s.at)!.name}
/** Progress (0..1) toward the next stage, for the small relationship bar. */
export function stageProgress(score:number){if(score<=-15)return Math.min(1,(-score-15)/85);const i=[...STAGES].reverse().findIndex(s=>score>=s.at),cur=STAGES[STAGES.length-1-i],next=STAGES[STAGES.length-i];return next?Math.max(0,Math.min(1,(score-cur.at)/(next.at-cur.at))):1}
/** Relationship score needed before an interaction is offered. */
export const UNLOCK:Partial<Record<SocialAction,number>>={gossip:8,drama:8,hangout:8,flirt:30,favor:30,secret:55}
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
// Small deterministic random so the same situation reacts the same way (and tests stay stable).
function chance(...parts:(string|number)[]){let h=2166136261;for(const c of parts.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000}
const pick=<T,>(list:readonly T[],seed:number)=>list[Math.floor(seed*list.length)%list.length]
const INVITES:SocialAction[]=['hangout','lunch','study','friend','challenge','favor']
const MEAN:SocialAction[]=['tease','disagree','complain','argue','insult']

/** Gossip about another student, drawn from their real relationships and projects. */
export function gossipLine(npc:StudentProfile,seed:number){
  const others=STUDENTS.filter(s=>s.id!==npc.id), linked=Object.keys(npc.relationships) as StudentId[]
  const other=STUDENTS.find(s=>s.id===pick(linked.length?linked:others.map(o=>o.id),seed))!
  const rel=npc.relationships[other.id]
  return pick([
    `Did you hear ${other.name} has been ${other.background.replace(/^\w+ is /,'').replace(/\.$/,'')}? ${rel==='friendly rival'?'Not that I’m keeping track.':'Honestly kind of impressive.'}`,
    `${other.name} told me they can’t stand ${other.dislikes[0]}. So maybe don’t bring that up.`,
    `Apparently ${other.name} is really into ${other.likes[0]} lately. Like, really into it.`,
    `${other.name} and I ${rel?`are ${rel}s, but`:'don’t talk much, but'} I heard they were up all night working on something.`,
  ],chance(seed,'g'))
}
const DRAMA=['Someone keeps reserving the good table at Stingers with a single notebook. Every. Day.','The robotics and architecture clubs are fighting over the same room for the showcase.','Somebody painted a mustache on the Slap the Rock handprints. Nobody knows who.','There’s a rumor the Big Owl Bus driver has a secret playlist. People are obsessed.','The library printer ate three people’s essays this morning. Pure chaos.']

export function talk(state:LifeState,id:StudentId,action:SocialAction,text='',playerName='student'):{state:LifeState;reply:string;outcome:TalkOutcome} {
  const npc=STUDENTS.find(s=>s.id===id);if(!npc)return {state,reply:'See you around!',outcome:{reaction:'neutral',delta:0}}
  const prev=relation(state,id), t=npc.traits, seed=chance(id,action,state.day,prev.interactions,text)
  const mood=moodFor(npc,state.minute,prev.score), grumpy=mood==='guarded'||mood==='tired'||mood==='focused'
  const custom=text.trim().slice(0,240), lower=custom.toLowerCase()
  const rude=/(stupid|hate|idiot|shut up|loser|dumb)/i.test(lower), positive=/(thank|nice|help|friend|great|love|sorry)/i.test(lower)
  const topic=npc.likes.find(l=>lower.includes(l)) ?? (/robot/i.test(lower)?'robotics':/game|play/i.test(lower)?'games':/club/i.test(lower)?'clubs':/study|class|exam/i.test(lower)?'studying':undefined)
  const repeated=(prev.recent??[]).filter(a=>a===action).length>=2 && action!=='custom'
  const loves=npc.loves.includes(action), hates=npc.hates.includes(action), invite=INVITES.includes(action), mean=MEAN.includes(action)||rude
  const memories=[...prev.memories]
  const remember=(m:string)=>{const i=memories.indexOf(m);if(i>=0)memories.splice(i,1);memories.push(m)}
  let delta=0, reaction:TalkOutcome['reaction']='neutral', accepted:boolean|undefined, outing:Outing|undefined, reply=''

  if(action==='introduce'){delta=prev.met?0:5;reaction='positive';reply=prev.met?`We’ve met, ${playerName}! Good to see you again.`:`Hi, ${playerName}! I’m ${npc.name}. I study ${npc.major}. ${npc.background}`}
  else if(action==='custom' && isMemoryQuestion(custom)){
    if(!prev.met)reply=`I don’t think we’ve met yet. I’m ${npc.name} — it’s nice to meet you!`
    else if(prev.memories.length){const memory=prev.memories[prev.memories.length-1];reply=[`Yeah, ${playerName}. I remember ${memory}.`,`Yeah, ${playerName}. We talked about ${memory}.`,`I do, ${playerName}. I remember ${memory} from before.`][prev.interactions%3]}
    else reply=[`Yeah, ${playerName}, we’ve met. I’m still getting to know you.`,`I remember meeting you, ${playerName}. We haven’t talked about much yet.`,`Yeah, ${playerName}. Good to see you again.`][prev.interactions%3]
    delta=1
  }
  else if(!prev.met && action!=='custom'){reply=`Hi! I’m ${npc.name}. Before we get into that, what should I call you?`;delta=1}
  else if((UNLOCK[action]??-99)>prev.score){reply=pick(['Uh, we don’t really know each other that well yet.','That’s a little much. We just met.','Let’s maybe hang out more first?'],seed);delta=-1;reaction='negative'}
  else if(repeated && !mean){reply=pick([`You asked me that already, ${playerName}.`,'Didn’t we just do this?','Ha, again? Let’s talk about something else.'],seed);delta=action==='compliment'?-2:0;reaction='neutral'}
  else if(invite){
    // Acceptance depends on friendship, personality, mood and what they're busy with.
    const busy=/class|studio|exam/.test(scheduleFor(npc,state.minute).label)&&action!=='study'
    const need=action==='friend'?30:0
    const fit=action==='study'?t.studious:action==='challenge'?t.competitive:action==='hangout'?t.social:action==='lunch'?.5+t.social*.3:action==='favor'?.6:.5
    const odds=.1+Math.max(0,prev.score)/55+fit*.45+(loves?.25:0)-(hates?.45:0)-(grumpy?.2:0)-(busy?.35:0)
    accepted=prev.score>=need && prev.score>-5 && (action==='favor'||chance(seed,'yes')<odds)
    if(action==='friend'&&!accepted)reply=prev.score<need?`I’d like to get to know you better first, ${playerName}.`:'Let’s keep hanging out and see, okay?'
    else if(!accepted)reply=busy?`I can’t right now — I’m in the middle of ${scheduleFor(npc,state.minute).label}.`:hates?pick(['Hm, that’s really not my thing.','I’ll pass on that one, honestly.'],seed):pick([`Maybe another time, ${playerName}.`,'Not today, sorry.','I’m kind of wiped right now. Rain check?'],seed)
    delta=accepted?(action==='friend'?6:3):hates?-2:0; reaction=accepted?'positive':hates?'negative':'neutral'
    if(accepted){
      outing=action==='lunch'?'lunch':action==='study'?'study':action==='hangout'?'hangout':action==='challenge'?'game':action==='favor'?'favor':undefined
      const rematch=prev.memories.some(m=>/^you beating me/.test(m))
      reply=({lunch:'Sure, I could eat. Stingers?',study:t.studious>.6?'Yes, please. I need the motivation. Library?':'Fine, but we’re taking breaks. Library?',hangout:'Sure, let’s walk around for a bit.',challenge:rematch?'Rematch? You’re on. Slap the Rock, let’s go.':t.competitive>.7?'Oh, you’re going down. Slap the Rock — whoever gets more slaps wins.':'Okay, sure. Slap the Rock?',friend:`Yeah, ${playerName}. I think we’re friends now.`,favor:''} as Record<string,string>)[action]
      if(action==='favor')reply=pick(['You’re the best. Could you grab me a coffee from Stingers? I’ll be right here.','Could you run to the library and check if my book came in? I’d owe you one.'],seed)
      if(action==='friend')remember('becoming friends')
    }
  }
  else if(mean){
    // Some people enjoy banter; most take it badly. Sensitive people take it worst.
    const banter=(action==='tease'&&t.humor>.55&&prev.score>=8&&!grumpy)||(action==='disagree'&&loves)
    if(banter){delta=2;reaction='positive';reply=action==='disagree'?pick(['Okay, fair point. But Kennesaw still wins.','Ha, I like that you push back.'],seed):pick(['Wow. Okay. I walked into that one.','Rude. Funny, but rude.'],seed)}
    else{const base=action==='insult'||rude?10:action==='argue'?6:action==='tease'?3:2;delta=-Math.round(base*(1+t.sensitive*.6));reaction='negative'
      reply=t.sensitive>.6?pick(['That actually kind of hurt.','Why would you say that?','I don’t really want to talk right now.'],seed):t.competitive>.7?pick(['Oh, it’s like that? Fine.','Bold of you. We’ll see.'],seed):pick(['Okay, that wasn’t cool.','Wow. Alright then.','Can we not do this?'],seed)
      if(action==='argue'||action==='insult')remember('arguing with you')}
  }
  else{
    let base=({chat:2,day:2,know:3,compliment:3,interests:3,joke:3,story:3,flirt:2,gossip:2,drama:2,secret:5,apologize:0,clubs:2,custom:positive?3:1} as Partial<Record<SocialAction,number>>)[action]??2
    if(action==='joke'||action==='story')base=Math.round(base*(.4+t.humor))
    if(action==='flirt')base=t.social>.7&&!hates?3:-3
    if(action==='apologize'){const owed=prev.memories.includes('arguing with you');base=owed?6:0;if(owed)memories.splice(memories.indexOf('arguing with you'),1),remember('you apologized')}
    const flat=chance(seed,'flat')<(grumpy?.35:.12)
    delta=hates?-3:flat?0:Math.round(base*(loves?1.8:1)*(grumpy?.6:1)); reaction=delta>0?'positive':delta<0?'negative':'neutral'
    const s=scheduleFor(npc,state.minute).label
    reply=hates?pick(['Not really my thing, honestly.','Hm. Okay.','Can we talk about something else?'],seed)
      :flat?pick(['Ha. Yeah.','Mm-hm.','Sorry, I’m a little distracted.'],seed)
      :action==='day'?pick([`Pretty good. I’ve been ${s}.`,`Long day. ${s[0].toUpperCase()+s.slice(1)} took forever.`],seed)
      :action==='know'||action==='interests'||action==='clubs'?`I’m into ${npc.likes.join(', ')}. ${npc.background}`
      :action==='compliment'?pick(['Oh! Thanks, that’s nice of you.','Stop, you’re going to make me blush.'],seed)
      :action==='joke'||action==='story'?(t.humor>.7?pick(['Okay, that one got me.','I’m stealing that.'],seed):t.humor<.4?'Ha. I get it.':'That was pretty good.')
      :action==='flirt'?(delta>0?'Smooth. I’ll allow it.':'Oh. Um. Let’s just stay friends.')
      :action==='gossip'?gossipLine(npc,seed)
      :action==='drama'?pick(DRAMA,seed)
      :action==='secret'?`Okay, promise you won’t tell anyone? ${pick(npc.secrets,seed)}`
      :action==='apologize'?(base?'Thanks. I appreciate that. We’re good.':'Apologize? For what? We’re fine.')
      :action==='custom'&&topic?`${topic[0].toUpperCase()+topic.slice(1)}? ${npc.likes.includes(topic)?'That’s one of my favorite things.':'That reminds me of something on campus.'} I’ll remember you brought it up.`
      :action==='custom'?`I hear you, ${playerName}. Tell me more sometime.`
      :prev.memories.length?`Hey ${playerName}! I remember ${prev.memories[prev.memories.length-1]}. Good to see you again.`
      :`It’s good to see you, ${playerName}. I’ve been ${s}.`
    if(action==='secret')remember('sharing a secret')
  }
  if(topic && !memories.includes(topic))memories.push(topic)
  // Small storylines advance only through supported interactions and on a later day.
  const startsStory = prev.met && (id==='imani' && (topic==='robotics'||action==='interests') || id==='nico' && action==='challenge' || id==='devon' && (action==='study'||action==='day') || id==='tess' && (action==='clubs'||action==='drama') || id==='marisol' && (action==='joke'||action==='story') || id==='jordan' && action==='interests' || id==='riley' && action==='disagree')
  const story = startsStory && prev.story===0 ? 1 : prev.story===1 && state.day>prev.lastDay ? 2 : prev.story
  if(story===1 && prev.story===0) reply += ({imani:' I am trying to get a robot project working.',nico:' I will remember that challenge.',devon:' I have been feeling overwhelmed with studying lately.',tess:' Our club is planning a gathering at the Student Center.',marisol:' I have a campus story to tell you next time.',jordan:' I am debugging a hackathon project.',riley:' Kennesaw still has the best campus, obviously.'} as const)[id]
  if(story===2 && prev.story===1) reply += ({imani: prev.score>=0?' My robot is finally moving; thanks for remembering the project!':' My robot is moving now. Maybe we can start over sometime.',nico:' Still up for that challenge? The recreation center is a good place to unwind.',devon: prev.score>=0?' Your company helped me take a breather.':' I am taking some time to focus on myself.',tess:' The club gathering is coming together at the Student Center.',marisol:' Remember that joke? I told it to someone else and they groaned even louder.',jordan:' The project is finally running!',riley:' Maybe Marietta has a few good spots too.'} as const)[id]
  const score=Math.max(-100,Math.min(100,prev.score+delta))
  const updated:Relation={score,met:true,memories:memories.slice(-8),interactions:prev.interactions+1,story,lastDay:story!==prev.story?state.day:prev.lastDay,recent:[...(prev.recent??[]),action].slice(-4)}
  const next=advance(state,5)
  next.needs={...next.needs,social:clamp(next.needs.social+(reaction==='negative'?-3:6)),fun:clamp(next.needs.fun+(action==='joke'||action==='story'?5:0))}
  next.relations={...next.relations,[id]:updated}
  next.journal=[...next.journal,`Day ${state.day}: ${npc.name} — ${topic?('talked about '+topic):action==='introduce'?'met on campus':action==='custom'?'shared a conversation':action}${reaction==='negative'?' (it went badly)':''}.`].slice(-30)
  return {state:next,reply,outcome:{reaction,delta,accepted,outing}}
}

/** Results of activities done together (lunch, study, games, favors) feed back into the relationship. */
export function recordEvent(state:LifeState,id:StudentId,memory:string,delta:number,journal?:string):LifeState{
  const prev=relation(state,id),memories=[...prev.memories.filter(m=>m!==memory),memory].slice(-8)
  const npc=STUDENTS.find(s=>s.id===id)
  return {...state,relations:{...state.relations,[id]:{...prev,met:true,score:Math.max(-100,Math.min(100,prev.score+delta)),memories}},journal:journal?[...state.journal,`Day ${state.day}: ${journal}`].slice(-30):npc?[...state.journal,`Day ${state.day}: ${npc.name} — ${memory}.`].slice(-30):state.journal}
}

/** Something a nearby student might walk up and say, based on memories and friendship. */
export function npcOpener(state:LifeState,id:StudentId):{line:string;suggest?:SocialAction}|null{
  const npc=STUDENTS.find(s=>s.id===id),r=relation(state,id);if(!npc||r.score<=-15)return null
  const seed=chance(id,state.day,Math.floor(state.minute/30))
  if(r.memories.some(m=>/^you beating me/.test(m))&&npc.traits.competitive>.4)return {line:pick(['Hey! I’ve been practicing. Rematch at the Rock?','You got lucky last time. Rematch?'],seed),suggest:'challenge'}
  if(r.memories.some(m=>/^beating you/.test(m)))return {line:'Still thinking about how I crushed you at the Rock, by the way.',suggest:'challenge'}
  if(r.memories.includes('arguing with you'))return {line:pick(['Hey… about earlier. That got a little heated.','Can we talk? I didn’t like how that went last time.'],seed),suggest:'apologize'}
  if(!r.met)return npc.traits.social>.7?{line:`Hey, I don’t think we’ve met! I’m ${npc.name}.`,suggest:'introduce'}:null
  if(r.score>=30&&seed<.3)return {line:'Hey, can I ask you a small favor?',suggest:'favor'}
  if(r.score>=55&&seed<.5)return {line:'Okay, I have to tell someone something. Got a sec?',suggest:'secret'}
  if(r.score>=8&&seed<.75)return {line:pick(['You will not believe what I just heard.','Okay, campus drama update. You ready?'],seed),suggest:seed<.6?'gossip':'drama'}
  return {line:pick(['Hey! Want to grab lunch at some point?','Hey, what are you up to?','Oh hey, you! Got a minute?'],seed),suggest:seed<.4?'lunch':'chat'}
}
