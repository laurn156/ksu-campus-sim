export interface InteriorOrbit { yaw:number; pitch:number; distance:number }
export function turnInteriorCamera(orbit:InteriorOrbit,dx:number,dy:number):void {
 orbit.yaw-=dx*.008
 orbit.pitch=Math.max(.3,Math.min(1.22,orbit.pitch+dy*.006))
}
export function zoomInteriorCamera(orbit:InteriorOrbit,deltaY:number):void {
 orbit.distance=Math.max(5,Math.min(22,orbit.distance*Math.exp(deltaY*.001)))
}
