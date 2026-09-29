-- Phase 3 / Checkpoint A: organization onboarding, memberships and invitations.
create extension if not exists pgcrypto with schema extensions;

alter table public.organizations drop constraint if exists organizations_status_check;
update public.organizations set status = 'suspended' where status = 'inactive';
alter table public.organizations
  add column legal_name text,
  add column country text not null default 'BR',
  add column state text,
  add column city text,
  add column timezone text not null default 'America/Sao_Paulo',
  add column default_currency text not null default 'BRL',
  add column version bigint not null default 1 check (version > 0),
  add constraint organizations_status_check check (status in ('draft','active','suspended','archived')),
  add constraint organizations_slug_normalized_check check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint organizations_country_check check (country ~ '^[A-Z]{2}$'),
  add constraint organizations_currency_check check (default_currency ~ '^[A-Z]{3}$');

alter table public.organization_members
  add column version bigint not null default 1 check (version > 0),
  add column updated_at timestamptz not null default now(),
  add column removed_at timestamptz;
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email_normalized text not null,
  role text not null check (role in ('organization_admin','seller','viewer')),
  status text not null check (status in ('pending_delivery','sent','accepted','delivery_failed','expired','revoked')),
  token_hash text not null,
  operation_id uuid not null,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  sent_at timestamptz,
  accepted_at timestamptz,
  last_delivery_attempt_at timestamptz,
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  delivery_error_code text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invited_by, operation_id),
  check (email_normalized = lower(btrim(email_normalized))),
  check (expires_at > created_at)
);
create unique index organization_invitations_current_email_idx
  on public.organization_invitations(organization_id,email_normalized)
  where status in ('pending_delivery','sent','delivery_failed');
create index organization_invitations_org_created_idx on public.organization_invitations(organization_id,created_at desc,id);
create trigger organization_invitations_updated_at before update on public.organization_invitations
  for each row execute function public.set_updated_at();

create table private.invitation_rate_limits (
  scope_type text not null check (scope_type in ('actor_hour','organization_day')),
  scope_id uuid not null,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0),
  primary key(scope_type,scope_id,window_started_at)
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  resource_type text not null check (resource_type in ('organization','membership','invitation')),
  resource_id uuid not null,
  action text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason text,
  performed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index admin_audit_logs_org_created_idx on public.admin_audit_logs(organization_id,created_at desc,id);

-- Platform admins can inspect onboarding organizations; ordinary members only operate active ones.
create or replace function private.has_organization_access(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.organizations o where o.id=p_organization_id and (
      (private.is_platform_admin() and o.status <> 'archived') or
      (o.status='active' and exists(select 1 from public.organization_members m
        where m.organization_id=o.id and m.user_id=(select auth.uid()) and m.active and m.removed_at is null))
    )
  );
$$;

create or replace function private.raise_admin_error(p_code text) returns void
language plpgsql volatile set search_path='' as $$
begin raise exception using errcode='P0001',message='admin_operation_failed',detail=jsonb_build_object('code',p_code)::text; end;
$$;
create function private.require_active_user() returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if; end;
$$;
create function private.normalize_slug(p_value text) returns text language sql immutable set search_path='' as $$
  select trim(both '-' from regexp_replace(lower(btrim(coalesce(p_value,''))),'[^a-z0-9]+','-','g'));
$$;
create function private.organization_configuration_valid(p_org public.organizations) returns boolean
language sql immutable set search_path='' as $$
  select btrim(p_org.name)<>'' and p_org.slug<>'' and p_org.country~'^[A-Z]{2}$'
    and p_org.timezone<>'' and p_org.default_currency~'^[A-Z]{3}$';
$$;
create function private.is_organization_manager(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_platform_admin() or exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
    where m.organization_id=p_org and m.user_id=(select auth.uid()) and m.active and m.removed_at is null
      and m.role='organization_admin' and o.status='active');
$$;

