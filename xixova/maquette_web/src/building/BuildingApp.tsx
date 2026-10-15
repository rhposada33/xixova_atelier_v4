import {useEffect,useMemo,useRef,useState} from 'react';
import {BuildingScene} from './BuildingScene';
import {buildingConfig,defaultFilters,filterUnits,formatBRL,statusLabel,orientationLabel,isMorning,canExplore,canPropose,type BuildingUnit,type UnitFilters} from './inventory';
import {useProjectInventory,useSelectedUnit} from '../infrastructure/inventory/useInventory';
import type {InventorySummary} from '../domain/inventory';
import {visualV2} from './visualV2';

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
  building:<><path d="M5 22V3h9v19M14 8h5v14M2 22h20M8 6v2m3-2v2M8 11v2m3-2v2M8 16v2m3-2v2m5-7v2m0 3v2"/></>,
  landscape:<><path d="m2 21 7-16 7 16Zm9 0 6-12 6 12Z"/></>,
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
  const state=useProjectInventory(buildingConfig);
  const requested=new URLSearchParams(location.search).get('unidad')||sessionStorage.getItem('xixova-building-unit');
  const selection=useSelectedUnit(state.data,buildingConfig,requested);
  if(state.loading)return <main className="building-app"><div className="building-loading"><span className="building-spinner"/>Carregando unidades disponíveis…</div></main>;
  if(state.error)return <main className="building-app"><div className="building-error" role="alert"><p>Não foi possível carregar a disponibilidade.</p><button onClick={state.retry}>Tentar novamente</button></div></main>;
  if(!selection.unit)return <main className="building-app"><div className="building-error" role="status">Este empreendimento não está disponível.</div></main>;
  return <BuildingExperience inventory={state.data} summary={state.summary} initialSelected={selection.unit} invalidCode={selection.invalidCode} onExplore={onExplore}/>;
}

