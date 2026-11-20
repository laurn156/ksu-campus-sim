export type Point={x:number;y:number}
/** Planar two-link inverse kinematics, in world units. */
export function solveArm(p:Point,l1=1.5,l2=1.5){const r=Math.hypot(p.x,p.y);if(r>l1+l2||r<Math.abs(l1-l2)+.02)return null;const elbow=Math.acos(Math.max(-1,Math.min(1,(r*r-l1*l1-l2*l2)/(2*l1*l2))));const shoulder=Math.atan2(p.y,p.x)-Math.atan2(l2*Math.sin(elbow),l1+l2*Math.cos(elbow));return {shoulder,elbow}}
export function smoothPath(points:Point[]):Point[]{return points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return {x:(a.x+2*p.x+b.x)/4,y:(a.y+2*p.y+b.y)/4}})}
export type Body='Wedge'|'Compact'|'Low profile'|'Wide defense'
export type Weapon='Horizontal spinner'|'Vertical spinner'|'Flipper'|'Pusher'
export type Mobility='Two wheels'|'Four wheels'|'Tracks'
export type Bot={x:number;z:number;heading:number;health:number;cooldown:number;damage:number}
export type Battle={player:Bot;enemy:Bot;time:number;over:boolean;winner:string}
export function newBattle():Battle{return {player:{x:-3,z:0,heading:Math.PI/2,health:100,cooldown:0,damage:0},enemy:{x:3,z:0,heading:-Math.PI/2,health:100,cooldown:0,damage:0},time:90,over:false,winner:''}}
export function stepBattle(b:Battle,keys:Set<string>,body:Body,weapon:Weapon,mobility:Mobility,dt:number){if(b.over)return;dt=Math.min(.05,dt);b.time=Math.max(0,b.time-dt);const p=b.player,e=b.enemy;p.cooldown=Math.max(0,p.cooldown-dt);e.cooldown=Math.max(0,e.cooldown-dt)
 const turn=(Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')))*(mobility==='Two wheels'?2.8:2.1);p.heading-=turn*dt;const speed=(Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')))*(body==='Wide defense'?2.1:mobility==='Tracks'?2.3:3.2);p.x=Math.max(-5.6,Math.min(5.6,p.x+Math.sin(p.heading)*speed*dt));p.z=Math.max(-4.1,Math.min(4.1,p.z+Math.cos(p.heading)*speed*dt))
 const desired=Math.atan2(p.x-e.x,p.z-e.z),delta=Math.atan2(Math.sin(desired-e.heading),Math.cos(desired-e.heading));e.heading+=Math.max(-2.1*dt,Math.min(2.1*dt,delta));e.x=Math.max(-5.6,Math.min(5.6,e.x+Math.sin(e.heading)*2.3*dt));e.z=Math.max(-4.1,Math.min(4.1,e.z+Math.cos(e.heading)*2.3*dt));const distance=Math.hypot(p.x-e.x,p.z-e.z)
 if(distance<1.3){if(keys.has(' ')&&p.cooldown<=0){const damage=weapon==='Horizontal spinner'?14:weapon==='Vertical spinner'?12:weapon==='Flipper'?10:7;e.health=Math.max(0,e.health-damage);p.damage+=damage;p.cooldown=.65;e.x=Math.max(-5.6,Math.min(5.6,e.x+Math.sin(p.heading)*(mobility==='Tracks'?1.1:.65)));e.z=Math.max(-4.1,Math.min(4.1,e.z+Math.cos(p.heading)*(mobility==='Tracks'?1.1:.65)))}if(e.cooldown<=0){const damage=body==='Wide defense'?5:8;p.health=Math.max(0,p.health-damage);e.damage+=damage;e.cooldown=1;p.x=Math.max(-5.6,Math.min(5.6,p.x+Math.sin(e.heading)*.5));p.z=Math.max(-4.1,Math.min(4.1,p.z+Math.cos(e.heading)*.5))}}
 if(!p.health||!e.health||!b.time){b.over=true;b.winner=p.health===e.health?'Draw':p.health>e.health?'You win':'Computer wins'}
}
