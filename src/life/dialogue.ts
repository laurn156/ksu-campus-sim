import type { LifeState, SocialAction, TalkOutcome } from './simulation'
import { moodFor, scheduleFor, type StudentProfile } from './students'
import { relation, level } from './simulation'

/** The model returns dialogue only; game rules remain local. */
export type DialogueTurn = { role: 'user' | 'assistant'; content: string }
export async function optionalDialogue(npc:StudentProfile, state:LifeState, action:SocialAction, text:string, playerName:string, outcome:string, history:DialogueTurn[], signal:AbortSignal, result?:TalkOutcome):Promise<string|null> {
  const endpoint='/api/campus-dialogue'
  try {
    const url=new URL(endpoint,window.location.origin)
    if(url.origin!==window.location.origin)return null
    const r=relation(state,npc.id)
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({
      student:{name:npc.name,personality:npc.personality,major:npc.major,likes:npc.likes,dislikes:npc.dislikes,background:npc.background,traits:npc.traits,currentlyDoing:scheduleFor(npc,state.minute).label},
      playerName,day:state.day,time:state.minute,mood:moodFor(npc,state.minute,r.score),relationship:level(r.score),hasMet:r.met,memories:r.memories.slice(-5),action,message:text.slice(0,240),gameOutcome:action==='custom'&&!result?.accepted?null:outcome,reaction:result?.reaction??'neutral',decision:result?.accepted===undefined?null:result.accepted?'accepted':'declined',history:history.slice(-6)
    })})
    if(!response.ok)return null
    const json=await response.json()
    return typeof json.reply==='string' ? json.reply.trim().slice(0,400)||null : null
  }catch{return null}
}

