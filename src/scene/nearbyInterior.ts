import { distToSeg, type Building } from '../campus.ts'

/** Some mapped building pieces belong to a single playable interior. */
const interiorOwner:Record<string,string>={
 // The curved glazed wing is mapped separately from the rest of the library.
 '589314485':'C',
}

export function nearbyInterior(buildings:Building[],x:number,z:number,range=10):Building|null {
 let best:Building|null=null,nearest=range
 for(const footprint of buildings){
  let distance=Infinity
  for(let i=0,j=footprint.poly.length-1;i<footprint.poly.length;j=i++)distance=Math.min(distance,distToSeg(x,z,footprint.poly[j],footprint.poly[i]))
  if(distance>=nearest)continue
  const ownerCode=interiorOwner[footprint.id]
  const owner=ownerCode?buildings.find(b=>b.code===ownerCode):undefined
  best=owner??footprint
  nearest=distance
 }
 return best
}
