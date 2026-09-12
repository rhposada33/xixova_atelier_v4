import {useEffect,useMemo,useState} from 'react';
import {BuildingScene} from './BuildingScene';
import {buildingConfig,inventory,defaultFilters,filterUnits,formatBRL,statusLabel,orientationLabel,isMorning,canExplore,canPropose,type BuildingUnit,type UnitFilters} from './inventory';

function Icon({name,size=24}:{name:string;size?:number}){
 const paths:Record<string,React.ReactNode>={
  heart:<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  pin:<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
  moon:<path d="M20.8 13.2A9 9 0 0 1 10.8 3 9 9 0 1 0 20.8 13.2Z"/>,
  reset:<><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></>,
  area:<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>,
  bed:<><path d="M3 19V9h18v10M2 16h20M5 9V5h14v4M3 19v3m18-3v3"/></>,
  layers:<><path d="m12 2 10 6-10 6L2 8Zm-9 11 9 5 9-5M3 17l9 5 9-5"/></>,
  compass:<><circle cx="12" cy="12" r="10"/><path d="m16 7-3 7-6 3 3-7Z"/></>,
  zoomin:<><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6m-3-3v6"/></>,
  zoomout:<><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6"/></>,
  home:<><path d="m3 10 9-8 9 8v12H3Z"/><path d="M9 22V12h6v10"/></>,
  clear:<path d="M3 4v6h6M4 9a8 8 0 1 1 0 7"/>,
  info:<><circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v.2"/></>,
  close:<path d="m5 5 14 14M5 19 19 5"/>,
  matrix:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18m6-18v18"/></>,
 };return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.info}</svg>;
}
const loadFilters=():UnitFilters=>{try{return {...defaultFilters,...JSON.parse(sessionStorage.getItem('xixova-building-filters')||'{}')};}catch{return {...defaultFilters};}};
const savedInitial=():string[]=>{try{return JSON.parse(localStorage.getItem('xixova-saved-units')||'[]');}catch{return [];}};
function Status({unit}:{unit:BuildingUnit}){return <span className={`b-status ${unit.status}`}><span>{unit.status==='reserved'?'◷':unit.status==='sold'?'−':'●'}</span>{statusLabel[unit.status]}</span>;}

