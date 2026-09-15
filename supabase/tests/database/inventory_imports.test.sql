begin;
create extension if not exists pgtap with schema extensions;
select plan(30);
create function pg_temp.err(p_sql text) returns text language plpgsql as $$declare d text;begin execute p_sql;return null;exception when others then get stacked diagnostics d=pg_exception_detail;begin return (d::jsonb)->>'code';exception when others then return sqlstate;end;end$$;
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('63000000-0000-4000-8000-000000000001','authenticated','authenticated','import-admin@test.local',now(),now()),
('63000000-0000-4000-8000-000000000002','authenticated','authenticated','import-seller@test.local',now(),now());
insert into public.organization_members(organization_id,user_id,role) values
('00000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','organization_admin'),
('00000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000002','seller');
insert into public.projects(id,organization_id,name,slug,status,country,timezone,currency,north_offset_degrees) values('63000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','Importação','importacao-teste','draft','BR','America/Sao_Paulo','BRL',0);
insert into public.buildings(id,project_id,code,name,display_order,model_path,floor_count) values('63000000-0000-4000-8000-000000000101','63000000-0000-4000-8000-000000000100','A','Torre A',1,'__not_configured__',1);
insert into public.floors(id,building_id,code,label,number,display_order) values('63000000-0000-4000-8000-000000000102','63000000-0000-4000-8000-000000000101','F1','Pavimento 1',1,1);
insert into public.unit_types(id,project_id,code,name,bedrooms,suites,bathrooms,private_area_m2,total_area_m2) values('63000000-0000-4000-8000-000000000103','63000000-0000-4000-8000-000000000100','T1','Tipo 1',2,1,2,70,80);

select is((select count(*)::int from public.units where project_id='00000000-0000-4000-8000-000000000002'),72,'migration preserves all 72 Escobar units');
select has_table('public','inventory_imports','imports table exists');
select has_table('public','inventory_import_errors','normalized issues table exists');
select ok(not has_table_privilege('authenticated','public.inventory_imports','insert'),'clients cannot insert imports');
select ok(not has_table_privilege('authenticated','public.inventory_import_errors','insert'),'clients cannot insert issues');
select ok(not has_function_privilege('anon','public.admin_confirm_inventory_import(uuid,uuid,jsonb,text)','execute'),'anonymous cannot confirm');

select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','create_only','[]',gen_random_uuid(),2)$$),'not_found','seller cannot dry-run imports');
reset role;

select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000001',true);set local role authenticated;
create temporary table preview as select * from public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','create_only','[{"unit_code":"101","building_code":"A","floor_code":"F1","unit_type_code":"T1","external_reference":"EXT","orientation":"north","view_type":"sea","solar_exposure":"morning","parking_spaces":"1","price":"500000","currency":"BRL","status":"reserved","published":"false","expected_version":""}]','63000000-0000-4000-8000-000000000201',350);
select is((select status from preview),'validated','valid draft row receives validated dry-run');
select is((select new_count from preview),1,'new row classified once');
select is((select error_count from preview),0,'valid preview has no errors');
select is((select extract(epoch from(expires_at-created_at))::int from preview),1800,'database expiry is exactly 30 minutes after creation');
select is((select length(payload_hash) from preview),64,'server computes SHA-256 payload hash');
select is((select id from public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','create_only','[]','63000000-0000-4000-8000-000000000201',2)),(select id from preview),'same operation id is idempotent');
select is(pg_temp.err($$select public.admin_confirm_inventory_import((select id from preview),'63000000-0000-4000-8000-000000000201','[]',(select payload_hash from preview))$$),'invalid_input','confirmation rejects changed payload');
select is((select status from public.admin_confirm_inventory_import((select id from preview),'63000000-0000-4000-8000-000000000201','[{"unit_code":"101","building_code":"A","floor_code":"F1","unit_type_code":"T1","external_reference":"EXT","orientation":"north","view_type":"sea","solar_exposure":"morning","parking_spaces":"1","price":"500000","currency":"BRL","status":"reserved","published":"false","expected_version":""}]',(select payload_hash from preview))),'completed','confirmation succeeds atomically');
select ok((select status='reserved' and price_brl=500000 and not published and reserved_by is null from public.units where project_id='63000000-0000-4000-8000-000000000100' and code='101'),'draft initial commercial values apply without invented reservation owner');
select is((select count(*)::int from public.units where project_id='63000000-0000-4000-8000-000000000100' and status='reserved' and reserved_by is null),1,'imported reservation remains explicitly ownerless');
select is((select count(*)::int from public.admin_list_audit_logs(p_project_id=>'63000000-0000-4000-8000-000000000100',p_action=>'unit.imported_initial')),1,'created unit is audited once');
select is((select status from public.admin_confirm_inventory_import((select id from preview),'63000000-0000-4000-8000-000000000201','[{"unit_code":"101","building_code":"A","floor_code":"F1","unit_type_code":"T1","external_reference":"EXT","orientation":"north","view_type":"sea","solar_exposure":"morning","parking_spaces":"1","price":"500000","currency":"BRL","status":"reserved","published":"false","expected_version":""}]',(select payload_hash from preview))),'completed','repeated confirmation returns completed import');
select is((select count(*)::int from public.units where project_id='63000000-0000-4000-8000-000000000100'),1,'idempotent confirm does not duplicate unit');
reset role;select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_change_unit_status((select id from public.units where project_id='63000000-0000-4000-8000-000000000100' and code='101'),1,'reserved','available','Tentativa de liberação')$$),'invalid_transition','seller cannot release imported ownerless reservation');
reset role;select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000001',true);set local role authenticated;

