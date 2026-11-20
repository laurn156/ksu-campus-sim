// Shared by the dev server (vite.config.ts) and the production server (serve-campus.mjs).
// Small local models do much better with a short plain-text brief than with raw JSON.

/** JSON schema the model must return: the student's line plus three things the player could say next. */
export const DIALOGUE_FORMAT={type:'object',properties:{reply:{type:'string'},options:{type:'object',properties:{warm:{type:'string'},playful:{type:'string'},blunt:{type:'string'}},required:['warm','playful','blunt']}},required:['reply','options']}

const str=(v,max=200)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):''
const list=(v,n=5)=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,n).map(x=>str(x,80)):[]

export function dialogueMessages(context){
  const s=context&&typeof context.student==='object'&&context.student||{}
  const name=str(s.name,30)||'the student', player=str(context.playerName,30)||'the player'
  const history=Array.isArray(context.history)?context.history.slice(-6).map(t=>t&&typeof t.content==='string'?`${t.role==='user'?'Player':name}: ${str(t.content,200)}`:'').filter(Boolean).join('\n'):''
  const memories=list(context.memories)
  const brief=[
    `You are ${name}, a ${str(s.major,60)} student at KSU Marietta. Personality: ${str(s.personality,120)}.`,
    `You like ${list(s.likes).join(', ')||'campus life'}. You dislike ${list(s.dislikes).join(', ')||'rudeness'}. Right now you are ${str(s.currentlyDoing,60)||'on campus'} and feeling ${str(context.mood,20)||'okay'}.`,
    `The player is ${player}. To you they are: ${str(context.relationship,20)||'a stranger'}.${memories.length?` You remember: ${memories.join('; ')}.`:''}`,
    history?`Conversation so far:\n${history}`:'',
    `What just happened: ${str(context.playerDid,260)||`${player} said something.`}`,
    `How you feel about it: ${str(context.reaction,10)||'neutral'}.`,
    context.decision?`Your decision (final): you ${context.decision==='accepted'?'say yes':'say no'}.`:'',
    str(context.gist,300)?`The gist of your answer (keep this meaning and these facts, but say it your own way): "${str(context.gist,300)}"`:'',
  ].filter(Boolean).join('\n')
  const system=[
    `You write dialogue for ${name} in a cozy college life game. Reply the way a real college student talks in person: relaxed, specific, a little understated.`,
    'Rules for your reply: one or two short sentences, under 30 words. Respond directly to what just happened; if you were asked a question, answer it plainly first.',
    'Match how you feel: never warmer than that. If you are annoyed or hurt, show it briefly and naturally, without drama.',
    'Only use facts from the brief. Do not invent stories, events, animals, or people. No emojis. No nicknames. Do not start with "Hey" or the player\'s name. Do not mention games, AI, or rules.',
    'Then write three short things the player might say next, under 14 words each, in the player\'s voice, each clearly responding to your reply: "warm" is kind or friendly, "playful" is lightly joking or teasing, "blunt" is honest, cool, or a bit sassy.',
    'Return only JSON: {"reply": "...", "options": {"warm": "...", "playful": "...", "blunt": "..."}}',
  ].join('\n')
  return [{role:'system',content:system},{role:'user',content:brief}]
}

const emoji=/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu
/** Remove things small models add anyway: emoji, "Hey <name>," openers, quotes, and runaway length. */
export function cleanLine(text,playerName='',maxSentences=2,maxChars=220){
  let t=str(text,600).replace(emoji,'').replace(/\s+/g,' ').trim().replace(/^["“']+|["”']+$/g,'').trim()
  const nm=str(playerName,30)
  if(nm){const short=nm.slice(0,3).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');t=t.replace(new RegExp(`^(?:(?:hey|hi|oh|so|okay|ok|well)[,!]?\\s+){0,2}${short}\\w*[,!.]?\\s+`,'i'),'')}
  t=t.replace(/^(?:hey|hi there|hiya)[,!]?\s+/i,'')
  const sentences=t.match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g)||[t]
  t=sentences.slice(0,maxSentences).map(x=>x.trim()).join(' ')
  if(t.length>maxChars)t=t.slice(0,maxChars).replace(/\s+\S*$/,'')+'…'
  return t?t[0].toUpperCase()+t.slice(1):''
}
export function parseDialogue(raw,playerName){
  let data={};try{data=typeof raw==='string'?JSON.parse(raw):raw||{}}catch{return null}
  const reply=cleanLine(data.reply,playerName)
  if(!reply)return null
  const o=data.options&&typeof data.options==='object'?data.options:{}
  const options={warm:cleanLine(o.warm,'',2,90),playful:cleanLine(o.playful,'',2,90),blunt:cleanLine(o.blunt,'',2,90)}
  return {reply,options:options.warm&&options.playful&&options.blunt?options:null}
}
