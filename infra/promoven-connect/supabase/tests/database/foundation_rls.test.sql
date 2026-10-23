begin;
create extension if not exists pgtap with schema extensions;
select plan(30);
create function pg_temp.sqlstate_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'ok'; exception when others then return sqlstate; end $$;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-a@test.local',now(),now(),now()),
 ('a1000000-0000-4000-8000-000000000002','authenticated','authenticated','manager-both@test.local',now(),now(),now()),
 ('a1000000-0000-4000-8000-000000000003','authenticated','authenticated','admin-b@test.local',now(),now(),now()),
 ('a1000000-0000-4000-8000-000000000004','authenticated','authenticated','inactive@test.local',now(),now(),now()),
 ('a1000000-0000-4000-8000-000000000005','authenticated','authenticated','unbound@test.local',now(),now(),now()),
 ('a1000000-0000-4000-8000-000000000006','authenticated','authenticated','platform@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values
 ('b1000000-0000-4000-8000-000000000001','Organização A','org-a'),
 ('b1000000-0000-4000-8000-000000000002','Organização B','org-b');
insert into public.organization_members(organization_id,user_id,role) values
 ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','organization_admin'),
 ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','sales_manager'),
 ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','sales_manager'),
 ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','organization_admin'),
 ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004','sales_manager');
update public.profiles set active=false where user_id='a1000000-0000-4000-8000-000000000004';
insert into public.platform_admins(user_id) values('a1000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.profiles where user_id::text like 'a1000000%'),6,'trigger creates six profiles');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((select count(*)::int from public.organizations),1,'admin A sees only A');
select is((select count(*)::int from public.organization_members),3,'admin A sees all active and inactive members of A only');
select is((select count(*)::int from public.profiles),1,'profile read is self only');
select is(pg_temp.sqlstate_of($$insert into public.organizations(name,slug) values('X','x')$$),'42501','direct organization INSERT denied');
select is(pg_temp.sqlstate_of($$update public.organizations set name='X'$$),'42501','direct organization UPDATE denied');
select is(pg_temp.sqlstate_of($$delete from public.organizations$$),'42501','direct organization DELETE denied');
select is(pg_temp.sqlstate_of($$insert into public.organization_members(organization_id,user_id,role) values('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','organization_admin')$$),'42501','direct membership INSERT denied');
select is(pg_temp.sqlstate_of($$update public.profiles set active=true$$),'42501','self escalation through profile UPDATE denied');
select is(pg_temp.sqlstate_of($$insert into public.platform_admins(user_id) values('a1000000-0000-4000-8000-000000000001')$$),'42501','platform role INSERT denied');
select is(pg_temp.sqlstate_of($$select public.connect_create_organization('X','x')$$),'42501','organization admin cannot create tenants');
select is((select full_name from public.connect_update_my_profile('Administrador A')),'Administrador A','profile presentation update succeeds');
select is(pg_temp.sqlstate_of($$select public.connect_set_member('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003',1,'sales_manager',true)$$),'42501','admin A cannot edit B');
select is(pg_temp.sqlstate_of($$select public.connect_set_member('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,'sales_manager',true)$$),'23514','last administrator cannot be demoted');
select is((select role from public.connect_add_member('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005','sales_manager')),'sales_manager','organization admin grants scoped membership');
select is(pg_temp.sqlstate_of($$select public.connect_set_member('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005',9,'sales_manager',false)$$),'40001','stale membership version conflicts');
select is((select active from public.connect_set_member('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005',1,'sales_manager',false)),false,'admin deactivates membership');
select is((select count(*)::int from public.audit_events where action like 'membership.%'),2,'confirmed membership changes are audited');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is((select count(*)::int from public.organizations),2,'one user can belong to both organizations');
select is((select count(*)::int from public.organization_members),2,'manager sees only own memberships');
select is(pg_temp.sqlstate_of($$select public.connect_add_member('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000005','sales_manager')$$),'42501','manager cannot grant roles');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true); set local role authenticated;
select is((select count(*)::int from public.organizations),0,'inactive profile loses organization access');
select is((select count(*)::int from public.organization_members),0,'inactive profile loses membership access');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true); set local role authenticated;
select is((select count(*)::int from public.organizations),0,'unbound user sees no organizations');
select is((select count(*)::int from public.organization_members),0,'deactivated membership grants no read access');
reset role;

set local role anon;
select is(pg_temp.sqlstate_of($$select * from public.organizations$$),'42501','anon cannot read organizations');
select is(pg_temp.sqlstate_of($$select public.connect_create_organization('X','x')$$),'42501','anon cannot call privileged RPC');
reset role;

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000006',true); set local role authenticated;
select is((select count(*)::int from public.connect_create_organization('Organização C','org-c')),1,'platform admin creates organization');
select is((select count(*)::int from public.audit_events where action='organization.created'),1,'organization creation is audited');
select is((select count(*)::int from public.organization_members where user_id='a1000000-0000-4000-8000-000000000006'),1,'creator becomes organization admin');
select * from finish();
rollback;
