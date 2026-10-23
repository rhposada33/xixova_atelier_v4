-- PC07B3C: synthetic-only erasure executor. No production authorization switch.
do $$begin if not exists(select 1 from pg_roles where rolname='connect_privacy_worker') then create role connect_privacy_worker nologin;end if;end$$;
grant usage on schema public to connect_privacy_worker;
alter table public.connect_privacy_requests alter column lead_id drop not null;
alter table public.connect_privacy_requests drop constraint connect_privacy_requests_lead_id_fkey;
alter table public.connect_privacy_requests add foreign key(lead_id) references public.leads on delete set null;
alter table public.connect_privacy_requests add column purpose text not null default 'export' check(purpose in ('export','erase')),
 add column phase text not null default 'requested' check(phase in ('requested','verified','approved','prepared','completed')),
 add column verified_by uuid references auth.users, add column expected_version bigint,
 add column executed_by uuid references auth.users, add column completed_at timestamptz,
 add column result jsonb not null default '{}'::jsonb;
create unique index privacy_one_erasure on public.connect_privacy_requests(lead_id) where purpose='erase';
create table private.privacy_fixtures(lead_id uuid primary key references public.leads on delete cascade);
create table private.privacy_key(singleton boolean primary key default true check(singleton),key bytea not null check(octet_length(key)=32));
create table private.privacy_suppressions(lead_id uuid primary key,organization_id uuid not null,contact_hash text not null check(contact_hash ~ '^[a-f0-9]{64}$'),ledger_id uuid not null,created_at timestamptz not null default now());
create index on private.privacy_suppressions(organization_id,contact_hash);
create table private.privacy_context(tx bigint not null,lead_id uuid not null,primary key(tx,lead_id));
-- No buyer/lead/project/link/unit/time remains in the retained attribution counter. Never exposed to analytics.
create table private.privacy_attribution_totals(organization_id uuid not null,broker_user_id uuid not null references auth.users,removed_count bigint not null,primary key(organization_id,broker_user_id));
create table private.privacy_resources(
 id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.leads on delete cascade,
 kind text not null check(kind in ('storage','export','temporary','mail')),
 bucket text,path text,mail_id uuid references private.mail_outbox,
 removed boolean not null default false,
 check((kind='mail' and mail_id is not null and bucket is null and path is null) or
 (kind<>'mail' and mail_id is null and bucket='connect-privacy-private' and path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$')));
create unique index privacy_resource_path on private.privacy_resources(bucket,path) where path is not null;
create unique index privacy_resource_mail on private.privacy_resources(mail_id) where mail_id is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('connect-privacy-private','connect-privacy-private',false,1048576,array['text/plain','application/json']) on conflict do nothing;
create table private.connect_retention_policies(category text primary key,days integer check(days>0),policy_reference text,approved boolean not null default false,automatic_execution boolean not null default false check(automatic_execution=false));
insert into private.connect_retention_policies(category) values('leads'),('activities'),('attribution'),('audit'),('storage'),('exports'),('mail'),('logs'),('backups'),('suppression_ledger');
do $$declare t text;begin foreach t in array array['privacy_fixtures','privacy_key','privacy_suppressions','privacy_context','privacy_attribution_totals','privacy_resources','connect_retention_policies'] loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role,connect_privacy_worker',t);end loop;end$$;
create function private.contact_hash(p_channel text,p_contact text) returns text language sql stable security definer set search_path='' as $$
 select encode(extensions.hmac(convert_to(p_channel||':'||case when p_channel='phone' then regexp_replace(p_contact,'[^0-9]','','g') else lower(btrim(p_contact)) end,'UTF8'),key,'sha256'),'hex') from private.privacy_key
$$;
create function private.privacy_locked(p_lead uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.connect_privacy_requests where lead_id=p_lead and purpose='erase' and phase='prepared')
$$;
create function private.privacy_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_TABLE_NAME='leads' then
  if TG_OP='INSERT' and exists(select 1 from private.privacy_suppressions s where s.organization_id=new.organization_id and (s.lead_id=new.id or s.contact_hash=private.contact_hash(new.contact_channel,new.contact_value))) then raise exception using errcode='42501',message='suppressed_subject';end if;
  if TG_OP<>'INSERT' and private.privacy_locked(old.id) and not exists(select 1 from private.privacy_context where tx=txid_current() and lead_id=old.id) then raise exception using errcode='55000',message='privacy_processing';end if;
 else
  if private.privacy_locked(coalesce(new.lead_id,old.lead_id)) and not exists(select 1 from private.privacy_context where tx=txid_current() and lead_id=coalesce(new.lead_id,old.lead_id)) then raise exception using errcode='55000',message='privacy_processing';end if;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end$$;
create trigger privacy_lead_guard before insert or update or delete on public.leads for each row execute function private.privacy_guard();
create trigger privacy_resource_guard before insert or update or delete on private.privacy_resources for each row execute function private.privacy_guard();
create trigger privacy_activity_guard before insert on public.lead_activities for each row execute function private.privacy_guard();
-- Scoped capability in a private table, not a caller-spoofable GUC; no global trigger disabling.
create or replace function private.crm_immutable() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='DELETE' and exists(select 1 from private.privacy_context where tx=txid_current() and lead_id=old.lead_id) then return old;end if;
 raise exception using errcode='42501',message='immutable_history';end$$;
create function public.connect_privacy_plan(p_lead uuid,p_action text,p_ticket text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.leads;r public.connect_privacy_requests;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_lead::text,31));
 select * into l from public.leads where id=p_lead for update;
 if not found or not private.is_org_admin(l.organization_id) then raise exception using errcode='42501',message='forbidden';end if;
 select * into r from public.connect_privacy_requests where lead_id=p_lead and purpose='erase' for update;
 if p_action='request' then
  if not found then insert into public.connect_privacy_requests(organization_id,lead_id,requested_by,ticket,purpose,expected_version) values(l.organization_id,l.id,auth.uid(),p_ticket,'erase',l.version) returning * into r;end if;
 else
  if r.id is null then raise exception using errcode='55000',message='request_required';end if;
  if p_action='hold' then
   update public.connect_privacy_requests set decision='hold' where id=r.id;
  elsif p_action='verify' then
   if r.phase<>'requested' or r.requested_by<>auth.uid() or r.decision='hold' then raise exception using errcode='42501',message='verification_required';end if;
   update public.connect_privacy_requests set phase='verified',verified_by=auth.uid() where id=r.id;
  elsif p_action='approve' then
   if r.phase<>'verified' or r.requested_by=auth.uid() or r.verified_by=auth.uid() or exists(select 1 from public.connect_privacy_requests where lead_id=l.id and decision='hold') then raise exception using errcode='42501',message='independent_review_required';end if;
   update public.connect_privacy_requests set phase='approved',decision='approved',decided_by=auth.uid(),expected_version=l.version where id=r.id;
  else raise exception using errcode='22023',message='invalid_action';end if;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(l.organization_id,auth.uid(),'privacy.plan.'||p_action,'privacy_request',r.id);
 return jsonb_build_object('requestId',r.id);
end$$;
create or replace function public.connect_privacy_preview(p_lead uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.leads;begin
 select * into l from public.leads where id=p_lead;
 if not found or not private.is_org_admin(l.organization_id) then raise exception using errcode='42501',message='forbidden';end if;
 return jsonb_build_object('leadId',l.id,'version',l.version,'executionEnabled',false,'hold',exists(select 1 from public.connect_privacy_requests where lead_id=l.id and decision='hold'),
 'activityRecords',(select count(*) from public.lead_activities where lead_id=l.id),'resourceRecords',(select count(*) from private.privacy_resources where lead_id=l.id),
 'relatedLeads',(select count(*) from public.leads x where x.organization_id=l.organization_id and x.contact_channel=l.contact_channel and lower(btrim(x.contact_value))=lower(btrim(l.contact_value))),
 'directFields',jsonb_build_array('buyer_name','contact_value','message','next_action','closure_reason'),
 'indirectReferences',jsonb_build_array('receipt_id','activities.detail','attribution','audit','exports','mail','storage','backups'),
 'reason','synthetic_executor_only_untracked_copies_require_review');end$$;
create function public.connect_privacy_cases(p_organization uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.is_org_admin(p_organization) then raise exception using errcode='42501',message='forbidden';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'leadId',lead_id,'ticket',ticket,'phase',phase,'hold',decision='hold','independentApproval',decided_by is not null and decided_by<>requested_by,'result',result) order by created_at desc) from public.connect_privacy_requests where organization_id=p_organization and purpose='erase'),'[]');end$$;
-- Worker gets only one reviewed case. Caller must hold session advisory lock on lead (same key as review).
create function public.connect_privacy_prepare(p_request uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.connect_privacy_requests;l public.leads;
begin
 select * into r from public.connect_privacy_requests where id=p_request;
 perform pg_advisory_xact_lock(hashtextextended(r.lead_id::text,31));
 select * into l from public.leads where id=r.lead_id for update;
 select * into r from public.connect_privacy_requests where id=p_request for update;
 if r.phase='completed' then return jsonb_build_object('completed',true);end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if r.id is null or r.requested_by is distinct from p_actor or r.decided_by=p_actor or not private.is_org_admin(r.organization_id) or r.phase not in ('approved','prepared') then raise exception using errcode='42501',message='independent_approval_required';end if;
 if exists(select 1 from public.connect_privacy_requests where lead_id=l.id and decision='hold') then raise exception using errcode='42501',message='legal_hold';end if;
 if not exists(select 1 from private.privacy_fixtures where lead_id=l.id) then raise exception using errcode='55000',message='synthetic_fixture_required';end if;
 if private.contact_hash(l.contact_channel,l.contact_value) is null then raise exception using errcode='55000',message='ledger_key_required';end if;
 if l.version<>r.expected_version then raise exception using errcode='PT409',message='preview_stale';end if;
 if exists(select 1 from public.leads x where x.id<>l.id and x.organization_id=l.organization_id and private.contact_hash(x.contact_channel,x.contact_value)=private.contact_hash(l.contact_channel,l.contact_value)) then raise exception using errcode='55000',message='related_subject_review_required';end if;
 -- Identity accounts are a different lifecycle; never erase them through a buyer request.
 if l.contact_channel='email' and exists(select 1 from auth.users where lower(email)=lower(l.contact_value)) then raise exception using errcode='55000',message='identity_account_review_required';end if;
 update public.connect_privacy_requests set phase='prepared',executed_by=p_actor where id=r.id;
 -- Cancel only explicitly inventoried synthetic mail; dispatch/accepted mail cannot be recalled.
 if exists(select 1 from private.privacy_resources x join private.mail_outbox m on m.id=x.mail_id where x.lead_id=l.id and (m.dispatch_at is not null or m.state='sent')) then raise exception using errcode='55000',message='external_mail_copy_review_required';end if;
 update public.broker_invitations set status='cancelled',version=version+1 where id in(select m.invitation_id from private.mail_outbox m join private.privacy_resources x on x.mail_id=m.id where x.lead_id=l.id) and status='pending';
 return jsonb_build_object('completed',false,'id',r.id,'leadId',l.id,'organizationId',l.organization_id,'contactHash',private.contact_hash(l.contact_channel,l.contact_value),'actor',r.requested_by,
 'resources',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'bucket',bucket,'path',path)) from private.privacy_resources where lead_id=l.id and kind<>'mail'),'[]'));
