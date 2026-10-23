do $$begin if not exists(select 1 from pg_roles where rolname='connect_mail_worker') then create role connect_mail_worker nologin;end if;end$$;
grant connect_mail_worker to authenticator;
grant usage on schema public to connect_mail_worker;
create table private.mail_outbox (
 id uuid primary key, message_type text not null default 'broker_invitation' check(message_type='broker_invitation'),
 organization_id uuid not null references public.organizations(id), invitation_id uuid not null unique references public.broker_invitations(id),
 template_version text not null default 'broker-invite.pt-BR.v1' check(template_version='broker-invite.pt-BR.v1'),
 payload jsonb not null, state text not null default 'pending' check(state in ('pending','processing','sent','retry','failed','cancelled')),
 attempts integer not null default 0, max_attempts integer not null default 5 check(max_attempts between 1 and 10),
 next_attempt_at timestamptz not null default now(), lease_id uuid, worker_id uuid, lease_until timestamptz,
 dispatch_at timestamptz, provider_id text, last_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), sent_at timestamptz,
 check(jsonb_typeof(payload)='object' and payload->>'alg'='RSA-OAEP-256+A256GCM' and payload ?& array['kid','iv','key','data'] and octet_length(payload::text)<16384)
);
create index mail_outbox_due on private.mail_outbox(state,next_attempt_at,lease_until);
alter table private.mail_outbox enable row level security;
revoke all on private.mail_outbox from public,anon,authenticated,service_role,connect_mail_worker;
create function private.mail_audit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='INSERT' or new.state is distinct from old.state then
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(new.organization_id,null,'mail.'||new.state,'mail',new.id,jsonb_build_object('attempts',new.attempts,'code',new.last_code));end if;
 return new;end$$;
create trigger mail_audit after insert or update on private.mail_outbox for each row execute function private.mail_audit();
create function private.cancel_invitation_mail() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status<>'pending' then update private.mail_outbox set state='cancelled',last_code='invitation_inactive',lease_id=null,lease_until=null,updated_at=now()
 where invitation_id=new.id and state in ('pending','retry','processing');end if;return new;end$$;
create trigger cancel_invitation_mail after update of status on public.broker_invitations for each row execute function private.cancel_invitation_mail();

-- Only trusted Edge can enqueue; it supplies the JWT-validated actor. Existing domain validators reused.
create function public.connect_queue_invitation(p_actor uuid,p_action text,p_project uuid,p_email text,p_invitation uuid,p_version bigint,p_token_hash text,p_operation uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.broker_invitations; existing private.mail_outbox;
begin
 if p_actor is null or p_operation is null or p_payload is null then raise exception using errcode='22023',message='invalid_request';end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if p_action='create' then
  if not private.can_manage_brokers((select organization_id from public.projects where id=p_project)) then raise exception using errcode='42501',message='forbidden';end if;
 elsif p_action='resend' then
  if not private.can_manage_brokers((select organization_id from public.broker_invitations where id=p_invitation)) then raise exception using errcode='42501',message='forbidden';end if;
 else raise exception using errcode='22023',message='invalid_action';end if;
 -- Serialize duplicate operation IDs, then compare authorized business context, without changing token.
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 select * into existing from private.mail_outbox where id=p_operation;
 if found then
  select * into r from public.broker_invitations where id=existing.invitation_id;
  if r.created_by<>p_actor or (p_action='create' and (r.project_id is distinct from p_project or r.invited_email is distinct from lower(btrim(p_email))))
   or (p_action='resend' and not exists(select 1 from public.broker_invitations i where i.id=p_invitation and i.project_id=r.project_id and i.invited_email=r.invited_email)) then
   raise exception using errcode='42501',message='operation_mismatch';end if;
 else
  if p_action='create' then r:=public.connect_create_broker_invitation(p_project,p_email,p_token_hash,p_operation);
  else r:=public.connect_resend_broker_invitation(p_invitation,p_version,p_token_hash,p_operation);end if;
  insert into private.mail_outbox(id,organization_id,invitation_id,payload) values(p_operation,r.organization_id,r.id,p_payload);
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'version',r.version,'expiresAt',r.expires_at,'deliveryStatus',coalesce(existing.state,'pending'));
end$$;
revoke all on function public.connect_queue_invitation(uuid,text,uuid,text,uuid,bigint,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.connect_queue_invitation(uuid,text,uuid,text,uuid,bigint,text,uuid,jsonb) to service_role;
revoke execute on function public.connect_create_broker_invitation(uuid,text,text,uuid),public.connect_resend_broker_invitation(uuid,bigint,text,uuid) from authenticated,anon,public;

create function public.connect_mail_status(p_organization uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.can_manage_brokers(p_organization) then raise exception using errcode='42501',message='forbidden';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('invitationId',o.invitation_id,'state',o.state,'attempts',o.attempts,'nextAttemptAt',o.next_attempt_at,'code',o.last_code,'sentAt',o.sent_at)) from private.mail_outbox o where organization_id=p_organization),'[]'::jsonb);
end$$;
revoke all on function public.connect_mail_status(uuid) from public,anon;
grant execute on function public.connect_mail_status(uuid) to authenticated;

