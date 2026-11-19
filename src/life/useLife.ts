import { useCallback, useEffect, useState } from 'react'
import { advance, doActivity, loadLife, saveLife, talk, type Activity, type SocialAction } from './simulation'
import type { StudentId } from './students'
export function useLife(username:string,playerName:string) {
  const [state,setState]=useState(()=>loadLife(username))
  const [reply,setReply]=useState('')
  useEffect(()=>{saveLife(username,state)},[username,state])
  useEffect(()=>{const id=setInterval(()=>setState(s=>advance(s,1)),1000);return()=>clearInterval(id)},[])
  const interact=useCallback((id:StudentId,action:SocialAction,text='')=>{
    const result=talk(state,id,action,text,playerName||username);setState(result.state);setReply(result.reply);return result
  },[state,playerName,username])
  const activity=useCallback((id:Activity)=>setState(s=>doActivity(s,id)),[])
  const nextDay=useCallback(()=>setState(s=>advance(s,1440-s.minute+8*60)),[])
  return {state,reply,setReply,interact,activity,nextDay}
}
export type LifeController=ReturnType<typeof useLife>

