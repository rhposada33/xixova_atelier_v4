import {InventoryError,publicStatuses,summarizeInventory,validateUnits,type InventoryReader,type PropertyUnit,type PublishedUnitsQuery} from '../../../domain/inventory';
import {mapDemoRow,type DemoInventoryRow} from './staticInventoryMapper';
import {buildings} from '../../../building/buildingRegistry';

const fixtures=import.meta.glob('../../../../../data/*_inventory.json',{eager:true,import:'default'}) as Record<string,unknown>;
const projects=new Map(buildings.map(building=>{
  const rows=fixtures[`../../../../../data/${building.inventory}`];
  if(!Array.isArray(rows))throw new InventoryError('configuration',`Inventario local ausente: ${building.inventory}`);
  const mapped=building.inventoryFormat==='legacy'?(rows as DemoInventoryRow[]).map(mapDemoRow):rows as PropertyUnit[];
  const units=Object.freeze(validateUnits(mapped).map(unit=>Object.freeze({...unit})));
  return [`${building.organizationSlug}/${building.projectSlug}`,units] as const;
}));
const clone=(unit:PropertyUnit):PropertyUnit=>({...unit});
export class StaticInventoryRepository implements InventoryReader{
  async listPublishedUnits(query:PublishedUnitsQuery){
    if(query.signal?.aborted)throw new InventoryError('aborted','Carregamento cancelado.');
    const selected=projects.get(`${query.organizationSlug}/${query.projectSlug}`)??[];
    return selected.filter(u=>u.published&&publicStatuses.includes(u.status as never)).map(clone);
  }
  async getPublishedUnit(organizationSlug:string,projectSlug:string,code:string,signal?:AbortSignal){
    const units=await this.listPublishedUnits({organizationSlug,projectSlug,signal});return units.find(u=>u.code===code)??null;
  }
  async getInventorySummary(organizationSlug:string,projectSlug:string,signal?:AbortSignal){return summarizeInventory(await this.listPublishedUnits({organizationSlug,projectSlug,signal}));}
}
