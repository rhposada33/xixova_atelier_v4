begin;
create extension if not exists pgtap with schema extensions;
select plan(49);
-- Exercise legacy domain logic only, under transaction-local test grants. Production entry now requires atomic outbox.
-- New mail_outbox tests separately prove these functions are NOT executable by authenticated users.
grant execute on function public.connect_create_broker_invitation(uuid,text,text,uuid),public.connect_resend_broker_invitation(uuid,bigint,text,uuid) to authenticated;
create function pg_temp.state(p_sql text) returns text language plpgsql as $$ begin execute p_sql; return 'ok'; exception when others then return sqlstate; end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 ('a3000000-0000-4000-8000-000000000001','authenticated','authenticated','pc03-admin-a@test.local',now(),now(),now()),
 ('a3000000-0000-4000-8000-000000000002','authenticated','authenticated','pc03-manager-a@test.local',now(),now(),now()),
 ('a3000000-0000-4000-8000-000000000003','authenticated','authenticated','pc03-admin-b@test.local',now(),now(),now()),
 ('a3000000-0000-4000-8000-000000000004','authenticated','authenticated','pc03-broker@test.local',now(),now(),now()),
 ('a3000000-0000-4000-8000-000000000005','authenticated','authenticated','pc03-other@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values('b3000000-0000-4000-8000-000000000001','PC03 A','pc03-a'),('b3000000-0000-4000-8000-000000000002','PC03 B','pc03-b');
insert into public.organization_members(organization_id,user_id,role) values
 ('b3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','organization_admin'),
 ('b3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002','sales_manager'),
 ('b3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000003','organization_admin');
insert into public.projects(id,organization_id,name,slug,public_slug,city,state) values
 ('c3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','A 1','a1','pc03-a1','São Paulo','SP'),
 ('c3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','A 2','a2','pc03-a2','São Paulo','SP'),
 ('c3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000002','B 1','b1','pc03-b1','Rio','RJ');

select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(pg_temp.state($$insert into public.project_broker_access(organization_id,project_id,broker_user_id) values('b3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000004')$$),'42501','direct authorization write denied');
select is((select status from public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000001','PC03-BROKER@test.local',encode(extensions.digest(repeat('a',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000001')),'pending','admin creates invitation');
select is((select count(*)::int from public.audit_events where action='broker.invited'),1,'invitation audited');
select is(pg_temp.state($$select public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000001','pc03-broker@test.local',encode(extensions.digest(repeat('z',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000002')$$),'23505','pending duplicate rejected');
select is(pg_temp.state($$select public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000003','pc03-broker@test.local',encode(extensions.digest(repeat('y',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000003')$$),'42501','admin A cannot invite in B');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is((select status from public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000002','pc03-other@test.local',encode(extensions.digest(repeat('b',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000004')),'pending','authorized manager invites');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000005',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_accept_broker_invitation(repeat('a',64))$$),'42501','wrong identity cannot accept');
select is(pg_temp.state($$select public.connect_set_broker_access(gen_random_uuid(),1,'active',null)$$),'P0002','unprivileged user cannot choose arbitrary access');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_accept_broker_invitation(repeat('a',64))$$),'22023','professional profile required');
select is((select verification_status from public.connect_upsert_broker_profile('{"displayName":"Corretor Teste","professionalEmail":"pc03-broker@test.local","professionalPhone":"11999990000","creciNumber":"12345","creciState":"SP"}')),'pending','new CRECI remains pending');
select is((select status from public.connect_accept_broker_invitation(repeat('a',64))),'invited','correct broker accepts into pending access');
select is(pg_temp.state($$select public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),1,'active',null)$$),'42501','broker cannot activate own access');
select is(pg_temp.state($$select public.connect_accept_broker_invitation(repeat('a',64))$$),'PT409','token cannot be reused');
select is(jsonb_array_length(public.connect_broker_projects()),0,'pending verification grants no private project');
select is((select count(*)::int from public.projects),0,'broker cannot query base projects');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_verify_broker((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),1,'verified',null)$$),'42501','manager cannot verify CRECI');
select is(pg_temp.state($$select public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),1,'active',null)$$),'42501','manager cannot activate pending CRECI');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select version from public.connect_verify_broker((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),1,'verified',null)),2::bigint,'admin verifies manually');
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),2,'active',null)),'active','access explicitly activated');
select is(pg_temp.state($$select public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),2,'suspended',null)$$),'PT409','stale access version conflicts');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_broker_projects()),1,'broker sees one approved project');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),3,'revoked',null)$$),'P0002','other tenant cannot resolve or manage access');
select is((select status from public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000003','pc03-broker@test.local',encode(extensions.digest(repeat('c',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000005')),'pending','other organization independently invites broker');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is((select status from public.connect_accept_broker_invitation(repeat('c',64))),'invited','same broker accepts second organization');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000003'),1,'active',null)$$),'42501','global profile review does not approve B project');
select is((select verification_status from public.connect_verify_broker((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000003'),1,'verified',null)),'verified','B reviews its own access');
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000003'),2,'active',null)),'active','verified broker activated in second organization');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_broker_projects()),2,'broker sees two authorized organizations');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000002','pc03-broker@test.local',encode(extensions.digest(repeat('f',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000008')),'pending','A invites broker to second project');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is((select status from public.connect_accept_broker_invitation(repeat('f',64))),'invited','broker accepts second A project');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.connect_verify_broker((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000002'),1,'rejected','Revisão local')),'revoked','rejection closes only this project access');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_broker_projects()),2,'rejection of A2 preserves A1 and B1');
select is((select verification_status from public.broker_profiles where user_id=auth.uid()),'verified','global profile remains verified after scoped rejection');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000001'),3,'revoked','Fim do vínculo')),'revoked','revocation committed');
select is((select count(*)::int from public.audit_events where organization_id='b3000000-0000-4000-8000-000000000001' and action='broker.access_changed'),2,'confirmed A access transitions audited');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_broker_projects()),1,'revocation removes project immediately');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000003',true);set local role authenticated;
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000003'),3,'suspended','Pausa')),'suspended','suspension committed');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_broker_projects()),0,'suspension blocks private access');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000003',true);set local role authenticated;
select is((select status from public.connect_set_broker_access((select id from public.project_broker_access where project_id='c3000000-0000-4000-8000-000000000003'),4,'active','Retorno')),'active','verified access can be reactivated');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000004',true);set local role authenticated;
select is(jsonb_array_length(public.connect_broker_projects()),1,'reactivated project returns');
select is((select verification_status from public.connect_upsert_broker_profile('{"displayName":"Corretor Atualizado","professionalEmail":"pc03-broker@test.local","professionalPhone":"11999990000","creciNumber":"54321","creciState":"SP"}')),'pending','CRECI change resets verification');
select is(jsonb_array_length(public.connect_broker_projects()),0,'pending CRECI blocks formerly active access');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(pg_temp.state($$select token_hash from public.broker_invitations limit 1$$),'42501','token hash is not selectable by managers');
select is((select status from public.connect_resend_broker_invitation((select id from public.broker_invitations where project_id='c3000000-0000-4000-8000-000000000002' and status='pending'),1,encode(extensions.digest(repeat('d',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000006')),'pending','resend rotates invitation token');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000005',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_accept_broker_invitation(repeat('b',64))$$),'PT409','rotated old token rejected');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.connect_cancel_broker_invitation((select id from public.broker_invitations where project_id='c3000000-0000-4000-8000-000000000002' and status='pending'),1)),'cancelled','new invitation can be cancelled');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000005',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_accept_broker_invitation(repeat('d',64))$$),'PT409','cancelled invitation cannot be accepted');
reset role;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.connect_create_broker_invitation('c3000000-0000-4000-8000-000000000002','pc03-other@test.local',encode(extensions.digest(repeat('e',64),'sha256'),'hex'),'d3000000-0000-4000-8000-000000000007')),'pending','fresh invitation for expiry test');
reset role;
update public.broker_invitations set expires_at=now()-interval '1 hour' where operation_id='d3000000-0000-4000-8000-000000000007';
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000005',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_accept_broker_invitation(repeat('e',64))$$),'PT409','expired invitation rejected');
select * from finish();
rollback;
