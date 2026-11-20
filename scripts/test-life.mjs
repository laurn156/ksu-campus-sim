import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const folder=await mkdtemp(join(tmpdir(),'campus-life-test-'))
await writeFile(join(folder,'students.ts'),await readFile(new URL('../src/life/students.ts',import.meta.url),'utf8'))
await writeFile(join(folder,'simulation.ts'),(await readFile(new URL('../src/life/simulation.ts',import.meta.url),'utf8')).replace("'./students'","'./students.ts'"))
const {freshLife,advance,doActivity,talk,relation,level,saveLife,loadLife,npcOpener,recordEvent}=await import(pathToFileURL(join(folder,'simulation.ts')).href)
const store=new Map()
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const first=talk(freshLife(),'imani','custom','Do you remember me?','Owl')
assert.match(first.reply,/don’t think we’ve met/i)
const again=talk(first.state,'imani','custom','Do you remember me?','Owl')
assert.match(again.reply,/Owl/)
assert.doesNotMatch(again.reply,/robotics|workshop|drone/i)
const third=talk(again.state,'imani','custom','Do you remember me?','Owl')
assert.notEqual(third.reply,again.reply)
let state=freshLife()
state=talk(state,'imani','introduce','','Owl').state
assert.equal(relation(state,'imani').met,true)
assert.equal(relation(state,'imani').score,5)
const refusal=talk(state,'imani','friend','','Owl')
assert.match(refusal.reply,/better first/)
assert.equal(level(relation(refusal.state,'imani').score),'Stranger')
state=talk(state,'imani','custom','I love robotics','Owl').state
assert.ok(relation(state,'imani').memories.includes('robotics'))
assert.match(talk(state,'imani','custom','Do you remember me?','Owl').reply,/robotics/i)
state=advance(state,1440)
const next=talk(state,'imani','chat','','Owl')
assert.match(next.reply,/robot/i)
assert.equal(relation(next.state,'imani').story,2)
state=next.state
for(let i=0;i<20;i++)state=talk(state,'imani','argue','','Owl').state
assert.equal(level(relation(state,'imani').score),'Rival')
const before={...state.needs}
const ate=doActivity(state,'eat')
assert.ok(ate.needs.hunger>before.hunger)
assert.ok(ate.minute!==state.minute)
const studied=doActivity(ate,'study')
assert.ok(studied.academics>ate.academics)
saveLife('Demo',studied)
assert.deepEqual(loadLife('Demo'),studied)
assert.notEqual(loadLife('Other').academics,studied.academics)
assert.ok(relation(studied,'imani').memories.length<=8)
// Personalities: the same interaction lands differently with different students.
const friendWith=(id)=>{let s=freshLife();s=talk(s,id,'introduce','','Owl').state;s.relations[id]={...s.relations[id],score:20};return s}
assert.ok(talk(friendWith('riley'),'riley','tease','','Owl').outcome.delta>0,'Riley enjoys banter')
assert.ok(talk(friendWith('imani'),'imani','tease','','Owl').outcome.delta<0,'Imani dislikes being teased')
// Repeating the same friendly line stops helping.
let rep=friendWith('tess');for(let i=0;i<2;i++)rep=talk(rep,'tess','chat','','Owl').state
assert.ok(talk(rep,'tess','chat','','Owl').outcome.delta<=0)
// Locked interactions and invitations that can be declined.
assert.equal(talk(friendWith('devon'),'devon','secret','','Owl').outcome.reaction,'negative')
const answers=new Set();for(let d=1;d<12;d++){let s=friendWith('devon');s={...s,day:d};answers.add(talk(s,'devon','hangout','','Owl').outcome.accepted)}
assert.ok(answers.has(true)&&answers.has(false),'invitations are sometimes declined')
// Memories from activities drive later conversations.
let mem=recordEvent(friendWith('nico'),'nico','you beating me at Slap the Rock, 90 to 70',2)
assert.match(npcOpener(mem,'nico').line,/rematch/i)
assert.equal(level(85),'Best Friend')
process.stdout.write('Campus Life simulation checks passed.\n')

await rm(folder,{recursive:true,force:true})
