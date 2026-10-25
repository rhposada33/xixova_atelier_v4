import {beforeAll,describe,it,expect} from 'vitest';
import {defaultFilters,filtersForInventory,filterUnits,formatBRL,canExplore,canPropose,isMorning,type BuildingUnit} from './inventory';
import {getBuilding} from './buildingRegistry';
const buildingConfig=getBuilding('escobar');
import {StaticInventoryRepository} from '../infrastructure/inventory/static/StaticInventoryRepository';

let inventory:BuildingUnit[]=[];
beforeAll(async()=>{inventory=await new StaticInventoryRepository().listPublishedUnits({organizationSlug:buildingConfig.organizationSlug,projectSlug:buildingConfig.projectSlug});});

it('amplía los límites iniciales para un edificio futuro con otros precios y áreas',()=>{
  const limits=filtersForInventory([{...inventory[0],priceBRL:3_000_000,privateAreaM2:225}]);
  expect(limits).toMatchObject({minPrice:600000,maxPrice:3_000_000,minArea:50,maxArea:225});
});

describe('Inventario provisional del edificio',()=>{
  it('contiene 72 unidades, cuatro en cada una de las 18 plantas',()=>{
    expect(inventory).toHaveLength(72);
    for(let floor=1;floor<=18;floor++)expect(inventory.filter(u=>u.floor===floor).map(u=>u.code)).toEqual([1,2,3,4].map(i=>String(floor*100+i)));
  });
  it('distribuye estados 54 / 6 / 12 con proxies únicos y estables',()=>{
    expect(inventory.filter(u=>u.status==='available')).toHaveLength(54);expect(inventory.filter(u=>u.status==='reserved')).toHaveLength(6);expect(inventory.filter(u=>u.status==='sold')).toHaveLength(12);
    expect(new Set(inventory.map(u=>u.modelObjectId)).size).toBe(72);
    for(const u of inventory)expect(u.modelObjectId).toBe(`UNIT_${u.code}_PROXY`);
  });
  it('aplica precio, piso, área, orientación y dormitorios individualmente',()=>{
    expect(filterUnits(inventory,{...defaultFilters,floor:'12'}).map(u=>u.code)).toEqual(['1201','1202','1203','1204']);
    expect(filterUnits(inventory,{...defaultFilters,bedrooms:3})).toHaveLength(36);
    expect(filterUnits(inventory,{...defaultFilters,orientation:'southeast'})).toHaveLength(18);
    const priced=filterUnits(inventory,{...defaultFilters,minPrice:1400000,maxPrice:1600000});expect(priced.length).toBeGreaterThan(0);expect(priced.every(u=>u.priceBRL!==undefined&&u.priceBRL>=1400000&&u.priceBRL<=1600000)).toBe(true);
    const area=filterUnits(inventory,{...defaultFilters,minArea:100,maxArea:130});expect(area).toHaveLength(20);
  });
  it('combina mediante AND y limpia recuperando el inventario',()=>{
    expect(filterUnits(inventory,{...defaultFilters,floor:'12',bedrooms:3,sea:true,sun:'morning'}).map(u=>u.code)).toEqual(['1203']);
    expect(filterUnits(inventory,{...defaultFilters,floor:'12',bedrooms:3,sun:'afternoon'})).toEqual([]);
    expect(filterUnits(inventory,defaultFilters)).toHaveLength(72);
  });
  it('mantiene independientes las preferencias de sol y vista',()=>{
    expect(filterUnits(inventory,{...defaultFilters,sun:'morning'}).every(isMorning)).toBe(true);
    expect(filterUnits(inventory,{...defaultFilters,sun:'afternoon'}).every(u=>!isMorning(u))).toBe(true);
    expect(filterUnits(inventory,{...defaultFilters,sea:true}).every(u=>u.viewType==='sea')).toBe(true);
  });
  it('distingue interior disponible y acciones comerciales por estado',()=>{
    expect(canExplore(inventory.find(u=>u.code==='1203')!)).toBe(true);
    expect(canExplore(inventory.find(u=>u.code==='1201')!)).toBe(true);
    expect(canPropose(inventory.find(u=>u.code==='1203')!)).toBe(true);
    expect(canPropose(inventory.find(u=>u.code==='1201')!)).toBe(false);
    expect(canPropose(inventory.find(u=>u.code==='1204')!)).toBe(true);
  });
  it('formatea BRL y aplica incremento de precio por piso',()=>{
    expect(formatBRL(1580000).replace(/\s/g,' ')).toBe('R$ 1.580.000');
    expect(inventory.find(u=>u.code==='1803')!.priceBRL!).toBeGreaterThan(inventory.find(u=>u.code==='103')!.priceBRL!);
  });
});
