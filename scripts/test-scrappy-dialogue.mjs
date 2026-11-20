import assert from 'node:assert/strict'
import fs from 'node:fs'
import { dialogueMessages, parseDialogue } from './dialogue-prompt.mjs'
const mascot=dialogueMessages({student:{name:'Scrappy',role:'mascot'},playerName:'Alex',playerDid:'How have you been?',history:[{role:'user',content:'What is happening?'},{role:'assistant',content:'It is a lovely day.'}]})
assert.match(mascot[0].content,/campus mascot/);assert.match(mascot[0].content,/Scrappy Hour/);assert.match(mascot[1].content,/How have you been/);assert.match(mascot[1].content,/lovely day/)
assert.match(dialogueMessages({student:{name:'Jordan',major:'Computer Science'},playerDid:'Hi'})[0].content,/college student/,'ordinary student dialogue stays unchanged')
assert.equal(parseDialogue('{"reply":"I am doing great!","options":{"warm":"Nice!","playful":"Hoot!","blunt":"Okay."}}','Alex').reply,'I am doing great!')
const sound=fs.readFileSync(new URL('../public/audio/scrappy-hooty.wav',import.meta.url));assert.equal(sound.toString('ascii',0,4),'RIFF');assert(sound.length>1000)
console.log('Scrappy mascot prompt, conversation history, existing student prompt, and greeting audio verified')
