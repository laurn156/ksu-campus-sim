export interface InteriorOrbit { yaw:number; pitch:number; distance:number }
export function turnInteriorCamera(orbit:InteriorOrbit,dx:number,dy:number):void {
 orbit.yaw-=dx*.008
 orbit.pitch=Math.max(.3,Math.min(1.22,orbit.pitch+dy*.006))
}
export function zoomInteriorCamera(orbit:InteriorOrbit,deltaY:number):void {
 orbit.distance=Math.max(5,Math.min(22,orbit.distance*Math.exp(deltaY*.001)))
}

export function panInteriorCamera(pan:{x:number;y:number},orbit:InteriorOrbit,dx:number,dy:number):void {
 const scale=orbit.distance*.0018
 pan.x=Math.max(-20,Math.min(20,pan.x+(-Math.cos(orbit.yaw)*dx-Math.sin(orbit.yaw)*dy)*scale))
 pan.y=Math.max(-20,Math.min(20,pan.y+(Math.sin(orbit.yaw)*dx-Math.cos(orbit.yaw)*dy)*scale))
}
