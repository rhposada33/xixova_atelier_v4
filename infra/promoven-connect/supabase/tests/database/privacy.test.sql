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

insert into public.leads(id,organization_id,project_id,buyer_name,contact_channel,contact_value,source,privacy_notice_version) values ('f6100000-0000-4000-8000-000000000001','b5100000-0000-4000-8000-000000000001','c5100000-0000-4000-8000-000000000001','CRM Buyer','email','crm@test.local','public','2026-10-23');

set local role anon;
select is(pg_temp.state($$select public.connect_privacy('f6100000-0000-4000-8000-000000000001','request','TEST-001')$$),'42501','anonymous denied');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_privacy('f6100000-0000-4000-8000-000000000001','request','TEST-001')$$),'42501','other tenant denied');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);set local role authenticated;
select ok(public.connect_privacy('f6100000-0000-4000-8000-000000000001','request','TEST-001') ? 'requestId','request recorded');
select is(pg_temp.state($$select public.connect_privacy('f6100000-0000-4000-8000-000000000001','approved','TEST-001')$$),'42501','self approval denied');
select is(pg_temp.state($$select public.connect_privacy('f6100000-0000-4000-8000-000000000001','export','TEST-001')$$),'42501','unapproved export denied');
reset role;
insert into public.organization_members(organization_id,user_id,role) values('b5100000-0000-4000-8000-000000000001','a5100000-0000-4000-8000-000000000004','organization_admin');
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(public.connect_privacy('f6100000-0000-4000-8000-000000000001','approved','TEST-001')->>'decision','approved','independent approval');
select ok(public.connect_privacy('f6100000-0000-4000-8000-000000000001','export','TEST-001') ? 'activities','authorized export includes history');
select is(pg_temp.state($$select public.connect_privacy('f6100000-0000-4000-8000-000000000001','erase','TEST-001')$$),'55000','erasure remains fail closed');
select * from finish();rollback;