create function public.connect_mail_claim(p_worker uuid,p_lease_seconds integer default 30,p_max_attempts integer default 5) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.mail_outbox; i public.broker_invitations;
begin
 if p_worker is null or p_lease_seconds not between 15 and 120 or p_max_attempts not between 1 and 10 then raise exception using errcode='22023',message='invalid_claim';end if;
 update private.mail_outbox o set state='cancelled',last_code='invitation_inactive',lease_id=null,lease_until=null,updated_at=now()
 from public.broker_invitations i where o.invitation_id=i.id and o.state in ('pending','retry','processing') and (i.status<>'pending' or i.expires_at<=now() or not exists(select 1 from public.organizations g where g.id=i.organization_id and g.status='active'));
 update private.mail_outbox set state='failed',last_code='attempts_exhausted',updated_at=now() where (state in ('pending','retry') or (state='processing' and lease_until<=now() and dispatch_at is null)) and attempts>=max_attempts;
 select * into r from private.mail_outbox o where (o.state in ('pending','retry') and next_attempt_at<=now() and attempts<max_attempts)
 or (o.state='processing' and lease_until<=now()) order by o.created_at,o.id for update skip locked limit 1;
 if not found then return null;end if;
 update private.mail_outbox set state='processing',attempts=attempts+case when dispatch_at is null then 1 else 0 end,max_attempts=p_max_attempts,
 lease_id=gen_random_uuid(),worker_id=p_worker,lease_until=now()+make_interval(secs=>p_lease_seconds),updated_at=now() where id=r.id returning * into r;
 select * into i from public.broker_invitations where id=r.invitation_id;
 return to_jsonb(r)||jsonb_build_object('recipient',i.invited_email,'token_hash',i.token_hash,'expires_at',i.expires_at);
end$$;
create function public.connect_mail_prepare(p_id uuid,p_lease uuid,p_payload jsonb) returns boolean language sql security definer set search_path='' as $$
 with changed as (update private.mail_outbox set payload=p_payload,updated_at=now() where id=p_id and lease_id=p_lease and state='processing' and lease_until>now() and dispatch_at is null returning id) select exists(select 1 from changed)
