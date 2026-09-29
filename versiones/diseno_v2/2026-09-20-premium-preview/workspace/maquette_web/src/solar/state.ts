import{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{SolarEngine}from'./engine';import type{ProjectSolarConfig}from'./types';
export function useSolarSimulation(config:ProjectSolarConfig){
 const engine=useMemo(()=>new SolarEngine(config),[config]),initial=useMemo(()=>engine.localParts(new Date()),[engine]);
 const[date,setDate]=useState(initial.date),[minutes,setMinutes]=useState(initial.minutes),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[showPath,setShowPath]=useState(true);const timer=useRef<number|undefined>(undefined);
 const position=useMemo(()=>engine.calculate(date,minutes),[engine,date,minutes]);
 useEffect(()=>{if(!playing)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){setPlaying(false);return}const start=performance.now(),events=engine.calculate(date,720),a=engine.localParts(events.sunrise).minutes,b=engine.localParts(events.sunset).minutes,origin=Math.max(a,Math.min(b,minutes));const tick=()=>{const next=origin+(performance.now()-start)/30000*(b-a)*speed;if(next>=b){setMinutes(a);setPlaying(false);return}setMinutes(next);timer.current=window.setTimeout(tick,60)};tick();return()=>{if(timer.current)clearTimeout(timer.current)}},[playing,speed,date,engine]);
 const preset=useCallback((event:'morning'|'noon'|'sunset')=>{setPlaying(false);setMinutes(engine.eventMinutes(date,event))},[engine,date]);
 const season=useCallback((value:'summer'|'winter')=>{setPlaying(false);setDate(engine.seasonDate(+date.slice(0,4),value))},[engine,date]);
 const now=()=>{const p=engine.localParts(new Date());setDate(p.date);setMinutes(p.minutes);setPlaying(false)};
 return{engine,date,setDate,minutes,setMinutes,playing,setPlaying,speed,setSpeed,showPath,setShowPath,position,preset,season,now};
}
