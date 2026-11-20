import type { LifeState, SocialAction, TalkOutcome } from './simulation'
import { moodFor, scheduleFor, type StudentProfile } from './students'
import { relation, level } from './simulation'

/** The model returns dialogue only; game rules remain local. */
export type DialogueTurn = { role: 'user' | 'assistant'; content: string }
/** Three ways the player can answer, each tied to a game action so the choice still matters. */
export type ReplyOptions = { warm: string; playful: string; blunt: string }
export const TONE_ACTION: Record<keyof ReplyOptions, SocialAction> = { warm: 'chat', playful: 'joke', blunt: 'disagree' }

// Plain descriptions so the model knows what a button press meant.
const DID: Partial<Record<SocialAction, string>> = {
  introduce: 'introduced themselves', chat: 'made some small talk', day: 'asked how your day is going', know: 'asked about you and what you do', compliment: 'gave you a compliment',
  interests: 'asked what you are into', apologize: 'apologized to you', gossip: 'asked if you have heard any gossip', secret: 'asked you to share a secret', friend: 'asked if you two are friends now',
  joke: 'told you a joke', story: 'told you a funny story', tease: 'teased you', drama: 'asked about campus drama', flirt: 'flirted with you',
  lunch: 'invited you to lunch at Stingers', study: 'asked you to study together at the library', hangout: 'asked you to hang out', challenge: 'challenged you to a game at Slap the Rock', favor: 'offered to do you a favor',
  disagree: 'disagreed with you', complain: 'complained to you', argue: 'started an argument with you', insult: 'insulted you', clubs: 'asked about campus clubs',
}

const pickOne = <T,>(list: T[], seed: number) => list[Math.abs(Math.floor(seed)) % list.length]
/** Built-in reply options when the AI is unavailable: short, casual and reactive to how things went. */
export function fallbackOptions(npc: StudentProfile, reaction: TalkOutcome['reaction'], met: boolean, seed: number): ReplyOptions {
  if (!met) return { warm: 'Hi! Nice to meet you.', playful: 'Hey, you look like you know where the good snacks are.', blunt: 'Hey.' }
  if (reaction === 'negative') return { warm: pickOne(['Sorry, that came out wrong.', 'My bad. I didn’t mean it like that.'], seed), playful: pickOne(['Okay, okay, truce?', 'Too far? Too far.'], seed), blunt: pickOne(['Relax, it’s not a big deal.', 'Whatever. I said what I said.'], seed) }
  const like = npc.likes[Math.abs(Math.floor(seed)) % npc.likes.length]
  return {
    warm: pickOne(['That’s really cool.', `So how did you get into ${like}?`, 'Ha, I like that.', 'That sounds nice, honestly.'], seed),
    playful: pickOne(['Okay, but that sounds made up.', 'Bold claim. I’ll allow it.', `I bet I’m better at ${like} than you.`, 'You’re kind of a nerd, huh?'], seed + 1),
    blunt: pickOne(['Huh. Okay.', 'Not really my thing.', 'I don’t really buy that.', 'Cool, I guess.'], seed + 2),
  }
}

export async function optionalDialogue(npc:StudentProfile, state:LifeState, action:SocialAction, text:string, playerName:string, outcome:string, history:DialogueTurn[], signal:AbortSignal, result?:TalkOutcome):Promise<{reply:string;options:ReplyOptions|null}|null> {
  const endpoint='/api/campus-dialogue'
  try {
    const url=new URL(endpoint,window.location.origin)
    if(url.origin!==window.location.origin)return null
    const r=relation(state,npc.id)
    const said=text.trim().slice(0,240)
    const playerDid=said?`${playerName} said: "${said}"`:`${playerName} ${DID[action]??'said something'}.`
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({
      student:{name:npc.name,personality:npc.personality,major:npc.major,likes:npc.likes,dislikes:npc.dislikes,background:npc.background,currentlyDoing:scheduleFor(npc,state.minute).label},
      playerName,mood:moodFor(npc,state.minute,r.score),relationship:level(r.score),memories:r.memories.slice(-5),playerDid,
      // A typed question needs a real answer, so the canned line is only a guide for button actions or decisions.
      gist:said&&result?.accepted===undefined?'':outcome,
      reaction:result?.reaction??'neutral',decision:result?.accepted===undefined?null:result.accepted?'accepted':'declined',history:history.slice(-6)
    })})
    if(!response.ok)return null
    const json=await response.json()
    if(typeof json.reply!=='string'||!json.reply.trim())return null
    const o=json.options
    const options=o&&typeof o.warm==='string'&&typeof o.playful==='string'&&typeof o.blunt==='string'?{warm:o.warm.slice(0,90),playful:o.playful.slice(0,90),blunt:o.blunt.slice(0,90)}:null
    return {reply:json.reply.replace(/\p{Extended_Pictographic}/gu,'').trim().slice(0,400),options}
  }catch{return null}
}