create temporary table unchanged as select * from public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','update_existing','[{"unit_code":"101","building_code":"A","floor_code":"F1","unit_type_code":"T1","external_reference":"EXT","orientation":"north","view_type":"sea","solar_exposure":"morning","parking_spaces":"1","price":"500000","currency":"BRL","status":"reserved","published":"false","expected_version":"1"}]','63000000-0000-4000-8000-000000000202',350);
select is((select unchanged_count from unchanged),1,'unchanged row is classified');
select lives_ok($$select public.admin_confirm_inventory_import((select id from unchanged),'63000000-0000-4000-8000-000000000202','[{"unit_code":"101","building_code":"A","floor_code":"F1","unit_type_code":"T1","external_reference":"EXT","orientation":"north","view_type":"sea","solar_exposure":"morning","parking_spaces":"1","price":"500000","currency":"BRL","status":"reserved","published":"false","expected_version":"1"}]',(select payload_hash from unchanged))$$,'unchanged import confirms');
select is((select version from public.units where project_id='63000000-0000-4000-8000-000000000100' and code='101'),1::bigint,'unchanged row does not increment version');
select is((select count(*)::int from public.admin_list_audit_logs(p_project_id=>'63000000-0000-4000-8000-000000000100',p_action=>'unit.imported_structure')),0,'unchanged row creates no unit audit');

select is((select status from public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','create_only','[{"unit_code":"102","building_code":"X","floor_code":"F1","unit_type_code":"T1","orientation":"north","parking_spaces":"1","currency":"BRL"}]','63000000-0000-4000-8000-000000000203',200)),'invalid','bad reference makes dry-run invalid');
select ok((select error_count=1 from public.inventory_imports where operation_id='63000000-0000-4000-8000-000000000203'),'invalid row counted once');
select is(pg_temp.err($$select public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','create_only','[]',gen_random_uuid(),5242881)$$),'invalid_input','server enforces 5 MiB declaration');
select is(pg_temp.err($$select public.admin_preview_inventory_import('63000000-0000-4000-8000-000000000100','create_only',(select jsonb_agg('{}'::jsonb) from generate_series(1,1001)),gen_random_uuid(),1000)$$),'invalid_input','server enforces 1000 rows');
reset role;
update public.inventory_imports set expires_at=now()-interval '1 second' where id=(select id from public.inventory_imports where operation_id='63000000-0000-4000-8000-000000000203');
select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_confirm_inventory_import((select id from public.inventory_imports where operation_id='63000000-0000-4000-8000-000000000203'),'63000000-0000-4000-8000-000000000203','[]',(select payload_hash from public.inventory_imports where operation_id='63000000-0000-4000-8000-000000000203'))$$),'import_expired','expired dry-run cannot confirm');
reset role;
select * from finish();
rollback;
