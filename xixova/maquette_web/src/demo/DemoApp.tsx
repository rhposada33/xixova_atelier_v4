import {lazy,Suspense,useEffect,useState} from 'react';
import {BuildingApp} from '../building/BuildingApp';
import {InventoryProvider} from '../infrastructure/inventory/InventoryContext';
import type {PropertyUnit} from '../domain/inventory';
import {buildingFromSearch,type BuildingConfig} from '../building/buildingRegistry';
import '../building/building.css';
import '../building/premium.css';
const InteriorApp=lazy(()=>import('../InteriorApp'));
function DemoViewer(){
  const [interior,setInterior]=useState(new URLSearchParams(location.search).get('vista')==='interior');
  const [buildingId,setBuildingId]=useState(()=>buildingFromSearch(location.search).id);
  const building=buildingFromSearch(`?edificio=${buildingId}`);
  useEffect(()=>{const pop=()=>{setInterior(new URLSearchParams(location.search).get('vista')==='interior');setBuildingId(buildingFromSearch(location.search).id);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  const navigate=(enter:boolean,unit?:PropertyUnit)=>{const url=new URL(location.href);url.pathname='/demo';url.searchParams.set('edificio',building.id);if(enter&&unit?.interiorProjectId&&building.interiorEnabled){url.searchParams.set('vista','interior');url.searchParams.set('maqueta',unit.interiorProjectId);url.searchParams.set('piso',String(unit.floor));url.searchParams.set('unidad',unit.code);}else{url.searchParams.set('vista','edificio');url.searchParams.delete('maqueta');url.searchParams.delete('piso');url.searchParams.delete('area');}history.pushState(null,'',url);setInterior(enter&&Boolean(unit?.interiorProjectId)&&building.interiorEnabled);};
  const changeBuilding=(next:BuildingConfig)=>{if(next.id===building.id)return;sessionStorage.removeItem(`xixova-building-${next.id}-filters`);const url=new URL(location.href);url.pathname='/demo';url.searchParams.set('vista','edificio');url.searchParams.set('edificio',next.id);url.searchParams.set('unidad',next.defaultUnitCode);for(const key of ['cliente','maqueta','piso','area'])url.searchParams.delete(key);history.pushState(null,'',url);setInterior(false);setBuildingId(next.id);};
  return interior?<><button className="building-return" onClick={()=>navigate(false)}>← Voltar ao edifício</button><Suspense fallback={<div className="building-loading">Abrindo o interior ilustrativo…</div>}><InteriorApp/></Suspense></>:<BuildingApp key={building.id} building={building} onBuildingChange={changeBuilding} onExplore={unit=>navigate(true,unit)}/>;
}
export default function DemoApp(){return <InventoryProvider><DemoViewer/></InventoryProvider>}
