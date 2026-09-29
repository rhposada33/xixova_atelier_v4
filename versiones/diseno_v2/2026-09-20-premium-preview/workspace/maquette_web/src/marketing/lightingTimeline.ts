export const LIGHTING_START_HOUR=8;
export const LIGHTING_END_HOUR=20;
export const LIGHTING_CYCLE_MS=16_000;
export const LIGHTING_DAY_PORTION=.92;

export const lightingPresets=[
  {id:'morning',label:'Manhã',hour:8},
  {id:'midday',label:'Meio-dia',hour:12},
  {id:'sunset',label:'Entardecer',hour:17.5},
  {id:'night',label:'Noite',hour:20},
] as const;

export type LightingPresetId=(typeof lightingPresets)[number]['id'];
export type LightingState={
  hour:number;
  keyPosition:[number,number,number];keyColor:string;keyIntensity:number;
  hemisphereSky:string;hemisphereGround:string;hemisphereIntensity:number;
  fillColor:string;fillIntensity:number;exposure:number;
  skyStart:string;skyEnd:string;shadowOpacity:number;roomEmission:number;
};

const stops:LightingState[]=[
  {hour:8,keyPosition:[-18,13,15],keyColor:'#ffdda7',keyIntensity:3.1,hemisphereSky:'#dce9f4',hemisphereGround:'#58635e',hemisphereIntensity:.88,fillColor:'#c0d7ef',fillIntensity:.22,exposure:.88,skyStart:'#d6e5ef',skyEnd:'#eee9db',shadowOpacity:.24,roomEmission:0},
  {hour:12,keyPosition:[-2,30,9],keyColor:'#fffaf2',keyIntensity:3.5,hemisphereSky:'#c3dcfa',hemisphereGround:'#59645d',hemisphereIntensity:1,fillColor:'#cbdef2',fillIntensity:.2,exposure:.84,skyStart:'#b8d7f2',skyEnd:'#e2e9eb',shadowOpacity:.2,roomEmission:0},
  {hour:17.5,keyPosition:[22,10,9],keyColor:'#ffc48a',keyIntensity:3.4,hemisphereSky:'#a6bedc',hemisphereGround:'#595966',hemisphereIntensity:.76,fillColor:'#9ebeea',fillIntensity:.28,exposure:.86,skyStart:'#a8b9cf',skyEnd:'#e5cec0',shadowOpacity:.3,roomEmission:.04},
  {hour:20,keyPosition:[-9,17,-12],keyColor:'#9dbbed',keyIntensity:.62,hemisphereSky:'#6484b1',hemisphereGround:'#283541',hemisphereIntensity:.4,fillColor:'#91acd2',fillIntensity:.18,exposure:.68,skyStart:'#14233b',skyEnd:'#354963',shadowOpacity:.14,roomEmission:.32},
];

export const clampLightingHour=(hour:number)=>Math.min(LIGHTING_END_HOUR,Math.max(LIGHTING_START_HOUR,hour));
export const formatLightingHour=(hour:number)=>{const minutes=Math.round(clampLightingHour(hour)*60);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`};
export const selectedLightingPreset=(hour:number):LightingPresetId=>lightingPresets.reduce((closest,preset)=>Math.abs(preset.hour-hour)<Math.abs(closest.hour-hour)?preset:closest).id;

const mix=(from:number,to:number,amount:number)=>from+(to-from)*amount;
const mixColor=(from:string,to:string,amount:number)=>{const parse=(value:string)=>[1,3,5].map(offset=>Number.parseInt(value.slice(offset,offset+2),16));const [r1,g1,b1]=parse(from),[r2,g2,b2]=parse(to);return `#${[mix(r1,r2,amount),mix(g1,g2,amount),mix(b1,b2,amount)].map(value=>Math.round(value).toString(16).padStart(2,'0')).join('')}`};
const blend=(from:LightingState,to:LightingState,amount:number):LightingState=>({
  hour:mix(from.hour,to.hour,amount),keyPosition:from.keyPosition.map((value,index)=>mix(value,to.keyPosition[index],amount)) as LightingState['keyPosition'],keyColor:mixColor(from.keyColor,to.keyColor,amount),keyIntensity:mix(from.keyIntensity,to.keyIntensity,amount),hemisphereSky:mixColor(from.hemisphereSky,to.hemisphereSky,amount),hemisphereGround:mixColor(from.hemisphereGround,to.hemisphereGround,amount),hemisphereIntensity:mix(from.hemisphereIntensity,to.hemisphereIntensity,amount),fillColor:mixColor(from.fillColor,to.fillColor,amount),fillIntensity:mix(from.fillIntensity,to.fillIntensity,amount),exposure:mix(from.exposure,to.exposure,amount),skyStart:mixColor(from.skyStart,to.skyStart,amount),skyEnd:mixColor(from.skyEnd,to.skyEnd,amount),shadowOpacity:mix(from.shadowOpacity,to.shadowOpacity,amount),roomEmission:mix(from.roomEmission,to.roomEmission,amount),
});

export const lightingForHour=(value:number)=>{const hour=clampLightingHour(value);const after=stops.find(stop=>stop.hour>=hour)??stops.at(-1)!;const before=[...stops].reverse().find(stop=>stop.hour<=hour)??stops[0];return before===after?{...before,hour}:blend(before,after,(hour-before.hour)/(after.hour-before.hour));};
export const cycleProgressForHour=(hour:number)=>((clampLightingHour(hour)-LIGHTING_START_HOUR)/(LIGHTING_END_HOUR-LIGHTING_START_HOUR))*LIGHTING_DAY_PORTION;
export const hourForCycleProgress=(value:number)=>{const progress=((value%1)+1)%1;return progress<=LIGHTING_DAY_PORTION?mix(LIGHTING_START_HOUR,LIGHTING_END_HOUR,progress/LIGHTING_DAY_PORTION):mix(LIGHTING_END_HOUR,LIGHTING_START_HOUR,(progress-LIGHTING_DAY_PORTION)/(1-LIGHTING_DAY_PORTION));};
export const lightingForCycleProgress=(value:number)=>{const progress=((value%1)+1)%1;return progress<=LIGHTING_DAY_PORTION?lightingForHour(hourForCycleProgress(progress)):blend(stops.at(-1)!,stops[0],(progress-LIGHTING_DAY_PORTION)/(1-LIGHTING_DAY_PORTION));};
export const advanceLightingCycle=(progress:number,elapsedMs:number)=>((progress+elapsedMs/LIGHTING_CYCLE_MS)%1+1)%1;
