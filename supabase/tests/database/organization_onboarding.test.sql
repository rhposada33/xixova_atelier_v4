begin;
create extension if not exists pgtap with schema extensions;
select plan(48);
create function pg_temp.err(p_sql text) returns text language plpgsql as $$declare d text;begin execute p_sql;return null;exception when others then get stacked diagnostics d=pg_exception_detail;begin return (d::jsonb)->>'code';exception when others then return sqlstate;end;end$$;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('41000000-0000-4000-8000-000000000001','authenticated','authenticated','platform@test.local',now(),now(),now()),
('41000000-0000-4000-8000-000000000002','authenticated','authenticated','admin@test.local',now(),now(),now()),
('41000000-0000-4000-8000-000000000003','authenticated','authenticated','second@test.local',now(),now(),now()),
('41000000-0000-4000-8000-000000000004','authenticated','authenticated','viewer@test.local',now(),now(),now()),
('41000000-0000-4000-8000-000000000005','authenticated','authenticated','escobar-admin@test.local',now(),now(),now()),
('41000000-0000-4000-8000-000000000006','authenticated','authenticated','seller@test.local',now(),now(),now());
insert into public.platform_admins(user_id) values('41000000-0000-4000-8000-000000000001');
insert into public.organization_members(organization_id,user_id,role) values('00000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000005','organization_admin');
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.admin_create_organization('Cliente Novo','Cliente Novo SA','cliente-novo','BR','SP','São Paulo','America/Sao_Paulo','BRL')),'draft','new organization starts draft');
select is((select count(*)::int from public.units),72,'onboarding migration preserves 72 units');
select is((select status from public.organizations where slug='escobar'),'active','Escobar remains active');
select is((select version from public.organizations where slug='escobar'),1::bigint,'legacy organization receives version one');
select is((select count(*)::int from public.organization_members where organization_id='00000000-0000-4000-8000-000000000001' and role='organization_admin' and active),1,'local Escobar fixture has an explicit organization admin');
select is(pg_temp.err($$select public.admin_change_organization_status((select id from public.organizations where slug='cliente-novo'),1,'active','Onboarding concluído')$$),'last_admin_required','draft cannot activate without admin');
reset role;

insert into public.organization_members(organization_id,user_id,role) select id,'41000000-0000-4000-8000-000000000002','organization_admin' from public.organizations where slug='cliente-novo';
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select status from public.admin_change_organization_status((select id from public.organizations where slug='cliente-novo'),1,'active','Administrador confirmado')),'active','configured draft activates with admin');
select is(pg_temp.err($$select public.admin_change_organization_status((select id from public.organizations where slug='cliente-novo'),1,'suspended','Teste')$$),'version_conflict','organization mutations require expected version');
select is((select status from public.admin_change_organization_status((select id from public.organizations where slug='cliente-novo'),2,'suspended','Pausa comercial')),'suspended','platform admin suspends organization');
select is((select status from public.admin_change_organization_status((select id from public.organizations where slug='cliente-novo'),3,'active','Retomar operação')),'active','reactivation validates admin');
reset role;

select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_update_membership((select id from public.organizations where slug='cliente-novo'),'41000000-0000-4000-8000-000000000002',1,'viewer',true,false)$$),'last_admin_required','last active admin cannot be demoted');
select is(pg_temp.err($$select public.admin_create_organization('X','','x','BR','','','America/Sao_Paulo','BRL')$$),'forbidden','organization admin cannot create organizations');
select is((select count(*)::int from public.admin_list_members((select id from public.organizations where slug='cliente-novo'),1,25)),1,'organization admin lists own members');
select is(pg_temp.err($$select * from public.admin_list_members('00000000-0000-4000-8000-000000000001',1,25)$$),'not_found','organization admin cannot inspect another organization');
select ok((select (public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'new.user@test.local','viewer',repeat('a',43),'51000000-0000-4000-8000-000000000001')).status='pending_delivery'),'manager prepares invitation');
select is((select count(*)::int from public.admin_audit_logs where action='invitation.created'),1,'invitation creation is audited without email');
select ok(not exists(select 1 from public.admin_audit_logs where old_values::text like '%new.user%' or new_values::text like '%new.user%'),'audit excludes invitation email');
select is((select count(*)::int from public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'new.user@test.local','viewer',repeat('b',43),'51000000-0000-4000-8000-000000000001')),1,'repeated operation id is idempotent');
select is((select count(*)::int from public.organization_invitations),1,'idempotency creates one invitation');
select is(pg_temp.err($$select public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'new.user@test.local','viewer',repeat('c',44),'51000000-0000-4000-8000-000000000099')$$),'invitation_exists','concurrent operation cannot create a second current invitation');
reset role;

