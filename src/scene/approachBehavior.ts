/** Slow for someone walking toward a character and pause at conversation distance. */
export function approachSpeed(x:number,z:number,px:number,pz:number,heading:number,moving:boolean,active:boolean,stop:number,slow:number):number {
 if(!active||![x,z,px,pz,heading].every(Number.isFinite))return 1
 const dx=x-px,dz=z-pz,d=Math.hypot(dx,dz)
 if(d<=stop)return 0
 if(!moving||d>=slow)return 1
 const toward=(dx*Math.sin(heading)+dz*Math.cos(heading))/d
 return toward>.45?Math.max(.2,Math.min(1,(d-stop)/(slow-stop))):1
}
