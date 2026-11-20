import { centroid, type Building } from '../campus.ts'

/** Group numbered residences in the location picker while retaining other destinations. */
export function groupResidenceLocations(buildings:Building[]) {
 const groups:Record<string,Building[]>={}
 const nameFor=(name:string)=>{
  if(/university columns \d+$/i.test(name))return 'University Columns'
  if(/courtyard \d+$/i.test(name))return 'Courtyard'
  if(/commons \d+$/i.test(name))return 'Commons'
  if(/hornet village \d+$/i.test(name))return 'Hornet Village'
  return null
 }
 const singles=buildings.filter(b=>{
  const name=nameFor(b.short||b.name)
  if(!name)return true
  ;(groups[name]??=[]).push(b)
  return false
 })
 const grouped=Object.entries(groups).map(([label,members])=>{
  const centres=members.map(b=>centroid(b.poly))
  const x=centres.reduce((sum,p)=>sum+p[0],0)/centres.length
  const z=centres.reduce((sum,p)=>sum+p[1],0)/centres.length
  const building=members.reduce((best,b)=>{
   const p=centroid(b.poly),q=centroid(best.poly)
   return Math.hypot(p[0]-x,p[1]-z)<Math.hypot(q[0]-x,q[1]-z)?b:best
  })
  return {label,building}
 })
 return {singles,grouped}
}