function BuildingExperience({inventory,summary,initialSelected,invalidCode,onExplore}:{inventory:BuildingUnit[];summary:InventorySummary;initialSelected:BuildingUnit;invalidCode:boolean;onExplore:(unit:BuildingUnit)=>void}){
  const [filters,setFilters]=useState<UnitFilters>(loadFilters),[selected,setSelected]=useState(initialSelected),[mode,setMode]=useState<'neutral_day'|'warm_dusk'>('neutral_day');
  const [command,setCommand]=useState({type:'',nonce:0}),[modal,setModal]=useState(''),[notice,setNotice]=useState(''),[saved,setSaved]=useState<string[]>(savedInitial),[compare,setCompare]=useState<string[]>([]),[mobilePanel,setMobilePanel]=useState(''),[filtersOpen,setFiltersOpen]=useState(false),[activeNav,setActiveNav]=useState('Edifício');
  const filtersRef=useRef<HTMLElement>(null),filterTriggerRef=useRef<HTMLButtonElement>(null),mobileFilterTriggerRef=useRef<HTMLButtonElement>(null);
  const matches=useMemo(()=>filterUnits(inventory,filters),[filters,inventory]);const filtered=JSON.stringify(filters)!==JSON.stringify(defaultFilters);
  const change=<K extends keyof UnitFilters>(key:K,value:UnitFilters[K])=>setFilters(f=>({...f,[key]:value}));
  const closeFilters=()=>{setFiltersOpen(false);setMobilePanel(panel=>panel==='filters'?'':panel);};
  const toggleFilters=()=>{if(window.matchMedia('(max-width:850px)').matches)setMobilePanel(panel=>panel==='filters'?'':'filters');else setFiltersOpen(value=>!value);};
  const select=(unit:BuildingUnit)=>{if(filtered&&!matches.some(match=>match.code===unit.code))return;setSelected(unit);setFiltersOpen(false);setMobilePanel('detail');const url=new URL(location.href);url.searchParams.set('vista','edificio');url.searchParams.set('unidad',unit.code);history.replaceState(null,'',url);sessionStorage.setItem('xixova-building-unit',unit.code);};
  const action=(type:string)=>setCommand(c=>({type,nonce:c.nonce+1}));
  const save=()=>setSaved(s=>s.includes(selected.code)?s.filter(c=>c!==selected.code):[...s,selected.code]);
  const addCompare=()=>{setCompare(c=>c.includes(selected.code)?c.filter(id=>id!==selected.code):c.length<3?[...c,selected.code]:c);setNotice('Selecione até 3 unidades e abra Comparar.');};
  const reset=()=>setFilters({...defaultFilters});
  const openWhatsApp=()=>{
    const share=new URL(location.href);share.pathname='/demo';share.searchParams.set('vista','edificio');share.searchParams.set('unidad',selected.code);const shareUrl=share.href;
    const message=[
      `Olá! Tenho interesse na Unidade ${selected.code} do ${buildingConfig.name}.`,
      `Área: ${selected.privateAreaM2} m²`,
      `Andar: ${selected.floor}`,
      `Valor ilustrativo: ${formatBRL(selected.priceBRL)}`,
      `Link: ${shareUrl}`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
  };
  useEffect(()=>{sessionStorage.setItem('xixova-building-filters',JSON.stringify(filters));},[filters]);
  useEffect(()=>{localStorage.setItem('xixova-saved-units',JSON.stringify(saved));},[saved]);
  useEffect(()=>{if(invalidCode){setNotice(`A unidade informada não foi encontrada. Exibindo a unidade ${initialSelected.code}.`);const url=new URL(location.href);url.searchParams.set('unidad',initialSelected.code);history.replaceState(null,'',url);}},[invalidCode,initialSelected.code]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(filtersOpen||mobilePanel)){setFiltersOpen(false);setMobilePanel('');}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[filtersOpen,mobilePanel]);
  useEffect(()=>{if(!filtersOpen&&mobilePanel!=='filters')return;const onPointerDown=(event:PointerEvent)=>{const target=event.target as Node;if(filtersRef.current?.contains(target)||filterTriggerRef.current?.contains(target)||mobileFilterTriggerRef.current?.contains(target))return;closeFilters();};document.addEventListener('pointerdown',onPointerDown);return()=>document.removeEventListener('pointerdown',onPointerDown);},[filtersOpen,mobilePanel]);
  useEffect(()=>{if(!modal)return;const sections=[...document.querySelectorAll<HTMLElement>('.building-header,.building-layout,.building-mobile-tabs')];sections.forEach(s=>s.inert=true);const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){setModal('');setActiveNav('Edifício');}if(e.key==='Tab'){const elements=[...document.querySelectorAll<HTMLElement>('.b-modal button:not(:disabled),.b-modal input,.b-modal a[href]')];const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',listener);return()=>{window.removeEventListener('keydown',listener);sections.forEach(s=>s.inert=false);};},[modal]);
  const open=(name:string)=>{setModal(name);setActiveNav(name==='matrix'?'Unidades':name==='floors'?'Andares':name==='compare'?'Comparar':name==='environment'?'Arredores':'Edifício');};
  const close=()=>{setModal('');setActiveNav('Edifício');};
  const similar=inventory.filter(u=>u.code!==selected.code&&u.status==='available'&&u.bedrooms===selected.bedrooms).sort((a,b)=>Math.abs((a.priceBRL??0)-(selected.priceBRL??0))-Math.abs((b.priceBRL??0)-(selected.priceBRL??0))).slice(0,6);
  return <main className={`building-app ${visualV2?'building-visual-v2':''}`}>
    <header className="building-header"><a href="/" className="building-brand" aria-label="Promoven, início"><b>P</b><span>PROMOVEN<small>Experiências imobiliárias</small></span></a>
      <nav aria-label="Navegação do edifício">{['Edifício','Andares','Unidades','Comparar','Arredores'].map((name,i)=><button key={name} className={activeNav===name?'active':''} onClick={()=>i===0?close():open(['','floors','matrix','compare','environment'][i])}>{name}{name==='Comparar'&&compare.length>0?` (${compare.length})`:''}</button>)}</nav>
      <div className="building-header-actions"><button aria-label={`Favoritos${saved.length?` (${saved.length})`:''}`} onClick={()=>open('favorites')}><Icon name="heart"/> <span>Favoritos{saved.length?` (${saved.length})`:''}</span></button><button onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setNotice('Link desta unidade copiado.');}catch{setModal('share');}}}><Icon name="pin"/><span>Compartilhar</span></button><button className="b-gold" disabled={!canPropose(selected)} onClick={openWhatsApp}>Falar pelo WhatsApp</button></div>
    </header>
    <div className="building-mobile-tabs"><button ref={mobileFilterTriggerRef} aria-expanded={mobilePanel==='filters'} onClick={toggleFilters}>Filtros {filtered?'●':''}</button><button onClick={()=>open('matrix')}>Unidades</button><button onClick={()=>setMobilePanel(m=>m==='detail'?'':'detail')}>Unidade {selected.code}</button></div>
    <div className="building-layout">
      <aside ref={filtersRef} id="building-filters" className={`building-filters ${filtersOpen?'is-open':''} ${mobilePanel==='filters'?'mobile-open':''}`} aria-label="Filtros de unidades">
        <button className="b-mobile-close" onClick={()=>{setMobilePanel('');setFiltersOpen(false);}} aria-label="Fechar filtros"><Icon name="close"/></button>
        <button className="b-filter-close" type="button" onClick={closeFilters} aria-label="Fechar filtros"><Icon name="close" size={16}/><span>Fechar</span></button>
        <span className="b-eyebrow">{buildingConfig.name}</span>
        <h1>Encontre seu <br/>apartamento ideal</h1>
        <p className="b-discovery-copy">Um novo olhar sobre o seu próximo lar. Explore o edifício e descubra a unidade que combina com você.</p>
        <p className="b-availability"><strong>{filtered?matches.filter(u=>u.status==='available').length:summary.available}</strong><span> de {summary.total}<small>unidades disponíveis</small></span></p>
        <fieldset><legend>Andar</legend><select aria-label="Andar" value={filters.floor} onChange={e=>change('floor',e.target.value)}><option value="">Todos os andares</option>{Array.from({length:buildingConfig.floors},(_,i)=><option key={i+1} value={i+1}>Andar {i+1}</option>)}</select></fieldset>
        <fieldset><legend>Dormitórios</legend><select aria-label="Dormitórios" value={filters.bedrooms} onChange={e=>change('bedrooms',Number(e.target.value))}><option value={0}>Todos os dormitórios</option>{[2,3,4].map(n=><option key={n} value={n}>{n} dormitórios</option>)}</select></fieldset>
        <fieldset><legend>Faixa de preço</legend><select aria-label="Faixa de preço" value={filters.maxPrice} onChange={e=>setFilters(f=>({...f,minPrice:defaultFilters.minPrice,maxPrice:Number(e.target.value)}))}><option value={defaultFilters.maxPrice}>Todas as faixas</option><option value={1000000}>Até R$ 1.000.000</option><option value={1500000}>Até R$ 1.500.000</option><option value={2000000}>Até R$ 2.000.000</option>{![defaultFilters.maxPrice,1000000,1500000,2000000].includes(filters.maxPrice)&&<option value={filters.maxPrice}>{formatBRL(filters.maxPrice)}</option>}</select></fieldset>
        <button className="b-primary b-search" onClick={()=>{closeFilters();open('matrix');}}>Buscar unidades <span>→</span></button>
        <button className="b-clear" onClick={reset}><Icon name="clear" size={15}/>Limpar filtros</button>
        <details className="b-advanced"><summary>Mais filtros <span>+</span></summary>
        <fieldset><legend>Faixa de preço (R$)</legend><div className="b-range"><input aria-label="Preço mínimo" type="range" min="600000" max="2500000" step="10000" value={filters.minPrice} onChange={e=>change('minPrice',Math.min(+e.target.value,filters.maxPrice))}/><input aria-label="Preço máximo" type="range" min="600000" max="2500000" step="10000" value={filters.maxPrice} onChange={e=>change('maxPrice',Math.max(+e.target.value,filters.minPrice))}/></div><div className="b-range-values"><label><input aria-label="Preço mínimo exato" type="number" min="0" value={filters.minPrice} onChange={e=>change('minPrice',+e.target.value)}/></label><label><input aria-label="Preço máximo exato" type="number" min="0" value={filters.maxPrice} onChange={e=>change('maxPrice',+e.target.value)}/></label></div></fieldset>
        <fieldset><legend>Área (m²)</legend><div className="b-range"><input aria-label="Área mínima" type="range" min="50" max="200" value={filters.minArea} onChange={e=>change('minArea',Math.min(+e.target.value,filters.maxArea))}/><input aria-label="Área máxima" type="range" min="50" max="200" value={filters.maxArea} onChange={e=>change('maxArea',Math.max(+e.target.value,filters.minArea))}/></div><div className="b-range-values"><label><input aria-label="Área mínima exata" type="number" min="0" value={filters.minArea} onChange={e=>change('minArea',+e.target.value)}/><span>m²</span></label><label><input aria-label="Área máxima exata" type="number" min="0" value={filters.maxArea} onChange={e=>change('maxArea',+e.target.value)}/><span>m²</span></label></div></fieldset>
        <fieldset><legend>Orientação</legend><select aria-label="Orientação" value={filters.orientation} onChange={e=>change('orientation',e.target.value)}><option value="">Todas as orientações</option>{Object.entries(orientationLabel).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></fieldset>
        <div className="b-preferences" aria-label="Preferências rápidas"><button aria-pressed={filters.sun==='morning'} onClick={()=>change('sun',filters.sun==='morning'?'':'morning')}>☀ Sol da manhã</button><button aria-pressed={filters.sun==='afternoon'} onClick={()=>change('sun',filters.sun==='afternoon'?'':'afternoon')}>◐ Sol da tarde</button><button aria-pressed={filters.sea} onClick={()=>change('sea',!filters.sea)}>≈ Vista para o mar</button></div>
        </details>
        <p className="b-result-count" aria-live="polite">{filtered?`${matches.length} unidades correspondem aos seus filtros`:`${inventory.length} unidades no edifício`}</p>
        {matches.length===0&&<p className="b-empty-inline">Não há unidades com esta combinação. Tente ampliar a faixa ou limpar os filtros.</p>}
        <div className="b-legend">{(['available','reserved','sold'] as const).map(status=><div key={status}><i className={status}/><span>{statusLabel[status]}</span><b>{summary[status]}</b></div>)}</div>
        <button className="b-matrix-link" onClick={()=>open('matrix')}><Icon name="matrix" size={16}/>Ver matriz de unidades →</button>
        <small className="b-demo">Inventário de demonstração · Reconstrução aproximada</small>
      </aside>
      <section className="building-view" aria-label="Vista geral do edifício">
        <BuildingScene units={inventory} selected={selected} matches={matches.map(u=>u.code)} filtered={filtered} mode={mode} onSelect={select} command={command}/>
        <section className="b-intro" aria-label="Apresentação do empreendimento"><h1>Encontre seu <br/>apartamento ideal</h1><p className="b-availability"><strong>{filtered?matches.filter(u=>u.status==='available').length:summary.available}</strong> de {filtered?matches.length:summary.total} unidades disponíveis</p><p className="b-intro-copy">Explore o edifício e selecione uma unidade.</p><button ref={filterTriggerRef} className="b-filter-trigger" aria-expanded={filtersOpen||mobilePanel==='filters'} aria-controls="building-filters" onClick={toggleFilters}><Icon name="layers" size={18}/>Filtros{filtered?<b>{Object.values(filters).filter((value,index)=>value!==Object.values(defaultFilters)[index]).length}</b>:null}</button></section>
        <div className="b-light-controls"><button className={mode==='neutral_day'?'active':''} aria-pressed={mode==='neutral_day'} onClick={()=>setMode('neutral_day')}><Icon name="sun" size={26}/>Dia</button><button className={mode==='warm_dusk'?'active':''} aria-pressed={mode==='warm_dusk'} onClick={()=>setMode('warm_dusk')}><Icon name="moon" size={24}/>Entardecer</button></div>
        <button className="b-reset-view" onClick={()=>action('reset')}><span><Icon name="reset" size={27}/></span>Restaurar<br/>vista</button>
        {visualV2?<><button className="b-view-trigger" onClick={()=>action('reset')} aria-label="Restaurar vista do edifício"><Icon name="landscape"/><span>Vista</span></button><div className="b-v2-zoom"><button aria-label="Aproximar edifício" onClick={()=>action('in')}>+</button><button aria-label="Afastar edifício" onClick={()=>action('out')}>−</button></div></>:<div className="b-camera-tools">{[['rotate','reset','Girar'],['in','zoomin','Aproximar'],['out','zoomout','Afastar'],['reset','home','Vista inicial']].map(([type,icon,title])=><button key={title} onClick={()=>action(type)}><Icon name={icon}/><span>{title}</span></button>)}</div>}
        <div className="b-model-note">{visualV2?'Ambientação ilustrativa':<>ESCOBAR RESIDENCES <span>·</span> MAQUETE INTERATIVA</>}</div>
      </section>
      <aside className={`building-details ${mobilePanel==='detail'?'mobile-open':''}`} aria-label="Ficha da unidade">
        <button className="b-mobile-close" onClick={()=>setMobilePanel('')} aria-label="Fechar ficha"><Icon name="close"/></button>
        <article className="b-unit-card"><div className="b-card-heading"><h2>Unidade {selected.code}</h2><Status unit={selected}/></div><p className="b-floor-subtitle">Andar {selected.floor} · Final {selected.code.slice(-2)}</p>
          <div className="b-unit-facts">{[
            ['area',`${selected.privateAreaM2} m²`,'Área privativa'],
            ['bed',String(selected.bedrooms),'Dormitórios'],
            ['home',String(selected.suites),'Suítes'],
            ['building',String(selected.parkingSpaces),'Vagas'],
            ['sun',orientationLabel[selected.orientation],'Orientação solar'],
            ['layers',selected.priceBRL===undefined?'Sob consulta':formatBRL(Math.round(selected.priceBRL/selected.privateAreaM2)),'Valor por m²'],
          ].map(([icon,value,title])=><div key={title}><i><Icon name={icon}/></i><span><strong>{value}</strong><small>{title}</small></span></div>)}</div>
          <div className="b-price"><small>Valor da unidade</small><strong>{formatBRL(selected.priceBRL)}</strong><small>Preço ilustrativo · Inventário de demonstração</small></div>
          <div className="b-unit-extras">Sol da {isMorning(selected)?'manhã':'tarde'} · {selected.viewType==='sea'?'Vista parcial para o mar':selected.viewType==='city'?'Vista para a cidade':'Vista para o jardim'}</div>
          <button className="b-primary" disabled={!canExplore(selected)} onClick={()=>onExplore(selected)}>{canExplore(selected)?'Ver interior  →':'Interior ainda não disponível'}</button>
          {canPropose(selected)?<button className="b-outline" onClick={openWhatsApp}>Falar pelo WhatsApp</button>:<button className="b-outline" onClick={()=>open('similar')}>{selected.status==='reserved'?'Consultar disponibilidade':'Ver unidades semelhantes'}</button>}
          {visualV2?<div className="b-v2-card-actions"><button aria-pressed={saved.includes(selected.code)} onClick={save}><Icon name="heart"/>{saved.includes(selected.code)?'Favoritada':'Favoritar'}</button><button aria-pressed={compare.includes(selected.code)} onClick={addCompare}><Icon name="layers"/>{compare.includes(selected.code)?'Adicionada':'Comparar'}</button><button onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setNotice('Link desta unidade copiado.');}catch{open('share');}}}><Icon name="pin"/>Compartilhar</button></div>:<button className="b-compare-link" aria-pressed={compare.includes(selected.code)} onClick={addCompare}>{compare.includes(selected.code)?'✓ Adicionada à comparação':'+ Comparar esta unidade'}</button>}
          <p className="b-interior-note"><Icon name="info" size={19}/><span>O interior mostra uma tipologia ilustrativa. Os acabamentos, medidas e mobiliário podem variar conforme a unidade.</span></p>
        </article>
        <article className="b-neighbors"><h3>Outras unidades neste andar</h3>{inventory.filter(u=>u.floor===selected.floor&&u.code!==selected.code).map(u=><button key={u.code} onClick={()=>select(u)}><i className={u.status}/><strong>{u.code}</strong><span>{statusLabel[u.status]}</span><small>{u.privateAreaM2} m²</small><b>›</b></button>)}</article>
      </aside>
    </div>
    {notice&&<div className="b-toast" role="status">{notice}</div>}
    {modal&&<div className="b-modal-shade" onClick={close}><section className={`b-modal ${['matrix','floors'].includes(modal)?'wide':''}`} role="dialog" aria-modal="true" aria-labelledby="b-modal-title" onClick={e=>e.stopPropagation()}><button autoFocus className="b-modal-close" onClick={close} aria-label="Fechar diálogo"><Icon name="close"/></button>
      <h2 id="b-modal-title">{({matrix:'Matriz de unidades',floors:'Explore os andares',compare:'Compare seus favoritos',favorites:'Suas unidades salvas',environment:'Um lar perto do mar',proposal:`Unidade ${selected.code}`,similar:'Encontre uma alternativa',share:'Compartilhar unidade'} as Record<string,string>)[modal]}</h2>
      {['matrix','floors'].includes(modal)&&<><p>Selecione uma unidade para ver sua ficha. Os filtros também são aplicados a esta matriz.</p><div className="b-unit-matrix">{Array.from({length:18},(_,i)=>18-i).map(floor=><div key={floor}><button className="b-matrix-floor" onClick={()=>{change('floor',String(floor));close();}}>Andar {String(floor).padStart(2,'0')}</button>{inventory.filter(u=>u.floor===floor).map(u=><button key={u.code} className={`${u.status} ${u.code===selected.code?'selected':''} ${matches.some(m=>m.code===u.code)?'':'dimmed'}`} onClick={()=>{select(u);close();}} aria-label={`Unidade ${u.code}, ${statusLabel[u.status]}, ${u.privateAreaM2} metros quadrados`}><strong>{u.code}</strong><small>{statusLabel[u.status]}</small></button>)}</div>)}</div></>}
      {modal==='compare'&&(compare.length?<div className="b-comparison">{compare.map(code=>inventory.find(u=>u.code===code)!).map(u=><article key={u.code}><h3>Unidade {u.code}</h3><Status unit={u}/><p>{u.privateAreaM2} m² · {u.bedrooms} dormitórios</p><p>Andar {u.floor} · {orientationLabel[u.orientation]}</p><strong>{formatBRL(u.priceBRL)}</strong><button className="b-outline" onClick={()=>{select(u);close();}}>Ver unidade</button><button onClick={()=>setCompare(c=>c.filter(code=>code!==u.code))}>Remover</button></article>)}</div>:<p>Adicione até três unidades pela ficha para comparar área, dormitórios, orientação e preço.</p>)}
      {['favorites','similar'].includes(modal)&&<div className="b-list">{(modal==='favorites'?inventory.filter(u=>saved.includes(u.code)):similar).map(u=><button key={u.code} onClick={()=>{select(u);close();}}><strong>Unidade {u.code}</strong><Status unit={u}/><span>{u.privateAreaM2} m² · {formatBRL(u.priceBRL)} →</span></button>)}{modal==='favorites'&&!saved.length&&<p>Salve unidades com o coração da ficha para encontrá-las aqui.</p>}</div>}
      {modal==='environment'&&<><div className="b-environment-art"><Icon name="sun" size={48}/><span>BRISA · LUZ · NATUREZA</span></div><p>Uma interpretação residencial inspirada no litoral brasileiro, com varandas profundas, acesso ajardinado e vegetação tropical.</p><p>A localização e a orientação são provisórias. As preferências de sol e vista ilustram o funcionamento do inventário real; não representam um estudo solar do terreno.</p></>}
      {modal==='share'&&<label>Link da unidade<input className="b-share-input" readOnly value={location.href} onFocus={e=>e.target.select()}/></label>}
    </section></div>}
  </main>;
}
