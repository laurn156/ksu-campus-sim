import { sfx } from '../audio/sfx'
import { useEffect, useRef, useState } from 'react'
import { activityState } from '../activities/activityState'
import { hardware, clearHardware, validSample, type Sample } from './controller'
import './hardware.css'

type Port={readable:ReadableStream<Uint8Array>|null;writable:WritableStream<Uint8Array>|null;open:(o:{baudRate:number})=>Promise<void>;setSignals:(o:{dataTerminalReady:boolean;requestToSend:boolean})=>Promise<void>;close:()=>Promise<void>}
type Serial={requestPort:()=>Promise<Port>;addEventListener:(t:string,fn:EventListener)=>void;removeEventListener:(t:string,fn:EventListener)=>void}
const press=(key:string,code:string)=>{window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true}))}
export function HardwarePanel(){
 const [connected,setConnected]=useState(false),[status,setStatus]=useState('Disconnected'),[settings,setSettings]=useState(false),[sample,setSample]=useState<Sample|null>(null),[lighting,setLighting]=useState(false),[now,setNow]=useState(Date.now()),[received,setReceived]=useState(0),[chunks,setChunks]=useState(0),[frames,setFrames]=useState(0)
 const port=useRef<Port|null>(null),reader=useRef<ReadableStreamDefaultReader<Uint8Array>|null>(null),writer=useRef<WritableStreamDefaultWriter<Uint8Array>|null>(null),generation=useRef(0),bridge=useRef<WebSocket|null>(null),vending=useRef('idle'),last=useRef({joy:0,b1:0,b2:0,armed:true,slap:0}),writeBusy=useRef(false)
 const stop=async(message='Disconnected')=>{generation.current++;const oldBridge=bridge.current;bridge.current=null;oldBridge?.close();const oldPort=port.current,oldReader=reader.current,oldWriter=writer.current;port.current=null;reader.current=null;writer.current=null;clearHardware();setConnected(false);setSample(null);setReceived(0);setChunks(0);setFrames(0);setStatus(message);try{await oldReader?.cancel()}catch{};try{oldReader?.releaseLock()}catch{};try{oldWriter?.releaseLock()}catch{};try{await oldPort?.close()}catch{}}
 const send=async()=>{if(vending.current==='idle')return;if(bridge.current?.readyState===WebSocket.OPEN){bridge.current.send(JSON.stringify({state:vending.current}));return}if(!writer.current||writeBusy.current)return;writeBusy.current=true;try{await writer.current.write(new TextEncoder().encode(JSON.stringify({state:vending.current})+'\n'))}catch{}finally{writeBusy.current=false}}
 useEffect(()=>{const changed=(e:Event)=>{vending.current=(e as CustomEvent<string>).detail;void send()};window.addEventListener('hardware-vending',changed);const timer=setInterval(()=>{setNow(Date.now());void send()},800);return()=>{clearInterval(timer);window.removeEventListener('hardware-vending',changed);void stop()}},[])
 useEffect(()=>{hardware.lightEnabled=lighting},[lighting])
 const process=(s:Sample)=>{
  hardware.sample=s;hardware.updated=performance.now();setSample(s);setReceived(Date.now());const k=hardware.keys;k.clear();const mode=activityState.mode
  if(mode==='bathtub'||mode==='busdrive') {if(mode==='busdrive'&&s.b2)k.add('s');else k.add('w');if(s.gyro){const t=s.tilt-hardware.neutral;if(t>10)k.add('d');if(t< -10)k.add('a')}}
  else if(!activityState.locked&&!document.querySelector('[aria-modal="true"]')){if(s.x<350)k.add('a');if(s.x>675)k.add('d');if(s.y<350)k.add('w');if(s.y>675)k.add('s')}
  const prev=last.current
  if(!s.cm||s.cm<0||s.cm>=15)prev.armed=true
  if(mode==='rock'&&s.cm>0&&s.cm<=10&&prev.armed&&performance.now()-prev.slap>450){prev.armed=false;prev.slap=performance.now();press(' ','Space')}
  if(s.joy&&!prev.joy){if(mode==='busdrive')press('e','KeyE');else if(!mode&&!activityState.locked){const talk=document.querySelector('.nearby-player-prompt');press(talk?'t':'e',talk?'KeyT':'KeyE')}else if(mode==='hunt')press('e','KeyE')}
  if(s.b1&&!prev.b1){if(mode==='busdrive')sfx.horn();else if(mode==='bathtub')hardware.neutral=s.tilt;else if(!mode&&!activityState.locked)window.dispatchEvent(new Event('hardware-phone'))}
  if(s.b2&&!prev.b2&&!mode&&!activityState.locked)window.dispatchEvent(new Event('hardware-activities'))
  prev.joy=s.joy;prev.b1=s.b1;prev.b2=s.b2
 }
 const start=async()=>{
  const session=++generation.current
  // A loopback bridge avoids browser-specific serial stalls on Linux. If it is
  // absent, use the normal Web Serial picker instead.
  if(['localhost','127.0.0.1'].includes(location.hostname)){
   const socket=new WebSocket('ws://127.0.0.1:18763')
   const opened=await new Promise<boolean>(resolve=>{const timer=setTimeout(()=>{socket.close();resolve(false)},700);socket.onopen=()=>{clearTimeout(timer);resolve(true)};socket.onerror=()=>{clearTimeout(timer);resolve(false)}})
   if(session!==generation.current){socket.close();return}
   if(opened){bridge.current=socket;hardware.enabled=true;setConnected(true);setSample(null);setReceived(0);setStatus('Connected; waiting for readings');socket.onmessage=event=>{setChunks(n=>n+1);let data:unknown;try{data=JSON.parse(String(event.data))}catch{return}if(validSample(data)){setFrames(n=>n+1);process(data);setStatus('Connected')}};socket.onclose=()=>{if(session===generation.current)void stop('Local bridge disconnected. Close other serial monitors and try again.')};return}
  }
  const serial=(navigator as Navigator & {serial?:Serial}).serial;if(!serial){setStatus('Web Serial needs Chrome or Edge on localhost or HTTPS.');return}
  let localPort:Port|null=null, localReader:ReadableStreamDefaultReader<Uint8Array>|null=null
  try{
   localPort=await serial.requestPort();if(session!==generation.current)return
   await localPort.open({baudRate:115200});await localPort.setSignals({dataTerminalReady:true,requestToSend:true});if(session!==generation.current){await localPort.close();return}
   port.current=localPort;if(!localPort.readable||!localPort.writable)throw Error('Serial streams unavailable')
   const localWriter=localPort.writable.getWriter();writer.current=localWriter
   localReader=localPort.readable.getReader();reader.current=localReader
   hardware.enabled=true;setConnected(true);setSample(null);setReceived(0);setStatus('Connected; waiting for readings')
   let buffer='';const decoder=new TextDecoder()
   while(session===generation.current){
    const {value,done}=await localReader.read();if(done||session!==generation.current)break
    setChunks(n=>n+1);buffer+=decoder.decode(value,{stream:true});if(buffer.length>8192)buffer=buffer.slice(-8192)
    let pos:number
    while((pos=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,pos).trim();buffer=buffer.slice(pos+1)
     let data:unknown;try{data=JSON.parse(line)}catch{continue}
     if(validSample(data)){setFrames(n=>n+1);process(data);setStatus('Connected')}
    }
   }
   if(session===generation.current)await stop('Controller disconnected.')
  }catch(e){if(session===generation.current)await stop(e instanceof DOMException&&e.name==='NotFoundError'?'No controller selected.':'Could not connect to the controller.')}
  finally{try{localReader?.releaseLock()}catch{};if(session!==generation.current&&localPort&&localPort!==port.current){try{await localPort.close()}catch{}}}
 }

 return <div className="hardware-panel"><button onClick={()=>{if(connected)void stop();else void start()}}>🎮 ELEGOO Controller: {connected?'ON':'OFF'}</button><button onClick={()=>setSettings(v=>!v)}>⚙</button>{settings&&<section><b>{connected?'🟢':'⚪'} ELEGOO {status}</b><p>{connected?(received&&now-received<2500?'Receiving live readings':'Waiting for readings from the Mega'):'Controller disconnected'}</p><p>Data chunks: {chunks} · Valid readings: {frames}</p><p>Joystick: {sample?`${sample.x}, ${sample.y}`:'—'} · Distance: {sample&&sample.cm>0?`${sample.cm.toFixed(1)} cm`:'—'}</p><p>Motion sensor: {sample?.gyro?'ready':'not detected'} · Tilt: {sample?.tilt.toFixed(1)??'—'}°</p><button disabled={!sample?.gyro} onClick={()=>{if(sample)hardware.neutral=sample.tilt}}>Calibrate tilt</button><label><input type="checkbox" checked={lighting} onChange={e=>setLighting(e.target.checked)}/> Use room lighting</label><p>Joystick: walk and press to interact. Rock: move your hand near the sensor. Driving: tilt to steer; button 1 calibrates the bathtub or honks the bus; button 2 brakes the bus.</p></section>}{status!=='Disconnected'&&status!=='Connected'&&<small role="status">{status}</small>}</div>
}
