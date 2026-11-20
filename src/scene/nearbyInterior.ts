import { distToSeg, isCampusBuilding, type Building } from '../campus.ts'

const enterable=(b:Building)=>isCampusBuilding(b)||b.kind==='greenhouse'

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
