import {InventoryError,type InventoryReader,type PublishedUnitsQuery} from '../../domain/inventory';

export class DevelopmentInventoryReader implements InventoryReader{
  constructor(private readonly inner:InventoryReader,private readonly delayMs:number,private readonly fail:boolean){}
  private async wait(signal?:AbortSignal){if(this.delayMs>0)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,this.delayMs);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new InventoryError('aborted','A consulta de disponibilidade foi cancelada.'));},{once:true});});if(this.fail)throw new InventoryError('network','Não foi possível carregar a disponibilidade.');}
  async listPublishedUnits(query:PublishedUnitsQuery){await this.wait(query.signal);return this.inner.listPublishedUnits(query);}
  async getPublishedUnit(organizationSlug:string,projectSlug:string,code:string,signal?:AbortSignal){await this.wait(signal);return this.inner.getPublishedUnit(organizationSlug,projectSlug,code,signal);}
  async getInventorySummary(organizationSlug:string,projectSlug:string,signal?:AbortSignal){await this.wait(signal);return this.inner.getInventorySummary(organizationSlug,projectSlug,signal);}
}
