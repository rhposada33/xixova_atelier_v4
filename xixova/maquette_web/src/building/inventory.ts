import type {Orientation,PropertyUnit,UnitFilters,UnitStatus} from '../domain/inventory';
export {canExplore,canPropose,filterUnits,isMorning} from '../domain/inventory';
export type {PropertyUnit as BuildingUnit,UnitFilters,UnitStatus as UnitAvailability,Orientation} from '../domain/inventory';

export const statusLabel:Record<UnitStatus,string>={available:'Disponível',reserved:'Reservada',sold:'Vendida',blocked:'Bloqueada',coming_soon:'Em breve',hidden:'Oculta'};
export const orientationLabel:Record<Orientation,string>={north:'Norte',northeast:'Nordeste',east:'Leste',southeast:'Sudeste',south:'Sul',southwest:'Sudoeste',west:'Oeste',northwest:'Noroeste'};
export const formatBRL=(value:number|undefined)=>value===undefined?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
export const defaultFilters:UnitFilters={minPrice:600000,maxPrice:2500000,floor:'',minArea:50,maxArea:200,orientation:'',bedrooms:0,sun:'',sea:false};
export function filtersForInventory(units:readonly PropertyUnit[]):UnitFilters{
  return {...defaultFilters,
    minPrice:Math.min(defaultFilters.minPrice,...units.map(unit=>unit.priceBRL??defaultFilters.minPrice)),
    maxPrice:Math.max(defaultFilters.maxPrice,...units.map(unit=>unit.priceBRL??defaultFilters.maxPrice)),
    minArea:Math.min(defaultFilters.minArea,...units.map(unit=>unit.privateAreaM2)),
    maxArea:Math.max(defaultFilters.maxArea,...units.map(unit=>unit.privateAreaM2)),
  };
}
