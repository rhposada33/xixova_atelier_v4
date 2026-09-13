import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {InventoryError} from '../../domain/inventory';

let client:SupabaseClient|null=null;
export function getSupabaseClient():SupabaseClient{
  if(client)return client;
  const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key)throw new InventoryError('configuration','A disponibilidade remota não está configurada.');
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return client;
}
