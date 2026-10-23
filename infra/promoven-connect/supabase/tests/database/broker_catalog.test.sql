begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.state(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return 'ok'; exception when others then return sqlstate; end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('a4000000-0000-4000-8000-000000000001','authenticated','authenticated','pc04-admin-a@test.local',now(),now(),now()),
 ('a4000000-0000-4000-8000-000000000002','authenticated','authenticated','pc04-admin-b@test.local',now(),now(),now()),
 ('a4000000-0000-4000-8000-000000000003','authenticated','authenticated','pc04-broker@test.local',now(),now(),now()),
 ('a4000000-0000-4000-8000-000000000004','authenticated','authenticated','pc04-other@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values
 ('b4000000-0000-4000-8000-000000000001','PC04 A','pc04-a'),
 ('b4000000-0000-4000-8000-000000000002','PC04 B','pc04-b');
insert into public.organization_members(organization_id,user_id,role) values
 ('b4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','organization_admin'),
 ('b4000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002','organization_admin');
insert into public.projects(id,organization_id,name,slug,public_slug,city,state,status,broker_price_visible) values
 ('c4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','Catálogo A','catalogo-a','pc04-catalogo-a','São Paulo','SP','published',false),
 ('c4000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000002','Catálogo B','catalogo-b','pc04-catalogo-b','Rio','RJ','published',true),
 ('c4000000-0000-4000-8000-000000000003','b4000000-0000-4000-8000-000000000001','Rascunho A','rascunho-a','pc04-rascunho-a','São Paulo','SP','draft',true);
insert into public.units(id,organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,price_brl,status,published) values
 ('d4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','A101',1,'Apartamento',2,1,1,70.125,500000.10,'available',true),
 ('d4000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','A102',1,'Studio',1,1,0,42.500,340000.25,'reserved',true),
 ('d4000000-0000-4000-8000-000000000003','b4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','A103',2,'Apartamento',3,2,2,90.000,650000.00,'available',false),
 ('d4000000-0000-4000-8000-000000000004','b4000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000002','B201',2,'Apartamento',2,2,1,80.000,800000.50,'available',true);
insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state,verification_status)
 values('a4000000-0000-4000-8000-000000000003','PC04 Corretor','pc04-broker@test.local','11999990000','12345','SP','verified');
insert into public.project_broker_access(organization_id,project_id,broker_user_id,status,verification_status,approved_by,activated_at) values
 ('b4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000003','active','verified','a4000000-0000-4000-8000-000000000001',now()),
 ('b4000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000003','invited','pending',null,null),
 ('b4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000003','a4000000-0000-4000-8000-000000000003','active','verified','a4000000-0000-4000-8000-000000000001',now());

select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(jsonb_array_length(public.connect_broker_catalog_projects()),1,'only published and locally verified project listed');
select is((public.connect_broker_catalog_projects()->0->>'availableCount')::integer,1,'published available count only');
select is(public.connect_broker_project_detail('c4000000-0000-4000-8000-000000000001')->>'name','Catálogo A','authorized project detail');
select is(pg_temp.state($$select public.connect_broker_project_detail('c4000000-0000-4000-8000-000000000002')$$),'P0002','other organization pending review denies detail');
select is(pg_temp.state($$select public.connect_broker_project_detail('c4000000-0000-4000-8000-000000000003')$$),'P0002','draft project denied');
select is(jsonb_array_length(public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001')->'data'),2,'published units only');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001')->'data'->0->>'priceBRL') is null,true,'private price defaults hidden');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{"type":"Studio"}')->>'total')::integer,1,'typology server filter');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{"bedrooms":2,"status":"available"}')->>'total')::integer,1,'bedroom and status filters');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{"minArea":"80.000"}')->>'total')::integer,0,'area filter excludes nonpublished unit');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{}',1,0)->>'nextOffset')::integer,1,'server page has cursor offset');
select is(jsonb_array_length(public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{}',1,1)->'data'),1,'next page stays within project');
select is(pg_temp.state($$select public.connect_broker_inventory('c4000000-0000-4000-8000-000000000002')$$),'P0002','pending other project inventory denied');
select is(pg_temp.state($$select public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{"minPrice":"1.00"}')$$),'42501','hidden price cannot be filtered for inference');
select is(pg_temp.state($$select public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{"sort":"price"}')$$),'42501','hidden price cannot be sorted for inference');
select is(public.connect_broker_unit_detail('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')->>'priceBRL',null,'detail hides price');
select is(pg_temp.state($$select public.connect_broker_unit_detail('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000003')$$),'P0002','unpublished unit detail denied');
select is(pg_temp.state($$select public.connect_broker_unit_detail('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000004')$$),'P0002','foreign project unit detail denied');
select is(public.connect_set_broker_favorite('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001',true),true,'favorite saved');
select is(jsonb_array_length(public.connect_broker_favorites('c4000000-0000-4000-8000-000000000001')),1,'favorite persists');
select is(pg_temp.state($$select public.connect_set_broker_favorite('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000004',true)$$),'P0002','cannot favorite foreign unit');
select is(pg_temp.state($$select * from public.broker_favorites$$),'42501','favorites table not directly readable');
select is(pg_temp.state($$update public.units set price_brl=1 where id='d4000000-0000-4000-8000-000000000001'$$),'42501','broker cannot change inventory');
select is((public.connect_public_project('pc04-catalogo-a')->'units'->0->>'priceBRL') is null,true,'public catalog still hides private price');
reset role;

select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000004',true); set local role authenticated;
select is(jsonb_array_length(public.connect_broker_catalog_projects()),0,'uninvited user sees no catalog');
select is(pg_temp.state($$select public.connect_broker_project_detail('c4000000-0000-4000-8000-000000000001')$$),'P0002','uninvited user detail denied');
select is(pg_temp.state($$select public.connect_broker_favorites('c4000000-0000-4000-8000-000000000001')$$),'P0002','uninvited user cannot query favorites');
reset role;

select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_set_broker_price_visibility('c4000000-0000-4000-8000-000000000001',1,true)$$),'42501','other tenant cannot set price policy');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is(public.connect_set_broker_price_visibility('c4000000-0000-4000-8000-000000000001',1,true),2::bigint,'admin explicitly authorizes private price');
select is(pg_temp.state($$select public.connect_set_broker_price_visibility('c4000000-0000-4000-8000-000000000001',1,false)$$),'PT409','price policy optimistic version');
select is((select count(*)::integer from public.audit_events where action='broker.catalog_price_policy' and organization_id='b4000000-0000-4000-8000-000000000001'),1,'price policy audited');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(public.connect_broker_unit_detail('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')->>'priceBRL','500000.10','private decimal price visible after permission');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001','{"minPrice":"400000.00","sort":"price"}')->>'total')::integer,1,'price filter and sort authorized');
select is((public.connect_public_project('pc04-catalogo-a')->'units'->0->>'priceBRL') is null,true,'private price flag does not publish public price');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000002',true); set local role authenticated;
select is((select verification_status from public.connect_verify_broker((select id from public.project_broker_access where project_id='c4000000-0000-4000-8000-000000000002'),1,'verified',null)),'verified','B reviews its own project');
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c4000000-0000-4000-8000-000000000002'),2,'active','PC04')),'active','B activates access');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(jsonb_array_length(public.connect_broker_catalog_projects()),2,'two organizations only after both approvals');
select is((public.connect_broker_inventory('c4000000-0000-4000-8000-000000000002')->'data'->0->>'priceBRL'),'800000.50','B private price independent');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c4000000-0000-4000-8000-000000000001'),1,'suspended','PC04')),'suspended','A access suspended');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_broker_inventory('c4000000-0000-4000-8000-000000000001')$$),'P0002','suspension immediately blocks inventory');
select is(pg_temp.state($$select public.connect_broker_favorites('c4000000-0000-4000-8000-000000000001')$$),'P0002','favorite cannot bypass suspension');
select is(jsonb_array_length(public.connect_broker_catalog_projects()),1,'B survives A suspension');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000001',true); set local role authenticated;
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c4000000-0000-4000-8000-000000000001'),2,'revoked','PC04')),'revoked','A access revoked');
reset role;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000003',true); set local role authenticated;
select is(pg_temp.state($$select public.connect_broker_unit_detail('c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001')$$),'P0002','revocation with same JWT blocks unit detail');
select is(pg_temp.state($$select public.connect_broker_favorites('c4000000-0000-4000-8000-000000000001')$$),'P0002','favorite cannot bypass revocation');
select * from finish();
rollback;
