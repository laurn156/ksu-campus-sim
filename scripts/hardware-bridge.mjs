// USB stays local to this computer and is opened only while a player is connected.
import { WebSocketServer } from 'ws'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const script=fileURLToPath(new URL('../hardware/elegoo/serial_bridge.py',import.meta.url))
const server=new WebSocketServer({host:'127.0.0.1',port:18763,verifyClient:({origin})=>/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)})
server.on('error',error=>{if(error.code==='EADDRINUSE'){console.log('Hardware bridge is already running.');process.exit(0)}console.error('Hardware bridge could not start:',error.message);process.exit(1)})
let active=false
server.on('connection',socket=>{
 if(active){socket.close(1013,'Controller already in use');return} active=true
 const child=spawn('python3',['-u',script],{stdio:['pipe','pipe','pipe']});let buffer=''
 child.stdout.on('data',chunk=>{buffer+=chunk.toString();let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(line&&socket.readyState===1)socket.send(line)}})
 child.stderr.on('data',data=>console.error('serial error',data.toString()));child.on('close',()=>{if(socket.readyState===1)socket.close(1011,'Could not read the Mega')})
 socket.on('message',data=>{if(data.length<128&&child.stdin.writable)child.stdin.write(data.toString()+'\n')})
 socket.on('close',()=>{child.kill();active=false})
 socket.on('error',()=>child.kill())
})
console.log('Nest Life hardware bridge listening on 127.0.0.1:18763')
