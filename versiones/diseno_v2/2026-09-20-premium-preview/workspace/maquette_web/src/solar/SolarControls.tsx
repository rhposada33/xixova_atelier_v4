import type{RoomSunlightResult}from'./types';
const clock=(v:number)=>`${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(Math.round(v)%60).padStart(2,'0')}`;
const period=(solar:any)=>!solar.position.daylight?'Noite':solar.minutes<solar.engine.eventMinutes(solar.date,'noon')-90?'Sol da manhã':solar.minutes>solar.engine.eventMinutes(solar.date,'noon')+90?'Sol da tarde':'Sol do meio-dia';
export function SolarControls({solar,timezone,calibration,rooms,names,onClose}:{solar:any;timezone:string;calibration:string;rooms:RoomSunlightResult[];names:Map<string,string>;onClose?:()=>void}){
 const lit=rooms.filter(x=>x.directSunlight),events=solar.engine.calculate(solar.date,720),rise=solar.engine.localParts(events.sunrise).minutes,set=solar.engine.localParts(events.sunset).minutes,date=new Intl.DateTimeFormat('pt-BR',{timeZone:timezone,day:'numeric',month:'long',year:'numeric'}).format(solar.engine.instant(solar.date,solar.minutes));
 return <section className="solar-panel" aria-label="Estudo solar">
  <div className="solar-heading"><div><small>ESTUDO SOLAR</small><h2>Iluminação natural</h2></div>{onClose&&<button onClick={onClose} aria-label="Fechar estudo solar">×</button>}</div>
  <p className="solar-intro">Descubra como a luz do sol entra neste lar conforme a data e o horário.</p><div className="solar-clock"><strong>{clock(solar.minutes)}</strong><span>{date}<small>{timezone}</small></span></div>
  {calibration==='demo_unverified'&&<div className="solar-warning" role="status">◇ Estimativa · dados a calibrar</div>}
  <div className="solar-slider"><span>{clock(rise)}</span><input aria-label="Horário local" className="time-slider" type="range" min="0" max="1439" step="1" value={solar.minutes} onChange={e=>{solar.setPlaying(false);solar.setMinutes(+e.target.value)}}/><span>{clock(set)}</span></div>
  <label className="solar-date-input">Alterar data<input type="date" value={solar.date} onChange={e=>solar.setDate(e.target.value)}/></label>
  <div className="solar-presets"><button onClick={()=>solar.preset('morning')}>Manhã</button><button onClick={()=>solar.preset('noon')}>Meio-dia</button><button onClick={()=>solar.preset('sunset')}>Entardecer</button></div>
  <div className="solar-play"><button className="solar-main" onClick={()=>solar.setPlaying((v:boolean)=>!v)}>{solar.playing?'❚❚ Pausar':'▶ Percorrer o dia'}</button><select aria-label="Velocidade" value={solar.speed} onChange={e=>solar.setSpeed(+e.target.value)}>{[.5,1,2,4].map(x=><option key={x} value={x}>{x}×</option>)}</select></div>
  <div className="solar-secondary"><button onClick={()=>solar.season('summer')}>Verão</button><button onClick={()=>solar.season('winter')}>Inverno</button><button onClick={solar.now}>Agora</button></div>
  <label className="solar-toggle"><input type="checkbox" checked={solar.showPath} onChange={e=>solar.setShowPath(e.target.checked)}/> Mostrar trajetória</label>
  <div className="solar-result" aria-live="polite"><h3>{period(solar)}</h3>{solar.position.daylight&&lit.length>0?<div className="sun-rooms">{lit.map(r=><span key={r.roomId}>☀ {names.get(r.roomId)||r.roomId}<b>{Math.round(r.exposureRatio*100)}%</b></span>)}</div>:solar.position.daylight?<p>Sem sol direto neste momento.</p>:<p>A luz direta voltará ao nascer do sol.</p>}<strong>{lit.length} de {rooms.length} ambientes iluminados</strong></div>
  <details><summary>Dados da simulação</summary><p>Elevação {solar.position.elevationDegrees.toFixed(1)}° · Azimute {solar.position.azimuthDegrees.toFixed(1)}°</p></details>
 </section>
}