create function public.admin_list_organizations(p_page integer default 1,p_page_size integer default 25,p_search text default null,p_status text default null)
returns table(id uuid,name text,legal_name text,slug text,country text,state text,city text,timezone text,default_currency text,status text,version bigint,member_count bigint,project_count bigint,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_active_user();
  if p_page<1 or p_page_size<1 or p_page_size>100 or (p_status is not null and p_status not in ('draft','active','suspended','archived')) then perform private.raise_admin_error('invalid_input'); end if;
  return query select o.id,o.name,o.legal_name,o.slug,o.country,o.state,o.city,o.timezone,o.default_currency,o.status,o.version,
    (select count(*) from public.organization_members m where m.organization_id=o.id and m.removed_at is null),
    (select count(*) from public.projects p where p.organization_id=o.id),count(*) over()
  from public.organizations o where
    (private.is_platform_admin() or private.has_organization_access(o.id))
    and (p_status is null or o.status=p_status)
    and (p_search is null or o.name ilike '%'||btrim(p_search)||'%' or o.slug ilike '%'||btrim(p_search)||'%')
  order by o.name,o.id offset (p_page-1)*p_page_size limit p_page_size;
end; $$;

create function public.admin_create_organization(p_name text,p_legal_name text,p_slug text,p_country text,p_state text,p_city text,p_timezone text,p_currency text)
returns public.organizations language plpgsql security definer set search_path='' as $$
declare v public.organizations;
begin perform private.require_active_user(); if not private.is_platform_admin() then perform private.raise_admin_error('forbidden'); end if;
  if btrim(coalesce(p_name,''))='' or private.normalize_slug(p_slug)='' then perform private.raise_admin_error('invalid_input'); end if;
  insert into public.organizations(id,name,legal_name,slug,country,state,city,timezone,default_currency,status)
  values(gen_random_uuid(),btrim(p_name),nullif(btrim(p_legal_name),''),private.normalize_slug(p_slug),upper(p_country),nullif(btrim(p_state),''),nullif(btrim(p_city),''),p_timezone,upper(p_currency),'draft') returning * into v;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,new_values,performed_by)
  values(v.id,'organization',v.id,'organization.created',jsonb_build_object('name',v.name,'slug',v.slug,'status',v.status),auth.uid()); return v;
exception when unique_violation then perform private.raise_admin_error('conflict'); return null; end; $$;

create function public.admin_update_organization(p_id uuid,p_expected_version bigint,p_name text,p_legal_name text,p_slug text,p_country text,p_state text,p_city text,p_timezone text,p_currency text)
returns public.organizations language plpgsql security definer set search_path='' as $$
declare v_old public.organizations;v_new public.organizations;
begin perform private.require_active_user(); select * into v_old from public.organizations where id=p_id for update;
  if not found or not private.is_organization_manager(p_id) then perform private.raise_admin_error('not_found'); end if;
  if v_old.version<>p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  if not private.is_platform_admin() and v_old.status<>'active' then perform private.raise_admin_error('forbidden'); end if;
  update public.organizations set name=btrim(p_name),legal_name=nullif(btrim(p_legal_name),''),slug=private.normalize_slug(p_slug),country=upper(p_country),state=nullif(btrim(p_state),''),city=nullif(btrim(p_city),''),timezone=p_timezone,default_currency=upper(p_currency),version=version+1 where id=p_id returning * into v_new;
  if not private.organization_configuration_valid(v_new) then raise exception using errcode='23514'; end if;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,old_values,new_values,performed_by) values(p_id,'organization',p_id,'organization.updated',to_jsonb(v_old)-'updated_at',to_jsonb(v_new)-'updated_at',auth.uid()); return v_new;
exception when check_violation then perform private.raise_admin_error('invalid_input'); return null; when unique_violation then perform private.raise_admin_error('conflict'); return null; end; $$;

create function public.admin_change_organization_status(p_id uuid,p_expected_version bigint,p_new_status text,p_reason text)
returns public.organizations language plpgsql security definer set search_path='' as $$
declare v_old public.organizations;v_new public.organizations;v_admins integer;
begin perform private.require_active_user(); if not private.is_platform_admin() then perform private.raise_admin_error('forbidden'); end if;
  select * into v_old from public.organizations where id=p_id for update; if not found then perform private.raise_admin_error('not_found'); end if;
  if v_old.version<>p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  if btrim(coalesce(p_reason,''))='' then perform private.raise_admin_error('invalid_input'); end if;
  if p_new_status='active' then
    if v_old.status not in ('draft','suspended') or not private.organization_configuration_valid(v_old) then perform private.raise_admin_error('invalid_transition'); end if;
    select count(*) into v_admins from public.organization_members where organization_id=p_id and role='organization_admin' and active and removed_at is null;
    if v_admins=0 then perform private.raise_admin_error('last_admin_required'); end if;
  elsif p_new_status='suspended' then if v_old.status<>'active' then perform private.raise_admin_error('invalid_transition'); end if;
  elsif p_new_status='archived' then if v_old.status not in ('draft','active','suspended') then perform private.raise_admin_error('invalid_transition'); end if;
  else perform private.raise_admin_error('invalid_transition'); end if;
  update public.organizations set status=p_new_status,version=version+1 where id=p_id returning * into v_new;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,old_values,new_values,reason,performed_by)
  values(p_id,'organization',p_id,'organization.'||p_new_status,jsonb_build_object('status',v_old.status,'version',v_old.version),jsonb_build_object('status',v_new.status,'version',v_new.version),btrim(p_reason),auth.uid()); return v_new; end; $$;

