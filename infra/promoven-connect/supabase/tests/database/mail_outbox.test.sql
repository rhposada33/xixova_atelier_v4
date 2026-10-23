begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.state(q text) returns text language plpgsql as $$begin execute q;return 'ok';exception when others then return sqlstate;end$$;
select ok(not has_function_privilege('authenticated','public.connect_queue_invitation(uuid,text,uuid,text,uuid,bigint,text,uuid,jsonb)','execute'),'enqueue rejects untrusted actor impersonation');
select ok(not has_function_privilege('authenticated','public.connect_create_broker_invitation(uuid,text,text,uuid)','execute'),'legacy create cannot bypass outbox');
select ok(not has_function_privilege('authenticated','public.connect_resend_broker_invitation(uuid,bigint,text,uuid)','execute'),'legacy resend cannot bypass outbox');
select ok(not has_function_privilege('authenticated','public.connect_mail_claim(uuid,integer,integer)','execute'),'ordinary user cannot claim');
select ok(not has_function_privilege('service_role','public.connect_mail_claim(uuid,integer,integer)','execute'),'Edge cannot claim/decrypt outbox');
select ok(not has_table_privilege('service_role','private.mail_outbox','select'),'Edge cannot read ciphertext directly');
select ok(not has_table_privilege('connect_mail_worker','private.mail_outbox','select'),'worker must use leased RPC, not table scan');
select ok(not has_table_privilege('connect_mail_worker','public.leads','select'),'worker cannot read leads');
select ok(not has_function_privilege('anon','public.connect_mail_webhook(text,uuid,text,text)','execute'),'webhook is not public');
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('a3b00000-0000-4000-8000-000000000001','authenticated','authenticated','mail-admin@test.local',now(),now(),now()),
('a3b00000-0000-4000-8000-000000000002','authenticated','authenticated','mail-other@test.local',now(),now(),now()),
('a3b00000-0000-4000-8000-000000000003','authenticated','authenticated','mail-broker@test.local',now(),now(),now());
insert into public.organizations(id,name,slug) values('b3b00000-0000-4000-8000-000000000001','Mail A','pc3b-a'),('b3b00000-0000-4000-8000-000000000002','Mail B','pc3b-b');
insert into public.organization_members(organization_id,user_id,role) values
('b3b00000-0000-4000-8000-000000000001','a3b00000-0000-4000-8000-000000000001','organization_admin'),
('b3b00000-0000-4000-8000-000000000002','a3b00000-0000-4000-8000-000000000002','organization_admin');
insert into public.projects(id,organization_id,name,slug,public_slug,city,state) values('c3b00000-0000-4000-8000-000000000001','b3b00000-0000-4000-8000-000000000001','Mail A','mail-a','mail-a','São Paulo','SP');
create function pg_temp.enq(actor uuid,operation uuid,email text,payload jsonb default '{"alg":"RSA-OAEP-256+A256GCM","kid":"test","iv":"x","key":"x","data":"x"}') returns jsonb language sql as $$
 select public.connect_queue_invitation(actor,'create','c3b00000-0000-4000-8000-000000000001',email,null,null,encode(extensions.digest(operation::text,'sha256'),'hex'),operation,payload)
$$;
set local role service_role;
select is(pg_temp.state($$select pg_temp.enq('a3b00000-0000-4000-8000-000000000002','e3b00000-0000-4000-8000-000000000001','outbox@test.local')$$),'42501','other tenant cannot queue');
select is(pg_temp.state($$select pg_temp.enq('a3b00000-0000-4000-8000-000000000003','e3b00000-0000-4000-8000-000000000001','outbox@test.local')$$),'42501','broker cannot queue');
select is(pg_temp.state($$select pg_temp.enq('a3b00000-0000-4000-8000-000000000001','e3b00000-0000-4000-8000-000000000001','outbox@test.local','{}')$$),'23514','invalid encrypted envelope rolls back');
reset role;
select is((select count(*) from public.broker_invitations where project_id='c3b00000-0000-4000-8000-000000000001'),0::bigint,'no invitation persisted without outbox');
set local role service_role;
select is(pg_temp.enq('a3b00000-0000-4000-8000-000000000001','e3b00000-0000-4000-8000-000000000001','outbox@test.local')->>'deliveryStatus','pending','authorized enqueue');
select is(pg_temp.enq('a3b00000-0000-4000-8000-000000000001','e3b00000-0000-4000-8000-000000000001','outbox@test.local')->>'deliveryStatus','pending','idempotent operation replay');
select is(pg_temp.state($$select pg_temp.enq('a3b00000-0000-4000-8000-000000000001','e3b00000-0000-4000-8000-000000000001','different@test.local')$$),'42501','recipient cannot be changed on replay');
select is(pg_temp.state($$select pg_temp.enq('a3b00000-0000-4000-8000-000000000001','e3b00000-0000-4000-8000-000000000002','outbox@test.local')$$),'23505','duplicate pending invitation rejected');
reset role;
select is((select count(*) from private.mail_outbox where organization_id='b3b00000-0000-4000-8000-000000000001'),1::bigint,'one outbox per invitation');
select set_config('request.jwt.claim.sub','a3b00000-0000-4000-8000-000000000003',true);set local role authenticated;
select is(pg_temp.state('select * from private.mail_outbox'),'42501','broker direct read denied');
select is(pg_temp.state($$select public.connect_mail_status('b3b00000-0000-4000-8000-000000000001')$$),'42501','broker delivery read denied');
reset role;
select set_config('request.jwt.claim.sub','a3b00000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(pg_temp.state($$select public.connect_mail_status('b3b00000-0000-4000-8000-000000000001')$$),'42501','cross-tenant status denied');
reset role;
select set_config('request.jwt.claim.sub','a3b00000-0000-4000-8000-000000000001',true);set local role authenticated;
select ok(not (public.connect_mail_status('b3b00000-0000-4000-8000-000000000001')->0 ? 'payload'),'manager status omits ciphertext');
select public.connect_cancel_broker_invitation((select id from public.broker_invitations where project_id='c3b00000-0000-4000-8000-000000000001'),1) is not null;
reset role;
select is((select state from private.mail_outbox where id='e3b00000-0000-4000-8000-000000000001'),'cancelled','cancel atomically invalidates queued mail');
select is(pg_temp.state($$select public.connect_queue_invitation('a3b00000-0000-4000-8000-000000000001','resend',null,null,(select invitation_id from private.mail_outbox where id='e3b00000-0000-4000-8000-000000000001'),2,repeat('b',64),'e3b00000-0000-4000-8000-000000000002','{"alg":"RSA-OAEP-256+A256GCM","kid":"test","iv":"x","key":"x","data":"x"}')$$),'PT409','cancelled invite cannot resend');
select is((select count(*) from private.mail_outbox where organization_id='b3b00000-0000-4000-8000-000000000001'),1::bigint,'failed resend inserts no message');
select * from finish();
rollback;
