begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.state(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return 'ok'; exception when others then return sqlstate; end $$;
create function pg_temp.link_id() returns uuid language sql security definer set search_path='' as $$ select id from public.broker_links where token_hash=repeat('a',64) $$;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('a5100000-0000-4000-8000-000000000001','authenticated','authenticated','pc05b-admin-a@test.local',now(),now(),now()),
 ('a5100000-0000-4000-8000-000000000002','authenticated','authenticated','pc05b-admin-b@test.local',now(),now(),now()),
 ('a5100000-0000-4000-8000-000000000003','authenticated','authenticated','pc05b-broker@test.local',now(),now(),now()),
 ('a5100000-0000-4000-8000-000000000004','authenticated','authenticated','pc05b-other-broker@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values
 ('b5100000-0000-4000-8000-000000000001','Links A','pc05b-links-a'),('b5100000-0000-4000-8000-000000000002','Links B','pc05b-links-b');
insert into public.organization_members(organization_id,user_id,role) values
 ('b5100000-0000-4000-8000-000000000001','a5100000-0000-4000-8000-000000000001','organization_admin'),
 ('b5100000-0000-4000-8000-000000000002','a5100000-0000-4000-8000-000000000002','organization_admin');
insert into public.projects(id,organization_id,name,slug,public_slug,city,state,status) values
 ('c5100000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-000000000001','Links A','links-a','pc05b-links-a','São Paulo','SP','published'),
 ('c5100000-0000-4000-8000-000000000002','b5100000-0000-4000-8000-000000000002','Links B','links-b','pc05b-links-b','Rio','RJ','published');
insert into public.units(id,organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,price_brl,status,published) values
 ('d5100000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-000000000001','c5100000-0000-4000-8000-000000000001','A101',1,'Apartamento',2,1,1,70,500000,'available',true),
 ('d5100000-0000-4000-8000-000000000002','b5100000-0000-4000-8000-000000000001','c5100000-0000-4000-8000-000000000001','A102',1,'Apartamento',2,1,1,70,600000,'available',false);
insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state,verification_status)
 values('a5100000-0000-4000-8000-000000000003','Corretor PC05','pc05b-broker@test.local','11999990000','12345','SP','verified'),
 ('a5100000-0000-4000-8000-000000000004','Outro Corretor','pc05b-other-broker@test.local','11999990001','54321','SP','verified');
insert into public.project_broker_access(id,organization_id,project_id,broker_user_id,status,verification_status,approved_by,activated_at)
 values('e5100000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-000000000001','c5100000-0000-4000-8000-000000000001','a5100000-0000-4000-8000-000000000003','active','verified','a5100000-0000-4000-8000-000000000001',now());

set local role anon;
select is(pg_temp.state($$select public.connect_onboarding('b5100000-0000-4000-8000-000000000001')$$),'42501','anonymous denied onboarding');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_onboarding('b5100000-0000-4000-8000-000000000001')$$),'42501','other tenant denied onboarding');
select is(pg_temp.state($$select public.connect_add_member_by_email('b5100000-0000-4000-8000-000000000001','pc05b-other-broker@test.local','sales_manager')$$),'42501','other tenant cannot provision member');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((public.connect_onboarding('b5100000-0000-4000-8000-000000000001')->>'administrators')::int,1,'count real administrators');
select is(jsonb_array_length(public.connect_onboarding('b5100000-0000-4000-8000-000000000001')->'projects'),1,'only tenant projects');
select is((public.connect_onboarding('b5100000-0000-4000-8000-000000000001')->'projects'->0->>'units')::int,2,'real unit count');
select is(pg_temp.state($$select public.connect_add_member_by_email('b5100000-0000-4000-8000-000000000001','missing@test.local','sales_manager')$$),'P0002','missing account handled');
select is(pg_temp.state($$select public.connect_add_member_by_email('b5100000-0000-4000-8000-000000000001','pc05b-other-broker@test.local','platform_admin')$$),'22023','platform escalation rejected');
select is(public.connect_add_member_by_email('b5100000-0000-4000-8000-000000000001',' PC05B-OTHER-BROKER@test.local ','sales_manager')->>'role','sales_manager','normalized account added');
select is(pg_temp.state($$select public.connect_add_member_by_email('b5100000-0000-4000-8000-000000000001','pc05b-other-broker@test.local','sales_manager')$$),'23505','duplicate member rejected');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000004',true);set local role authenticated;
select is((public.connect_onboarding('b5100000-0000-4000-8000-000000000001')->>'administrators')::int,1,'manager can read progress');
select is(pg_temp.state($$select public.connect_add_member_by_email('b5100000-0000-4000-8000-000000000001','missing@test.local','sales_manager')$$),'42501','manager cannot add members or enumerate accounts');
reset role;
update public.organization_members set active=false where user_id='a5100000-0000-4000-8000-000000000004';
set local role authenticated;
select is(pg_temp.state($$select public.connect_onboarding('b5100000-0000-4000-8000-000000000001')$$),'42501','removed member loses progress access');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_onboarding('b5100000-0000-4000-8000-000000000001')$$),'42501','broker cannot inspect tenant onboarding');
select * from finish();
rollback;
