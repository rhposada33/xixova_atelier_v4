import {lazy,Suspense,useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {BuildingApp} from './building/BuildingApp';
import {InventoryProvider} from './infrastructure/inventory/InventoryContext';
import type {PropertyUnit} from './domain/inventory';
import './building/building.css';
const InteriorApp=lazy(()=>import('./InteriorApp'));
function Root(){
  const [interior,setInterior]=useState(new URLSearchParams(location.search).get('vista')==='interior');
  useEffect(()=>{const pop=()=>setInterior(new URLSearchParams(location.search).get('vista')==='interior');window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  const navigate=(enter:boolean,unit?:PropertyUnit)=>{const url=new URL(location.href);if(enter&&unit?.interiorProjectId){url.searchParams.set('vista','interior');url.searchParams.set('maqueta',unit.interiorProjectId);url.searchParams.set('piso',String(unit.floor));url.searchParams.set('unidad',unit.code);}else{url.searchParams.set('vista','edificio');url.searchParams.delete('maqueta');url.searchParams.delete('piso');}history.pushState(null,'',url);setInterior(enter);};
  return interior?<><button className="building-return" onClick={()=>navigate(false)}>← Voltar ao edifício</button><Suspense fallback={<div className="building-loading">Abrindo o interior ilustrativo…</div>}><InteriorApp/></Suspense></>:<BuildingApp onExplore={unit=>navigate(true,unit)}/>;
}
createRoot(document.getElementById('root')!).render(<InventoryProvider><Root/></InventoryProvider>);
