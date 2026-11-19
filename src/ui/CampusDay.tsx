import { useEffect, useMemo, useState } from 'react'
import { distToSeg, type Campus } from '../campus'
import { player } from '../scene/Player'

type TaskId = 'meet'|'study'|'meal'|'scrappy'|'bus'|'atrium'|'recreation'
type Progress = { completed: TaskId[]; day:number }
const allTasks: {id:TaskId; label:string; detail:string; code?:string; action?:'student'|'scrappy'|'bus'; verb?:string}[] = [
  {id:'meet',label:'Meet a student',detail:'Find a student and press F to say hello.',action:'student'},
  {id:'study',label:'Study at the library',detail:'Find C · Lawrence V. Johnson Library.',code:'C',verb:'Study'},
  {id:'meal',label:'Grab a meal',detail:'Find X · Stingers.',code:'X',verb:'Eat'},
  {id:'scrappy',label:'Say hello to Scrappy',detail:'Find Scrappy and press F to greet him.',action:'scrappy'},
  {id:'bus',label:'Catch a Big Owl Bus',detail:'Meet a bus on its route and press F to board.',action:'bus'},
  {id:'atrium',label:'Visit the Atrium',detail:'Find J · Atrium Building.',code:'J',verb:'Visit'},
  {id:'recreation',label:'Visit the Rec Center',detail:'Find S1 · Recreation and Wellness Center.',code:'S1',verb:'Visit'},
]
const days: TaskId[][] = [['meet','study','meal'],['scrappy','bus','atrium'],['recreation','meet','meal'],['bus','study','scrappy']]
function storageKey(user:string) { return 'ksu-campus-day-v1:'+user.toLowerCase() }
function load(user:string):Progress {
  try {
    const p=JSON.parse(localStorage.getItem(storageKey(user)) || 'null')
    if (p && Number.isInteger(p.day) && p.day>0 && Array.isArray(p.completed)) {
      const ids=days[(p.day-1)%days.length]
      return {day:p.day,completed:ids.filter(id=>p.completed.includes(id))}
    }
  } catch { /* start fresh */ }
  return {day:1,completed:[]}
}
function nearBuilding(campus:Campus,code:string) {
  const b=campus.buildings.find(item=>item.code===code)
  return !!b && b.poly.some((p,i)=>distToSeg(player.x,player.z,p,b.poly[(i+1)%b.poly.length])<18)
}
export function CampusDay({campus,username}:{campus:Campus;username:string}) {
  const [progress,setProgress]=useState<Progress>(()=>load(username))
  const [near,setNear]=useState<string[]>([])
  const [blocked,setBlocked]=useState(false)
  const [open,setOpen]=useState(true)
  const [notice,setNotice]=useState('')
  const tasks=useMemo(()=>days[(progress.day-1)%days.length].map(id=>allTasks.find(t=>t.id===id)!),[progress.day])
  useEffect(()=>{try {localStorage.setItem(storageKey(username),JSON.stringify(progress))} catch { /* play without saving */ }},[username,progress])
  useEffect(()=>{
    const interval=setInterval(()=>{setNear(tasks.filter(t=>t.code && nearBuilding(campus,t.code)).map(t=>t.id));setBlocked(!!player.travelOrigin || !!player.view)},250)
    const action=(event:Event)=>{
      const detail=(event as CustomEvent<{kind:string;allowed:boolean}>).detail
      if(!detail?.allowed || player.view){setNotice('Walk away from your fast-travel arrival point before completing activities.');return}
      const task=tasks.find(t=>t.action===detail.kind)
      if(task){setProgress(p=>p.completed.includes(task.id)?p:{...p,completed:[...p.completed,task.id]});setNotice('Nice! You discovered an activity.')}
    }
    addEventListener('campus-action',action)
    return()=>{clearInterval(interval);removeEventListener('campus-action',action)}
  },[campus,tasks])
  const complete=(id:TaskId)=>{
    if(!near.includes(id) || player.travelOrigin || player.view) return
    setProgress(p=>p.completed.includes(id)?p:{...p,completed:[...p.completed,id]})
    setNotice('Nice! You completed an activity.')
  }
  return <section className="day-panel" aria-label="Campus Life activities">
    <button className="day-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>☀ Day {progress.day} <span>{progress.completed.length}/{tasks.length} ideas {open?'−':'+'}</span></button>
    {open && <div className="day-content"><p>Optional ideas for your day. Explore at your own pace.</p>{blocked && <div className="day-warning">Return to your character to take part in activities.</div>}{tasks.map(t=>{
      const finished=progress.completed.includes(t.id), available=near.includes(t.id) && !blocked
      return <div className={'day-task '+(finished?'done':'')} key={t.id}><div><b>{finished?'✓':'○'} {t.label}</b><small>{t.detail}</small></div>{t.code && !finished && <button disabled={!available} onClick={()=>complete(t.id)}>{available ? t.verb : 'Explore'}</button>}</div>
    })}{notice && <div className="day-notice" role="status">{notice}</div>}
    <div className="day-finished"><span>{progress.completed.length===tasks.length?'You explored all of today’s ideas!':'No need to finish everything.'}</span><button onClick={()=>{setProgress({day:progress.day+1,completed:[]});setNotice('')}}>Start next day</button></div></div>}
  </section>
}

