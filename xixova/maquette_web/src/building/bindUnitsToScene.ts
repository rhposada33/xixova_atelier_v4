import type {Object3D} from 'three';
import type {PropertyUnit} from '../domain/inventory';

export interface SceneBindingReport {bound:Map<string,PropertyUnit>;unitsWithoutProxy:string[];proxiesWithoutUnit:string[];duplicateProxies:string[];hiddenUnits:string[];invalidProxyNames:string[];}
const convention=/^UNIT_(\d{3,4})_PROXY$/;
export function bindUnitsToScene(units:readonly PropertyUnit[],scene:Object3D):SceneBindingReport{
  const byObject=new Map(units.map(unit=>[unit.modelObjectId,unit])),bound=new Map<string,PropertyUnit>(),seen=new Set<string>(),proxiesWithoutUnit:string[]=[],duplicateProxies:string[]=[],invalidProxyNames:string[]=[];
  scene.traverse(object=>{if(!object.name.startsWith('UNIT_'))return;if(!convention.test(object.name)){invalidProxyNames.push(object.name);return;}if(seen.has(object.name)){duplicateProxies.push(object.name);return;}seen.add(object.name);const unit=byObject.get(object.name);if(unit)bound.set(object.uuid,unit);else proxiesWithoutUnit.push(object.name);});
  return {bound,unitsWithoutProxy:units.filter(unit=>!seen.has(unit.modelObjectId)).map(unit=>unit.code),proxiesWithoutUnit,duplicateProxies,hiddenUnits:units.filter(unit=>unit.status==='hidden'||!unit.published).map(unit=>unit.code),invalidProxyNames};
}
