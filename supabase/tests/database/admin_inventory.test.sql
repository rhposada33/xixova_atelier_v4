begin;
create extension if not exists pgtap with schema extensions;
select plan(78);

create function pg_temp.admin_error_code(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  begin return (v_detail::jsonb)->>'code'; exception when others then return sqlstate; end;
end;
$$;

insert into auth.users(id,aud,role,email,created_at,updated_at) values
  ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','platform@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','admin-a@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000003','authenticated','authenticated','seller-a@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000004','authenticated','authenticated','viewer-a@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000005','authenticated','authenticated','admin-b@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000006','authenticated','authenticated','inactive@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000007','authenticated','authenticated','seller-a2@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000008','authenticated','authenticated','inactive-member@example.test',now(),now()),
  ('20000000-0000-4000-8000-000000000009','authenticated','authenticated','inactive-org@example.test',now(),now());

insert into public.platform_admins(user_id) values ('20000000-0000-4000-8000-000000000001');
insert into public.organizations(id,name,slug,status) values
  ('20000000-0000-4000-8000-000000000100','Organização B','organizacao-b','active'),
  ('20000000-0000-4000-8000-000000000101','Organização suspensa','organizacao-inativa','suspended');
insert into public.projects(id,organization_id,name,slug,status,timezone,published_at) values
  ('20000000-0000-4000-8000-000000000110','20000000-0000-4000-8000-000000000100','Projeto B','projeto-b','published','America/Sao_Paulo',now());
insert into public.buildings(id,project_id,name,code,model_path,floor_count) values
  ('20000000-0000-4000-8000-000000000120','20000000-0000-4000-8000-000000000110','Torre B','b','b.glb',1);
insert into public.floors(id,building_id,number,label) values
  ('20000000-0000-4000-8000-000000000130','20000000-0000-4000-8000-000000000120',1,'Andar 1');
insert into public.unit_types(id,project_id,name,bedrooms,suites,private_area_m2) values
  ('20000000-0000-4000-8000-000000000140','20000000-0000-4000-8000-000000000110','Tipo B',2,1,80);
insert into public.units(id,project_id,building_id,floor_id,unit_type_id,code,status,price_brl,parking_spaces,orientation,model_object_id,published) values
  ('20000000-0000-4000-8000-000000000150','20000000-0000-4000-8000-000000000110','20000000-0000-4000-8000-000000000120','20000000-0000-4000-8000-000000000130','20000000-0000-4000-8000-000000000140','101','available',500000,1,'north','UNIT_B_101',true);

insert into public.organization_members(organization_id,user_id,role) values
  ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','organization_admin'),
  ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','seller'),
  ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','viewer'),
  ('20000000-0000-4000-8000-000000000100','20000000-0000-4000-8000-000000000005','organization_admin'),
  ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000006','organization_admin'),
  ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000007','seller'),
  ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000008','viewer'),
  ('20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000009','viewer');
update public.profiles set active=false where user_id='20000000-0000-4000-8000-000000000006';
update public.organization_members set active=false where user_id='20000000-0000-4000-8000-000000000008';

select is((select count(*)::integer from public.profiles where user_id::text like '20000000-%'),9,'auth trigger creates profiles');
select ok((select active from public.profiles where user_id='20000000-0000-4000-8000-000000000002'),'new profiles are active');
select is((select count(*)::integer from public.platform_admins),1,'platform role is independent from memberships');
select ok(not exists(select 1 from public.organization_members where user_id='20000000-0000-4000-8000-000000000001'),'platform admin needs no membership');
select is((select count(*)::integer from public.units where reserved_until is not null),6,'historical reservation dates remain unchanged');
select ok((select is_nullable='YES' from information_schema.columns where table_schema='public' and table_name='units' and column_name='reserved_until'),'reserved_until remains nullable');

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.organizations),3,'platform admin sees active and suspended onboarding organizations');
select is((select count(*)::integer from public.units),73,'platform admin reads units without membership');
select is((select public.admin_update_unit_price('20000000-0000-4000-8000-000000000150',1,510000)).version,2::bigint,'platform admin mutates any active organization without membership');
select is((select count(*)::integer from public.admin_get_unit_history(null,'20000000-0000-4000-8000-000000000110',null,null,null)),1,'platform admin reads complete audit without membership');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.organizations),1,'organization admin sees own organization');
select is((select count(*)::integer from public.units),72,'organization admin sees own inventory only');
select is((select count(*)::integer from public.admin_list_units(null,'00000000-0000-4000-8000-000000000002',null,1,5,null,null,null,null,null,null,'floor','asc')),5,'administrative list applies remote page size');
select is((select total_count from public.admin_list_units(null,'00000000-0000-4000-8000-000000000002',null,1,5,null,null,null,null,null,null,'floor','asc') limit 1),72::bigint,'administrative page returns total count');
select is((select code from public.admin_list_units(null,'00000000-0000-4000-8000-000000000002',null,1,4,null,null,null,null,null,null,'floor','asc') limit 1),'101','administrative ordering is deterministic');
select is((select code from public.admin_list_units(null,'00000000-0000-4000-8000-000000000002',null,2,4,null,null,null,null,null,null,'floor','asc') limit 1),'201','administrative pagination uses stable offset');
select is((select total_count from public.admin_list_units(null,'00000000-0000-4000-8000-000000000002',null,1,25,null,12,null,null,null,null,'floor','asc') limit 1),4::bigint,'administrative list filters by floor');
select is((select total_count from public.admin_list_units(null,'00000000-0000-4000-8000-000000000002',null,1,25,null,12,'available',null,null,null,'floor','asc') limit 1),3::bigint,'administrative list combines filters');
select is(pg_temp.admin_error_code($$select * from public.admin_list_units(null,null,null,1,101,null,null,null,null,null,null,'floor','asc')$$),'invalid_input','administrative pagination validates maximum page size');
select is((select total from public.admin_get_project_summary('00000000-0000-4000-8000-000000000002')),72::bigint,'project summary is computed in the database');
select is(pg_temp.admin_error_code($$select * from public.admin_get_project_summary('20000000-0000-4000-8000-000000000110')$$),'not_found','project summary does not reveal another organization');
select is((select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',1,1500000)).version,2::bigint,'organization admin updates price and increments version');
select is((select price_brl from public.units where code='1203'),1500000::numeric,'new price is stored');
select is((select old_values->>'price_brl' from public.unit_audit_logs where unit_id='00000000-0000-4001-8000-000000001203' order by created_at desc limit 1),'1460000','price audit stores old value');
select is((select new_values->>'price_brl' from public.unit_audit_logs where unit_id='00000000-0000-4001-8000-000000001203' order by created_at desc limit 1),'1500000','price audit stores new value');
select is(pg_temp.admin_error_code($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',1,1600000)$$),'version_conflict','stale price update returns version conflict');
select is((select version from public.units where code='1203'),2::bigint,'version conflict changes nothing');
select is((select count(*)::integer from public.unit_audit_logs where unit_id='00000000-0000-4001-8000-000000001203'),1,'version conflict writes no audit');
select is(pg_temp.admin_error_code($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',2,-1)$$),'invalid_input','negative price is rejected');
select is((select public.admin_set_unit_published('00000000-0000-4001-8000-000000001203',2,false)).version,3::bigint,'admin unpublishes and increments version');
select ok(exists(select 1 from public.unit_audit_logs where unit_id='00000000-0000-4001-8000-000000001203' and action='unit.unpublished'),'unpublish is audited');
select is((select public.admin_change_unit_status('00000000-0000-4001-8000-000000001202',1,'available','sold','Venda direta')).status,'sold','organization admin changes available directly to sold');
select is((select count(*)::integer from public.admin_get_unit_history(null,'00000000-0000-4000-8000-000000000002',null,null,null)),3,'organization admin reads complete organization audit');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select is((select count(*)::integer from public.units),72,'viewer reads administrative inventory');
select is((select total from public.admin_get_project_summary('00000000-0000-4000-8000-000000000002')),72::bigint,'viewer may read project summary');
select is(pg_temp.admin_error_code($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',3,1)$$),'forbidden','viewer cannot update price');
select is(pg_temp.admin_error_code($$select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',3,'available','reserved','Teste')$$),'forbidden','viewer cannot reserve');
select is((select count(*)::integer from public.unit_audit_logs),0,'viewer cannot read audit');
select is(pg_temp.admin_error_code($$select * from public.admin_get_unit_history(null,'00000000-0000-4000-8000-000000000002',null,null,null)$$),'forbidden','viewer is explicitly rejected by history RPC');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is(pg_temp.admin_error_code($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',3,1)$$),'forbidden','seller cannot update price');
select is(pg_temp.admin_error_code($$select public.admin_set_unit_published('00000000-0000-4001-8000-000000001203',3,true)$$),'forbidden','seller cannot publish');
select is(pg_temp.admin_error_code($$select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',3,'available','reserved','')$$),'invalid_input','every status change requires a reason');
select is(pg_temp.admin_error_code($$select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',3,'sold','reserved','Teste')$$),'status_conflict','expected status is checked');
select is((select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',3,'available','reserved','Contato comercial')).status,'reserved','seller reserves available unit');
select is((select reserved_by from public.units where code='1203'),'20000000-0000-4000-8000-000000000003'::uuid,'reservation stores operational owner');
select ok((select reserved_at is not null and reserved_until is null from public.units where code='1203'),'reservation stores time without expiry');
select is((select count(*)::integer from public.admin_get_unit_history('00000000-0000-4001-8000-000000001203',null,null,null,null)),1,'seller reads own reservation activity only');
select is(pg_temp.admin_error_code($$select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',4,'reserved','sold','Venda')$$),'invalid_transition','seller cannot mark a reserved unit sold');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000007',true);
set local role authenticated;
select is(pg_temp.admin_error_code($$select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',4,'reserved','available','Não é minha')$$),'invalid_transition','seller cannot release another seller reservation');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select public.admin_change_unit_status('00000000-0000-4001-8000-000000001203',4,'reserved','available','Cliente desistiu')).status,'available','seller releases own reservation');
select ok((select reserved_by is null and reserved_at is null and reserved_until is null from public.units where code='1203'),'release clears operational reservation fields');
select is((select count(*)::integer from public.unit_audit_logs),2,'seller RLS exposes only own two reservation events');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select public.admin_change_unit_status('00000000-0000-4001-8000-000000001204',1,'available','reserved','Reserva para venda')).version,2::bigint,'seller reserves unit for subsequent sale');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select public.admin_change_unit_status('00000000-0000-4001-8000-000000001204',2,'reserved','sold','Contrato assinado')).status,'sold','organization admin sells reserved unit');
select ok((select reserved_by is null and reserved_at is null and reserved_until is null from public.units where code='1204'),'sale clears operational reservation fields');
select is((select old_values->>'reserved_by' from public.unit_audit_logs where unit_id='00000000-0000-4001-8000-000000001204' and new_values->>'status'='sold'),'20000000-0000-4000-8000-000000000003','sale audit preserves previous reservation owner');
select is((select public.admin_change_unit_status('00000000-0000-4001-8000-000000001302',1,'sold','available','Venda cancelada')).status,'available','admin reverts sold unit');
select is((select action from public.unit_audit_logs where unit_id='00000000-0000-4001-8000-000000001302'),'unit.sold_reverted','sold reversal receives sensitive audit action');
select is(pg_temp.admin_error_code($$select public.admin_change_unit_status('00000000-0000-4001-8000-000000001302',2,'available','blocked','Bloquear')$$),'invalid_transition','unapproved status transition is rejected');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000005',true);
set local role authenticated;
select is((select count(*)::integer from public.units),1,'organization B admin is isolated');
select is(pg_temp.admin_error_code($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',5,1)$$),'not_found','cross-organization mutation does not reveal unit existence');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000006',true);
set local role authenticated;
select is((select count(*)::integer from public.units),0,'inactive profile reads no inventory');
select is(pg_temp.admin_error_code($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',5,1)$$),'inactive_user','inactive profile is rejected by RPC');
select throws_ok($$update public.profiles set active=true where user_id='20000000-0000-4000-8000-000000000006'$$,'42501',null,'user cannot activate own profile');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000008',true);
set local role authenticated;
select is((select count(*)::integer from public.units),0,'inactive membership grants no inventory access');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000009',true);
set local role authenticated;
select is((select count(*)::integer from public.organizations),0,'member of inactive organization receives no access');
reset role;

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$update public.units set price_brl=1 where code='1203'$$,'42501','permission denied for table units','authenticated has no direct unit writes');
select throws_ok($$insert into public.unit_audit_logs(organization_id,project_id,unit_id,action,old_values,new_values,performed_by) values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4001-8000-000000001203','unit.price_updated','{}','{}','20000000-0000-4000-8000-000000000002')$$,'42501','permission denied for table unit_audit_logs','clients cannot insert audit');
select throws_ok($$update public.unit_audit_logs set reason='x'$$,'42501','permission denied for table unit_audit_logs','clients cannot update audit');
select throws_ok($$delete from public.unit_audit_logs$$,'42501','permission denied for table unit_audit_logs','clients cannot delete audit');
reset role;

create function pg_temp.reject_audit() returns trigger language plpgsql as $$begin raise exception 'forced audit failure'; end;$$;
create trigger reject_audit before insert on public.unit_audit_logs for each row execute function pg_temp.reject_audit();
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.admin_update_unit_price('00000000-0000-4001-8000-000000001203',5,1700000)$$,'P0001','forced audit failure','audit failure aborts mutation');
reset role;
drop trigger reject_audit on public.unit_audit_logs;
select is((select version from public.units where code='1203'),5::bigint,'failed audit leaves version unchanged');
select is((select price_brl from public.units where code='1203'),1500000::numeric,'failed audit leaves price unchanged');

select ok(not has_function_privilege('public','public.admin_update_unit_price(uuid,bigint,numeric)','execute'),'PUBLIC cannot execute admin price RPC');
select ok(not has_function_privilege('anon','public.admin_change_unit_status(uuid,bigint,text,text,text)','execute'),'anon cannot execute status RPC');
select ok(has_function_privilege('authenticated','public.admin_get_unit_history(uuid,uuid,text,timestamptz,timestamptz)','execute'),'authenticated may invoke protected history RPC');
select ok(has_function_privilege('authenticated','public.admin_list_units(uuid,uuid,uuid,integer,integer,text,integer,text,integer,text,boolean,text,text)','execute'),'authenticated may invoke protected paginated list RPC');
select ok(position('reserved_by' in pg_get_function_result('public.get_public_inventory(text,text,text)'::regprocedure))=0,'public inventory excludes reservation owner');

select * from finish();
rollback;
