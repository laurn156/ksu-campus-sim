import type { LifeState, SocialAction } from './simulation'
import { moodFor, type StudentProfile } from './students'
import { relation, level } from './simulation'

/** Optional developer-supplied dialogue service. The model only returns text; game rules remain local. */
export async function optionalDialogue(npc:StudentProfile, state:LifeState, action:SocialAction, text:string, playerName:string, outcome:string, signal:AbortSignal):Promise<string|null> {
  const endpoint=import.meta.env.VITE_CAMPUS_DIALOGUE_ENDPOINT as string|undefined
  if(!endpoint)return null
  try {
    const url=new URL(endpoint,window.location.origin)
    if(url.origin!==window.location.origin)return null
    const r=relation(state,npc.id)
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({
      student:{name:npc.name,personality:npc.personality,major:npc.major,likes:npc.likes,dislikes:npc.dislikes,background:npc.background},
      playerName,day:state.day,time:state.minute,mood:moodFor(npc,state.minute,r.score),relationship:level(r.score),memories:r.memories.slice(-5),action,message:text.slice(0,240),decidedOutcome:outcome,
      constraints:'Return one short in-character reply as JSON {"reply":"..."}. Preserve the decided outcome; do not invent items, locations, completed actions or change game state.'
    })})
    if(!response.ok)return null
    const json=await response.json()
    return typeof json.reply==='string' ? json.reply.trim().slice(0,400)||null : null
  }catch{return null}
}

