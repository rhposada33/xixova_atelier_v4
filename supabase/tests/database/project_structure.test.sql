begin;
create extension if not exists pgtap with schema extensions;
select plan(55);
create function pg_temp.err(p_sql text) returns text language plpgsql as $$declare d text;begin execute p_sql;return null;exception when others then get stacked diagnostics d=pg_exception_detail;begin return (d::jsonb)->>'code';exception when others then return sqlstate;end;end$$;
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('61000000-0000-4000-8000-000000000001','authenticated','authenticated','structure-platform@test.local',now(),now()),
('61000000-0000-4000-8000-000000000002','authenticated','authenticated','structure-admin@test.local',now(),now()),
('61000000-0000-4000-8000-000000000003','authenticated','authenticated','structure-seller@test.local',now(),now()),
('61000000-0000-4000-8000-000000000004','authenticated','authenticated','structure-viewer@test.local',now(),now());
insert into public.platform_admins values('61000000-0000-4000-8000-000000000001');
insert into public.organization_members(organization_id,user_id,role) values
('00000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','organization_admin'),
('00000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003','seller'),
('00000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000004','viewer');

select is((select count(*)::int from public.units),72,'migration preserves 72 units');
select is((select count(*)::int from public.units where status='available'),54,'54 units remain available');
select is((select count(*)::int from public.units where status='reserved'),6,'6 units remain reserved');
select is((select count(*)::int from public.units where status='sold'),12,'12 units remain sold');
select ok((select public_inventory_enabled and visual_experience_enabled from public.projects where slug='escobar-residences'),'Escobar retains both capabilities');
select is((select count(distinct interior_project_id)::int from public.unit_types),2,'Garden House and Terraza Luz links remain');
select is((select count(*)::int from public.units where model_object_id like 'UNIT_%_PROXY'),72,'all visual unit proxies remain');

