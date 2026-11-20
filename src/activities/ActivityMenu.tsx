import { useState } from 'react'
import { Collider, pointInPoly, type Campus, type Pt } from '../campus'
import { approach, player } from '../scene/Player'
import { busPositions } from '../scene/Buses'
import { community } from '../scene/Community'
import { indoorState } from '../scene/indoorState'
import { discGolfSpots } from '../scene/discGolf'
import { activityState } from './activityState'
import { bathtubCourse } from './bathtubRace'
import { huntPositions } from './campusActivities'
import { landmarkSpots } from '../scene/Landmarks'
import './activityMenu.css'

type Target={x:number;z:number;yaw:number;buildingId?:string}
type Item={name:string;kind:string;description:string;instructions:string;target:(campus:Campus)=>Target|null}
/** A free spot close enough to trigger the activity prompt. */
function near(campus:Campus,at:Pt,radii=[4,5,6]):Target|null{
 const collider=new Collider(campus.buildings)
 for(const r of radii)for(let i=0;i<16;i++){const a=i*Math.PI/8,x=at[0]+Math.sin(a)*r,z=at[1]+Math.cos(a)*r;if(pointInPoly(x,z,campus.boundary)&&!collider.blocked(x,z,1))return {x,z,yaw:Math.atan2(at[0]-x,at[1]-z)}}
 return null
}
function building(campus:Campus,code:string):Target|null{const b=campus.buildings.find(x=>x.code===code||x.id===code);return b?{...approach(campus,b.poly),buildingId:b.id}:null}
const items:Item[]=[
 {name:'Bathtub Race',kind:'MINIGAME',description:'Race through checkpoints on Alumni Field.',instructions:'Press E near the starting area, then select Start race.',target:c=>{const p=bathtubCourse(c)[0];return p?near(c,p):null}},
 {name:'Disc Golf',kind:'MINIGAME',description:'Aim and throw at a basket.',instructions:'Press E near a basket to start.',target:c=>{const p=discGolfSpots(c)[0];return p?near(c,p):null}},
 {name:'Drive the Big Owl Bus',kind:'MINIGAME',description:'Drive the shuttle and serve campus stops.',instructions:'Press E near the bus to start driving.',target:c=>{const b=busPositions.filter(Boolean).reduce<(typeof busPositions)[number]|null>((best,p)=>!best||Math.hypot(p.x-player.x,p.z-player.z)<Math.hypot(best.x-player.x,best.z-player.z)?p:best,null);return b?near(c,[b.x,b.z],[6,7,8]):null}},
 {name:'Slap the Rock Battle',kind:'MINIGAME',description:'Slap the rock as fast as you can and beat your best score.',instructions:'Press E near Slap the Rock.',target:c=>{const p=landmarkSpots(c).find(x=>x.name==='Slap the Rock');return p?near(c,p.at,[2.5,3,4]):null}},
 {name:'Hooty Hoo Hunt',kind:'MINIGAME',description:'Find the hidden letters across campus.',instructions:'Press E at the Hooty Hoo Hunt sign.',target:c=>{const p=huntPositions(c)[0];return p?near(c,p):null}},
 {name:'Attend a Class',kind:'LEARN',description:'Choose a subject and topic for a lesson.',instructions:'Go inside, then choose Attend class.',target:c=>building(c,'D')},
 {name:'Campus Conversations',kind:'MEET',description:'Talk with a campus student and build a friendship.',instructions:'Approach the student and press E to talk.',target:c=>{const p=community.students.reduce<(typeof community.students)[number]|null>((best,s)=>!best||Math.hypot(s.x-player.x,s.z-player.z)<Math.hypot(best.x-player.x,best.z-player.z)?s:best,null);return p?near(c,[p.x,p.z],[2,3]):null}},
 {name:'Robotic Arm',kind:'ROBOTICS',description:'Draw a path for an articulated arm to follow.',instructions:'Go inside the Shore Innovation Center. Approach the robot-arm station and press E.',target:c=>building(c,'1556621556')},
 {name:'Build and Battle Robots',kind:'ROBOTICS',description:'Customize a robot and battle the computer.',instructions:'Go inside the Shore Innovation Center. Approach the BattleBots station and press E.',target:c=>building(c,'1556621556')},
]
export function ActivityMenu({campus}:{campus:Campus}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState('')
 const go=(item:Item)=>{
  if(indoorState.active||activityState.mode||activityState.locked||player.busRide){setMessage('Exit your current activity or building before traveling.');return}
  const target=item.target(campus);if(!target){setMessage('That destination is not available yet. Try again in a moment.');return}
  player.view=null;window.dispatchEvent(new Event('activity-travel'));player.tp=null;player.viewChanged=true
  const direct=['Bathtub Race','Disc Golf','Drive the Big Owl Bus','Slap the Rock Battle','Hooty Hoo Hunt'].includes(item.name)
  if(direct){window.dispatchEvent(new CustomEvent('activity-start',{detail:{name:item.name,target}}));setOpen(false);setMessage('');return}
  if(['Attend a Class','Robotic Arm','Build and Battle Robots'].includes(item.name)&&target.buildingId){window.dispatchEvent(new CustomEvent('activity-enter-building',{detail:{id:target.buildingId,name:item.name,target}}));setOpen(false);setMessage('');return}
  if(item.name==='Campus Conversations'){const student=community.students.reduce<(typeof community.students)[number]|null>((best,s)=>!best||Math.hypot(s.x-target.x,s.z-target.z)<Math.hypot(best.x-target.x,best.z-target.z)?s:best,null);if(student){player.x=target.x;player.z=target.z;player.yaw=target.yaw;window.dispatchEvent(new CustomEvent('open-student',{detail:student.id}));setOpen(false);setMessage('');return}}
  player.tp=target;setOpen(false);setMessage(item.instructions)
 }
 return <><button className="activity-menu-button" aria-expanded={open} aria-controls="activity-menu" onClick={()=>{setOpen(v=>!v);setMessage('')}}>✦ Activities</button>{message&&!open&&<div className="activity-travel-note" role="status"><span>{message}</span><button aria-label="Dismiss directions" onClick={()=>setMessage('')}>×</button></div>}{open&&<div className="activity-menu-back" onClick={()=>setOpen(false)}><section id="activity-menu" className="activity-menu" role="dialog" aria-modal="true" aria-label="Campus activities" onClick={e=>e.stopPropagation()}><header><div><small>EXPLORE NEST LIFE</small><h2>Campus activities</h2><p>Pick an activity to jump in.</p></div><button className="activity-menu-close" onClick={()=>setOpen(false)} aria-label="Close activities">×</button></header><div className="activity-menu-grid">{items.map(item=><article key={item.name}><small>{item.kind}</small><h3>{item.name}</h3><p>{item.description}</p><button onClick={()=>go(item)}>Start activity <span aria-hidden="true">→</span></button></article>)}</div>{message&&<p className="activity-menu-error" role="status">{message}</p>}</section></div>}</>
}
