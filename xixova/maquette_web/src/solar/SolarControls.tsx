import type{RoomSunlightResult}from'./types';
const clock=(v:number)=>`${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(Math.round(v)%60).padStart(2,'0')}`;
const period=(solar:any)=>!solar.position.daylight?'Noche':solar.minutes<solar.engine.eventMinutes(solar.date,'noon')-90?'Sol de la mañana':solar.minutes>solar.engine.eventMinutes(solar.date,'noon')+90?'Sol de la tarde':'Sol del mediodía';
export function SolarControls({solar,timezone,calibration,rooms,names,onClose}:{solar:any;timezone:string;calibration:string;rooms:RoomSunlightResult[];names:Map<string,string>;onClose?:()=>void}){
 const lit=rooms.filter(x=>x.directSunlight),events=solar.engine.calculate(solar.date,720),rise=solar.engine.localParts(events.sunrise).minutes,set=solar.engine.localParts(events.sunset).minutes,date=new Intl.DateTimeFormat('es',{timeZone:timezone,day:'numeric',month:'long',year:'numeric'}).format(solar.engine.instant(solar.date,solar.minutes));
 return <section className="solar-panel" aria-label="Estudio solar">
  <div className="solar-heading"><div><small>ILUMINACIÓN NATURAL</small><h2>{period(solar)}</h2></div>{onClose&&<button onClick={onClose} aria-label="Cerrar estudio solar">×</button>}</div>
  <p className="solar-intro">Descubra cómo entra el sol en este hogar según la fecha y la hora.</p><div className="solar-clock"><strong>{clock(solar.minutes)}</strong><span>{date}<small>{timezone}</small></span></div>
  {calibration==='demo_unverified'&&<div className="solar-warning" role="status">◇ Estimación · datos por calibrar</div>}
  <div className="solar-slider"><span>{clock(rise)}</span><input aria-label="Hora local" className="time-slider" type="range" min="0" max="1439" step="1" value={solar.minutes} onChange={e=>{solar.setPlaying(false);solar.setMinutes(+e.target.value)}}/><span>{clock(set)}</span></div>
  <label className="solar-date-input">Cambiar fecha<input type="date" value={solar.date} onChange={e=>solar.setDate(e.target.value)}/></label>
  <div className="solar-presets"><button onClick={()=>solar.preset('morning')}>Mañana</button><button onClick={()=>solar.preset('noon')}>Mediodía</button><button onClick={()=>solar.preset('sunset')}>Atardecer</button></div>
  <div className="solar-play"><button className="solar-main" onClick={()=>solar.setPlaying((v:boolean)=>!v)}>{solar.playing?'❚❚ Pausar':'▶ Recorrer el día'}</button><select aria-label="Velocidad" value={solar.speed} onChange={e=>solar.setSpeed(+e.target.value)}>{[.5,1,2,4].map(x=><option key={x} value={x}>{x}×</option>)}</select></div>
  <div className="solar-secondary"><button onClick={()=>solar.season('summer')}>Verano</button><button onClick={()=>solar.season('winter')}>Invierno</button><button onClick={solar.now}>Ahora</button></div>
  <label className="solar-toggle"><input type="checkbox" checked={solar.showPath} onChange={e=>solar.setShowPath(e.target.checked)}/> Mostrar trayectoria</label>
  <div className="solar-result" aria-live="polite"><h3>{solar.position.daylight?'Reciben sol directo':'El sol está bajo el horizonte'}</h3>{solar.position.daylight&&lit.length>0?<div className="sun-rooms">{lit.map(r=><span key={r.roomId}>☀ {names.get(r.roomId)||r.roomId}<b>{Math.round(r.exposureRatio*100)}%</b></span>)}</div>:solar.position.daylight?<p>Sin sol directo en este momento.</p>:<p>La luz directa se reanudará al amanecer.</p>}<strong>{lit.length} de {rooms.length} ambientes iluminados</strong></div>
  <details><summary>Datos de la simulación</summary><p>Elevación {solar.position.elevationDegrees.toFixed(1)}° · Azimut {solar.position.azimuthDegrees.toFixed(1)}°</p></details>
 </section>
}
