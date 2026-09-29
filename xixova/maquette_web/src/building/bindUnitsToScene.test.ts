import {describe,expect,it} from 'vitest';
import {Object3D} from 'three';
import {bindUnitsToScene} from './bindUnitsToScene';
import {StaticInventoryRepository} from '../infrastructure/inventory/static/StaticInventoryRepository';

describe('binding de proxies',()=>{it('informa proxies vinculados, huérfanos e inválidos',async()=>{const [unit]=await new StaticInventoryRepository().listPublishedUnits({organizationSlug:'escobar',projectSlug:'escobar-residences'}),scene=new Object3D();for(const name of [unit.modelObjectId,'UNIT_999_PROXY','UNIT_INVALID']){const child=new Object3D();child.name=name;scene.add(child);}const report=bindUnitsToScene([unit],scene);expect([...report.bound.values()]).toEqual([unit]);expect(report.proxiesWithoutUnit).toEqual(['UNIT_999_PROXY']);expect(report.invalidProxyNames).toEqual(['UNIT_INVALID']);expect(report.unitsWithoutProxy).toEqual([]);});});
