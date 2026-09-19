import {useState} from 'react';

type AvailabilityStatus='available'|'reserved'|'sold';
type UnitView='Vista mar'|'Vista cidade'|'Vista jardim'|'Vista panorâmica';

type AvailabilityUnit={
  code:string;
  floor:number;
  position:number;
  status:AvailabilityStatus;
  area:number;
  bedrooms:number;
  view:UnitView;
  price:number;
};

const statusLabel:Record<AvailabilityStatus,string>={available:'Disponível',reserved:'Reservada',sold:'Vendida'};
const statusOrder:AvailabilityStatus[]=['available','reserved','sold'];
const summary=Object.freeze([{value:'54',label:'Disponíveis',status:'available'},{value:'6',label:'Reservadas',status:'reserved'},{value:'12',label:'Vendidas',status:'sold'}] as const);
const viewImages:Record<UnitView,{src:string;alt:string}>={
  'Vista mar':{src:'/marketing/promoven-view-coast.png',alt:'Vista ilustrativa de uma baía e cidade costeira vista de uma varanda'},
  'Vista cidade':{src:'/marketing/promoven-view-city.png',alt:'Vista ilustrativa de uma cidade vista de uma varanda'},
  'Vista jardim':{src:'/marketing/promoven-view-city.png',alt:'Vista ilustrativa de uma cidade arborizada vista de uma varanda'},
  'Vista panorâmica':{src:'/marketing/promoven-view-city.png',alt:'Vista panorâmica ilustrativa de uma cidade vista de uma varanda'},
};

const statusFor=(floor:number,position:number):AvailabilityStatus=>{
  if(floor===12&&position===1)return 'available';
  const value=(floor*7+position*11)%10;
  return value<6?'available':value<8?'reserved':'sold';
};

const units:readonly AvailabilityUnit[]=Object.freeze(Array.from({length:15},(_,floorIndex)=>{
  const floor=15-floorIndex;
  return Array.from({length:4},(_,positionIndex)=>{
    const position=positionIndex+1;
    return Object.freeze({
      code:String(floor*100+position),floor,position,status:statusFor(floor,position),
      area:position<3?84:position===3?104:126,
      bedrooms:position<3?2:position===3?3:4,
      view:position===1?'Vista mar':position===2?'Vista cidade':position===3?'Vista jardim':'Vista panorâmica',
      price:1460000+(floor-12)*32000+(position-1)*65000,
    });
  });
}).flat());

const formatBRL=(price:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(price);
const floorUnits=(floor:number)=>units.filter(unit=>unit.floor===floor);

export function UnitAvailabilityMatrix(){
  const [selectedCode,setSelectedCode]=useState('1201');
  const [detailsOpen,setDetailsOpen]=useState(false);
  const selected=units.find(unit=>unit.code===selectedCode)??units[0];
  const selectedView=viewImages[selected.view];
  const selectUnit=(unit:AvailabilityUnit)=>{setSelectedCode(unit.code);setDetailsOpen(true)};

  return <section className="unit-availability" id="disponibilidade" aria-labelledby="availability-title">
    <div className="availability-shell">
      <div className="availability-intro">
        <p className="eyebrow">Disponibilidade comercial</p>
        <h2 id="availability-title">Encontre a unidade certa</h2>
        <p>Consulte disponibilidade, compare características e localize cada unidade por pavimento.</p>
        <div className="availability-summary" aria-label="Resumo ilustrativo de disponibilidade">
          {summary.map(item=><article key={item.status} className={`availability-summary-${item.status}`}><strong>{item.value}</strong><span>{item.label}</span></article>)}
        </div>
        <div className="availability-filters" role="note" aria-label="Filtros ilustrativos: todas as unidades">
          <span className="availability-filter-label"><b aria-hidden="true">☷</b> Filtrar unidades</span>
          <span className="availability-filter-value">Todas <b aria-hidden="true">⌄</b></span>
        </div>
        <table className="availability-table"><caption>Exemplo de unidades por disponibilidade</caption><thead><tr><th>Unidade</th><th>Área</th><th>Quartos</th><th>Status</th></tr></thead><tbody>{floorUnits(12).map(unit=><tr key={unit.code} className={unit.code===selected.code?'is-selected':''}><td>{unit.code}</td><td>{unit.area} m²</td><td>{unit.bedrooms}</td><td><span className={`availability-status ${unit.status}`}>{statusLabel[unit.status]}</span></td></tr>)}</tbody></table>
      </div>

      <div className="availability-matrix">
        <h3>Disponibilidade por pavimento</h3>
        <div className="availability-legend" aria-label="Legenda de status">{statusOrder.map(status=><span key={status} className={`availability-status ${status}`}>{statusLabel[status]}</span>)}</div>
        <div className="availability-grid-wrap">
          <div className="availability-grid" role="group" aria-label="Matriz ilustrativa de unidades por pavimento">
            {Array.from({length:15},(_,index)=>15-index).map(floor=><div className="availability-floor" key={floor}><span className="availability-floor-label">{floor}º</span>{floorUnits(floor).map(unit=><button key={unit.code} type="button" className={`availability-cell ${unit.status}`} aria-pressed={unit.code===selected.code} aria-label={`Unidade ${unit.code}, ${floor}º pavimento, ${statusLabel[unit.status]}`} onClick={()=>selectUnit(unit)}>{unit.code}<span className="sr-only"> — {statusLabel[unit.status]}</span></button>)}</div>)}
          </div>
        </div>
        <p className="availability-scroll-hint"><span aria-hidden="true">⌄</span> Deslize para ver outros pavimentos</p>
      </div>

      <article className={`availability-card ${detailsOpen?'is-expanded':''}`} aria-label={`Detalhes da unidade ${selected.code}`}>
        <div className="availability-card-summary"><div><h3>Unidade {selected.code}</h3><p>{selected.floor}º pavimento · {selected.area} m²</p></div><strong>{formatBRL(selected.price)}</strong><button type="button" aria-expanded={detailsOpen} aria-controls="availability-card-details" onClick={()=>setDetailsOpen(open=>!open)}>{detailsOpen?'Ocultar detalhes':'Ver detalhes'}</button></div>
        <div className="availability-card-details" id="availability-card-details"><p className={`availability-status ${selected.status}`}>{statusLabel[selected.status]}</p><p>{selected.bedrooms} dormitórios · {selected.view}</p><div className="availability-view"><img src={selectedView.src} alt={selectedView.alt} loading="lazy" width="1672" height="941"/><span>{selected.view} ilustrativa</span></div><a className="button primary" href="/demo">Ver unidade <span>→</span></a></div>
      </article>
    </div>
    <p className="availability-note">Dados e disponibilidade apresentados apenas para demonstração comercial.</p>
  </section>;
}
