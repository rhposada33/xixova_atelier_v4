begin;
create extension if not exists pgtap with schema extensions;
select plan(25);
create function pg_temp.domain_code(p_sql text) returns text language plpgsql as $$
declare d text;
begin execute p_sql;return null;
exception when others then get stacked diagnostics d=pg_exception_detail;
  begin return (d::jsonb)->>'code';exception when others then return sqlstate;end;
end$$;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('61000000-0000-4000-8000-000000000001','authenticated','authenticated','global@test.local',now(),now(),now()),
('61000000-0000-4000-8000-000000000002','authenticated','authenticated','admin-a@test.local',now(),now(),now()),
('61000000-0000-4000-8000-000000000003','authenticated','authenticated','admin-b@test.local',now(),now(),now()),
('61000000-0000-4000-8000-000000000004','authenticated','authenticated','seller@test.local',now(),now(),now()),
('61000000-0000-4000-8000-000000000005','authenticated','authenticated','viewer@test.local',now(),now(),now()),
('61000000-0000-4000-8000-000000000006','authenticated','authenticated','inactive@test.local',now(),now(),now());
update public.profiles set active=false where user_id='61000000-0000-4000-8000-000000000006';
insert into public.platform_admins(user_id) values('61000000-0000-4000-8000-000000000001');
insert into public.organizations(id,name,slug,status,country,timezone,default_currency) values
('62000000-0000-4000-8000-000000000001','Empresa A','audit-a','active','BR','America/Sao_Paulo','BRL'),
('62000000-0000-4000-8000-000000000002','Empresa B','audit-b','active','BR','America/Sao_Paulo','BRL'),
('62000000-0000-4000-8000-000000000003','Empresa Suspensa','audit-s','suspended','BR','America/Sao_Paulo','BRL');
insert into public.organization_members(organization_id,user_id,role,active) values
('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','organization_admin',true),
('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003','organization_admin',true),
('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000004','seller',true),
('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000005','viewer',true),
('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000006','organization_admin',true),
('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000002','organization_admin',true);
insert into public.admin_audit_logs(id,organization_id,resource_type,resource_id,action,new_values,reason,performed_by,created_at) values
('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','organization','62000000-0000-4000-8000-000000000001','organization.created','{"name":"Empresa A","email":"private@test.local","token_hash":"secret"}','Sem motivo','61000000-0000-4000-8000-000000000002','2026-09-15T12:00:00Z'),
('63000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','invitation','64000000-0000-4000-8000-000000000001','invitation.sent','{"role":"viewer","status":"sent"}',null,'61000000-0000-4000-8000-000000000002','2026-09-15T12:00:00Z'),
('63000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000002','organization','62000000-0000-4000-8000-000000000002','organization.created','{"name":"Empresa B"}',null,'61000000-0000-4000-8000-000000000003','2026-09-15T11:00:00Z'),
('63000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000003','organization','62000000-0000-4000-8000-000000000003','organization.suspended','{"status":"suspended"}',null,'61000000-0000-4000-8000-000000000002','2026-09-15T10:00:00Z');

select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select count(*)::int from public.admin_list_audit_logs()),4,'platform admin lists across organizations including suspended');
select is((select count(*)::int from public.admin_list_audit_actors()),2,'platform admin can find actors across organizations');
select is((select count(*)::int from public.admin_list_audit_logs('62000000-0000-4000-8000-000000000001')),2,'organization filter is applied remotely');
select is((select total_count from public.admin_list_audit_logs(p_page_size=>1) limit 1),4::bigint,'remote page reports total');
select is((select id from public.admin_list_audit_logs(p_page_size=>1) limit 1),'63000000-0000-4000-8000-000000000002'::uuid,'same timestamp uses descending id tie-breaker');
select is((select id from public.admin_list_audit_logs(p_page=>2,p_page_size=>1) limit 1),'63000000-0000-4000-8000-000000000001'::uuid,'second page is deterministic');
select is((select count(*)::int from public.admin_list_audit_logs(p_action=>'invitation.sent')),1,'action filter works');
select is((select count(*)::int from public.admin_list_audit_logs(p_resource_type=>'invitation')),1,'resource filter works');
select is((select count(*)::int from public.admin_list_audit_logs(p_actor_id=>'61000000-0000-4000-8000-000000000003')),1,'actor filter works');
select is((select count(*)::int from public.admin_list_audit_logs(p_date_from=>'2026-09-15T11:30:00Z')),2,'date filter works');
select ok((select not (new_values ? 'email' or new_values ? 'token_hash') from public.admin_list_audit_logs(p_action=>'organization.created',p_organization_id=>'62000000-0000-4000-8000-000000000001') limit 1),'sensitive and unknown JSON keys are absent');
select is(pg_temp.domain_code($$select * from public.admin_list_audit_logs(p_page_size=>101)$$),'invalid_input','page size is bounded');
reset role;

select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is((select count(*)::int from public.admin_list_audit_logs()),2,'organization admin sees only active own organization');
select is((select count(*)::int from public.admin_list_audit_actors()),1,'organization admin sees only own audit actors');
select is(pg_temp.domain_code($$select * from public.admin_list_audit_actors('62000000-0000-4000-8000-000000000002')$$),'not_found','actor search cannot reveal foreign organization');
select is(pg_temp.domain_code($$select * from public.admin_list_audit_logs('62000000-0000-4000-8000-000000000002')$$),'not_found','foreign organization does not reveal audit');
select is(pg_temp.domain_code($$select * from public.admin_list_audit_logs('62000000-0000-4000-8000-000000000003')$$),'not_found','suspended organization is unavailable to its members');
select throws_ok($$select * from public.admin_audit_logs$$,'42501','permission denied for table admin_audit_logs','clients cannot read raw audit table');
select throws_ok($$update public.admin_audit_logs set action='x'$$,'42501','permission denied for table admin_audit_logs','audit is immutable for clients');
reset role;

select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(pg_temp.domain_code($$select * from public.admin_list_audit_logs()$$),'forbidden','seller is excluded');reset role;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(pg_temp.domain_code($$select * from public.admin_list_audit_actors()$$),'forbidden','seller cannot list audit actors');reset role;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000005',true);set local role authenticated;
select is(pg_temp.domain_code($$select * from public.admin_list_audit_logs()$$),'forbidden','viewer is excluded');reset role;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000006',true);set local role authenticated;
select is(pg_temp.domain_code($$select * from public.admin_list_audit_logs()$$),'inactive_user','inactive profile is excluded');reset role;
set local role anon;
select throws_ok($$select * from public.admin_list_audit_logs()$$,'42501','permission denied for function admin_list_audit_logs','anon cannot execute');
select throws_ok($$select * from public.admin_list_audit_actors()$$,'42501','permission denied for function admin_list_audit_actors','anon cannot list actors');
select * from finish();rollback;
