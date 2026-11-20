/** Shared control gate: activities can pause walking without changing the indoor location. */
export const activityState={mode:null as null|'disc'|'hunt'|'bathtub'|'busdrive'|'parking'|'rock',locked:false,discFlight:null as null|{x:number;y:number;z:number},throwUntil:0,vehicleNear:false,parkingNear:false,near:null as null|'disc'|'hunt'|'bathtub'|'busdrive'|'parking'}
