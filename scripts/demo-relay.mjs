import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'

// Ephemeral demo sessions: the server assigns identities and never accepts a claimed sender.
export function installDemoRelay(server) {
 const wss=new WebSocketServer({noServer:true,maxPayload:8192}), clients=new Map(), requests=new Set(), friends=new Set(), challenges=new Map(), photos=new Map(), contests=new Map()
 const pair=(a,b)=>[a,b].sort().join(':')
 const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))}
 const broadcast=(data,except)=>{for(const [id,c] of clients)if(id!==except)send(c.ws,data)}
 server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/api/demo-world')return
  let valid=false;try{valid=new URL(req.headers.origin).host===req.headers.host}catch{}
  if(!valid||wss.clients.size>=40){socket.destroy();return}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws))
 })
 wss.on('connection',ws=>{
  const id=randomUUID();let joined=false,lastMove=0,lastAction=0
  const expire=setTimeout(()=>{if(!joined)ws.close()},10000)
  ws.on('error',()=>{})
  ws.on('message',data=>{let m;try{m=JSON.parse(data.toString())}catch{return}
   if(!m||typeof m!=='object')return
   if(!joined){
    if(m.type!=='join'||typeof m.name!=='string'||!m.name.trim()||!m.look||typeof m.look!=='object'||Array.isArray(m.look))return
    const look={};for(const [key,value] of Object.entries(m.look))if(typeof value==='string'&&value.length<=32||typeof value==='boolean')look[key]=value
    const peer={id,name:m.name.trim().slice(0,20),look,x:0,z:0,heading:0,moving:false,location:'campus',online:true}
    clients.set(id,{ws,peer});joined=true;clearTimeout(expire);send(ws,{type:'welcome',id,peers:[...clients.values()].filter(c=>c.peer.id!==id).map(c=>c.peer)});broadcast({type:'peer',peer},id);return
   }
   const c=clients.get(id);if(!c)return
   if(m.type==='move'){
    if(Date.now()-lastMove<120||![m.x,m.z,m.heading].every(Number.isFinite)||Math.abs(m.x)>10000||Math.abs(m.z)>10000)return
    lastMove=Date.now();Object.assign(c.peer,{x:m.x,y:Number.isFinite(m.y)&&Math.abs(m.y)<1000?m.y:0,z:m.z,heading:m.heading,moving:m.moving===true,slapping:m.slapping===true,activity:m.activity==='bathtub'?'bathtub':'',boosting:m.activity==='bathtub'&&m.boosting===true,discFlight:m.discFlight&&[m.discFlight.x,m.discFlight.y,m.discFlight.z].every(Number.isFinite)&&Math.abs(m.discFlight.x)<10000&&Math.abs(m.discFlight.z)<10000&&m.discFlight.y>=0&&m.discFlight.y<100?{x:m.discFlight.x,y:m.discFlight.y,z:m.discFlight.z}:null,location:typeof m.location==='string'&&/^(campus|building:[\w-]+|bus:\d+)$/.test(m.location)?m.location:'campus'});broadcast({type:'peer',peer:c.peer},id);return
   }
   if(!['photo-state','photo-shoot','photo-ready','game'].includes(m.type)){if(Date.now()-lastAction<100)return;lastAction=Date.now()}
   if(m.type==='chat'&&typeof m.text==='string'&&m.text.trim()){broadcast({type:'chat',id:randomUUID(),name:c.peer.name,text:m.text.trim().slice(0,200)});return}
   if(m.type==='wave'){broadcast({type:'wave',id,name:c.peer.name});return}
   const target=typeof m.to==='string'?clients.get(m.to):null;if((!target||m.to===id)&&!['rock-accept','rock-leave','rock-score','photo-accept','photo-leave','photo-state','photo-shoot','photo-ready','contest-accept','contest-leave','contest-throw','contest-finish'].includes(m.type))return
   if(m.type==='rock-invite'){
    if([...challenges.values()].some(v=>v.a===id||v.b===id||v.a===m.to||v.b===m.to)){send(ws,{type:'rock-unavailable'});return}
    const challenge=randomUUID();challenges.set(challenge,{a:id,b:m.to,phase:'invited',scores:{}});setTimeout(()=>{const pending=challenges.get(challenge);if(pending?.phase==='invited'){challenges.delete(challenge);for(const participant of [pending.a,pending.b])send(clients.get(participant)?.ws,{type:'rock-left',challenge})}},60000).unref();send(target.ws,{type:'rock-invite',challenge,from:id});send(ws,{type:'rock-wait',challenge,from:m.to});return
   }
   if(typeof m.challenge==='string'&&typeof m.type==='string'&&m.type.startsWith('rock-')){
    const game=challenges.get(m.challenge);if(!game||![game.a,game.b].includes(id))return
    const other=game.a===id?game.b:game.a
    if(m.type==='rock-accept'&&id===game.b&&game.phase==='invited'){game.phase='playing';game.started=Date.now()+3000;for(const participant of [game.a,game.b])send(clients.get(participant)?.ws,{type:'rock-start',challenge:m.challenge,from:participant===id?other:id,slot:participant===game.a?0:1,delay:3000});return}
    if(m.type==='rock-leave'){challenges.delete(m.challenge);send(clients.get(other)?.ws,{type:'rock-left',challenge:m.challenge});return}
    if(m.type==='rock-score'&&game.phase==='playing'&&Date.now()>=game.started+19000&&Number.isInteger(m.score)&&m.score>=0&&m.score<=1000){game.scores[id]=m.score;if(game.scores[other]!==undefined){for(const participant of [game.a,game.b])send(clients.get(participant)?.ws,{type:'rock-result',challenge:m.challenge,own:game.scores[participant],other:game.scores[participant===game.a?game.b:game.a]});challenges.delete(m.challenge)}return}
    return
   }
   if(m.type==='contest-invite'&&['disc','race'].includes(m.game)){
    if([...contests.values()].some(v=>[v.a,v.b].includes(id)||[v.a,v.b].includes(m.to))){send(ws,{type:'contest-unavailable'});return}
    const session=randomUUID(),wind=Array.from({length:5},()=>{const a=Math.random()*Math.PI*2,v=1.2+Math.random()*2;return [Math.sin(a)*v,Math.cos(a)*v]});contests.set(session,{a:id,b:m.to,game:m.game,phase:'invited',turn:id,round:0,scores:{[id]:0,[m.to]:0},results:{},wind});send(target.ws,{type:'contest-invite',session,from:id,game:m.game});send(ws,{type:'contest-wait',session,from:m.to,game:m.game});setTimeout(()=>{const g=contests.get(session);if(g?.phase==='invited'){contests.delete(session);for(const pid of [g.a,g.b])send(clients.get(pid)?.ws,{type:'contest-left',session})}},60000).unref();return
   }
   if(typeof m.session==='string'&&typeof m.type==='string'&&m.type.startsWith('contest-')){
    const g=contests.get(m.session);if(!g||![g.a,g.b].includes(id))return;const other=g.a===id?g.b:g.a
    if(m.type==='contest-leave'){contests.delete(m.session);send(clients.get(other)?.ws,{type:'contest-left',session:m.session});return}
    if(m.type==='contest-accept'&&id===g.b&&g.phase==='invited'){g.phase='playing';g.started=Date.now()+3000;for(const pid of [g.a,g.b])send(clients.get(pid)?.ws,{type:'contest-start',session:m.session,game:g.game,from:pid===g.a?g.b:g.a,slot:pid===g.a?0:1,delay:3000,wind:g.wind,turn:pid===g.a});return}
    if(m.type==='contest-throw'&&g.phase==='playing'&&g.game==='disc'&&id===g.turn&&g.round<10&&m.round===Math.floor(g.round/2)+1&&typeof m.hit==='boolean'){
     g.scores[id]+=m.hit?1:0;g.round++;if(g.round===10){for(const pid of [g.a,g.b])send(clients.get(pid)?.ws,{type:'contest-result',session:m.session,game:g.game,own:g.scores[pid],other:g.scores[pid===g.a?g.b:g.a]});contests.delete(m.session)}else{g.turn=other;for(const pid of [g.a,g.b])send(clients.get(pid)?.ws,{type:'contest-turn',session:m.session,turn:pid===g.turn,own:g.scores[pid],other:g.scores[pid===g.a?g.b:g.a],round:Math.floor(g.round/2)+1})}return
    }
    if(m.type==='contest-finish'&&g.phase==='playing'&&g.game==='race'&&Number.isFinite(m.time)&&m.time>0&&m.time<3600&&Number.isInteger(m.coins)&&m.coins>=0&&m.coins<=100&&g.results[id]===undefined){g.results[id]={time:m.time,coins:m.coins};send(clients.get(other)?.ws,{type:'contest-opponent-finished',session:m.session});if(g.results[other]){for(const pid of [g.a,g.b])send(clients.get(pid)?.ws,{type:'contest-result',session:m.session,game:g.game,own:g.results[pid],other:g.results[pid===g.a?g.b:g.a]});contests.delete(m.session)}return}
    return
   }
   if(m.type==='photo-invite'){
    if([...photos.values()].some(v=>[v.a,v.b].includes(id)||[v.a,v.b].includes(m.to))){send(ws,{type:'photo-unavailable'});return}
    const session=randomUUID();photos.set(session,{a:id,b:m.to,phase:'invited'});send(ws,{type:'photo-wait',session,from:m.to});send(target.ws,{type:'photo-invite',session,from:id});setTimeout(()=>{const p=photos.get(session);if(p?.phase==='invited'){photos.delete(session);for(const pid of [p.a,p.b])send(clients.get(pid)?.ws,{type:'photo-left',session})}},60000).unref();return
   }
   if(typeof m.session==='string'&&typeof m.type==='string'&&m.type.startsWith('photo-')){
    const p=photos.get(m.session);if(!p||![p.a,p.b].includes(id))return;const other=p.a===id?p.b:p.a
    if(m.type==='photo-leave'){photos.delete(m.session);send(clients.get(other)?.ws,{type:'photo-left',session:m.session});return}
    if(m.type==='photo-accept'&&id===p.b&&p.phase==='invited'){p.phase='active';send(ws,{type:'photo-start',session:m.session,from:p.a,host:false});send(clients.get(p.a)?.ws,{type:'photo-start',session:m.session,from:p.b,host:true});return}
    if(p.phase==='active'&&id===p.b&&m.type==='photo-ready'){send(clients.get(other)?.ws,{type:'photo-ready',session:m.session});return}
    if(p.phase==='active'&&id===p.a&&m.type==='photo-state'&&m.state&&typeof m.state==='object'){send(clients.get(other)?.ws,{type:'photo-state',session:m.session,state:m.state});return}
    if(p.phase==='active'&&id===p.a&&m.type==='photo-shoot'){send(clients.get(other)?.ws,{type:'photo-shoot',session:m.session});return}
    return
   }
   if(m.type==='game'&&m.packet&&typeof m.packet==='object'&&m.packet.to===m.to&&typeof m.packet.kind==='string'&&typeof m.packet.match==='string'){send(target.ws,{type:'game',from:id,payload:m.packet});return}
   const key=pair(id,m.to)
   if(m.type==='friend-request'){if(!friends.has(key)){requests.add(id+':'+m.to);send(target.ws,{type:'friend-request',from:id});send(ws,{type:'friend-sent',to:m.to})}return}
   if(m.type==='friend-accept'&&requests.has(m.to+':'+id)){requests.delete(m.to+':'+id);friends.add(key);send(target.ws,{type:'friend-accepted',from:id});send(ws,{type:'friend-accepted',from:m.to});return}
   if(m.type==='friend-decline'){requests.delete(m.to+':'+id);send(target.ws,{type:'friend-declined',from:id});return}
   if(m.type==='dm'&&typeof m.text==='string'&&m.text.trim()){const event={type:'dm',from:id,to:m.to,text:m.text.trim().slice(0,200),id:randomUUID()};send(ws,event);send(target.ws,event)}
  })
  ws.on('close',()=>{clearTimeout(expire);if(!joined)return;clients.delete(id);for(const [session,g] of contests)if(g.a===id||g.b===id){send(clients.get(g.a===id?g.b:g.a)?.ws,{type:'contest-left',session});contests.delete(session)}for(const [session,p] of photos)if(p.a===id||p.b===id){send(clients.get(p.a===id?p.b:p.a)?.ws,{type:'photo-left',session});photos.delete(session)}for(const [challenge,game] of challenges)if(game.a===id||game.b===id){send(clients.get(game.a===id?game.b:game.a)?.ws,{type:'rock-left',challenge});challenges.delete(challenge)}for(const key of requests)if(key.split(':').includes(id))requests.delete(key);for(const key of friends)if(key.split(':').includes(id))friends.delete(key);broadcast({type:'leave',id})})
 })
 server.on('close',()=>wss.close())
 return wss
}