end$$;
-- Retain operational rows but erase the sensitive encrypted payload, without destroying any keyring.
alter table private.mail_outbox add column erased_at timestamptz;
alter table private.mail_outbox drop constraint mail_outbox_payload_check;
alter table private.mail_outbox add constraint mail_outbox_payload_check check((erased_at is not null and state='cancelled' and payload='{}') or (erased_at is null and jsonb_typeof(payload)='object' and payload->>'alg'='RSA-OAEP-256+A256GCM' and payload ?& array['kid','iv','key','data'] and octet_length(payload::text)<16384));
create function public.connect_privacy_finish(p_request uuid,p_actor uuid,p_ledger uuid,p_removed uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.connect_privacy_requests;l public.leads;counts jsonb;rid uuid;
begin
 perform public.connect_privacy_prepare(p_request,p_actor);
 select * into r from public.connect_privacy_requests where id=p_request for update;
 if r.phase='completed' then return r.result;end if;
 select * into l from public.leads where id=r.lead_id for update;
 if p_ledger is distinct from p_request or exists(select 1 from private.privacy_resources where lead_id=l.id and kind<>'mail' and not(id=any(coalesce(p_removed,'{}')))) then raise exception using errcode='55000',message='external_cleanup_required';end if;
 insert into private.privacy_context values(txid_current(),l.id);
 counts:=jsonb_build_object('leads',1,'activities',(select count(*) from public.lead_activities where lead_id=l.id),'resources',(select count(*) from private.privacy_resources where lead_id=l.id),'technicalResult','covered_records_removed','integralAnonymizationApproved',false);
 insert into private.privacy_suppressions(lead_id,organization_id,contact_hash,ledger_id) values(l.id,l.organization_id,private.contact_hash(l.contact_channel,l.contact_value),p_ledger) on conflict do nothing;
 insert into private.privacy_attribution_totals select l.organization_id,broker_user_id,1 from public.lead_attributions where lead_id=l.id on conflict(organization_id,broker_user_id) do update set removed_count=private.privacy_attribution_totals.removed_count+1;
 -- Audit events are transformed in scope, never globally disabled; retain action but remove buyer linkage/content/time.
 update public.audit_events set detail='{}',subject_id=r.id,subject_type='privacy_redacted',created_at=date_trunc('month',created_at) where organization_id=l.organization_id and (subject_id=l.id or subject_id=l.receipt_id or subject_id in(select id from public.lead_activities where lead_id=l.id));
 for rid in select mail_id from private.privacy_resources where lead_id=l.id and kind='mail' loop
  update public.audit_events set detail='{}',subject_id=r.id,subject_type='privacy_redacted' where subject_id=rid or subject_id=(select invitation_id from private.mail_outbox where id=rid);
  update public.broker_invitations set invited_email=gen_random_uuid()::text||'@redacted.invalid',token_hash=encode(extensions.gen_random_bytes(32),'hex') where id=(select invitation_id from private.mail_outbox where id=rid);
  update private.mail_outbox set payload='{}',erased_at=now(),state='cancelled',provider_id=null where id=rid;
 end loop;
 delete from public.interest_idempotency where receipt_id=l.receipt_id;
 delete from public.lead_activities where lead_id=l.id;
 delete from public.lead_attributions where lead_id=l.id;
 update public.connect_privacy_requests set ticket='REDACTED',result=counts where lead_id=l.id;
 delete from public.leads where id=l.id;
 update public.connect_privacy_requests set phase='completed',completed_at=now(),result=counts where id=r.id;
 delete from private.privacy_context where tx=txid_current() and lead_id=l.id;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,p_actor,'privacy.completed','privacy_request',r.id,counts);
 return counts;