create function public.admin_list_members(p_organization_id uuid,p_page integer default 1,p_page_size integer default 25)
returns table(user_id uuid,full_name text,role text,active boolean,joined_at timestamptz,version bigint,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin perform private.require_active_user(); if not private.is_organization_manager(p_organization_id) then perform private.raise_admin_error('not_found'); end if;
  if p_page<1 or p_page_size<1 or p_page_size>100 then perform private.raise_admin_error('invalid_input'); end if;
  return query select m.user_id,p.full_name,m.role,m.active,m.created_at,m.version,count(*) over() from public.organization_members m left join public.profiles p on p.user_id=m.user_id
    where m.organization_id=p_organization_id and m.removed_at is null order by p.full_name nulls last,m.user_id offset (p_page-1)*p_page_size limit p_page_size; end; $$;

create function public.admin_update_membership(p_organization_id uuid,p_user_id uuid,p_expected_version bigint,p_role text,p_active boolean,p_remove boolean default false)
returns public.organization_members language plpgsql security definer set search_path='' as $$
declare v_old public.organization_members;v_new public.organization_members;v_org_status text;v_count integer;
begin perform private.require_active_user(); if not private.is_organization_manager(p_organization_id) then perform private.raise_admin_error('not_found'); end if;
  if p_role not in ('organization_admin','seller','viewer') then perform private.raise_admin_error('invalid_input'); end if;
  select * into v_old from public.organization_members where organization_id=p_organization_id and user_id=p_user_id for update; if not found then perform private.raise_admin_error('not_found'); end if;
  if v_old.version<>p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  select status into v_org_status from public.organizations where id=p_organization_id for update;
  if v_org_status='active' and v_old.role='organization_admin' and v_old.active and v_old.removed_at is null and (p_role<>'organization_admin' or not p_active or p_remove) then
    select count(*) into v_count from public.organization_members where organization_id=p_organization_id and role='organization_admin' and active and removed_at is null;
    if v_count<=1 then perform private.raise_admin_error('last_admin_required'); end if;
  end if;
  update public.organization_members set role=p_role,active=case when p_remove then false else p_active end,removed_at=case when p_remove then now() else null end,version=version+1
    where organization_id=p_organization_id and user_id=p_user_id returning * into v_new;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,old_values,new_values,performed_by)
    values(p_organization_id,'membership',p_user_id,case when p_remove then 'membership.removed' when v_old.role<>p_role then 'membership.role_changed' when p_active then 'membership.activated' else 'membership.suspended' end,
      jsonb_build_object('role',v_old.role,'active',v_old.active),jsonb_build_object('role',v_new.role,'active',v_new.active),auth.uid()); return v_new; end; $$;

create function private.consume_invitation_rate_limit(p_actor uuid,p_org uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_hour timestamptz=date_trunc('hour',now());v_day timestamptz=date_trunc('day',now());v_count integer;
begin insert into private.invitation_rate_limits values('actor_hour',p_actor,v_hour,1) on conflict(scope_type,scope_id,window_started_at) do update set attempt_count=private.invitation_rate_limits.attempt_count+1 returning attempt_count into v_count;
  if v_count>20 then perform private.raise_admin_error('rate_limited'); end if;
  insert into private.invitation_rate_limits values('organization_day',p_org,v_day,1) on conflict(scope_type,scope_id,window_started_at) do update set attempt_count=private.invitation_rate_limits.attempt_count+1 returning attempt_count into v_count;
  if v_count>100 then perform private.raise_admin_error('rate_limited'); end if; end; $$;

create function public.admin_prepare_invitation(p_organization_id uuid,p_email text,p_role text,p_token_hash text,p_operation_id uuid)
returns public.organization_invitations language plpgsql security definer set search_path='' as $$
declare v public.organization_invitations;v_email text=lower(btrim(p_email));
begin perform private.require_active_user(); if not private.is_organization_manager(p_organization_id) then perform private.raise_admin_error('not_found'); end if;
  if p_role not in ('organization_admin','seller','viewer') or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or length(p_token_hash)<43 then perform private.raise_admin_error('invalid_input'); end if;
  select * into v from public.organization_invitations where invited_by=auth.uid() and operation_id=p_operation_id; if found then return v; end if;
  perform private.consume_invitation_rate_limit(auth.uid(),p_organization_id);
  insert into public.organization_invitations(organization_id,email_normalized,role,status,token_hash,operation_id,invited_by,expires_at)
    values(p_organization_id,v_email,p_role,'pending_delivery',p_token_hash,p_operation_id,auth.uid(),now()+interval '7 days') returning * into v;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,new_values,performed_by)
    values(p_organization_id,'invitation',v.id,'invitation.created',jsonb_build_object('role',p_role,'status','pending_delivery'),auth.uid()); return v;
