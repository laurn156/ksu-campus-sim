/** Shared only while the player-controlled shuttle occupies its active stop. */
export const protectedShuttle={active:false,x:0,z:0}
/** Traffic already too close clears out invisibly; approaching traffic waits. */
export function trafficStopAction(active:boolean,currentDistance:number,nextDistance:number):'move'|'hold'|'clear'{
 if(!active)return 'move'
 if(currentDistance<12)return 'clear'
 return nextDistance<16?'hold':'move'
}
