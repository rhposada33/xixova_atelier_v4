import source from '../../../data/demo_buildings.json';
import type {ProjectInventoryConfig} from '../domain/inventory';

export interface BuildingConfig extends ProjectInventoryConfig {
  id:string;
  name:string;
  inventory:string;
  inventoryFormat:'legacy'|'property-units';
  inventoryProvider:'static'|'supabase';
  models:{standard:{url:string;sha256:string};premium?:{url:string;sha256:string}};
  camera:{original:{targetY:number;distance:number;height:number};premium:{targetY:number;distance:number;height:number}};
  visualExperience:'v2'|'standard'|'coastal';
  environment?:{url:string;sha256:string};
  interiorEnabled:boolean;
}

export const buildings:readonly BuildingConfig[]=source.buildings.map(item=>({
  ...item,
  visualExperience:item.visualExperience as BuildingConfig['visualExperience'],
  inventoryFormat:item.inventoryFormat as BuildingConfig['inventoryFormat'],
  inventoryProvider:item.inventoryProvider as BuildingConfig['inventoryProvider'],
  modelUrl:item.models.standard.url,
}));
export const defaultBuildingId=source.defaultBuilding;
export function getBuilding(id:string|null|undefined):BuildingConfig{
  return buildings.find(item=>item.id===id)??buildings.find(item=>item.id===defaultBuildingId)!;
}
export function buildingFromSearch(search:string):BuildingConfig{
  const query=new URLSearchParams(search);
  return getBuilding(query.get('edificio')??(query.get('cliente')==='jequitiba'?'jequitiba':null));
}
export function buildingModelUrl(building:BuildingConfig,premium:boolean):string{
  return premium&&building.models.premium?building.models.premium.url:building.models.standard.url;
}
