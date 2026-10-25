import {describe,expect,it} from 'vitest';
import {buildingFromSearch,buildingModelUrl,buildings,getBuilding} from './buildingRegistry';
import {StaticInventoryRepository} from '../infrastructure/inventory/static/StaticInventoryRepository';

describe('registro de edificios del demo',()=>{
  it('resuelve URLs actuales y el alias de Jequitibá',()=>{
    expect(buildingFromSearch('').id).toBe('escobar');
    expect(buildingFromSearch('?cliente=jequitiba&unidad=1203').id).toBe('jequitiba');
    expect(buildingFromSearch('?edificio=jequitiba').id).toBe('jequitiba');
    expect(getBuilding('desconocido').id).toBe('escobar');
    expect(buildingModelUrl(getBuilding('escobar'),true)).toBe('building/promoven-premium.glb');
    expect(buildingModelUrl(getBuilding('jequitiba'),true)).toBe('building/jequitiba-building.glb');
  });
  it('cada edificio tiene inventario local propio y unidad inicial válida',async()=>{
    const repository=new StaticInventoryRepository();
    const inventories=await Promise.all(buildings.map(item=>repository.listPublishedUnits({organizationSlug:item.organizationSlug,projectSlug:item.projectSlug})));
    expect(inventories.map(items=>items.length)).toEqual([72,60,64]);
    buildings.forEach((item,index)=>expect(inventories[index].some(unit=>unit.code===item.defaultUnitCode)).toBe(true));
    expect(new Set(inventories.flatMap(items=>items.map(unit=>unit.id))).size).toBe(196);
    expect(inventories[2].every(unit=>unit.interiorProjectId===undefined)).toBe(true);
    expect(buildingFromSearch('?edificio=canto-do-forte&unidad=1604').id).toBe('canto-do-forte');
    expect(inventories[1].every(unit=>unit.interiorProjectId===undefined)).toBe(true);
  });
});
