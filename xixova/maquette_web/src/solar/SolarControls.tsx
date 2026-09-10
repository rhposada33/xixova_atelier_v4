import type{RoomSunlightResult}from'./types';
const clock=(v:number)=>`${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(Math.round(v)%60).padStart(2,'0')}`;
export function SolarControls({solar,timezone,calibration,rooms,names,onClose}:{solar:any;timezone:string;calibration:string;rooms:RoomSunlightResult[];names:Map<string,string>;onClose?:()=>void}){
 const lit=rooms.filter(x=>x.directSunlight);
 return <section className="solar-panel" aria-label="Estudio solar">
  <div className="solar-heading"><div><small>ESTUDIO SOLAR</small><h2>Iluminación natural</h2></div>{onClose&&<button onClick={onClose} aria-label="Cerrar estudio solar">×</button>}</div>
  <p>Descubra cómo entra el sol en este hogar según la fecha y la hora.</p>
  {calibration==='demo_unverified'&&<div className="solar-warning" role="status">◇ Estimación solar · orientación y ubicación por calibrar</div>}
  <div className="solar-date"><label>Fecha<input type="date" value={solar.date} onChange={e=>solar.setDate(e.target.value)}/></label><label>Hora local<strong>{clock(solar.minutes)}</strong><span>{timezone}</span></label></div>
  <input aria-label="Hora local" className="time-slider" type="range" min="0" max="1439" step="1" value={solar.minutes} onChange={e=>{solar.setPlaying(false);solar.setMinutes(+e.target.value)}}/>
  <div className="solar-presets"><button onClick={()=>solar.preset('morning')}>Mañana</button><button onClick={()=>solar.preset('noon')}>Mediodía</button><button onClick={()=>solar.preset('sunset')}>Atardecer</button></div>
  <div className="solar-play"><button className="solar-main" onClick={()=>solar.setPlaying((v:boolean)=>!v)}>{solar.playing?'❚❚ Pausar':'▶ Recorrer el día'}</button><select aria-label="Velocidad" value={solar.speed} onChange={e=>solar.setSpeed(+e.target.value)}>{[.5,1,2,4].map(x=><option key={x} value={x}>{x}×</option>)}</select></div>
  <div className="solar-presets"><button onClick={()=>solar.season('summer')}>Verano</button><button onClick={()=>solar.season('winter')}>Invierno</button><button onClick={solar.now}>Ahora</button></div>
  <label className="solar-toggle"><input type="checkbox" checked={solar.showPath} onChange={e=>solar.setShowPath(e.target.checked)}/> Mostrar trayectoria solar</label>
  <div className="sun-state"><i className={solar.position.daylight?'day':'night'}/><span><b>{solar.position.daylight?'Sol sobre el horizonte':'Noche'}</b><small>Elevación {solar.position.elevationDegrees.toFixed(1)}° · Azimut {solar.position.azimuthDegrees.toFixed(1)}°</small></span></div>
  <h3>Con sol directo ahora</h3>{lit.length?<div className="sun-rooms">{lit.map(r=><span key={r.roomId}>{names.get(r.roomId)||r.roomId}<b>{Math.round(r.exposureRatio*100)}%</b></span>)}</div>:<p className="empty-sun">Ninguna estancia recibe sol directo a esta hora.</p>}
 </section>
}
