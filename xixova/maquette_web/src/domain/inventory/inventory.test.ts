import {describe,expect,it} from 'vitest';
import {InventoryError,validateUnits} from '.';
import {StaticInventoryRepository} from '../../infrastructure/inventory/static/StaticInventoryRepository';

const query={organizationSlug:'escobar',projectSlug:'escobar-residences'};
describe('contrato estático del inventario',()=>{
  it('devuelve copias y usa identidad pública compuesta',async()=>{const repository=new StaticInventoryRepository(),first=await repository.listPublishedUnits(query),second=await repository.listPublishedUnits(query);expect(first).toHaveLength(72);expect(first[0]).not.toBe(second[0]);first[0].code='alterado';expect(second[0].code).toBe('101');expect(await repository.getPublishedUnit(query.organizationSlug,query.projectSlug,'1203')).toMatchObject({code:'1203',floor:12});expect(await repository.listPublishedUnits({...query,organizationSlug:'outra'})).toEqual([]);});
  it('calcula el resumen público',async()=>{expect(await new StaticInventoryRepository().getInventorySummary(query.organizationSlug,query.projectSlug)).toEqual({total:72,available:54,reserved:6,sold:12,blocked:0,comingSoon:0});});
  it('rechaza duplicados y códigos incoherentes',async()=>{const [unit]=await new StaticInventoryRepository().listPublishedUnits(query);expect(()=>validateUnits([unit,{...unit}])).toThrow(InventoryError);expect(()=>validateUnits([{...unit,id:'otro',code:'999'}])).toThrow(/não corresponde/);});
});
