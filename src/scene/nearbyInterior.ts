import { distToSeg, isCampusBuilding, type Building } from '../campus.ts'

// Buildings that have no playable interior even though they are campus buildings.
// Codes and ids: Wilder (T), Science Lab Annex, and the K3 pump house with the owl mural.
const noInterior=new Set(['T','1134398612','517434198'])
const enterable=(b:Building)=>!noInterior.has(b.code)&&!noInterior.has(b.id)&&(isCampusBuilding(b)||b.kind==='greenhouse')

/** Some mapped building pieces belong to a single playable interior. */
const interiorOwner:Record<string,string>={
 // The curved glazed wing is mapped separately from the rest of the library.
 '589314485':'C',
}

export function nearbyInterior(buildings:Building[],x:number,z:number,range=10,preferredId?:string|null):Building|null {
 if(preferredId){const target=buildings.find(b=>b.id===preferredId&&enterable(b));if(target)return target}
 let best:Building|null=null,nearest=range
 for(const footprint of buildings){
  let distance=Infinity
  for(let i=0,j=footprint.poly.length-1;i<footprint.poly.length;j=i++)distance=Math.min(distance,distToSeg(x,z,footprint.poly[j],footprint.poly[i]))
  if(distance>=nearest)continue
  const ownerCode=interiorOwner[footprint.id]
  const owner=ownerCode?buildings.find(b=>b.code===ownerCode):undefined
  if(!enterable(owner??footprint))continue
  best=owner??footprint
  nearest=distance
 }
 return best
}
