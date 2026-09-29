import type {SupabaseClient} from '@supabase/supabase-js';
import {InventoryError,summarizeInventory,validateUnits,type InventoryReader,type PropertyUnit,type PublishedUnitsQuery} from '../../../domain/inventory';
import {mapPublicInventoryRow,type PublicInventoryRow} from './supabaseInventoryMapper';

export class SupabaseInventoryRepository implements InventoryReader{
  constructor(private readonly client:SupabaseClient){}
  async listPublishedUnits(query:PublishedUnitsQuery):Promise<PropertyUnit[]>{return this.query(query.organizationSlug,query.projectSlug,null,query.signal);}
  async getPublishedUnit(organizationSlug:string,projectSlug:string,code:string,signal?:AbortSignal){const units=await this.query(organizationSlug,projectSlug,code,signal);return units[0]??null;}
  async getInventorySummary(organizationSlug:string,projectSlug:string,signal?:AbortSignal){return summarizeInventory(await this.query(organizationSlug,projectSlug,null,signal));}
  private async query(organizationSlug:string,projectSlug:string,code:string|null,signal?:AbortSignal):Promise<PropertyUnit[]>{
    try{let request=this.client.rpc('get_public_inventory',{p_organization_slug:organizationSlug,p_project_slug:projectSlug,p_unit_code:code});if(signal)request=request.abortSignal(signal);const {data,error}=await request;if(error)throw error;const units=((data??[]) as PublicInventoryRow[]).map(mapPublicInventoryRow);validateUnits(units);return units.map(unit=>({...unit}));}
    catch(error){if(signal?.aborted)throw new InventoryError('aborted','A consulta de disponibilidade foi cancelada.',{cause:error});if(error instanceof InventoryError)throw error;throw new InventoryError('network','Não foi possível carregar a disponibilidade.',{cause:error});}
  }
}