end$$;
revoke all on function public.connect_privacy_plan(uuid,text,text),public.connect_privacy_cases(uuid) from public,anon,authenticated,service_role;
grant execute on function public.connect_privacy_plan(uuid,text,text),public.connect_privacy_cases(uuid) to authenticated;
revoke all on function public.connect_privacy_prepare(uuid,uuid),public.connect_privacy_finish(uuid,uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.connect_privacy_prepare(uuid,uuid),public.connect_privacy_finish(uuid,uuid,uuid,uuid[]) to connect_privacy_worker;
revoke all on function private.contact_hash(text,text),private.privacy_locked(uuid),private.privacy_guard() from public,anon,authenticated,service_role;
-- Serialize old export/hold routes with the new worker, too.
alter function public.connect_privacy(uuid,text,text) rename to connect_privacy_pre_lifecycle;
revoke all on function public.connect_privacy_pre_lifecycle(uuid,text,text) from public,anon,authenticated,service_role;
create function public.connect_privacy(p_lead uuid,p_action text,p_ticket text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(p_lead::text,31));
 if private.privacy_locked(p_lead) then raise exception using errcode='55000',message='privacy_processing';end if;
 return public.connect_privacy_pre_lifecycle(p_lead,p_action,p_ticket);end$$;
revoke all on function public.connect_privacy(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.connect_privacy(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
