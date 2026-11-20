import http from 'node:http'
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
import { installDemoRelay } from './demo-relay.mjs'
const server=http.createServer();installDemoRelay(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port
function client(name){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/demo-world`,{origin:`http://127.0.0.1:${port}`}),events=[];ws.on('error',reject);ws.on('message',d=>events.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({type:'join',name,look:{color:'blue'}}));resolve({ws,events})})})}
const delay=()=>new Promise(r=>setTimeout(r,160));const a=await client('Alice');await delay();const b=await client('Bob');await delay();const ai=a.events.find(e=>e.type==='welcome').id,bi=b.events.find(e=>e.type==='welcome').id
assert(b.events.find(e=>e.type==='welcome').peers.some(p=>p.id===ai));assert(a.events.some(e=>e.type==='peer'&&e.peer.id===bi))
const send=(c,v)=>c.ws.send(JSON.stringify(v))
send(a,{type:'move',x:12,z:14,heading:1,moving:true,location:'campus'});await delay();assert(b.events.some(e=>e.type==='peer'&&e.peer.id===ai&&e.peer.x===12))
send(a,{type:'chat',text:'hello campus'});await delay();assert(b.events.some(e=>e.type==='chat'&&e.text==='hello campus'))
send(a,{type:'friend-request',to:bi});await delay();assert(b.events.some(e=>e.type==='friend-request'&&e.from===ai));send(b,{type:'friend-accept',to:ai});await delay();assert(a.events.some(e=>e.type==='friend-accepted'&&e.from===bi))
send(a,{type:'dm',to:bi,text:'hello Bob'});await delay();assert(b.events.some(e=>e.type==='dm'&&e.from===ai&&e.text==='hello Bob'))
send(b,{type:'game',to:ai,packet:{to:ai,match:'match',kind:'invite'}});await delay();assert(a.events.some(e=>e.type==='game'&&e.from===bi&&e.payload.kind==='invite'))
b.ws.close();await delay();assert(a.events.some(e=>e.type==='leave'&&e.id===bi));a.ws.close();await new Promise(r=>server.close(r));console.log('Guest relay: movement, campus chat, friends, private messages, game invitations and disconnect passed')