$$;
create function public.connect_mail_dispatch(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.broker_invitations; r private.mail_outbox;
begin
 select * into i from public.broker_invitations where id=(select invitation_id from private.mail_outbox where id=p_id) for update;
 select * into r from private.mail_outbox where id=p_id for update;
 if r.lease_id is distinct from p_lease or r.state<>'processing' or r.lease_until<=now() then return false;end if;
 if i.status<>'pending' or i.expires_at<=now() then update private.mail_outbox set state='cancelled',last_code='invitation_inactive',updated_at=now() where id=p_id;return false;end if;
 update private.mail_outbox set dispatch_at=now(),updated_at=now() where id=p_id;return true;
end$$;
create function public.connect_mail_finish(p_id uuid,p_lease uuid,p_outcome text,p_code text default null,p_provider text default null,p_delay integer default 5) returns boolean language plpgsql security definer set search_path='' as $$
declare r private.mail_outbox;
begin
 if p_outcome not in ('sent','retry','failed') or p_delay not between 1 and 3600 or (p_code is not null and p_code not in ('smtp_temporary','smtp_permanent','confirmation_unknown','crypto_invalid','auth_unavailable','reconcile_unavailable','attempts_exhausted')) or length(p_provider)>200 then raise exception using errcode='22023',message='invalid_result';end if;
 select * into r from private.mail_outbox where id=p_id for update;
 if not found or r.lease_id is distinct from p_lease or r.state<>'processing' or r.lease_until<=now() then return false;end if;
 update private.mail_outbox set state=case when p_outcome='retry' and attempts>=max_attempts then 'failed' else p_outcome end,
 last_code=p_code,provider_id=p_provider,sent_at=case when p_outcome='sent' then now() else sent_at end,
 next_attempt_at=now()+make_interval(secs=>p_delay),lease_id=null,lease_until=null,updated_at=now(),
 dispatch_at=case when p_outcome='retry' then null else dispatch_at end where id=p_id;
 return true;
end$$;
create function public.connect_mail_metrics() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('states',coalesce((select jsonb_object_agg(state,n) from(select state,count(*) n from private.mail_outbox group by state)s),'{}'::jsonb),'retries',coalesce((select sum(greatest(attempts-1,0)) from private.mail_outbox),0),'expiredLeases',(select count(*) from private.mail_outbox where state='processing' and lease_until<=now()))
$$;
revoke all on function public.connect_mail_claim(uuid,integer,integer),public.connect_mail_prepare(uuid,uuid,jsonb),public.connect_mail_dispatch(uuid,uuid),public.connect_mail_finish(uuid,uuid,text,text,text,integer),public.connect_mail_metrics() from public,anon,authenticated,service_role;
grant execute on function public.connect_mail_claim(uuid,integer,integer),public.connect_mail_prepare(uuid,uuid,jsonb),public.connect_mail_dispatch(uuid,uuid),public.connect_mail_finish(uuid,uuid,text,text,text,integer),public.connect_mail_metrics() to connect_mail_worker;
revoke all on function private.mail_audit(),private.cancel_invitation_mail() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
-- Inactive provider webhook contract: server-only, durable replay suppression, no payload retained.
alter table private.mail_outbox add column provider_status text check(provider_status in ('delivered','bounced'));
create table private.mail_webhook_events(event_id text primary key check(event_id ~ '^[a-zA-Z0-9_-]{1,128}$'),outbox_id uuid not null references private.mail_outbox(id),event_type text not null check(event_type in ('delivered','bounced')),created_at timestamptz not null default now());
alter table private.mail_webhook_events enable row level security;
revoke all on private.mail_webhook_events from public,anon,authenticated,service_role,connect_mail_worker;
create function public.connect_mail_webhook(p_event text,p_id uuid,p_type text,p_provider text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_type not in ('delivered','bounced') or not exists(select 1 from private.mail_outbox where id=p_id and provider_id=p_provider and state in ('sent','failed')) then raise exception using errcode='22023',message='invalid_event';end if;
 insert into private.mail_webhook_events(event_id,outbox_id,event_type) values(p_event,p_id,p_type) on conflict do nothing;
 if not found then return false;end if;
 update private.mail_outbox set provider_status=case when provider_status='bounced' then 'bounced' else p_type end,updated_at=now() where id=p_id;
 return true;end$$;
revoke all on function public.connect_mail_webhook(text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.connect_mail_webhook(text,uuid,text,text) to connect_mail_worker;
notify pgrst,'reload schema';
