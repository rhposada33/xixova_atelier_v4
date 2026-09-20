export const TIME_OF_DAY_CYCLE_MS=5_000;
export const TIME_OF_DAY_FADE_MS=220;

export const timeOfDayMoments=[
  {name:'Manhã',slug:'morning',alt:'Edifício residencial ilustrativo Promoven em uma manhã clara, com luz suave e céu azul.'},
  {name:'Meio-dia',slug:'midday',alt:'Edifício residencial ilustrativo Promoven ao meio-dia, sob céu azul e luz intensa.'},
  {name:'Entardecer',slug:'sunset',alt:'Edifício residencial ilustrativo Promoven no entardecer, com luz dourada e céu alaranjado.'},
  {name:'Noite',slug:'night',alt:'Edifício residencial ilustrativo Promoven à noite, com janelas iluminadas e cidade ao fundo.'},
] as const;

export type TimeOfDayIndex=0|1|2|3;
export const nextTimeOfDay=(index:number):TimeOfDayIndex=>((index+1)%timeOfDayMoments.length) as TimeOfDayIndex;
export const previousTimeOfDay=(index:number):TimeOfDayIndex=>((index+timeOfDayMoments.length-1)%timeOfDayMoments.length) as TimeOfDayIndex;
export const remainingAfterSuspend=(remaining:number,elapsed:number)=>Math.max(0,remaining-elapsed);
export const mayAutoplay=({reduced,paused,visible,inView,activeReady,pending}:{reduced:boolean;paused:boolean;visible:boolean;inView:boolean;activeReady:boolean;pending:boolean})=>!reduced&&!paused&&visible&&inView&&activeReady&&!pending;
