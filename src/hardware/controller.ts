/** Hardware input is local-only. It is cleared before leaving the private solo session. */
export type Sample={v:number;x:number;y:number;joy:number;b1:number;b2:number;cm:number;tilt:number;gyro:number;light:number}
export const hardware={enabled:false,keys:new Set<string>(),sample:null as Sample|null,neutral:0,lightEnabled:false,updated:0}
export function clearHardware(){hardware.enabled=false;hardware.keys.clear();hardware.sample=null;hardware.updated=0}
export function hardwareKeys():Set<string>{if(!hardware.enabled||performance.now()-hardware.updated>500){hardware.keys.clear()}return hardware.keys}
export function combinedKeys(keys:Set<string>){return new Set([...keys,...hardwareKeys()])}
export function validSample(value:unknown):value is Sample {if(!value||typeof value!=='object')return false;const s=value as Sample;return s.v===1&&['x','y','joy','b1','b2','cm','tilt','gyro','light'].every(k=>Number.isFinite(s[k as keyof Sample]))&&s.x>=0&&s.x<=1023&&s.y>=0&&s.y<=1023&&s.light>=0&&s.light<=1023}
