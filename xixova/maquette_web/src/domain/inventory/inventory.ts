import {InventoryError} from './errors';
import type {InventorySummary,Orientation,PropertyUnit,PublicUnitStatus,SunExposure,UnitFilters,UnitStatus,ViewType} from './types';

const statuses:UnitStatus[]=['available','reserved','sold','blocked','coming_soon','hidden'];
const orientations:Orientation[]=['north','northeast','east','southeast','south','southwest','west','northwest'];
const views:ViewType[]=['sea','city','garden','pool'];
const suns:SunExposure[]=['morning','afternoon'];
export const publicStatuses:PublicUnitStatus[]=['available','reserved','sold'];
const finitePositive=(value:number)=>Number.isFinite(value)&&value>0;

export function validateUnits(input:readonly PropertyUnit[]):readonly PropertyUnit[]{
  const ids=new Set<string>(),codes=new Set<string>(),objects=new Set<string>();
  for(const unit of input){
    if(!unit.id||ids.has(unit.id))throw new InventoryError('invalid_data',`ID de unidade duplicado ou vazio: ${unit.id||'(vazio)'}`);ids.add(unit.id);
    if(!unit.code||codes.has(unit.code))throw new InventoryError('invalid_data',`Código de unidade duplicado ou vazio: ${unit.code||'(vazio)'}`);codes.add(unit.code);
    if(!unit.modelObjectId||objects.has(unit.modelObjectId))throw new InventoryError('invalid_data',`Proxy 3D duplicado ou vazio: ${unit.modelObjectId||'(vazio)'}`);objects.add(unit.modelObjectId);
    if(!statuses.includes(unit.status)||!orientations.includes(unit.orientation)||unit.viewType&&!views.includes(unit.viewType)||unit.sunExposure&&!suns.includes(unit.sunExposure))throw new InventoryError('invalid_data',`Valores desconhecidos na unidade ${unit.code}.`);
    if(!Number.isInteger(unit.floor)||unit.floor<1||!finitePositive(unit.privateAreaM2)||unit.totalAreaM2!==undefined&&!finitePositive(unit.totalAreaM2)||unit.priceBRL!==undefined&&(!Number.isFinite(unit.priceBRL)||unit.priceBRL<0)||![unit.bedrooms,unit.suites,unit.parkingSpaces].every(v=>Number.isInteger(v)&&v>=0))throw new InventoryError('invalid_data',`Valores numéricos inválidos na unidade ${unit.code}.`);
    if(Math.floor(Number(unit.code)/100)!==unit.floor)throw new InventoryError('invalid_data',`O código ${unit.code} não corresponde ao andar ${unit.floor}.`);
  }
  return input;
}
export function summarizeInventory(units:readonly PropertyUnit[]):InventorySummary{return {total:units.length,available:units.filter(u=>u.status==='available').length,reserved:units.filter(u=>u.status==='reserved').length,sold:units.filter(u=>u.status==='sold').length,blocked:units.filter(u=>u.status==='blocked').length,comingSoon:units.filter(u=>u.status==='coming_soon').length};}
export const isMorning=(u:PropertyUnit)=>u.sunExposure?u.sunExposure==='morning':['east','northeast','southeast'].includes(u.orientation);
export function filterUnits(units:readonly PropertyUnit[],f:UnitFilters){return units.filter(u=>u.published&&u.priceBRL!==undefined&&u.priceBRL>=f.minPrice&&u.priceBRL<=f.maxPrice&&(!f.floor||u.floor===Number(f.floor))&&u.privateAreaM2>=f.minArea&&u.privateAreaM2<=f.maxArea&&(!f.orientation||u.orientation===f.orientation)&&(!f.bedrooms||u.bedrooms===f.bedrooms)&&(!f.sun||(f.sun==='morning'?isMorning(u):!isMorning(u)))&&(!f.sea||u.viewType==='sea'));}
export const canExplore=(u:PropertyUnit)=>Boolean(u.interiorProjectId);
export const canPropose=(u:PropertyUnit)=>u.status==='available';