select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.admin_create_project('00000000-0000-4000-8000-000000000001','Projeto Teste','projeto-teste','','BR','SP','Santos','Rua Teste',null,null,'America/Sao_Paulo','BRL',null,0)),'draft','new project starts draft');
select is((select visual_experience_enabled from public.projects where slug='projeto-teste'),false,'new project visual experience is disabled');
select is(pg_temp.err($$select public.admin_change_project_status((select id from public.projects where slug='projeto-teste'),1,'ready','Validar',false)$$),'project_not_ready','incomplete project cannot become ready');
select lives_ok($$select public.admin_save_building(null,(select id from public.projects where slug='projeto-teste'),null,'a','Torre A',1,true)$$,'platform creates building');
select is(pg_temp.err($$select public.admin_save_building(null,(select id from public.projects where slug='projeto-teste'),null,'a','Duplicada',2,true)$$),'duplicate_code','building code is unique per project');
select lives_ok($$select public.admin_save_floor(null,(select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),null,'0','Térreo',0,0,3,true)$$,'ground floor is supported');
select lives_ok($$select public.admin_save_floor(null,(select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),null,'s1','Subsolo 1',-1,-1,3,true)$$,'negative floor is supported');
select ok((public.admin_preview_floor_generation((select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),1,3,'{n}','Pavimento {n}')->>'canConfirm')::boolean,'floor generation preview is clean');
select is(public.admin_confirm_floor_generation((select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),1,3,'{n}','Pavimento {n}',gen_random_uuid()),3,'floor generation confirms atomically');
select is((public.admin_preview_floor_generation((select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),1,3,'{n}','Pavimento {n}')->>'canConfirm')::boolean,false,'preview reports existing conflicts');
select lives_ok($$select public.admin_save_unit_type_confirmed(null,(select id from public.projects where slug='projeto-teste'),null,'t2','Tipo 2','',80,100,2,1,2,1,true,false)$$,'platform creates valid unit type');
select is(pg_temp.err($$select public.admin_save_unit_type_confirmed(null,(select id from public.projects where slug='projeto-teste'),null,'bad','Inválida','',100,80,2,1,2,1,true,false)$$),'invalid_input','total area cannot be below private area');
select lives_ok($$select public.admin_create_structural_unit((select id from public.projects where slug='projeto-teste'),(select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.floors where code='1' and building_id=(select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste'))),(select id from public.unit_types where code='t2' and project_id=(select id from public.projects where slug='projeto-teste')),'101',null,'north',null,null,'BRL',1,500000,'available',false)$$,'platform creates structural unit');
select is((select status from public.units where project_id=(select id from public.projects where slug='projeto-teste')),'available','created unit starts available');
select is((select published from public.units where project_id=(select id from public.projects where slug='projeto-teste')),false,'created unit starts hidden');
select matches((select model_object_id from public.units where project_id=(select id from public.projects where slug='projeto-teste')),'^UNMAPPED_','new unit does not reuse Escobar mapping');
select is(pg_temp.err($$select public.admin_save_building((select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.projects where slug='projeto-teste'),99,'a','Torre A',1,true)$$),'version_conflict','building update checks expected version');
select is(pg_temp.err($$select public.admin_save_building((select id from public.buildings where code='a' and project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.projects where slug='projeto-teste'),1,'a','Torre A',1,false)$$),'dependency_conflict','building with unit cannot be deactivated');
select ok((public.admin_validate_project_readiness((select id from public.projects where slug='projeto-teste'))->>'ready')::boolean,'complete structure is ready');
select is((select status from public.admin_change_project_status((select id from public.projects where slug='projeto-teste'),1,'ready','Estrutura validada',false)),'ready','draft becomes ready');
select is((select count(*)::int from public.admin_list_audit_logs(p_project_id=>(select id from public.projects where slug='projeto-teste'))),8,'structural mutations are audited once');
reset role;

select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000003',true);set local role authenticated;
select is((select count(*)::int from public.admin_list_projects('00000000-0000-4000-8000-000000000001',1,100,null,null)),2,'seller can list own projects');
select is(pg_temp.err($$select public.admin_create_project('00000000-0000-4000-8000-000000000001','X','x','','BR','','','',null,null,'America/Sao_Paulo','BRL',null,0)$$),'not_found','seller cannot create project');
reset role;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is((select count(*)::int from public.admin_list_buildings((select id from public.projects where slug='projeto-teste'))),1,'viewer can inspect own structure');
select is(pg_temp.err($$select public.admin_save_unit_type_confirmed(null,(select id from public.projects where slug='projeto-teste'),null,'x','X','',1,null,0,0,1,null,true,false)$$),'not_found','viewer cannot mutate structure');
select throws_ok($$update public.projects set name='Ataque'$$,'42501','permission denied for table projects','direct project writes remain denied');
select throws_ok($$update public.units set model_object_id='Ataque'$$,'42501','permission denied for table units','direct visual mapping writes remain denied');
select ok(not has_function_privilege('anon','public.admin_create_project(uuid,text,text,text,text,text,text,text,numeric,numeric,text,text,date,numeric)','execute'),'anonymous cannot execute structural mutations');
reset role;
select is((select count(*)::int from public.unit_types where bathrooms is null),8,'legacy bathroom values remain unknown instead of zero');
select is((select column_default from information_schema.columns where table_schema='public' and table_name='unit_types' and column_name='bathrooms'),null,'bathrooms has no silent default');
insert into public.organizations(id,name,slug,status) values('61000000-0000-4000-8000-000000000100','Outra organização','outra-estrutura','active');
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_create_project('61000000-0000-4000-8000-000000000100','Slug repetido','projeto-teste','','BR','SP','Santos','',null,null,'America/Sao_Paulo','BRL',null,0)$$),'duplicate_code','project slug is globally unique across organizations');
select is(pg_temp.err($$select public.admin_save_unit_type_confirmed(null,(select id from public.projects where slug='projeto-teste'),null,'sem-banho','Sem banho','',50,60,1,0,null,null,true,false)$$),'invalid_input','new residential type requires explicit bathroom count');
select ok((public.admin_validate_project_visual((select id from public.projects where slug='projeto-teste'))->'errors') ? 'missing_building_model','placeholder building fails visual validation');
select ok((select (public.admin_validate_project_visual(id)->>'valid')::boolean from public.projects where id='00000000-0000-4000-8000-000000000002'),'Escobar deterministic visual configuration remains valid');
select is(pg_temp.err($$select public.admin_set_project_capabilities((select id from public.projects where slug='projeto-teste'),2,false,true)$$),'project_not_ready','visual capability cannot bypass validation');
select is(pg_temp.err($$select public.admin_save_unit_type_confirmed((select id from public.unit_types where code='t2' and project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.projects where slug='projeto-teste'),1,'t2','Tipo 2','',81,100,2,1,2,1,true,false)$$),'dependency_conflict','used type material change requires impact confirmation');
select is((select version from public.admin_save_unit_type_confirmed((select id from public.unit_types where code='t2' and project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.projects where slug='projeto-teste'),1,'t2','Tipo 2','',81,100,2,1,2,1,true,true)),2::bigint,'confirmed type impact increments version once');
select is((select (new_values->>'affected_units')::int from public.admin_list_audit_logs(p_action=>'unit_type.updated') limit 1),1,'type audit records affected unit count');
select is(pg_temp.err($$select public.admin_save_unit_type_confirmed((select id from public.unit_types where code='t2' and project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.projects where slug='projeto-teste'),1,'t2','Tipo 2','',82,100,2,1,2,1,true,true)$$),'version_conflict','type impact keeps optimistic concurrency');
select lives_ok($$select public.admin_update_structural_unit((select id from public.units where project_id=(select id from public.projects where slug='projeto-teste')),1,(select id from public.buildings where project_id=(select id from public.projects where slug='projeto-teste')),(select id from public.floors where code='1' and building_id=(select id from public.buildings where project_id=(select id from public.projects where slug='projeto-teste'))),(select id from public.unit_types where code='t2' and project_id=(select id from public.projects where slug='projeto-teste')),null,'north',null,null,'BRL',1)$$,'structural update accepts only structural fields');
select is((select price_brl from public.units where project_id=(select id from public.projects where slug='projeto-teste')),500000::numeric,'structural update preserves price');
select ok((select status='available' and not published and reserved_by is null and reserved_at is null and reserved_until is null from public.units where project_id=(select id from public.projects where slug='projeto-teste')),'structural update preserves status publication and reservation');
select matches((select model_object_id from public.units where project_id=(select id from public.projects where slug='projeto-teste')),'^UNMAPPED_','structural update preserves visual mapping');
select is((select count(*)::int from public.get_public_inventory('escobar','escobar-residences',null)),72,'published Escobar remains publicly visible');
select is((select count(*)::int from public.get_public_inventory('escobar','projeto-teste',null)),0,'ready project is not public automatically');
select ok(not has_function_privilege('authenticated','public.admin_save_unit_type(uuid,uuid,bigint,text,text,text,numeric,numeric,integer,integer,integer,integer,boolean)','execute'),'legacy type mutation path is revoked');
reset role;
select throws_ok($$insert into public.units(id,project_id,building_id,floor_id,unit_type_id,code,status,parking_spaces,orientation,model_object_id,published) select gen_random_uuid(),project_id,building_id,floor_id,unit_type_id,'proxy-duplicate','available',1,'north',model_object_id,true from public.units where project_id='00000000-0000-4000-8000-000000000002' limit 1$$,'23505',null,'duplicate proxy remains prohibited by PostgreSQL');
select is((select count(*)::int from public.units where model_object_id like 'UNIT_%_PROXY'),72,'all original proxies remain after structural operations');
select * from finish();rollback;
