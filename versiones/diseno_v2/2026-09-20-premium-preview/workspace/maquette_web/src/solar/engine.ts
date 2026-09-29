import * as SunCalc from 'suncalc';
import {Temporal} from 'temporal-polyfill';
import type{ProjectSolarConfig,SolarPosition}from'./types';

export const directionFromSolar=(azimuthDegrees:number,elevationDegrees:number,northOffsetDegrees=0):[number,number,number]=>{
 const az=(azimuthDegrees+northOffsetDegrees)*Math.PI/180,el=elevationDegrees*Math.PI/180,c=Math.cos(el);
 return [c*Math.sin(az),c*Math.cos(az),Math.sin(el)];
};
export class SolarEngine{
 constructor(readonly config:ProjectSolarConfig){}
 instant(date:string,minutes:number):Date{
  const hour=Math.floor(minutes/60),minute=Math.round(minutes%60);
  return new Date(Number(Temporal.ZonedDateTime.from(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00[${this.config.location.timezone}]`).epochMilliseconds));
 }
 localParts(instant:Date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:this.config.location.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const get=(type:string)=>parts.find(x=>x.type===type)?.value||'';
  return{date:`${get('year')}-${get('month')}-${get('day')}`,minutes:+get('hour')*60 + +get('minute')};
 }
 calculate(date:string,minutes:number):SolarPosition{
  const instant=this.instant(date,minutes),{latitude,longitude}=this.config.location,pos=SunCalc.getPosition(instant,latitude,longitude),times=SunCalc.getTimes(instant,latitude,longitude);
  const azimuthDegrees=(pos.azimuth+360)%360,elevationDegrees=pos.altitude;
  return{azimuthDegrees,elevationDegrees,direction:directionFromSolar(azimuthDegrees,elevationDegrees,this.config.building.northOffsetDegrees),sunrise:times.sunrise as Date,solarNoon:times.solarNoon,sunset:times.sunset as Date,daylight:elevationDegrees>0};
 }
 eventMinutes(date:string,event:'morning'|'noon'|'sunset'){
  const p=this.calculate(date,720),instant=event==='morning'?new Date(p.sunrise.getTime()+45*60000):event==='sunset'?new Date(p.sunset.getTime()-45*60000):p.solarNoon;
  return this.localParts(instant).minutes;
 }
 seasonDate(year:number,season:'summer'|'winter'){
  const south=this.config.location.latitude<0;
  return `${year}-${(season==='summer')===south?'12-21':'06-21'}`;
 }
}
