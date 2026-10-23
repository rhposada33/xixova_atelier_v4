begin;
create extension if not exists pgtap with schema extensions;
select plan(40);
create function pg_temp.state(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return 'ok'; exception when others then return sqlstate; end $$;
create function pg_temp.row_json(p_code text,p_expected integer default null) returns jsonb language sql as $$
  select jsonb_build_object('sourceLine',2,'code',p_code,'floor',3,'type','Apartamento','bedrooms',2,'bathrooms',1,'parkingSpaces',1,'areaM2','58.250','priceBRL','450000.00','status','available','published',true,'expectedVersion',p_expected)
$$;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('c1000000-0000-4000-8000-000000000001','authenticated','authenticated','pc02-admin-a@test.local',now(),now(),now()),
 ('c1000000-0000-4000-8000-000000000002','authenticated','authenticated','pc02-manager-a@test.local',now(),now(),now()),
 ('c1000000-0000-4000-8000-000000000003','authenticated','authenticated','pc02-admin-b@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values
 ('d1000000-0000-4000-8000-000000000001','PC02 A','pc02-a'),
 ('d1000000-0000-4000-8000-000000000002','PC02 B','pc02-b');
insert into public.organization_members(organization_id,user_id,role) values
 ('d1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','organization_admin'),
 ('d1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','sales_manager'),
 ('d1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003','organization_admin');
insert into public.projects(id,organization_id,name,slug,public_slug,city,state) values('f1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','Projeto B','projeto-b','pc02-projeto-b','Rio','RJ');
insert into public.units(id,organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,price_brl,status) values('f2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','B-101',2,'Apartamento',1,1,0,42.125,123456.78,'available');

select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is(pg_temp.state($$insert into public.projects(organization_id,name,slug,public_slug,city,state) values('d1000000-0000-4000-8000-000000000001','X','x','x','São Paulo','SP')$$),'42501','direct project write denied');
select is(pg_temp.state($$insert into public.units(organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,status) values('d1000000-0000-4000-8000-000000000001',gen_random_uuid(),'X',1,'A',1,1,1,50,'available')$$),'42501','direct unit write denied');
select is(pg_temp.state($$select public.connect_create_project('{"organizationId":"d1000000-0000-4000-8000-000000000002","name":"B","slug":"b","publicSlug":"pc02-b-project","city":"Rio","state":"RJ"}')$$),'42501','cannot create for other tenant');
select is((select status from public.connect_create_project('{"organizationId":"d1000000-0000-4000-8000-000000000001","name":"Edifício A","slug":"edificio-a","publicSlug":"pc02-edificio-a","city":"São Paulo","state":"SP"}')),'draft','project starts as draft');
select is((select count(*)::int from public.projects where organization_id='d1000000-0000-4000-8000-000000000001'),1,'admin A sees A project');
select is((select count(*)::int from public.projects),1,'admin A cannot read B project');
select is((select count(*)::int from public.units),0,'admin A cannot read B unit');
select is(pg_temp.state($$select public.connect_update_unit('f2000000-0000-4000-8000-000000000002',1,'{"status":"sold"}')$$),'42501','admin A cannot modify B unit');
select is(pg_temp.state($$select public.connect_update_project((select id from public.projects where slug='edificio-a'),1,'{"organizationId":"d1000000-0000-4000-8000-000000000002"}')$$),'22023','ownership field rejected');
select is(public.connect_public_project('pc02-projeto-b') is null,true,'draft B project not public');
select is((select count(*)::int from public.audit_events where action='project.created'),1,'project creation audited');
select is(pg_temp.state($$select public.connect_update_project((select id from public.projects where slug='edificio-a'),999,'{"name":"Outro"}')$$),'PT409','stale project update conflicts');
select is((select version from public.connect_update_project((select id from public.projects where slug='edificio-a'),1,'{"visibility":{"description":true,"unitFeatures":false,"price":false,"images":false,"floorPlans":false,"availability":true}}')),2::bigint,'visibility update increments version');
select is((select version from public.connect_publish_project((select id from public.projects where slug='edificio-a'),2,'published')),3::bigint,'explicit publish increments version');
select is((select version from public.connect_create_unit((select id from public.projects where slug='edificio-a'),pg_temp.row_json('A-101')-'sourceLine'-'expectedVersion')),1::bigint,'unit created with numeric price');
select is((select price_brl::text from public.units where code='A-101'),'450000.00','price preserves decimal scale');
select is(pg_temp.state($$select public.connect_create_unit((select id from public.projects where slug='edificio-a'),pg_temp.row_json('A-101')-'sourceLine'-'expectedVersion')$$),'23505','duplicate code rejected');
select is(pg_temp.state($$select public.connect_update_unit((select id from public.units where code='A-101'),0,'{"status":"sold"}')$$),'PT409','stale unit update conflicts');
select is((select status from public.connect_update_unit((select id from public.units where code='A-101'),1,'{"status":"reserved"}')),'reserved','unit can be updated');
select is((public.connect_public_project('pc02-edificio-a')->'units'->0 ? 'priceBRL'),false,'public projection omits private price');
select is((public.connect_public_project('pc02-edificio-a')->'units'->0->>'status'),'reserved','explicit availability is public');
select is((select count(*)::int from public.inventory_imports),0,'preview has no persistence');
select is((public.connect_preview_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102')))->'lines'->0->>'classification'),'new','preview classifies new unit');
select is(pg_temp.state($$select public.connect_preview_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('BAD')||'{"areaM2":"invalid"}'::jsonb))$$),'22023','invalid CSV row rejected by server');
select is((select count(*)::int from public.units),1,'invalid preview has no inventory write');
select is(pg_temp.state($$select public.connect_confirm_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102'),pg_temp.row_json('A-101',1)),(public.connect_preview_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102'),pg_temp.row_json('A-101',1)))->>'hash'),'e1000000-0000-4000-8000-000000000001')$$),'PT409','one conflict aborts whole CSV');
select is((select count(*)::int from public.units),1,'failed import is atomic');
select is((select inserted_rows from public.connect_confirm_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102')),(public.connect_preview_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102')))->>'hash'),'e1000000-0000-4000-8000-000000000002')),1,'confirmed import inserts row');
select is((select count(*)::int from public.inventory_imports),1,'import audit summary persisted');
select is((select inserted_rows from public.connect_confirm_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102')),(public.connect_preview_inventory((select id from public.projects where slug='edificio-a'),jsonb_build_array(pg_temp.row_json('A-102')))->>'hash'),'e1000000-0000-4000-8000-000000000002')),1,'retry returns same import result');
select is((select count(*)::int from public.inventory_imports),1,'retry is idempotent');
select is((public.connect_public_project('pc02-edificio-a') ? 'assets'),false,'asset metadata never leaks through public projection');
reset role;

select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_publish_project((select id from public.projects where slug='edificio-a'),3,'draft')$$),'42501','manager cannot publish');
select is((select count(*)::int from public.projects),1,'manager sees own tenant projects');
select is((select count(*)::int from public.units),2,'manager sees own inventory');
select is((select status from public.connect_update_unit((select id from public.units where code='A-101'),2,'{"status":"available"}')),'available','authorized manager updates unit');
reset role;

select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is((select count(*)::int from public.projects),1,'other tenant sees only B project');
select is((select count(*)::int from public.units),1,'other tenant sees only B unit');
select is(pg_temp.state($$select public.connect_create_unit((select id from public.projects where slug='edificio-a'),pg_temp.row_json('B-1')-'sourceLine'-'expectedVersion')$$),'P0002','other tenant cannot resolve project or create unit');
reset role;
set local role anon;
select is(pg_temp.state($$select * from public.units$$),'42501','anonymous cannot read base inventory');
select * from finish();
rollback;