export function BuildingApp({onExplore}:{onExplore:(unit:BuildingUnit)=>void}){
  const [filters,setFilters]=useState<UnitFilters>(loadFilters),[selected,setSelected]=useState(()=>inventory.find(u=>u.code===new URLSearchParams(location.search).get('unidad'))||inventory.find(u=>u.code===sessionStorage.getItem('xixova-building-unit'))||inventory.find(u=>u.code===buildingConfig.defaultUnit)!),[mode,setMode]=useState<'neutral_day'|'warm_dusk'>('neutral_day');
  const [command,setCommand]=useState({type:'',nonce:0}),[modal,setModal]=useState(''),[notice,setNotice]=useState(''),[saved,setSaved]=useState<string[]>(savedInitial),[compare,setCompare]=useState<string[]>([]),[mobilePanel,setMobilePanel]=useState(''),[activeNav,setActiveNav]=useState('Edificio');
  const matches=useMemo(()=>filterUnits(inventory,filters),[filters]);const filtered=JSON.stringify(filters)!==JSON.stringify(defaultFilters);
  const change=<K extends keyof UnitFilters>(key:K,value:UnitFilters[K])=>setFilters(f=>({...f,[key]:value}));
  const select=(unit:BuildingUnit)=>{setSelected(unit);setMobilePanel('detail');const url=new URL(location.href);url.searchParams.set('vista','edificio');url.searchParams.set('unidad',unit.code);history.replaceState(null,'',url);sessionStorage.setItem('xixova-building-unit',unit.code);};
  const action=(type:string)=>setCommand(c=>({type,nonce:c.nonce+1}));
  const save=()=>setSaved(s=>s.includes(selected.code)?s.filter(c=>c!==selected.code):[...s,selected.code]);
  const addCompare=()=>{setCompare(c=>c.includes(selected.code)?c.filter(id=>id!==selected.code):c.length<3?[...c,selected.code]:c);setNotice('Selecciona hasta 3 unidades y abre Comparar.');};
  const reset=()=>setFilters({...defaultFilters});
  useEffect(()=>{sessionStorage.setItem('xixova-building-filters',JSON.stringify(filters));},[filters]);
  useEffect(()=>{localStorage.setItem('xixova-saved-units',JSON.stringify(saved));},[saved]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!modal)return;const sections=[...document.querySelectorAll<HTMLElement>('.building-header,.building-layout,.building-mobile-tabs')];sections.forEach(s=>s.inert=true);const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){setModal('');setActiveNav('Edificio');}if(e.key==='Tab'){const elements=[...document.querySelectorAll<HTMLElement>('.b-modal button:not(:disabled),.b-modal input,.b-modal a[href]')];const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',listener);return()=>{window.removeEventListener('keydown',listener);sections.forEach(s=>s.inert=false);};},[modal]);
  const open=(name:string)=>{setModal(name);setActiveNav(name==='matrix'?'Unidades':name==='floors'?'Pisos':name==='compare'?'Comparar':name==='environment'?'Entorno':'Edificio');};
  const close=()=>{setModal('');setActiveNav('Edificio');};
  const similar=inventory.filter(u=>u.code!==selected.code&&u.status==='available'&&u.bedrooms===selected.bedrooms).sort((a,b)=>Math.abs(a.priceBRL-selected.priceBRL)-Math.abs(b.priceBRL-selected.priceBRL)).slice(0,6);
  return <main className="building-app">
    <header className="building-header"><a href="?" className="building-brand" aria-label="Xixová, edificio"><b>XV</b><span>XIXOVÁ<small>VIVIR ES UN ARTE</small></span></a>
      <nav aria-label="Navegación del edificio">{['Edificio','Pisos','Unidades','Comparar','Entorno'].map((name,i)=><button key={name} className={activeNav===name?'active':''} onClick={()=>i===0?close():open(['','floors','matrix','compare','environment'][i])}>{name}{name==='Comparar'&&compare.length>0?` (${compare.length})`:''}</button>)}</nav>
      <div className="building-header-actions"><button onClick={()=>open('favorites')}><Icon name="heart"/> <span>Favoritos{saved.length?` (${saved.length})`:''}</span></button><button onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setNotice('Enlace de esta unidad copiado.');}catch{setModal('share');}}}><Icon name="pin"/><span>Compartir</span></button><button className="b-gold" disabled={!canPropose(selected)} onClick={()=>open('proposal')}>Solicitar propuesta</button></div>
    </header>
    <div className="building-mobile-tabs"><button onClick={()=>setMobilePanel(m=>m==='filters'?'': 'filters')}>Filtros {filtered?'●':''}</button><button onClick={()=>open('matrix')}>Unidades</button><button onClick={()=>setMobilePanel(m=>m==='detail'?'':'detail')}>Unidad {selected.code}</button></div>
    <div className="building-layout">
      <aside className={`building-filters ${mobilePanel==='filters'?'mobile-open':''}`} aria-label="Filtros de unidades">
        <button className="b-mobile-close" onClick={()=>setMobilePanel('')} aria-label="Cerrar filtros"><Icon name="close"/></button>
        <h1>Encuentra tu<br/> apartamento ideal</h1><p className="b-availability"><strong>{inventory.filter(u=>u.status==='available').length}</strong> de {inventory.length} unidades disponibles</p>
        <fieldset><legend>Rango de precio (R$)</legend><div className="b-range"><input aria-label="Precio mínimo" type="range" min="600000" max="2500000" step="10000" value={filters.minPrice} onChange={e=>change('minPrice',Math.min(+e.target.value,filters.maxPrice))}/><input aria-label="Precio máximo" type="range" min="600000" max="2500000" step="10000" value={filters.maxPrice} onChange={e=>change('maxPrice',Math.max(+e.target.value,filters.minPrice))}/></div><div className="b-range-values"><label><input aria-label="Precio mínimo exacto" type="number" min="0" value={filters.minPrice} onChange={e=>change('minPrice',+e.target.value)}/></label><label><input aria-label="Precio máximo exacto" type="number" min="0" value={filters.maxPrice} onChange={e=>change('maxPrice',+e.target.value)}/></label></div></fieldset>
        <fieldset><legend>Piso</legend><select aria-label="Piso" value={filters.floor} onChange={e=>change('floor',e.target.value)}><option value="">Todos los pisos</option>{Array.from({length:buildingConfig.floors},(_,i)=><option key={i+1} value={i+1}>Piso {i+1}</option>)}</select></fieldset>
        <fieldset><legend>Área (m²)</legend><div className="b-range"><input aria-label="Área mínima" type="range" min="50" max="200" value={filters.minArea} onChange={e=>change('minArea',Math.min(+e.target.value,filters.maxArea))}/><input aria-label="Área máxima" type="range" min="50" max="200" value={filters.maxArea} onChange={e=>change('maxArea',Math.max(+e.target.value,filters.minArea))}/></div><div className="b-range-values"><label><input aria-label="Área mínima exacta" type="number" min="0" value={filters.minArea} onChange={e=>change('minArea',+e.target.value)}/><span>m²</span></label><label><input aria-label="Área máxima exacta" type="number" min="0" value={filters.maxArea} onChange={e=>change('maxArea',+e.target.value)}/><span>m²</span></label></div></fieldset>
        <fieldset><legend>Orientación</legend><select aria-label="Orientación" value={filters.orientation} onChange={e=>change('orientation',e.target.value)}><option value="">Todas las orientaciones</option>{Object.entries(orientationLabel).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></fieldset>
        <fieldset><legend>Dormitorios</legend><div className="b-bedroom-buttons">{[2,3,4].map(n=><button key={n} aria-pressed={filters.bedrooms===n} className={filters.bedrooms===n?'selected':''} onClick={()=>change('bedrooms',filters.bedrooms===n?0:n)}>{n===4?'4+':n}</button>)}</div></fieldset>
        <div className="b-preferences" aria-label="Preferencias rápidas"><button aria-pressed={filters.sun==='morning'} onClick={()=>change('sun',filters.sun==='morning'?'':'morning')}>☀ Sol de mañana</button><button aria-pressed={filters.sun==='afternoon'} onClick={()=>change('sun',filters.sun==='afternoon'?'':'afternoon')}>◐ Sol de tarde</button><button aria-pressed={filters.sea} onClick={()=>change('sea',!filters.sea)}>≈ Vista al mar</button></div>
        <button className="b-clear" onClick={reset}><Icon name="clear" size={17}/>Limpiar filtros</button>
        <p className="b-result-count" aria-live="polite">{filtered?`${matches.length} unidades coinciden con tus filtros`:`${inventory.length} unidades en el edificio`}</p>
        {matches.length===0&&<p className="b-empty-inline">No hay unidades con esta combinación. Prueba ampliar el rango o limpiar filtros.</p>}
        <div className="b-legend">{(['available','reserved','sold'] as const).map(status=><div key={status}><i className={status}/><span>{statusLabel[status]}</span><b>{inventory.filter(u=>u.status===status).length}</b></div>)}</div>
        <button className="b-matrix-link" onClick={()=>open('matrix')}><Icon name="matrix" size={16}/>Ver matriz de unidades →</button>
        <small className="b-demo">Inventario de demostración · Reconstrucción aproximada</small>
      </aside>
      <section className="building-view" aria-label="Vista general del edificio">
        <BuildingScene selected={selected} matches={matches.map(u=>u.code)} filtered={filtered} mode={mode} onSelect={select} command={command}/>
        <div className="b-light-controls"><button className={mode==='neutral_day'?'active':''} aria-pressed={mode==='neutral_day'} onClick={()=>setMode('neutral_day')}><Icon name="sun" size={26}/>Día</button><button className={mode==='warm_dusk'?'active':''} aria-pressed={mode==='warm_dusk'} onClick={()=>setMode('warm_dusk')}><Icon name="moon" size={24}/>Atardecer</button></div>
        <button className="b-reset-view" onClick={()=>action('reset')}><span><Icon name="reset" size={27}/></span>Restablecer<br/>vista</button>
        <div className="b-camera-tools">{[['rotate','reset','Rotar'],['in','zoomin','Acercar'],['out','zoomout','Alejar'],['reset','home','Vista inicial']].map(([type,icon,title])=><button key={title} onClick={()=>action(type)}><Icon name={icon}/><span>{title}</span></button>)}</div>
        <div className="b-model-note">XIXOVÁ RESIDENCES <span>·</span> MAQUETA INTERACTIVA</div>
      </section>
      <aside className={`building-details ${mobilePanel==='detail'?'mobile-open':''}`} aria-label="Ficha de unidad">
        <button className="b-mobile-close" onClick={()=>setMobilePanel('')} aria-label="Cerrar ficha"><Icon name="close"/></button>
        <article className="b-unit-card"><div className="b-card-heading"><h2>Unidad {selected.code}</h2><Status unit={selected}/></div><p className="b-floor-subtitle">Piso {selected.floor} · Final {selected.code.slice(-2)}</p>
          <div className="b-unit-facts"><div><i><Icon name="area"/></i><span><strong>{selected.privateAreaM2} m²</strong><small>Área privativa</small></span></div><div><i><Icon name="bed"/></i><span><strong>{selected.bedrooms}</strong><small>Dormitorios</small></span></div><div><i><Icon name="compass"/></i><span><strong>{orientationLabel[selected.orientation]}</strong><small>Orientación</small></span></div><div><i><Icon name="layers"/></i><span><strong>Piso {selected.floor}</strong><small>Del edificio</small></span></div></div>
          <div className="b-price"><strong>{formatBRL(selected.priceBRL)}</strong><button aria-label={saved.includes(selected.code)?'Quitar de favoritos':'Guardar unidad'} aria-pressed={saved.includes(selected.code)} onClick={save}><Icon name="heart"/></button><small>{formatBRL(Math.round(selected.priceBRL/selected.privateAreaM2))}/m² · Precio ilustrativo</small></div>
          <div className="b-unit-extras">{selected.suites} suites · {selected.parkingSpaces} estacionamientos<br/>{isMorning(selected)?'Sol de mañana':'Sol de tarde'} · {selected.viewType==='sea'?'Vista parcial al mar':selected.viewType==='city'?'Vista a la ciudad':'Vista al jardín'}</div>
          <button className="b-primary" disabled={!canExplore(selected)} onClick={()=>onExplore(selected)}>{canExplore(selected)?'Explorar apartamento  →':'Interior aún no disponible'}</button>
          {canPropose(selected)?<button className="b-outline" onClick={()=>open('proposal')}>Solicitar propuesta</button>:<button className="b-outline" onClick={()=>open('similar')}>{selected.status==='reserved'?'Consultar disponibilidad':'Ver unidades similares'}</button>}
          <button className="b-compare-link" aria-pressed={compare.includes(selected.code)} onClick={addCompare}>{compare.includes(selected.code)?'✓ Añadida a comparación':'+ Comparar esta unidad'}</button>
          <p className="b-interior-note"><Icon name="info" size={19}/><span>El interior muestra una tipología ilustrativa. Los acabados, medidas y mobiliario pueden variar según la unidad.</span></p>
        </article>
        <article className="b-neighbors"><h3>Otras unidades en este piso</h3>{inventory.filter(u=>u.floor===selected.floor&&u.code!==selected.code).map(u=><button key={u.code} onClick={()=>select(u)}><i className={u.status}/><strong>{u.code}</strong><span>{statusLabel[u.status]}</span><small>{u.privateAreaM2} m²</small><b>›</b></button>)}</article>
      </aside>
    </div>
    {notice&&<div className="b-toast" role="status">{notice}</div>}
    {modal&&<div className="b-modal-shade" onClick={close}><section className={`b-modal ${['matrix','floors'].includes(modal)?'wide':''}`} role="dialog" aria-modal="true" aria-labelledby="b-modal-title" onClick={e=>e.stopPropagation()}><button autoFocus className="b-modal-close" onClick={close} aria-label="Cerrar diálogo"><Icon name="close"/></button>
      <h2 id="b-modal-title">{({matrix:'Matriz de unidades',floors:'Explora los pisos',compare:'Compara tus favoritos',favorites:'Tus unidades guardadas',environment:'Un hogar junto al mar',proposal:`Unidad ${selected.code}`,similar:'Encuentra una alternativa',share:'Compartir unidad'} as Record<string,string>)[modal]}</h2>
      {['matrix','floors'].includes(modal)&&<><p>Selecciona una unidad para ver su ficha. Los filtros se aplican también a esta matriz.</p><div className="b-unit-matrix">{Array.from({length:18},(_,i)=>18-i).map(floor=><div key={floor}><button className="b-matrix-floor" onClick={()=>{change('floor',String(floor));close();}}>Piso {String(floor).padStart(2,'0')}</button>{inventory.filter(u=>u.floor===floor).map(u=><button key={u.code} className={`${u.status} ${u.code===selected.code?'selected':''} ${matches.some(m=>m.code===u.code)?'':'dimmed'}`} onClick={()=>{select(u);close();}} aria-label={`Unidad ${u.code}, ${statusLabel[u.status]}, ${u.privateAreaM2} metros cuadrados`}><strong>{u.code}</strong><small>{statusLabel[u.status]}</small></button>)}</div>)}</div></>}
      {modal==='compare'&&(compare.length?<div className="b-comparison">{compare.map(code=>inventory.find(u=>u.code===code)!).map(u=><article key={u.code}><h3>Unidad {u.code}</h3><Status unit={u}/><p>{u.privateAreaM2} m² · {u.bedrooms} dormitorios</p><p>Piso {u.floor} · {orientationLabel[u.orientation]}</p><strong>{formatBRL(u.priceBRL)}</strong><button className="b-outline" onClick={()=>{select(u);close();}}>Ver unidad</button><button onClick={()=>setCompare(c=>c.filter(code=>code!==u.code))}>Quitar</button></article>)}</div>:<p>Añade hasta tres unidades desde su ficha para comparar área, dormitorios, orientación y precio.</p>)}
      {['favorites','similar'].includes(modal)&&<div className="b-list">{(modal==='favorites'?inventory.filter(u=>saved.includes(u.code)):similar).map(u=><button key={u.code} onClick={()=>{select(u);close();}}><strong>Unidad {u.code}</strong><Status unit={u}/><span>{u.privateAreaM2} m² · {formatBRL(u.priceBRL)} →</span></button>)}{modal==='favorites'&&!saved.length&&<p>Guarda unidades con el corazón de su ficha para encontrarlas aquí.</p>}</div>}
      {modal==='proposal'&&<><Status unit={selected}/><p>Esta es una experiencia de demostración. No realiza reservas ni envía solicitudes comerciales.</p><p>Guarda los datos para conversar con tu asesor: {selected.privateAreaM2} m², {selected.bedrooms} dormitorios, piso {selected.floor} · {formatBRL(selected.priceBRL)}.</p><button className="b-primary" onClick={()=>{if(!saved.includes(selected.code))setSaved(s=>[...s,selected.code]);close();setNotice('Unidad guardada para consultar con tu asesor.');}}>Guardar ficha de la unidad</button></>}
      {modal==='environment'&&<><div className="b-environment-art"><Icon name="sun" size={48}/><span>BRISA · LUZ · NATURALEZA</span></div><p>Una interpretación residencial inspirada en el litoral brasileño, con balcones profundos, acceso ajardinado y vegetación tropical.</p><p>La ubicación y la orientación son provisionales. Las preferencias de sol y vistas ilustran cómo funcionará el inventario real; no representan un estudio solar del terreno.</p></>}
      {modal==='share'&&<label>Enlace a la unidad<input className="b-share-input" readOnly value={location.href} onFocus={e=>e.target.select()}/></label>}
    </section></div>}
  </main>;
}
