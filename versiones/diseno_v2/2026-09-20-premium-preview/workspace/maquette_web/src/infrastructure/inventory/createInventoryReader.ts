import type {InventoryReader} from '../../domain/inventory';
import {InventoryError} from '../../domain/inventory';
import {getSupabaseClient} from '../supabase/client';
import {StaticInventoryRepository} from './static/StaticInventoryRepository';
import {SupabaseInventoryRepository} from './supabase/SupabaseInventoryRepository';
import {DevelopmentInventoryReader} from './DevelopmentInventoryReader';

export function createInventoryReader():InventoryReader{
  const provider=import.meta.env.VITE_INVENTORY_PROVIDER||'static';
  let reader:InventoryReader;
  if(provider==='static')reader=new StaticInventoryRepository();
  else if(provider==='supabase')reader=new SupabaseInventoryRepository(getSupabaseClient());
  else throw new InventoryError('configuration',`Provedor de inventário não suportado: ${provider}`);
  if(import.meta.env.DEV&&(import.meta.env.VITE_INVENTORY_DEV_DELAY_MS||import.meta.env.VITE_INVENTORY_DEV_FAIL==='true'))return new DevelopmentInventoryReader(reader,Number(import.meta.env.VITE_INVENTORY_DEV_DELAY_MS)||0,import.meta.env.VITE_INVENTORY_DEV_FAIL==='true');
  return reader;
}
