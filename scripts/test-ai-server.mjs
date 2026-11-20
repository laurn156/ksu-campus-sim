import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
let lessonCalls=0
const mock=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);assert.equal(data.model,'test-model');const input=data.messages.at(-1).content;if(input.includes('Student question:')){assert.match(input,/Student question: Why\?/);assert.deepEqual(data.format.required,['reply']);assert(!input.includes('\"question\"'),'question context is plain language rather than echoed JSON')}let output={reply:'Hello from the mock model.'};if(input.includes('Topic: ohms law')){assert.match(input,/Subject: Electrical Engineering/);lessonCalls++;output=lessonCalls===1?{subject:'Electrical Engineering',topic:'ohms law'}:{explanation:'Ohm’s law relates voltage, current and resistance: V = IR.'}}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({message:{content:JSON.stringify(output)}}))})
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));const upstream=mock.address().port,port=22000+Math.floor(Math.random()*10000)
const child=spawn(process.execPath,['scripts/serve-campus.mjs'],{env:{...process.env,PORT:String(port),OLLAMA_URL:`http://127.0.0.1:${upstream}`,OLLAMA_MODEL:'test-model'},stdio:['ignore','pipe','inherit']})
try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',()=>reject(Error('server exited')))})
 const root=`http://127.0.0.1:${port}`;let response=await fetch(root);assert.equal(response.status,200);assert.match(await response.text(),/Nest Life/)
 response=await fetch(root+'/api/campus-class',{method:'POST',headers:{'Content-Type':'application/json',Origin:root},body:JSON.stringify({kind:'question',subject:'Robotics',topic:'Kinematics',question:'Why?'})});assert.equal(response.status,200);assert.equal((await response.json()).reply,'Hello from the mock model.')
 await new Promise(resolve=>setTimeout(resolve,1550))
 response=await fetch(root+'/api/campus-class',{method:'POST',headers:{'Content-Type':'application/json',Origin:root},body:JSON.stringify({kind:'lesson',subject:'Electrical Engineering',topic:'ohms law',lesson:null,history:[],question:''})});assert.equal(response.status,200);assert.match((await response.json()).lesson.explanation,/V = IR/);assert.equal(lessonCalls,2,'an echoed request is retried as a short explanation')
 response=await fetch(root+'/api/campus-dialogue',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.invalid'},body:'{}'});assert.equal(response.status,403)
 console.log('Built-game server, Ollama proxy and origin validation verified')
}finally{child.kill();mock.close()}