exception when unique_violation then perform private.raise_admin_error('invitation_exists'); return null; end; $$;

create function public.admin_mark_invitation_delivery(p_invitation_id uuid,p_success boolean,p_error_code text,p_actor_id uuid)
returns public.organization_invitations language plpgsql security definer set search_path='' as $$
declare v public.organization_invitations;
begin if coalesce(auth.jwt()->>'role','')<>'service_role' then perform private.raise_admin_error('forbidden'); end if; select * into v from public.organization_invitations where id=p_invitation_id for update;
  if not found or v.invited_by<>p_actor_id then perform private.raise_admin_error('not_found'); end if;
  if v.status<>'pending_delivery' or v.last_delivery_attempt_at is null then return v; end if;
  update public.organization_invitations set status=case when p_success then 'sent' else 'delivery_failed' end,sent_at=case when p_success then now() else sent_at end,
    delivery_error_code=case when p_success then null else left(coalesce(p_error_code,'delivery_unknown'),64) end,version=version+1 where id=v.id returning * into v;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,new_values,performed_by) values(v.organization_id,'invitation',v.id,case when p_success then 'invitation.sent' else 'invitation.delivery_failed' end,jsonb_build_object('status',v.status,'error_code',v.delivery_error_code),p_actor_id); return v; end; $$;

create function public.accept_organization_invitation(p_token text)
returns table(organization_id uuid,role text) language plpgsql security definer set search_path='' as $$
declare v public.organization_invitations;v_email text=lower(coalesce(auth.jwt()->>'email',''));
begin perform private.require_active_user(); if length(coalesce(p_token,''))<32 or v_email='' then perform private.raise_admin_error('invalid_invitation'); end if;
  select i.* into v from public.organization_invitations i join public.organizations o on o.id=i.organization_id
    join auth.users au on au.id=auth.uid()
    where i.token_hash=encode(extensions.digest(p_token,'sha256'),'base64') and o.status in ('draft','active')
      and au.email_confirmed_at is not null and lower(au.email)=v_email for update of i;
  if not found or v.status<>'sent' or v.expires_at<=now() or v.email_normalized<>v_email then perform private.raise_admin_error('invalid_invitation'); end if;
  insert into public.organization_members(organization_id,user_id,role,active) values(v.organization_id,auth.uid(),v.role,true)
    on conflict on constraint organization_members_pkey do update set role=excluded.role,active=true,removed_at=null,version=public.organization_members.version+1;
  update public.organization_invitations set status='accepted',accepted_at=now(),token_hash=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'base64'),version=version+1 where id=v.id;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,new_values,performed_by) values(v.organization_id,'invitation',v.id,'invitation.accepted',jsonb_build_object('role',v.role,'status','accepted'),auth.uid());
  return query select v.organization_id,v.role; end; $$;

alter table public.organization_invitations enable row level security;
alter table public.admin_audit_logs enable row level security;
revoke all on table public.organization_invitations,public.admin_audit_logs from public,anon,authenticated;
grant select on public.organization_invitations,public.admin_audit_logs to authenticated;
create policy "organization managers read invitations" on public.organization_invitations for select to authenticated using(private.is_organization_manager(organization_id));
create policy "organization managers read admin audit" on public.admin_audit_logs for select to authenticated using(private.is_organization_manager(organization_id));

