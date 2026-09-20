import {createClient} from '@supabase/supabase-js';
import WebSocket from 'ws';
import {describe,expect,it} from 'vitest';
import {StaticInventoryRepository} from '../static/StaticInventoryRepository';
import {SupabaseInventoryRepository} from './SupabaseInventoryRepository';

const url=import.meta.env.VITE_SUPABASE_TEST_URL,key=import.meta.env.VITE_SUPABASE_TEST_PUBLISHABLE_KEY;
const suite=url&&key?describe:describe.skip;
suite('contrato contra Supabase local',()=>{it('coincide con las 72 unidades estáticas',async()=>{const query={organizationSlug:'escobar',projectSlug:'escobar-residences'},remote=await new SupabaseInventoryRepository(createClient(url!,key!,{auth:{persistSession:false},realtime:{transport:WebSocket as any}})).listPublishedUnits(query),local=await new StaticInventoryRepository().listPublishedUnits(query),visible=(unit:(typeof local)[number])=>({code:unit.code,floor:unit.floor,status:unit.status,bedrooms:unit.bedrooms,suites:unit.suites,parkingSpaces:unit.parkingSpaces,privateAreaM2:unit.privateAreaM2,totalAreaM2:unit.totalAreaM2,orientation:unit.orientation,viewType:unit.viewType,sunExposure:unit.sunExposure,priceBRL:unit.priceBRL,modelObjectId:unit.modelObjectId,interiorProjectId:unit.interiorProjectId});expect(remote.map(visible)).toEqual(local.map(visible));});});
