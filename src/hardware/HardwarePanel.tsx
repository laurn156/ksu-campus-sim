import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { activityState } from '../activities/activityState'
import { hardware, clearHardware, validSample, type Sample } from './controller'
import './hardware.css'

type Port={readable:ReadableStream<Uint8Array>|null;writable:WritableStream<Uint8Array>|null;open:(o:{baudRate:number})=>Promise<void>;setSignals:(o:{dataTerminalReady:boolean;requestToSend:boolean})=>Promise<void>;close:()=>Promise<void>}
type Serial={requestPort:()=>Promise<Port>;addEventListener:(t:string,fn:EventListener)=>void;removeEventListener:(t:string,fn:EventListener)=>void}
const press=(key:string,code:string)=>{window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true}))}
export function HardwarePanel({allowed}:{allowed:boolean}){
 const allowedRef=useRef(allowed);allowedRef.current=allowed
 const [connected,setConnected]=useState(false),[status,setStatus]=useState('Disconnected'),[settings,setSettings]=useState(false),[sample,setSample]=useState<Sample|null>(null),[lighting,setLighting]=useState(true),[now,setNow]=useState(Date.now()),[received,setReceived]=useState(0),[chunks,setChunks]=useState(0),[frames,setFrames]=useState(0)
 const port=useRef<Port|null>(null),reader=useRef<ReadableStreamDefaultReader<Uint8Array>|null>(null),writer=useRef<WritableStreamDefaultWriter<Uint8Array>|null>(null),generation=useRef(0),bridge=useRef<WebSocket|null>(null),last=useRef({joy:0})
 const stop=async(message='Disconnected')=>{generation.current++;const oldBridge=bridge.current;bridge.current=null;oldBridge?.close();const oldPort=port.current,oldReader=reader.current,oldWriter=writer.current;port.current=null;reader.current=null;writer.current=null;clearHardware();setConnected(false);setSample(null);setReceived(0);setChunks(0);setFrames(0);setStatus(message);try{await oldReader?.cancel()}catch{};try{oldReader?.releaseLock()}catch{};try{oldWriter?.releaseLock()}catch{};try{await oldPort?.close()}catch{}}
 useLayoutEffect(()=>{if(!allowed)void stop('Controller unavailable while other players are connected.');else setStatus(current=>current==='Controller unavailable while other players are connected.'?'Disconnected':current)},[allowed])
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),800);return()=>{clearInterval(timer);void stop()}},[])
 useEffect(()=>{hardware.lightEnabled=lighting},[lighting])
 const process=(s:Sample)=>{
  if(!allowedRef.current)return
  hardware.sample=s;hardware.updated=performance.now();setSample(s);setReceived(Date.now());const k=hardware.keys;k.clear();const mode=activityState.mode
  if(!activityState.locked&&!document.querySelector('[aria-modal="true"]')){if(s.x<350)k.add('a');if(s.x>675)k.add('d');if(s.y<350)k.add('w');if(s.y>675)k.add('s')}
  const prev=last.current
  if(s.joy&&!prev.joy){if(mode==='busdrive')press('e','KeyE');else if(!mode&&!activityState.locked){const talk=document.querySelector('.nearby-player-prompt');press(talk?'t':'e',talk?'KeyT':'KeyE')}else if(mode==='hunt')press('e','KeyE')}
  prev.joy=s.joy
 }
 const start=async()=>{
  if(!allowedRef.current)return
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

 return <div className="hardware-panel"><button disabled={!allowed} title={allowed?'':'Controller is available when no other players are connected.'} onClick={()=>{if(connected)void stop();else void start()}}>🎮 ELEGOO Controller: {connected?'ON':'OFF'}</button><button onClick={()=>setSettings(v=>!v)}>⚙</button>{settings&&<section><b>{connected?'🟢':'⚪'} ELEGOO {status}</b><p>{connected?(received&&now-received<2500?'Receiving live readings':'Waiting for readings from the Mega'):'Controller disconnected'}</p><p>Data chunks: {chunks} · Valid readings: {frames}</p><p>Joystick: {sample?`${sample.x}, ${sample.y}`:'—'}</p><p>Light sensor: {sample?.light??'—'}</p><label><input type="checkbox" checked={lighting} onChange={e=>setLighting(e.target.checked)}/> Use room lighting (night ≤ 400 · day ≥ 600)</label><p>Joystick: walk and press to interact.</p></section>}{status!=='Disconnected'&&status!=='Connected'&&<small role="status">{status}</small>}</div>
}
