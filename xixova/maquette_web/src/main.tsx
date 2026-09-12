import {lazy,Suspense,useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {BuildingApp} from './building/BuildingApp';
import './building/building.css';
const InteriorApp=lazy(()=>import('./InteriorApp'));
function Root(){
  const [interior,setInterior]=useState(new URLSearchParams(location.search).get('vista')==='interior');
  useEffect(()=>{const pop=()=>setInterior(new URLSearchParams(location.search).get('vista')==='interior');window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  const navigate=(enter:boolean,unit?:import('./building/inventory').BuildingUnit)=>{const url=new URL(location.href);if(enter&&unit?.interiorProjectId){url.searchParams.set('vista','interior');url.searchParams.set('maqueta',unit.interiorProjectId);url.searchParams.set('piso',String(unit.floor));url.searchParams.set('unidad',unit.code);}else{url.searchParams.set('vista','edificio');url.searchParams.delete('maqueta');url.searchParams.delete('piso');url.searchParams.set('unidad',url.searchParams.get('unidad')||'1203');}history.pushState(null,'',url);setInterior(enter);};
  return interior?<><button className="building-return" onClick={()=>navigate(false)}>← Voltar ao edifício</button><Suspense fallback={<div className="building-loading">Abrindo o interior ilustrativo…</div>}><InteriorApp/></Suspense></>:<BuildingApp onExplore={unit=>navigate(true,unit)}/>;
}
createRoot(document.getElementById('root')!).render(<Root/>);
