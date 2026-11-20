import { sfx } from '../audio/sfx'
import { useEffect, useRef, useState } from 'react'
import { activityState } from '../activities/activityState'
import { hardware, clearHardware, validSample, type Sample } from './controller'
import './hardware.css'

type Port={readable:ReadableStream<Uint8Array>|null;writable:WritableStream<Uint8Array>|null;open:(o:{baudRate:number})=>Promise<void>;close:()=>Promise<void>}
type Serial={requestPort:()=>Promise<Port>;addEventListener:(t:string,fn:EventListener)=>void;removeEventListener:(t:string,fn:EventListener)=>void}
const press=(key:string,code:string)=>{window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true}))}
export function HardwarePanel({onShared}:{onShared:()=>void}){
 const [connected,setConnected]=useState(false),[status,setStatus]=useState('Disconnected'),[settings,setSettings]=useState(false),[sample,setSample]=useState<Sample|null>(null),[lighting,setLighting]=useState(false)
 const port=useRef<Port|null>(null),reader=useRef<ReadableStreamDefaultReader<Uint8Array>|null>(null),writer=useRef<WritableStreamDefaultWriter<Uint8Array>|null>(null),running=useRef(false),vending=useRef('idle'),last=useRef({joy:0,b1:0,b2:0,armed:true,slap:0}),writeBusy=useRef(false)
 const stop=async(message='Disconnected')=>{running.current=false;clearHardware();setConnected(false);setStatus(message);try{await reader.current?.cancel()}catch{};try{writer.current?.releaseLock()}catch{};writer.current=null;try{await port.current?.close()}catch{};port.current=null}
 const send=async()=>{if(!writer.current||writeBusy.current)return;writeBusy.current=true;try{await writer.current.write(new TextEncoder().encode(JSON.stringify({state:vending.current})+'\n'))}catch{}finally{writeBusy.current=false}}
 useEffect(()=>{const changed=(e:Event)=>{vending.current=(e as CustomEvent<string>).detail;void send()};window.addEventListener('hardware-vending',changed);const timer=setInterval(()=>void send(),800);return()=>{clearInterval(timer);window.removeEventListener('hardware-vending',changed);void stop()}},[])
 useEffect(()=>{hardware.lightEnabled=lighting},[lighting])
 const process=(s:Sample)=>{
  hardware.sample=s;hardware.updated=performance.now();setSample(s);const k=hardware.keys;k.clear();const mode=activityState.mode
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
  const serial=(navigator as Navigator & {serial?:Serial}).serial;if(!serial){setStatus('Web Serial needs Chrome or Edge on localhost or HTTPS.');return}
  try{const p=await serial.requestPort();await p.open({baudRate:115200});port.current=p;if(!p.readable||!p.writable)throw Error('Serial streams unavailable');writer.current=p.writable.getWriter();reader.current=p.readable.getReader();running.current=true;hardware.enabled=true;setConnected(true);setStatus('Connected');let buffer='';const decoder=new TextDecoder();while(running.current){const {value,done}=await reader.current.read();if(done||!running.current)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>8192)buffer='';let pos;while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);try{const data:unknown=JSON.parse(line);if(validSample(data))process(data)}catch{/* Ignore incomplete or invalid sensor frames. */}}}reader.current.releaseLock();reader.current=null;if(running.current)await stop('Controller disconnected.')}
  catch(e){await stop(e instanceof DOMException&&e.name==='NotFoundError'?'No controller selected.':'Could not connect to the controller.')}
 }
 return <div className="hardware-panel"><button onClick={()=>{if(connected)void stop();else void start()}}>🎮 ELEGOO Controller: {connected?'ON':'OFF'}</button><button onClick={()=>setSettings(v=>!v)}>⚙</button><button onClick={()=>{void stop();onShared()}}>Return to shared campus</button>{settings&&<section><b>{connected?'🟢':'⚪'} ELEGOO {status}</b><p>Joystick: {sample?`${sample.x}, ${sample.y}`:'—'} · Distance: {sample&&sample.cm>0?`${sample.cm.toFixed(1)} cm`:'—'}</p><p>Motion sensor: {sample?.gyro?'ready':'not detected'} · Tilt: {sample?.tilt.toFixed(1)??'—'}°</p><button disabled={!sample?.gyro} onClick={()=>{if(sample)hardware.neutral=sample.tilt}}>Calibrate tilt</button><label><input type="checkbox" checked={lighting} onChange={e=>setLighting(e.target.checked)}/> Use room lighting</label><p>Joystick: walk and press to interact. Rock: move your hand near the sensor. Driving: tilt to steer; button 1 calibrates the bathtub or honks the bus; button 2 brakes the bus.</p></section>}{status!=='Disconnected'&&status!=='Connected'&&<small role="status">{status}</small>}</div>
}
