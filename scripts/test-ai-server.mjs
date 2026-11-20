import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
const mock=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);assert.equal(data.model,'test-model');res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({message:{content:JSON.stringify({reply:'Hello from the mock model.'})}}))})
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));const upstream=mock.address().port,port=22000+Math.floor(Math.random()*10000)
const child=spawn(process.execPath,['scripts/serve-campus.mjs'],{env:{...process.env,PORT:String(port),OLLAMA_URL:`http://127.0.0.1:${upstream}`,OLLAMA_MODEL:'test-model'},stdio:['ignore','pipe','inherit']})
try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',()=>reject(Error('server exited')))})
 const root=`http://127.0.0.1:${port}`;let response=await fetch(root);assert.equal(response.status,200);assert.match(await response.text(),/Nest Life/)
 response=await fetch(root+'/api/campus-class',{method:'POST',headers:{'Content-Type':'application/json',Origin:root},body:JSON.stringify({kind:'question',subject:'Robotics',topic:'Kinematics',question:'Why?'})});assert.equal(response.status,200);assert.equal((await response.json()).reply,'Hello from the mock model.')
 response=await fetch(root+'/api/campus-dialogue',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.invalid'},body:'{}'});assert.equal(response.status,403)
 console.log('Built-game server, Ollama proxy and origin validation verified')
}finally{child.kill();mock.close()}
