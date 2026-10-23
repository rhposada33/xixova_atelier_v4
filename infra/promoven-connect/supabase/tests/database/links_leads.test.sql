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
select is(jsonb_array_length(public.connect_public_project('pc05b-links-a')->'units'),1,'public only sees published units');
select is((public.connect_public_project('pc05b-links-a')->'units'->0) ? 'priceBRL',false,'public price hidden without explicit visibility');
select is(public.connect_public_unit('pc05b-links-a','A102'),null::jsonb,'unpublished unit unavailable');
select is(public.connect_public_share(repeat('a',64)),null::jsonb,'unknown share token is unavailable');
select is(public.connect_public_share('malformed'),null::jsonb,'malformed share token is unavailable');
select is(pg_temp.state($$select public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000001',null,repeat('a',64),now()+interval '1 day')$$),'42501','anonymous cannot create link');
select is(pg_temp.state($$select * from public.leads$$),'42501','anonymous cannot read leads table');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000001',null,repeat('a',64),now()+interval '1 day')$$),'42501','broker cannot call privileged link creation directly');
reset role;
set local role service_role;
select is(pg_temp.state($$select public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000002',null,repeat('a',64),now()+interval '1 day')$$),'42501','service cannot create cross-project link without access');
select is(pg_temp.state($$select public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000001','d5100000-0000-4000-8000-000000000002',repeat('a',64),now()+interval '1 day')$$),'P0002','unpublished unit cannot be linked');
select is((public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000001','d5100000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '1 day')->>'status'),'active','verified broker link created');
reset role;
set local role anon;
select is(public.connect_public_share(repeat('a',64))->>'unitCode','A101','share resolves authorized unit');
select is(public.connect_public_share(repeat('a',64))->'broker'->>'name','Corretor PC05','only professional broker identity shown');
select is((public.connect_public_share(repeat('a',64))->'broker') ? 'professionalEmail',false,'broker contact not exposed');
select is(public.connect_public_share(repeat('a',64))->'project'->'units'->0 ? 'priceBRL',false,'share cannot reveal hidden public price');
reset role;
set local role service_role;
select is((public.connect_submit_interest(repeat('a',64),null,'{"buyerName":"Comprador Teste","contactChannel":"email","contactValue":"buyer@test.local","message":"Olá","unitCode":"A101","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000001',repeat('b',64))->>'status'),'accepted','broker interest accepted');
select is((public.connect_submit_interest(repeat('a',64),null,'{"buyerName":"Comprador Teste","contactChannel":"email","contactValue":"buyer@test.local","message":"Olá","unitCode":"A101","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000001',repeat('b',64))->>'status'),'accepted','identical retry accepted');
reset role;
select is((select count(*)::int from public.leads where organization_id='b5100000-0000-4000-8000-000000000001'),1,'retry produces one lead');
select is((select count(*)::int from public.lead_attributions a join public.leads l on l.id=a.lead_id where l.project_id='c5100000-0000-4000-8000-000000000001'),1,'attribution stored exactly once');
set local role service_role;
select is(pg_temp.state($$select public.connect_submit_interest(repeat('a',64),null,'{"buyerName":"Outro Nome","contactChannel":"email","contactValue":"buyer@test.local","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000001',repeat('c',64))$$),'PT409','idempotency key collision rejected');
select is((public.connect_submit_interest(null,'pc05b-links-a','{"buyerName":"Comprador Público","contactChannel":"phone","contactValue":"11999990000","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000002',repeat('d',64))->>'status'),'accepted','public project interest accepted');
reset role;
select is((select count(*)::int from public.lead_attributions a join public.leads l on l.id=a.lead_id where l.project_id='c5100000-0000-4000-8000-000000000001'),1,'public lead has no broker attribution');
set local role service_role;
select is(pg_temp.state($$select public.connect_submit_interest(null,'pc05b-links-a','{"buyerName":"Comprador Público","contactChannel":"phone","contactValue":"11999990000","unitCode":"A102","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000003',repeat('e',64))$$),'P0002','unpublished unit rejects interest');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(jsonb_array_length(public.connect_leads('b5100000-0000-4000-8000-000000000001')),0,'other tenant admin cannot see leads');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(jsonb_array_length(public.connect_leads(null)),1,'broker sees only own attributed lead');
select is((public.connect_broker_links()->0) ? 'token_hash',false,'link listing omits token hash');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_leads(null)),0,'other broker sees no attributed lead');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(jsonb_array_length(public.connect_leads('b5100000-0000-4000-8000-000000000001')),2,'organization admin sees both leads');
select is(pg_temp.state($$select public.connect_revoke_broker_link(pg_temp.link_id(),2)$$),'PT409','optimistic link revoke checks version');
select is((public.connect_revoke_broker_link(pg_temp.link_id(),1)->>'status'),'revoked','admin revokes link');
reset role;
set local role anon;
select is(public.connect_public_share(repeat('a',64)),null::jsonb,'revoked link disappears');
reset role;
set local role service_role;
select is(pg_temp.state($$select public.connect_submit_interest(repeat('a',64),null,'{"buyerName":"Novo Comprador","contactChannel":"email","contactValue":"new@test.local","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000004',repeat('f',64))$$),'P0002','revoked link rejects new interest');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(jsonb_array_length(public.connect_leads(null)),1,'historical broker lead retained after link revoke while access remains');
reset role;
set local role service_role;
select is((public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000001',null,repeat('c',64),now()+interval '1 day')->>'status'),'active','second link created for suspension test');
select is((public.connect_create_broker_link('a5100000-0000-4000-8000-000000000003','c5100000-0000-4000-8000-000000000001',null,repeat('d',64),now()+interval '1 day')->>'status'),'active','expiry test link created');
reset role;
update public.broker_links set expires_at=now()-interval '1 second' where token_hash=repeat('d',64);
set local role anon;
select is(public.connect_public_share(repeat('d',64)),null::jsonb,'expired token is unavailable');
reset role;
select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.connect_set_broker_access('e5100000-0000-4000-8000-000000000001',1,'suspended','PC05')),'suspended','broker access suspended');
reset role;
set local role anon;
select is(public.connect_public_share(repeat('c',64)),null::jsonb,'suspended access invalidates active link');
reset role;
set local role service_role;
select is(pg_temp.state($$select public.connect_submit_interest(repeat('c',64),null,'{"buyerName":"Novo Comprador","contactChannel":"email","contactValue":"new@test.local","privacyNoticeVersion":"2026-10-23"}'::jsonb,'f5100000-0000-4000-8000-000000000005',repeat('1',64))$$),'P0002','suspended link rejects new attribution');
reset role;
update public.projects set visibility=jsonb_set(visibility,'{price}','true'::jsonb) where id='c5100000-0000-4000-8000-000000000001';
set local role anon;
select is(public.connect_public_project('pc05b-links-a')->'units'->0 ? 'priceBRL',true,'explicit public price visibility exposes price');
reset role;
update public.organizations set status='suspended' where id='b5100000-0000-4000-8000-000000000001';
set local role anon;
select is(public.connect_public_project('pc05b-links-a'),null::jsonb,'suspended organization has no public catalog');
reset role;
select * from finish();
rollback;
