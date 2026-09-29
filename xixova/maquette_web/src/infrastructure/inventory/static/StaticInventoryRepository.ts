import fixture from '../../../../../data/escobar_inventory.json';
import {InventoryError,publicStatuses,summarizeInventory,validateUnits,type InventoryReader,type PropertyUnit,type PublishedUnitsQuery} from '../../../domain/inventory';
import {mapDemoRow,type DemoInventoryRow} from './staticInventoryMapper';

const ORGANIZATION_SLUG='escobar';
const PROJECT_SLUG='escobar-residences';
const source=Object.freeze(validateUnits((fixture as DemoInventoryRow[]).map(mapDemoRow)).map(unit=>Object.freeze({...unit})));
const jequitiba=Object.freeze(source.slice(0,60).map((unit,index)=>{
  const floor=Math.floor(index/3)+1, final=index%3+1, code=String(floor*100+final);
  return Object.freeze({...unit,code,floor,modelObjectId:'UNIT_'+code+'_PROXY',bedrooms:3,suites:3,parkingSpaces:2,privateAreaM2:127.84,totalAreaM2:151.2,priceBRL:780000+floor*42000+final*15000,orientation:final===1?'north':final===2?'east':'south',viewType:'city',sunExposure:final===1?'morning':'afternoon',status:index%11===0?'sold':index%9===0?'reserved':'available',interiorProjectId:'jequitiba-final-03'});
}));
const clone=(unit:PropertyUnit):PropertyUnit=>({...unit});
const matchesProject=(organizationSlug:string,projectSlug:string)=>organizationSlug===ORGANIZATION_SLUG&&projectSlug===PROJECT_SLUG;
export class StaticInventoryRepository implements InventoryReader{
  async listPublishedUnits(query:PublishedUnitsQuery){
    if(query.signal?.aborted)throw new InventoryError('aborted','Carregamento cancelado.');
    const selected=matchesProject(query.organizationSlug,query.projectSlug)?source:query.organizationSlug==='jequitiba'&&query.projectSlug==='jequitiba-residences'?jequitiba:[];
    return selected.filter(u=>u.published&&publicStatuses.includes(u.status as never)).map(clone);
  }
  async getPublishedUnit(organizationSlug:string,projectSlug:string,code:string,signal?:AbortSignal){
    const units=await this.listPublishedUnits({organizationSlug,projectSlug,signal});return units.find(u=>u.code===code)??null;
  }
  async getInventorySummary(organizationSlug:string,projectSlug:string,signal?:AbortSignal){return summarizeInventory(await this.listPublishedUnits({organizationSlug,projectSlug,signal}));}
}
