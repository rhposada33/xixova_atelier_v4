import type {Orientation,ProjectInventoryConfig,UnitFilters,UnitStatus} from '../domain/inventory';
export {canExplore,canPropose,filterUnits,isMorning} from '../domain/inventory';
export type {PropertyUnit as BuildingUnit,UnitFilters,UnitStatus as UnitAvailability,Orientation} from '../domain/inventory';

const isJequitiba=typeof location!=='undefined'&&new URLSearchParams(location.search).get('cliente')==='jequitiba';
export const buildingConfig:ProjectInventoryConfig&{floorHeight:number;residentialBase:number;width:number;depth:number;provisional:boolean;name:string} = isJequitiba ? {
  organizationSlug:'jequitiba',projectSlug:'jequitiba-residences',defaultUnitCode:'101',floors:20,unitsPerFloor:3,
  modelUrl:'building/jequitiba-building.glb',floorHeight:3.25,residentialBase:5,width:29,depth:23,provisional:true,name:'Jequitibá',
} : {
  organizationSlug:'escobar',projectSlug:'escobar-residences',defaultUnitCode:'1203',floors:18,unitsPerFloor:4,
  modelUrl:'building/xixova-building.glb',floorHeight:3.15,residentialBase:4,width:24,depth:34,provisional:true,name:'Escobar Residences',
};
export const statusLabel:Record<UnitStatus,string>={available:'Disponível',reserved:'Reservada',sold:'Vendida',blocked:'Bloqueada',coming_soon:'Em breve',hidden:'Oculta'};
export const orientationLabel:Record<Orientation,string>={north:'Norte',northeast:'Nordeste',east:'Leste',southeast:'Sudeste',south:'Sul',southwest:'Sudoeste',west:'Oeste',northwest:'Noroeste'};
export const formatBRL=(value:number|undefined)=>value===undefined?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
export const defaultFilters:UnitFilters={minPrice:600000,maxPrice:2500000,floor:'',minArea:50,maxArea:200,orientation:'',bedrooms:0,sun:'',sea:false};
