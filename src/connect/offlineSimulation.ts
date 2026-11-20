import type { Pt } from '../campus'
export type RoamingPath={a:Pt;b:Pt}
/** A deterministic, time-based approximation: all viewers see the same account at the same place. */
export function offlinePosition(id:string,now:number,paths:RoamingPath[],destinationIds:string[]) {
 if(!paths.length) return null
 let seed=0;for(const c of id)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0
 const slot=Math.floor(now/90000),phase=(now%90000)/90000
 const path=paths[(seed+slot)%paths.length],t=phase<.12?0:phase>.88?1:(phase-.12)/.76
 const destination=(seed+slot)%4===0&&destinationIds.length?destinationIds[(seed+slot)%destinationIds.length]:null
 return {x:destination?((seed%5)-2)*1.5:path.a[0]+(path.b[0]-path.a[0])*t,z:destination?7:path.a[1]+(path.b[1]-path.a[1])*t,heading:destination?Math.PI:Math.atan2(path.b[0]-path.a[0],path.b[1]-path.a[1]),moving:!destination&&phase>=.12&&phase<=.88,location:destination?'building:'+destination:'campus'}
}
