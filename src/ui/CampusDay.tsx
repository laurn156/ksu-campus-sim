import { useEffect, useMemo, useState } from 'react'
import { distToSeg, type Campus } from '../campus'
import { player } from '../scene/Player'
import { community } from '../scene/Community'

type TaskId = 'meet'|'study'|'meal'
type Progress = { completed: TaskId[]; day:number }
const tasks: {id:TaskId; label:string; detail:string; code?:string}[] = [
  {id:'meet',label:'Meet a student',detail:'Find a student near the Student Center and press F to say hello.'},
  {id:'study',label:'Study at the library',detail:'Go to C · Lawrence V. Johnson Library and start a study session.',code:'C'},
  {id:'meal',label:'Grab a meal',detail:'Go to X · Stingers and take a meal break.',code:'X'},
]
function storageKey(user:string) { return 'ksu-campus-day-v1:'+user.toLowerCase() }
function load(user:string):Progress {
  try {
    const p=JSON.parse(localStorage.getItem(storageKey(user)) || 'null')
    if (p && Number.isInteger(p.day) && p.day>0 && Array.isArray(p.completed)) return {day:p.day,completed:tasks.map(t=>t.id).filter(id=>p.completed.includes(id))}
  } catch { /* start fresh */ }
  return {day:1,completed:[]}
}
function nearBuilding(campus:Campus,code:string) {
  const b=campus.buildings.find(item=>item.code===code)
  if (!b) return false
  return b.poly.some((p,i)=>distToSeg(player.x,player.z,p,b.poly[(i+1)%b.poly.length])<24)
}
export function CampusDay({campus,username}:{campus:Campus;username:string}) {
  const [progress,setProgress]=useState<Progress>(()=>load(username))
  const [near,setNear]=useState<string[]>([])
  const [open,setOpen]=useState(true)
  const [notice,setNotice]=useState('')
  const found=useMemo(()=>tasks.filter(t=>t.code && campus.buildings.some(b=>b.code===t.code)),[campus])
  useEffect(()=>{try {localStorage.setItem(storageKey(username),JSON.stringify(progress))} catch { /* play without saving */ }},[username,progress])
  useEffect(()=>{
    const interval=setInterval(()=>setNear(found.filter(t=>nearBuilding(campus,t.code!)).map(t=>t.id)),250)
    const key=(e:KeyboardEvent)=>{
      if(e.key.toLowerCase()!=='f'||e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return
      if(community.students.some(s=>Math.hypot(s.x-player.x,s.z-player.z)<5)) setProgress(p=>p.completed.includes('meet')?p:{...p,completed:[...p.completed,'meet']})
    }
    addEventListener('keydown',key)
    return()=>{clearInterval(interval);removeEventListener('keydown',key)}
  },[campus,found])
  const complete=(id:TaskId)=>{
    if(!near.includes(id)) return
    setProgress(p=>p.completed.includes(id)?p:{...p,completed:[...p.completed,id]})
    setNotice(id==='study'?'Study session complete!':'Meal break complete!')
  }
  const done=progress.completed.length===tasks.length
  return <section className="day-panel" aria-label="Campus Life activities">
    <button className="day-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>☀ Day {progress.day} <span>{progress.completed.length}/{tasks.length} activities {open?'−':'+'}</span></button>
    {open && <div className="day-content"><p>Make the most of your campus day.</p>{tasks.map(t=>{
      const finished=progress.completed.includes(t.id), available=near.includes(t.id)
      return <div className={'day-task '+(finished?'done':'')} key={t.id}><div><b>{finished?'✓':'○'} {t.label}</b><small>{t.detail}</small></div>{t.code && !finished && <button disabled={!available} onClick={()=>complete(t.id)}>{available ? t.id==='study'?'Study':'Eat' : 'Go there'}</button>}</div>
    })}{notice && <div className="day-notice" role="status">{notice}</div>}{done && <div className="day-finished"><b>Day complete! ✨</b><span>You explored, studied, and met someone new.</span><button onClick={()=>{setProgress({day:progress.day+1,completed:[]});setNotice('')}}>Start next day</button></div>}</div>}
  </section>
}

