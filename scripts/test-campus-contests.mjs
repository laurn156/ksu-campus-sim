import http from 'node:http'
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
import { installDemoRelay } from './demo-relay.mjs'
const server=http.createServer();installDemoRelay(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port
function client(name){return new Promise((resolve,reject)=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/api/demo-world',{origin:'http://127.0.0.1:'+port}),events=[];ws.on('error',reject);ws.on('message',d=>events.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({type:'join',name,look:{color:'blue'}}));resolve({ws,events})})})}
const pause=()=>new Promise(r=>setTimeout(r,130)),send=(c,m)=>c.ws.send(JSON.stringify(m))
const a=await client('A');await pause();const b=await client('B');await pause();const bi=b.events.find(e=>e.type==='welcome').id
async function start(game){send(a,{type:'contest-invite',to:bi,game});await pause();const invitation=b.events.filter(e=>e.type==='contest-invite').at(-1);assert.equal(invitation.game,game);send(b,{type:'contest-accept',session:invitation.session});await pause();const starts=a.events.filter(e=>e.type==='contest-start'&&e.session===invitation.session);assert.equal(starts.length,1);return invitation.session}
const disc=await start('disc')
send(b,{type:'contest-throw',session:disc,round:1,hit:true});await pause();assert.equal(a.events.filter(e=>e.type==='contest-turn'&&e.session===disc).length,0)
for(let i=0;i<5;i++){send(a,{type:'contest-throw',session:disc,round:i+1,hit:i<3});await pause();send(b,{type:'contest-throw',session:disc,round:i+1,hit:i<2});await pause()}
const dr=a.events.find(e=>e.type==='contest-result'&&e.session===disc);assert.equal(dr.own,3);assert.equal(dr.other,2);const db=b.events.find(e=>e.type==='contest-result'&&e.session===disc);assert.equal(db.own,2);assert.equal(db.other,3)
const race=await start('race');send(a,{type:'contest-finish',session:race,time:75.3,coins:17});await pause();assert(b.events.some(e=>e.type==='contest-opponent-finished'&&e.session===race));send(b,{type:'contest-finish',session:race,time:80.1,coins:21});await pause();const rr=a.events.find(e=>e.type==='contest-result'&&e.session===race);assert.equal(rr.own.time,75.3);assert.equal(rr.other.coins,21);assert(b.events.some(e=>e.type==='contest-result'&&e.session===race&&e.own.time===80.1))
a.ws.close();b.ws.close();await new Promise(r=>server.close(r));console.log('Two-player disc golf turns, scores, race times and coin totals passed')
