import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import WebSocket from 'ws';
import {Pool} from 'pg';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {SupabaseInventoryAdminRepository} from './SupabaseInventoryAdminRepository';

const url=process.env.SUPABASE_TEST_URL;
const publishableKey=process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey=process.env.SUPABASE_TEST_SECRET_KEY;
const databaseUrl=process.env.SUPABASE_TEST_DB_URL;
const suite=url&&publishableKey&&secretKey&&databaseUrl?describe:describe.skip;

suite('repositório administrativo contra Auth e RLS locais',()=>{
  const ids={organization:randomUUID(),project:randomUUID(),building:randomUUID(),floor:randomUUID(),type:randomUUID(),unit:randomUUID()};
  const email=`admin-${randomUUID()}@local.test`;const password=`Local-${randomUUID()}-Aa1!`;let userId='';
  const service=createClient(url??'http://127.0.0.1',secretKey??'local-test-placeholder',{auth:{persistSession:false,autoRefreshToken:false},realtime:{transport:WebSocket as any}});
  const client=createClient(url??'http://127.0.0.1',publishableKey??'local-test-placeholder',{auth:{persistSession:false,autoRefreshToken:false},realtime:{transport:WebSocket as any}});
  const database=new Pool({connectionString:databaseUrl??'postgresql://127.0.0.1/unused'});
  const repo=new SupabaseInventoryAdminRepository(client);
  beforeAll(async()=>{
    const {data:user,error:userError}=await service.auth.admin.createUser({email,password,email_confirm:true});if(userError)throw userError;userId=user.user.id;
    await database.query('insert into public.organizations(id,name,slug,status) values($1,$2,$3,$4)',[ids.organization,'Integração local',`local-${ids.organization.slice(0,8)}`,'active']);
    await database.query('insert into public.projects(id,organization_id,name,slug,status,timezone,published_at) values($1,$2,$3,$4,$5,$6,now())',[ids.project,ids.organization,'Projeto local','projeto-local','published','America/Sao_Paulo']);
    await database.query('insert into public.buildings(id,project_id,name,code,model_path,floor_count) values($1,$2,$3,$4,$5,$6)',[ids.building,ids.project,'Torre local','local','local.glb',1]);
    await database.query('insert into public.floors(id,building_id,number,label) values($1,$2,$3,$4)',[ids.floor,ids.building,1,'Andar 1']);
    await database.query('insert into public.unit_types(id,project_id,name,bedrooms,suites,private_area_m2) values($1,$2,$3,$4,$5,$6)',[ids.type,ids.project,'Tipo local',2,1,80]);
    await database.query("insert into public.units(id,project_id,building_id,floor_id,unit_type_id,code,status,price_brl,parking_spaces,orientation,model_object_id,published) values($1,$2,$3,$4,$5,'101','available',500000,1,'north','LOCAL_101',true)",[ids.unit,ids.project,ids.building,ids.floor,ids.type]);
    await database.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'organization_admin')",[ids.organization,userId]);
    const {error:loginError}=await client.auth.signInWithPassword({email,password});if(loginError)throw loginError;
  },30_000);
  afterAll(async()=>{await client.auth.signOut();await database.query('delete from public.unit_audit_logs where organization_id=$1',[ids.organization]);await database.query('delete from public.organizations where id=$1',[ids.organization]);if(userId)await service.auth.admin.deleteUser(userId);await database.end();});
  it('usa sessão real, paginação RLS e RPC de mutação',async()=>{
    const organizations=await repo.listOrganizations();expect(organizations).toContainEqual(expect.objectContaining({id:ids.organization,role:'organization_admin'}));
    const page=await repo.listUnits({organizationId:ids.organization,projectId:ids.project,page:1,pageSize:10});expect(page).toMatchObject({total:1,items:[{id:ids.unit,version:1}]});
    const updated=await repo.changeUnitStatus({unitId:ids.unit,expectedVersion:1,expectedStatus:'available',newStatus:'reserved',reason:'Teste integrado local'});expect(updated).toMatchObject({status:'reserved',reservedBy:userId,version:2});
    const history=await repo.getUnitHistory({projectId:ids.project});expect(history).toHaveLength(1);expect(history[0]).toMatchObject({unitId:ids.unit,reason:'Teste integrado local'});
  });
  it('solicita recuperação pelo serviço de e-mail local',async()=>{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:'http://127.0.0.1:5173/reset-password'});expect(error).toBeNull();});
});
