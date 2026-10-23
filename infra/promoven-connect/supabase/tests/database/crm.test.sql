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
select is(pg_temp.state($$select public.connect_crm_lead('f6100000-0000-4000-8000-000000000001')$$),'42501','anonymous denied CRM');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_crm_lead('f6100000-0000-4000-8000-000000000001')$$),'42501','other tenant denied detail');
select is((public.connect_crm_list('{"organizationId":"b5100000-0000-4000-8000-000000000001"}')->>'total')::int,0,'other tenant list empty');
select is((public.connect_crm_analytics('{"organizationId":"b5100000-0000-4000-8000-000000000001"}')->>'received')::int,0,'other tenant analytics empty');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(public.connect_crm_change('f6100000-0000-4000-8000-000000000001',1,'status','{"status":"contacted"}')->>'status','contacted','manager changes stage');
select is(pg_temp.state($$select public.connect_crm_change('f6100000-0000-4000-8000-000000000001',1,'status','{"status":"qualified"}')$$),'PT409','stale update returns conflict');
select is(pg_temp.state($$select public.connect_crm_change('f6100000-0000-4000-8000-000000000001',2,'status','{"status":"qualified","organization_id":"forged"}')$$),'22023','forged tenant field denied');
select is((public.connect_crm_change('f6100000-0000-4000-8000-000000000001',2,'activity','{"type":"note_added","note":"Synthetic note"}')->>'version')::int,3,'note appended');
select is((public.connect_crm_change('f6100000-0000-4000-8000-000000000001',3,'schedule','{"nextAction":"Call","followUpAt":"2026-10-22T10:00:00Z"}')->>'version')::int,4,'follow up scheduled');
select is(public.connect_crm_lead('f6100000-0000-4000-8000-000000000001')->>'next_action','Call','follow up persisted');
select is((public.connect_crm_change('f6100000-0000-4000-8000-000000000001',4,'complete')->>'version')::int,5,'follow up completed');
select is(pg_temp.state($$select public.connect_crm_change('f6100000-0000-4000-8000-000000000001',5,'status','{"status":"won"}')$$),'22023','closing requires reason');
select is(public.connect_crm_change('f6100000-0000-4000-8000-000000000001',5,'status','{"status":"won","reason":"Synthetic completion"}')->>'status','won','closure persisted');
select is(jsonb_array_length(public.connect_crm_history('f6100000-0000-4000-8000-000000000001')),5,'history contains every successful change');
select is(pg_temp.state($$update public.lead_activities set detail='{}'::jsonb$$),'42501','history update denied');
select is(pg_temp.state($$update public.lead_attributions set broker_user_id=auth.uid()$$),'42501','attribution update denied');
select is((public.connect_crm_change('f6100000-0000-4000-8000-000000000001',6,'transfer','{"userId":"a5100000-0000-4000-8000-000000000003","reason":"Assigned"}')->>'version')::int,7,'explicit operational transfer');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(public.connect_crm_lead('f6100000-0000-4000-8000-000000000001')->>'status','won','assigned broker sees authorized lead');
select is(pg_temp.state($$select public.connect_crm_change('f6100000-0000-4000-8000-000000000001',7,'status','{"status":"new","reason":"Reopen"}')$$),'42501','broker cannot reopen closed lead');
reset role;
update public.project_broker_access set status='revoked' where id='e5100000-0000-4000-8000-000000000001';
set local role authenticated;
select is(pg_temp.state($$select public.connect_crm_lead('f6100000-0000-4000-8000-000000000001')$$),'42501','revoked broker loses PII');
select is(pg_temp.state($$select public.connect_crm_change('f6100000-0000-4000-8000-000000000001',7,'activity','{"type":"note_added","note":"Forbidden"}')$$),'42501','revoked broker cannot append');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);
insert into public.leads(organization_id,project_id,buyer_name,contact_channel,contact_value,source,privacy_notice_version)
select 'b5100000-0000-4000-8000-000000000001','c5100000-0000-4000-8000-000000000001','Pagination '||n,'email','test@test.local','public','2026-10-23' from generate_series(1,25) n;
select is(pg_temp.state($$update public.lead_activities set detail='{}'::jsonb where lead_id='f6100000-0000-4000-8000-000000000001'$$),'42501','append-only trigger rejects even privileged update');
set local role authenticated;
select is(jsonb_array_length(public.connect_crm_list('{"projectId":"c5100000-0000-4000-8000-000000000001"}',0)->'items'),20,'first page bounded to 20');
select is(jsonb_array_length(public.connect_crm_list('{"projectId":"c5100000-0000-4000-8000-000000000001"}',20)->'items'),6,'second page contains remaining scoped leads');
select is((public.connect_crm_analytics('{"projectId":"c5100000-0000-4000-8000-000000000001"}')->'statuses'->>'won')::int,1,'analytics uses persisted commercial closure');
select is(public.connect_crm_analytics('{"projectId":"c5100000-0000-4000-8000-000000000001"}')::text like '%crm@test.local%',false,'analytics excludes buyer PII');
select is(pg_temp.state($$select public.connect_crm_change('f6100000-0000-4000-8000-000000000001',7,'transfer','{"userId":"a5100000-0000-4000-8000-000000000004","reason":"Unauthorized"}')$$),'42501','transfer requires project-authorized target');
select * from finish();
rollback;
