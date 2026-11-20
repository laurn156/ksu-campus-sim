import { useEffect, useMemo, useState } from 'react'
import { Collider, pointInPoly, type Campus } from '../campus'
import { DEFAULT_PROFILE } from '../ui/Welcome'
import { supabase } from './client'
import type { Peer } from './World'
import { offlinePosition } from './offlineSimulation'

/** Shared clock and account ID produce the same route on every client, without server simulation. */
export function useOfflinePlayers(campus:Campus,userId:string,onlineIds:string[],ready:boolean) {
 const [profiles,setProfiles]=useState<{id:string;username:string;appearance:Peer['look']}[]>([])
 const [now,setNow]=useState(Date.now())
 const paths=useMemo(()=>{
  const collider=new Collider(campus.buildings)
  return campus.paths.flatMap(p=>p.pts.slice(1).map((b,i)=>({a:p.pts[i],b}))).filter(({a,b})=>{
   const len=Math.hypot(a[0]-b[0],a[1]-b[1]);if(len<5||len>45)return false
   return [0,.25,.5,.75,1].every(t=>{const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;return pointInPoly(x,z,campus.boundary)&&!collider.blocked(x,z,.8)})
  })
 },[campus])
 useEffect(()=>{if(!supabase)return;let alive=true;const client=supabase
  const refresh=async()=>{const {data,error}=await client.from('campus_profiles').select('id,username,appearance').eq('offline_roaming',true).order('id').limit(40);if(alive&&!error)setProfiles(data??[])}
  void refresh();const poll=setInterval(()=>void refresh(),15000),clock=setInterval(()=>setNow(Date.now()),500)
  return()=>{alive=false;clearInterval(poll);clearInterval(clock)}
 },[])
 return useMemo(()=>{if(!ready||!paths.length)return [] as Peer[]
  return profiles.filter(p=>p.id!==userId&&!onlineIds.includes(p.id)).slice(0,10).map(p=>{
   const destinations=campus.buildings.filter(b=>['A','C','D','O','S1'].includes(b.code)).map(b=>b.id)
   const position=offlinePosition(p.id,now,paths,destinations)!
   const {displayName,...appearance}=(p.appearance??{}) as Peer['look']&{displayName?:unknown}
   return {id:p.id,username:p.username,name:typeof displayName==='string'&&displayName.trim()?displayName.trim().slice(0,24):p.username,look:{...DEFAULT_PROFILE.look,...appearance},...position,online:false} satisfies Peer
  })
 },[profiles,userId,onlineIds,ready,paths,now,campus])
}
