create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active','suspended')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('organization_admin','sales_manager')),
  active boolean not null default true,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index organization_members_user_active_idx on public.organization_members(user_id,organization_id) where active;
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  subject_type text not null,
  subject_id uuid not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_organization_created_idx on public.audit_events(organization_id,created_at desc,id);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute function private.touch_updated_at();
create trigger organization_members_updated_at before update on public.organization_members for each row execute function private.touch_updated_at();

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(user_id) values(new.id) on conflict (user_id) do nothing; return new; end; $$;
create trigger connect_auth_user_profile after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(user_id) select id from auth.users on conflict (user_id) do nothing;

create function private.is_active_user() returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.active)
$$;
create function private.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists(select 1 from public.platform_admins a where a.user_id=(select auth.uid()))
$$;
create function private.has_membership(p_organization_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.organizations o join public.organization_members m on m.organization_id=o.id
    where o.id=p_organization_id and o.status='active' and m.user_id=(select auth.uid()) and m.active
  )
$$;
create function private.is_org_admin(p_organization_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_membership(p_organization_id) and exists (
    select 1 from public.organization_members m where m.organization_id=p_organization_id
      and m.user_id=(select auth.uid()) and m.active and m.role='organization_admin'
  )
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.profiles,public.organizations,public.organization_members,public.platform_admins,public.audit_events from public,anon,authenticated;
grant select on public.profiles,public.organizations,public.organization_members,public.platform_admins,public.audit_events to authenticated;
create policy profile_own_read on public.profiles for select to authenticated using (user_id=(select auth.uid()));
create policy organizations_member_read on public.organizations for select to authenticated using (private.has_membership(id) or private.is_platform_admin());
create policy memberships_scoped_read on public.organization_members for select to authenticated using (
  private.is_platform_admin() or (private.has_membership(organization_id) and (user_id=(select auth.uid()) or private.is_org_admin(organization_id)))
);
create policy platform_role_own_read on public.platform_admins for select to authenticated using (user_id=(select auth.uid()) and private.is_active_user());
create policy audit_admin_read on public.audit_events for select to authenticated using (private.is_platform_admin() or private.is_org_admin(organization_id));

create function public.connect_update_my_profile(p_full_name text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare result public.profiles;
begin
  if not private.is_active_user() then raise exception using errcode='42501', message='forbidden'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) > 160 then raise exception using errcode='22023', message='invalid_name'; end if;
  update public.profiles set full_name=btrim(p_full_name) where user_id=auth.uid() returning * into result;
  return result;
end; $$;
create function public.connect_create_organization(p_name text,p_slug text) returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare result public.organizations;
begin
  if not private.is_platform_admin() then raise exception using errcode='42501', message='forbidden'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode='22023', message='invalid_input';
  end if;
  insert into public.organizations(name,slug) values(btrim(p_name),p_slug) returning * into result;
  insert into public.organization_members(organization_id,user_id,role) values(result.id,auth.uid(),'organization_admin');
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
    values(result.id,auth.uid(),'organization.created','organization',result.id);
  return result;
end; $$;
create function public.connect_add_member(p_organization_id uuid,p_user_id uuid,p_role text) returns public.organization_members
language plpgsql security definer set search_path = '' as $$
declare result public.organization_members;
begin
  if not private.is_org_admin(p_organization_id) then raise exception using errcode='42501', message='forbidden'; end if;
  if p_role not in ('organization_admin','sales_manager') or not exists(select 1 from public.profiles where user_id=p_user_id and active) then
    raise exception using errcode='22023', message='invalid_member';
  end if;
  insert into public.organization_members(organization_id,user_id,role) values(p_organization_id,p_user_id,p_role) returning * into result;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(p_organization_id,auth.uid(),'membership.created','membership',p_user_id,jsonb_build_object('role',p_role));
  return result;
end; $$;
create function public.connect_set_member(p_organization_id uuid,p_user_id uuid,p_expected_version bigint,p_role text,p_active boolean) returns public.organization_members
language plpgsql security definer set search_path = '' as $$
declare result public.organization_members; old_role text; old_active boolean;
begin
  if not private.is_org_admin(p_organization_id) then raise exception using errcode='42501', message='forbidden'; end if;
  if p_role not in ('organization_admin','sales_manager') or p_active is null then raise exception using errcode='22023', message='invalid_member'; end if;
  select role,active into old_role,old_active from public.organization_members where organization_id=p_organization_id and user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002', message='not_found'; end if;
  if old_role='organization_admin' and old_active and (p_role<>'organization_admin' or not p_active) and
    (select count(*) from public.organization_members where organization_id=p_organization_id and role='organization_admin' and active)=1 then
    raise exception using errcode='23514', message='last_admin';
  end if;
  update public.organization_members set role=p_role,active=p_active,version=version+1
    where organization_id=p_organization_id and user_id=p_user_id and version=p_expected_version returning * into result;
  if not found then raise exception using errcode='40001', message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(p_organization_id,auth.uid(),'membership.updated','membership',p_user_id,jsonb_build_object('role',p_role,'active',p_active));
  return result;
end; $$;

revoke all on function private.touch_updated_at(),private.create_profile(),private.is_active_user(),private.is_platform_admin(),private.has_membership(uuid),private.is_org_admin(uuid) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_active_user(),private.is_platform_admin(),private.has_membership(uuid),private.is_org_admin(uuid) to authenticated;
revoke all on function public.connect_update_my_profile(text),public.connect_create_organization(text,text),public.connect_add_member(uuid,uuid,text),public.connect_set_member(uuid,uuid,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.connect_update_my_profile(text),public.connect_create_organization(text,text),public.connect_add_member(uuid,uuid,text),public.connect_set_member(uuid,uuid,bigint,text,boolean) to authenticated;
