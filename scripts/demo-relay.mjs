import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'

// Ephemeral demo sessions: the server assigns identities and never accepts a claimed sender.
export function installDemoRelay(server) {
 const wss=new WebSocketServer({noServer:true,maxPayload:8192}), clients=new Map(), requests=new Set(), friends=new Set()
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
    lastMove=Date.now();Object.assign(c.peer,{x:m.x,z:m.z,heading:m.heading,moving:m.moving===true,location:typeof m.location==='string'&&/^(campus|building:[\w-]+|bus:\d+)$/.test(m.location)?m.location:'campus'});broadcast({type:'peer',peer:c.peer},id);return
   }
   if(Date.now()-lastAction<100)return;lastAction=Date.now()
   if(m.type==='chat'&&typeof m.text==='string'&&m.text.trim()){broadcast({type:'chat',id:randomUUID(),name:c.peer.name,text:m.text.trim().slice(0,200)});return}
   if(m.type==='wave'){broadcast({type:'wave',id,name:c.peer.name});return}
   const target=typeof m.to==='string'?clients.get(m.to):null;if(!target||m.to===id)return
   if(m.type==='game'&&m.packet&&typeof m.packet==='object'&&m.packet.to===m.to&&typeof m.packet.kind==='string'&&typeof m.packet.match==='string'){send(target.ws,{type:'game',from:id,payload:m.packet});return}
   const key=pair(id,m.to)
   if(m.type==='friend-request'){if(!friends.has(key)){requests.add(id+':'+m.to);send(target.ws,{type:'friend-request',from:id});send(ws,{type:'friend-sent',to:m.to})}return}
   if(m.type==='friend-accept'&&requests.has(m.to+':'+id)){requests.delete(m.to+':'+id);friends.add(key);send(target.ws,{type:'friend-accepted',from:id});send(ws,{type:'friend-accepted',from:m.to});return}
   if(m.type==='friend-decline'){requests.delete(m.to+':'+id);send(target.ws,{type:'friend-declined',from:id});return}
   if(m.type==='dm'&&typeof m.text==='string'&&m.text.trim()){const event={type:'dm',from:id,to:m.to,text:m.text.trim().slice(0,200),id:randomUUID()};send(ws,event);send(target.ws,event)}
  })
  ws.on('close',()=>{clearTimeout(expire);if(!joined)return;clients.delete(id);for(const key of requests)if(key.split(':').includes(id))requests.delete(key);for(const key of friends)if(key.split(':').includes(id))friends.delete(key);broadcast({type:'leave',id})})
 })
 server.on('close',()=>wss.close())
 return wss
}
