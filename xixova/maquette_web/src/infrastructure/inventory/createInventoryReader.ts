import type {InventoryReader} from '../../domain/inventory';
import {InventoryError} from '../../domain/inventory';
import {getSupabaseClient} from '../supabase/client';
import {StaticInventoryRepository} from './static/StaticInventoryRepository';
import {SupabaseInventoryRepository} from './supabase/SupabaseInventoryRepository';
import {DevelopmentInventoryReader} from './DevelopmentInventoryReader';
import {buildings} from '../../building/buildingRegistry';

export function createInventoryReader():InventoryReader{
  const provider=import.meta.env.VITE_INVENTORY_PROVIDER||'static';
  let reader:InventoryReader;
  if(provider==='static')reader=new StaticInventoryRepository();
  else if(provider==='supabase'){
    const remote=new SupabaseInventoryRepository(getSupabaseClient()),local=new StaticInventoryRepository();
    const select=(organizationSlug:string,projectSlug:string)=>buildings.find(item=>item.organizationSlug===organizationSlug&&item.projectSlug===projectSlug)?.inventoryProvider==='static'?local:remote;
    reader={
      listPublishedUnits:query=>select(query.organizationSlug,query.projectSlug).listPublishedUnits(query),
      getPublishedUnit:(organizationSlug,projectSlug,code,signal)=>select(organizationSlug,projectSlug).getPublishedUnit(organizationSlug,projectSlug,code,signal),
      getInventorySummary:(organizationSlug,projectSlug,signal)=>select(organizationSlug,projectSlug).getInventorySummary(organizationSlug,projectSlug,signal),
    };
  }
  else throw new InventoryError('configuration',`Provedor de inventário não suportado: ${provider}`);
  if(import.meta.env.DEV&&(import.meta.env.VITE_INVENTORY_DEV_DELAY_MS||import.meta.env.VITE_INVENTORY_DEV_FAIL==='true'))return new DevelopmentInventoryReader(reader,Number(import.meta.env.VITE_INVENTORY_DEV_DELAY_MS)||0,import.meta.env.VITE_INVENTORY_DEV_FAIL==='true');
  return reader;
}
