import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {InventoryError} from '../../../domain/inventory';
import {SupabaseInventoryRepository} from './SupabaseInventoryRepository';

const row={organization_slug:'escobar',project_slug:'escobar-residences',project_name:'Escobar Residences',project_id:'00000000-0000-4000-8000-000000000002',building_id:'00000000-0000-4000-8000-000000000003',building_code:'tower-a',building_name:'Torre A',building_model_path:'building/xixova-building.glb',unit_id:'00000000-0000-4001-8000-000000001203',unit_code:'1203',floor_id:'00000000-0000-4000-8012-000000000000',floor_number:12,unit_type_id:'00000000-0000-4000-8000-000000000103',unit_type_name:'Final 03',status:'available',price_brl:'1460000',parking_spaces:2,bedrooms:3,suites:2,private_area_m2:'96',total_area_m2:'117',orientation:'southeast',view_type:'sea',sun_exposure:'morning',model_object_id:'UNIT_1203_PROXY',interior_project_id:'terraza_luz',updated_at:'2026-09-12T00:00:00Z'};
const client=(result:unknown)=>({rpc:vi.fn(()=>({abortSignal:vi.fn().mockResolvedValue(result),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve)}))}) as unknown as SupabaseClient;
describe('repositorio Supabase',()=>{
  it('mapea la RPC y usa los dos slugs',async()=>{const mock=client({data:[row],error:null}),repository=new SupabaseInventoryRepository(mock),units=await repository.listPublishedUnits({organizationSlug:'escobar',projectSlug:'escobar-residences'});expect(units[0]).toMatchObject({code:'1203',floor:12,priceBRL:1460000,sunExposure:'morning'});expect(mock.rpc).toHaveBeenCalledWith('get_public_inventory',{p_organization_slug:'escobar',p_project_slug:'escobar-residences',p_unit_code:null});});
  it('convierte errores técnicos',async()=>{await expect(new SupabaseInventoryRepository(client({data:null,error:{message:'detalle interno'}})).listPublishedUnits({organizationSlug:'escobar',projectSlug:'escobar-residences'})).rejects.toEqual(expect.objectContaining<Partial<InventoryError>>({code:'network',message:'Não foi possível carregar a disponibilidade.'}));});
});
