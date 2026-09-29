export const ROOM_PANEL_COUNT=120;
export const NIGHT_OCCUPANCY_THRESHOLD=.6;
export const ACTIVITY_SLOT_SECONDS=2.2;
export const ACTIVITY_TRANSITION_SECONDS=1.9;

const fract=(value:number)=>value-Math.floor(value);
export const roomSeed=(panel:number)=>fract(Math.sin((panel+1)*12.9898+78.233)*43_758.5453);
export const roomHash=(value:number)=>fract(Math.sin(value*91.173+19.19)*43_758.5453);

export type RoomPattern={panel:number;seed:number;occupied:boolean;television:boolean;arrivalStart:number};

export const createNightPattern=(count=ROOM_PANEL_COUNT):RoomPattern[]=>Array.from({length:count},(_,panel)=>{
  const seed=roomSeed(panel),variation=roomHash(seed*29+17);
  return {panel,seed,occupied:seed>=NIGHT_OCCUPANCY_THRESHOLD,television:seed>=NIGHT_OCCUPANCY_THRESHOLD&&variation>=.94,arrivalStart:.03+.46*roomHash(seed*41+7)};
});

export const nightPresence=(roomEmission:number)=>Math.min(1,Math.max(0,(roomEmission-.04)/.28));
export const interpolatedArrival=(pattern:RoomPattern,night:number)=>Math.min(1,Math.max(0,(night-pattern.arrivalStart)/.38));
export const staticActivityTime=(reducedMotion:boolean,seconds:number)=>reducedMotion?0:seconds;
