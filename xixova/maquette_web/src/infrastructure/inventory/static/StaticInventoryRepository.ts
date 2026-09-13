import fixture from '../../../../../data/escobar_inventory.json';
import {InventoryError,publicStatuses,summarizeInventory,validateUnits,type InventoryReader,type PropertyUnit,type PublishedUnitsQuery} from '../../../domain/inventory';
import {mapDemoRow,type DemoInventoryRow} from './staticInventoryMapper';

const ORGANIZATION_SLUG='escobar';
const PROJECT_SLUG='escobar-residences';
const source=Object.freeze(validateUnits((fixture as DemoInventoryRow[]).map(mapDemoRow)).map(unit=>Object.freeze({...unit})));
const clone=(unit:PropertyUnit):PropertyUnit=>({...unit});
const matchesProject=(organizationSlug:string,projectSlug:string)=>organizationSlug===ORGANIZATION_SLUG&&projectSlug===PROJECT_SLUG;
export class StaticInventoryRepository implements InventoryReader{
  async listPublishedUnits(query:PublishedUnitsQuery){
    if(query.signal?.aborted)throw new InventoryError('aborted','Carregamento cancelado.');
    if(!matchesProject(query.organizationSlug,query.projectSlug))return [];
    return source.filter(u=>u.published&&publicStatuses.includes(u.status as never)).map(clone);
  }
  async getPublishedUnit(organizationSlug:string,projectSlug:string,code:string,signal?:AbortSignal){
    const units=await this.listPublishedUnits({organizationSlug,projectSlug,signal});return units.find(u=>u.code===code)??null;
  }
  async getInventorySummary(organizationSlug:string,projectSlug:string,signal?:AbortSignal){return summarizeInventory(await this.listPublishedUnits({organizationSlug,projectSlug,signal}));}
}