select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000005',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_update_membership('00000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000005',1,'viewer',true,false)$$),'last_admin_required','Escobar last admin cannot be demoted');
select is(pg_temp.err($$select public.admin_update_membership('00000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000005',1,'organization_admin',false,false)$$),'last_admin_required','Escobar last admin cannot be suspended');
select is(pg_temp.err($$select public.admin_update_membership('00000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000005',1,'organization_admin',true,true)$$),'last_admin_required','Escobar last admin cannot be removed');
reset role;

insert into public.organization_members(organization_id,user_id,role) select id,'41000000-0000-4000-8000-000000000003','organization_admin' from public.organizations where slug='cliente-novo';
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);set local role authenticated;
select lives_ok($$select public.admin_update_membership((select id from public.organizations where slug='cliente-novo'),'41000000-0000-4000-8000-000000000002',1,'viewer',true,false)$$,'admin can demote after transfer');
select throws_ok($$insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,performed_by) values(null,'organization',gen_random_uuid(),'x','41000000-0000-4000-8000-000000000001')$$,'42501','permission denied for table admin_audit_logs','direct audit insert denied');
select throws_ok($$delete from public.admin_audit_logs$$,'42501','permission denied for table admin_audit_logs','direct audit delete denied');
select throws_ok($$update public.organization_members set role='organization_admin'$$,'42501','permission denied for table organization_members','direct membership update denied');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select count(*)::int from public.admin_audit_logs where resource_type='membership'),1,'membership change audited');
select is((select count(*)::int from public.admin_list_organizations(1,100,null,'active')),2,'platform listing remains remote and deterministic');
select is((select count(*)::int from public.admin_audit_logs where resource_type='organization'),4,'organization lifecycle is audited');
reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select ok(public.admin_claim_invitation_delivery((select id from public.organization_invitations where email_normalized='new.user@test.local'),'41000000-0000-4000-8000-000000000002'),'server claims the first cross-system delivery attempt');
select is(public.admin_claim_invitation_delivery((select id from public.organization_invitations where email_normalized='new.user@test.local'),'41000000-0000-4000-8000-000000000002'),false,'repeated request cannot claim or resend an ambiguous delivery');
select is((select (public.admin_mark_invitation_delivery((select id from public.organization_invitations where email_normalized='new.user@test.local'),true,null,'41000000-0000-4000-8000-000000000002')).status),'sent','delivery confirmation is a separate transition');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","email":"platform@test.local","role":"authenticated"}',true);set local role authenticated;
select is((select (public.admin_revoke_invitation((select id from public.organization_invitations where email_normalized='new.user@test.local'),3,'Convite substituído')).status),'revoked','sent invitation can be revoked logically');
select ok((select (public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'viewer@test.local','viewer',encode(extensions.digest('opaque-local-token-abcdefghijklmnopqrstuvwxyz','sha256'),'base64'),'51000000-0000-4000-8000-000000000002')).status='pending_delivery'),'acceptance fixture prepared with hashed token');
reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.admin_claim_invitation_delivery((select id from public.organization_invitations where email_normalized='viewer@test.local'),'41000000-0000-4000-8000-000000000001');
select is((select (public.admin_mark_invitation_delivery((select id from public.organization_invitations where email_normalized='viewer@test.local'),true,null,'41000000-0000-4000-8000-000000000001')).status),'sent','acceptance fixture marked sent');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000004","email":"viewer@test.local","role":"authenticated"}',true);set local role authenticated;
select is((select role from public.accept_organization_invitation('opaque-local-token-abcdefghijklmnopqrstuvwxyz')),'viewer','verified matching email accepts invitation');
select is(pg_temp.err($$select * from public.accept_organization_invitation('opaque-local-token-abcdefghijklmnopqrstuvwxyz')$$),'invalid_invitation','single-use token cannot be reused');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","email":"platform@test.local","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.admin_mark_invitation_delivery(gen_random_uuid(),true,null,'41000000-0000-4000-8000-000000000001')$$,'42501','permission denied for function admin_mark_invitation_delivery','browser roles cannot forge delivery state');
reset role;insert into private.invitation_rate_limits values('actor_hour','41000000-0000-4000-8000-000000000001',date_trunc('hour',now()),20) on conflict(scope_type,scope_id,window_started_at) do update set attempt_count=20;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","email":"platform@test.local","role":"authenticated"}',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'limit-actor@test.local','viewer',repeat('x',44),gen_random_uuid())$$),'rate_limited','actor limit is 20 invitations per hour');
reset role;delete from private.invitation_rate_limits where scope_type='actor_hour' and scope_id='41000000-0000-4000-8000-000000000001';insert into private.invitation_rate_limits select 'organization_day',id,date_trunc('day',now()),100 from public.organizations where slug='cliente-novo' on conflict(scope_type,scope_id,window_started_at) do update set attempt_count=100;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","email":"platform@test.local","role":"authenticated"}',true);set local role authenticated;
select is(pg_temp.err($$select public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'limit-org@test.local','viewer',repeat('y',44),gen_random_uuid())$$),'rate_limited','organization limit is 100 invitations per day');
reset role;delete from private.invitation_rate_limits;insert into public.organization_members(organization_id,user_id,role) select id,'41000000-0000-4000-8000-000000000006','seller' from public.organizations where slug='cliente-novo';
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","email":"platform@test.local","role":"authenticated"}',true);set local role authenticated;
select ok((select (public.admin_prepare_invitation((select id from public.organizations where slug='cliente-novo'),'delivery-failure@test.local','viewer',repeat('z',44),'51000000-0000-4000-8000-000000000003')).status='pending_delivery'),'delivery failure fixture is prepared');
reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select ok(public.admin_claim_invitation_delivery((select id from public.organization_invitations where email_normalized='delivery-failure@test.local'),'41000000-0000-4000-8000-000000000001'),'failed delivery was claimed once');
select is((select (public.admin_mark_invitation_delivery((select id from public.organization_invitations where email_normalized='delivery-failure@test.local'),false,'auth_delivery_failed','41000000-0000-4000-8000-000000000001')).status),'delivery_failed','failed cross-system delivery remains recorded');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","email":"platform@test.local","role":"authenticated"}',true);set local role authenticated;
select is((select (public.admin_retry_invitation((select id from public.organization_invitations where email_normalized='delivery-failure@test.local'),3,repeat('r',44),'51000000-0000-4000-8000-000000000004')).status),'pending_delivery','authorized retry rotates operation and returns to pending delivery');
reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select ok(public.admin_claim_invitation_delivery((select id from public.organization_invitations where email_normalized='delivery-failure@test.local'),'41000000-0000-4000-8000-000000000001'),'manual retry can claim exactly one new attempt');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000006',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000006","email":"seller@test.local","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::int from public.organization_invitations),0,'seller cannot read invitation emails');
reset role;select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000004","email":"viewer@test.local","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::int from public.organization_invitations),0,'viewer cannot read invitation emails');
select * from finish();rollback;
