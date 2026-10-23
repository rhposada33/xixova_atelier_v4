begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.state(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return 'ok'; exception when others then return sqlstate; end $$;
create function pg_temp.asset_id() returns uuid language sql security definer set search_path='' as $$ select id from public.project_assets where media_role='cover' and project_id='c5000000-0000-4000-8000-000000000001' limit 1 $$;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('a5000000-0000-4000-8000-000000000001','authenticated','authenticated','pc05-admin-a@test.local',now(),now(),now()),
 ('a5000000-0000-4000-8000-000000000002','authenticated','authenticated','pc05-admin-b@test.local',now(),now(),now()),
 ('a5000000-0000-4000-8000-000000000003','authenticated','authenticated','pc05-broker@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values
 ('b5000000-0000-4000-8000-000000000001','Media A','pc05-media-a'),
 ('b5000000-0000-4000-8000-000000000002','Media B','pc05-media-b');
insert into public.organization_members(organization_id,user_id,role) values
 ('b5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','organization_admin'),
 ('b5000000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000002','organization_admin');
insert into public.projects(id,organization_id,name,slug,public_slug,city,state,status,visibility) values
 ('c5000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','Media A','media-a','pc05-media-a','São Paulo','SP','published','{"description":false,"unitFeatures":false,"price":false,"images":true,"floorPlans":false,"availability":false}'::jsonb),
 ('c5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000002','Media B','media-b','pc05-media-b','Rio','RJ','published','{"description":false,"unitFeatures":false,"price":false,"images":false,"floorPlans":false,"availability":false}'::jsonb);
insert into public.units(id,organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,status,published)
 values('d5000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','A101',1,'Apartamento',2,1,1,70,'available',true);
insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state,verification_status)
 values('a5000000-0000-4000-8000-000000000003','Corretor','pc05-broker@test.local','11999990000','12345','SP','verified');
insert into public.project_broker_access(organization_id,project_id,broker_user_id,status,verification_status,approved_by,activated_at)
 values('b5000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000003','active','verified','a5000000-0000-4000-8000-000000000001',now());

select is((select public from storage.buckets where id='connect-media-private'),false,'Connect bucket is private');
select is((select max_file_bytes from public.connect_media_limits where id=true),5242880::bigint,'configurable per-project media policy installed');
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_reserve_media('c5000000-0000-4000-8000-000000000001',null,'cover','image/png',2048,repeat('a',64))$$),'42501','other tenant cannot reserve upload');
select is(pg_temp.state($$insert into storage.objects(bucket_id,name) values('connect-media-private','forged.png')$$),'42501','direct Storage upload denied');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_reserve_media('c5000000-0000-4000-8000-000000000001',null,'cover','image/png',2048,repeat('a',64))$$),'42501','broker cannot reserve upload');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_reserve_media('c5000000-0000-4000-8000-000000000001',null,'cover','application/pdf',2048,repeat('a',64))$$),'22023','PDF rejected');
select is(pg_temp.state($$select public.connect_reserve_media('c5000000-0000-4000-8000-000000000001',null,'cover','image/png',6000000,repeat('a',64))$$),'22023','file limit enforced');
select is(pg_temp.state($$select public.connect_reserve_media('c5000000-0000-4000-8000-000000000001',null,'floor_plan','image/png',2048,repeat('a',64))$$),'22023','floor plan requires unit');
select is(pg_temp.state($$select public.connect_reserve_media('c5000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','cover','image/png',2048,repeat('a',64))$$),'22023','cover must be project asset');
select is((public.connect_reserve_media('c5000000-0000-4000-8000-000000000001',null,'cover','image/png',2048,repeat('a',64))).upload_state,'pending','authorized asset reserved');
select is(pg_temp.state($$select public.connect_finish_media(pg_temp.asset_id())$$),'PT409','cannot finish without Storage object');
reset role;
insert into storage.objects(bucket_id,name) select 'connect-media-private',storage_path from public.project_assets where media_role='cover' and project_id='c5000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((public.connect_finish_media(pg_temp.asset_id())).upload_state,'ready','Storage object permits finalize');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(public.connect_private_media_allowed(pg_temp.asset_id()),false,'broker cannot sign unpublished media');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((public.connect_publish_media(pg_temp.asset_id(),2,true)).published,true,'admin explicitly publishes');
select is(pg_temp.state($$select public.connect_publish_media(pg_temp.asset_id(),2,false)$$),'PT409','optimistic media version');
select is((select count(*)::int from public.audit_events where organization_id='b5000000-0000-4000-8000-000000000001' and action in ('media.reserved','media.uploaded','media.published')),3,'media lifecycle audited');
reset role;
set local role anon;
select is(public.connect_public_media_allowed(pg_temp.asset_id()),true,'public can request published cover');
select is(jsonb_array_length(public.connect_public_media_manifest('c5000000-0000-4000-8000-000000000001')),1,'public manifest lists published cover');
select is((select count(*)::integer from storage.objects where bucket_id='connect-media-private'),0,'public cannot list Storage objects');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(public.connect_private_media_allowed(pg_temp.asset_id()),true,'active broker can request media');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access limit 1),1,'revoked','PC05')),'revoked','broker revoked');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(public.connect_private_media_allowed(pg_temp.asset_id()),false,'revoked broker denied new private URL');
reset role;
select set_config('request.jwt.claim.sub','a5000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((public.connect_delete_media(pg_temp.asset_id(),3)).upload_state,'deleted','asset tombstoned');
reset role;
set local role anon;
select is(public.connect_public_media_allowed(pg_temp.asset_id()),false,'deleted asset no longer signs');
select * from finish();
rollback;
