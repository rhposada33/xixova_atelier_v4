begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

create function pg_temp.hash_of(value integer) returns bytea language sql immutable as $$select decode(lpad(to_hex(value),64,'0'),'hex')$$;
create function pg_temp.submit(p_idempotency bytea,p_payload bytea,p_rate bytea,p_name text default 'Ana Silva') returns text language sql as $$
  select public.accept_commercial_lead(p_idempotency,p_payload,p_rate,p_name,'Construtora Exemplo',null,'+5511999999999','ana@exemplo.com','São Paulo / SP','31 a 80','De 3 a 6 meses','Ainda não',null,'website','/','', '', '', '2026-09-18',now(),now())
$$;

select has_table('public','commercial_leads','lead table exists');
select has_table('public','commercial_lead_idempotency','idempotency table exists');
select has_table('public','commercial_lead_rate_limits','rate limit table exists');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.commercial_leads'::regclass),'lead RLS is enabled');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.commercial_lead_idempotency'::regclass),'idempotency RLS is enabled');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.commercial_lead_rate_limits'::regclass),'rate limit RLS is enabled');
select hasnt_column('public','commercial_lead_rate_limits','ip','rate limit never stores an IP');
select hasnt_column('public','commercial_lead_rate_limits','payload','rate limit has no payload');
select hasnt_column('public','commercial_lead_rate_limits','email','rate limit has no e-mail');
select hasnt_column('public','commercial_lead_rate_limits','whatsapp_e164','rate limit has no phone');
select hasnt_column('public','commercial_lead_rate_limits','name','rate limit has no name');
select hasnt_column('public','commercial_lead_idempotency','idempotency_key','raw idempotency key is absent');
select hasnt_column('public','commercial_lead_idempotency','payload','raw payload is absent');
select ok(not has_table_privilege('public','public.commercial_leads','select,insert,update,delete'),'PUBLIC has no lead table access');
select ok(not has_table_privilege('anon','public.commercial_leads','select,insert,update,delete'),'anon has no lead table access');
select ok(not has_table_privilege('authenticated','public.commercial_leads','select,insert,update,delete'),'authenticated has no lead table access');
select ok(not has_table_privilege('service_role','public.commercial_leads','select,insert,update,delete'),'service role has no direct lead table grant');
select ok(not has_function_privilege('public','public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz)','execute'),'PUBLIC cannot execute the RPC');
select ok(not has_function_privilege('anon','public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz)','execute'),'anon cannot execute the RPC');
select ok(not has_function_privilege('authenticated','public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz)','execute'),'authenticated cannot execute the RPC');
select ok(has_function_privilege('service_role','public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz)','execute'),'only service role can execute the RPC');

set local role anon;
select throws_ok($$select * from public.commercial_leads$$,'42501','permission denied for table commercial_leads','anon direct reads are denied');
reset role;
set local role authenticated;
select throws_ok($$select * from public.commercial_leads$$,'42501','permission denied for table commercial_leads','authenticated direct reads are denied');
reset role;

set local role service_role;
select is(pg_temp.submit(pg_temp.hash_of(1),pg_temp.hash_of(101),pg_temp.hash_of(201)),'accepted','server-side path accepts the first lead');
select is(pg_temp.submit(pg_temp.hash_of(1),pg_temp.hash_of(101),pg_temp.hash_of(201)),'accepted','same idempotency hash returns generic acceptance');
reset role;
select is((select count(*)::integer from public.commercial_leads),1,'same idempotency hash does not duplicate a lead');
set local role service_role;
select is(pg_temp.submit(pg_temp.hash_of(1),pg_temp.hash_of(102),pg_temp.hash_of(201)),'idempotency_conflict','same idempotency hash with another payload is rejected');
select is(pg_temp.submit(pg_temp.hash_of(2),pg_temp.hash_of(102),pg_temp.hash_of(201)),'accepted','second request inside rate window is accepted');
select is(pg_temp.submit(pg_temp.hash_of(3),pg_temp.hash_of(103),pg_temp.hash_of(201)),'accepted','third request inside rate window is accepted');
select is(pg_temp.submit(pg_temp.hash_of(4),pg_temp.hash_of(104),pg_temp.hash_of(201)),'accepted','fourth request inside rate window is accepted');
select is(pg_temp.submit(pg_temp.hash_of(5),pg_temp.hash_of(105),pg_temp.hash_of(201)),'accepted','fifth request inside rate window is accepted');
select is(pg_temp.submit(pg_temp.hash_of(6),pg_temp.hash_of(106),pg_temp.hash_of(201)),'rate_limited','sixth request inside rate window is limited');
select is(pg_temp.submit(pg_temp.hash_of(7),pg_temp.hash_of(107),pg_temp.hash_of(202)),'accepted','new rate hash is accepted');
reset role;
update public.commercial_lead_rate_limits set window_started_at=now()-interval '16 minutes' where rate_limit_hash=pg_temp.hash_of(202);
set local role service_role;
select is(pg_temp.submit(pg_temp.hash_of(8),pg_temp.hash_of(108),pg_temp.hash_of(202)),'accepted','expired rate window resets');
reset role;
update public.commercial_lead_idempotency set expires_at=now()-interval '1 second' where idempotency_hash=pg_temp.hash_of(7);
set local role service_role;
select is(pg_temp.submit(pg_temp.hash_of(7),pg_temp.hash_of(109),pg_temp.hash_of(202)),'accepted','expired idempotency hash can be replaced');
select throws_ok($$select pg_temp.submit(pg_temp.hash_of(9),pg_temp.hash_of(110),pg_temp.hash_of(203),repeat('x',121))$$,'23514',null,'database enforces text length');
reset role;

select * from finish();
rollback;