revoke all on function private.raise_admin_error(text),private.require_active_user(),private.normalize_slug(text),private.organization_configuration_valid(public.organizations),private.is_organization_manager(uuid),private.consume_invitation_rate_limit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.admin_list_organizations(integer,integer,text,text),public.admin_create_organization(text,text,text,text,text,text,text,text),public.admin_update_organization(uuid,bigint,text,text,text,text,text,text,text,text),public.admin_change_organization_status(uuid,bigint,text,text),public.admin_list_members(uuid,integer,integer),public.admin_update_membership(uuid,uuid,bigint,text,boolean,boolean),public.admin_prepare_invitation(uuid,text,text,text,uuid),public.admin_mark_invitation_delivery(uuid,boolean,text,uuid),public.accept_organization_invitation(text) from public,anon,authenticated;
grant execute on function public.admin_list_organizations(integer,integer,text,text),public.admin_create_organization(text,text,text,text,text,text,text,text),public.admin_update_organization(uuid,bigint,text,text,text,text,text,text,text,text),public.admin_change_organization_status(uuid,bigint,text,text),public.admin_list_members(uuid,integer,integer),public.admin_update_membership(uuid,uuid,bigint,text,boolean,boolean),public.admin_prepare_invitation(uuid,text,text,text,uuid),public.accept_organization_invitation(text) to authenticated;
grant execute on function public.admin_mark_invitation_delivery(uuid,boolean,text,uuid) to service_role;
grant select on table public.organization_invitations to service_role;

-- Claims a delivery attempt before crossing the PostgreSQL/Auth transaction boundary.
-- A repeated request observes claimed=false and must verify state instead of sending again.
create function public.admin_claim_invitation_delivery(p_invitation_id uuid,p_actor_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.organization_invitations;
begin if coalesce(auth.jwt()->>'role','')<>'service_role' then perform private.raise_admin_error('forbidden'); end if;
  select * into v from public.organization_invitations where id=p_invitation_id for update;
  if not found or v.invited_by<>p_actor_id then perform private.raise_admin_error('not_found'); end if;
  if v.status<>'pending_delivery' or v.last_delivery_attempt_at is not null then return false; end if;
  update public.organization_invitations set last_delivery_attempt_at=now(),delivery_attempts=delivery_attempts+1,version=version+1 where id=v.id;
  return true;end;$$;
revoke all on function public.admin_claim_invitation_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_claim_invitation_delivery(uuid,uuid) to service_role;
grant execute on function private.is_organization_manager(uuid) to authenticated;

create function public.admin_retry_invitation(p_invitation_id uuid,p_expected_version bigint,p_token_hash text,p_operation_id uuid)
returns public.organization_invitations language plpgsql security definer set search_path='' as $$
declare v public.organization_invitations;
begin perform private.require_active_user();select * into v from public.organization_invitations where id=p_invitation_id for update;
  if not found or not private.is_organization_manager(v.organization_id) then perform private.raise_admin_error('not_found'); end if;
  if v.operation_id=p_operation_id then return v; end if;
  if v.version<>p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  if (v.status not in ('delivery_failed','sent') and not (v.status='pending_delivery' and v.last_delivery_attempt_at is not null)) or v.expires_at<=now() then perform private.raise_admin_error('invalid_transition'); end if;
  perform private.consume_invitation_rate_limit(auth.uid(),v.organization_id);
  update public.organization_invitations set status='pending_delivery',token_hash=p_token_hash,operation_id=p_operation_id,
    expires_at=now()+interval '7 days',delivery_error_code=null,last_delivery_attempt_at=null,version=version+1 where id=v.id returning * into v;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,new_values,performed_by)
    values(v.organization_id,'invitation',v.id,'invitation.resent',jsonb_build_object('role',v.role,'status',v.status),auth.uid());return v;end;$$;

create function public.admin_revoke_invitation(p_invitation_id uuid,p_expected_version bigint,p_reason text)
returns public.organization_invitations language plpgsql security definer set search_path='' as $$
declare v public.organization_invitations;
begin perform private.require_active_user();select * into v from public.organization_invitations where id=p_invitation_id for update;
  if not found or not private.is_organization_manager(v.organization_id) then perform private.raise_admin_error('not_found'); end if;
  if v.version<>p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  if v.status not in ('pending_delivery','sent','delivery_failed') or btrim(coalesce(p_reason,''))='' then perform private.raise_admin_error('invalid_transition'); end if;
  update public.organization_invitations set status='revoked',token_hash=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'base64'),version=version+1 where id=v.id returning * into v;
  insert into public.admin_audit_logs(organization_id,resource_type,resource_id,action,new_values,reason,performed_by)
    values(v.organization_id,'invitation',v.id,'invitation.revoked',jsonb_build_object('role',v.role,'status',v.status),btrim(p_reason),auth.uid());return v;end;$$;
revoke all on function public.admin_retry_invitation(uuid,bigint,text,uuid),public.admin_revoke_invitation(uuid,bigint,text) from public,anon;
grant execute on function public.admin_retry_invitation(uuid,bigint,text,uuid),public.admin_revoke_invitation(uuid,bigint,text) to authenticated;
