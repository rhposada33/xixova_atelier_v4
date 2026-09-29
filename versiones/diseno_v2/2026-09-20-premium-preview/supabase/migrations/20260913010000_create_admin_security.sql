create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.organization_members add column active boolean not null default true;
alter table public.units
  add column version bigint not null default 1 check (version > 0),
  add column reserved_by uuid references auth.users(id),
  add column reserved_at timestamptz;

do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.units'::regclass
    and c.contype = 'c'
    and pg_catalog.pg_get_constraintdef(c.oid) like '%reserved_until%';
  if constraint_name is not null then
    execute format('alter table public.units drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.units add constraint units_reservation_fields_check check (
  (status = 'reserved') or
  (reserved_by is null and reserved_at is null and reserved_until is null)
);

create table public.unit_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  unit_id uuid not null references public.units(id),
  action text not null check (action in (
    'unit.price_updated', 'unit.status_changed', 'unit.published',
    'unit.unpublished', 'unit.sold_reverted'
  )),
  old_values jsonb not null,
  new_values jsonb not null,
  reason text,
  performed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index organization_members_active_user_idx
  on public.organization_members(user_id, organization_id) where active;
create index units_admin_project_code_idx on public.units(project_id, code, id);
create index units_admin_project_updated_idx on public.units(project_id, updated_at desc, id);
create index unit_audit_logs_organization_created_idx on public.unit_audit_logs(organization_id, created_at desc);
create index unit_audit_logs_project_created_idx on public.unit_audit_logs(project_id, created_at desc);
create index unit_audit_logs_unit_created_idx on public.unit_audit_logs(unit_id, created_at desc);
create index unit_audit_logs_actor_created_idx on public.unit_audit_logs(performed_by, created_at desc);

create function private.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users for each row execute function private.create_profile_for_auth_user();

insert into public.profiles(user_id)
select id from auth.users
on conflict (user_id) do nothing;

create trigger profiles_updated_at
before update on public.profiles for each row execute function public.set_updated_at();

create function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.active
  );
$$;

create function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

create function private.has_organization_access(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active'
      and (
        private.is_platform_admin()
        or exists (
          select 1 from public.organization_members m
          where m.organization_id = o.id
            and m.user_id = (select auth.uid())
            and m.active
        )
      )
  );
$$;

create function private.has_organization_role(p_organization_id uuid, p_allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_organization_access(p_organization_id) and (
    private.is_platform_admin()
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
        and m.active and m.role = any(p_allowed_roles)
    )
  );
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function private.is_active_user() from public, anon, authenticated;
revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.has_organization_access(uuid) from public, anon, authenticated;
revoke all on function private.has_organization_role(uuid,text[]) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_organization_access(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid,text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.unit_audit_logs enable row level security;

revoke all on table public.profiles, public.platform_admins, public.unit_audit_logs from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update(full_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.platform_admins to authenticated;
grant select on table public.unit_audit_logs to authenticated;

create policy "users read own profile" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "active users update own presentation" on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and private.is_active_user())
  with check (user_id = (select auth.uid()) and private.is_active_user());
create policy "users read own platform role" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) and private.is_active_user());
create policy "authorized users read unit audit" on public.unit_audit_logs for select to authenticated
  using (
    private.has_organization_role(organization_id, array['organization_admin'])
    or (
      performed_by = (select auth.uid())
      and action = 'unit.status_changed'
      and private.has_organization_role(organization_id, array['seller'])
    )
  );

drop policy if exists "members read own membership" on public.organization_members;
drop policy if exists "members read own organizations" on public.organizations;
drop policy if exists "members read own projects" on public.projects;
drop policy if exists "members read own buildings" on public.buildings;
drop policy if exists "members read own floors" on public.floors;
drop policy if exists "members read own unit types" on public.unit_types;
drop policy if exists "members read own units" on public.units;
drop policy if exists "members read own unit history" on public.unit_status_history;

create policy "active users read memberships" on public.organization_members for select to authenticated
  using (
    (private.is_platform_admin() and private.has_organization_access(organization_id))
    or (user_id = (select auth.uid()) and active and private.has_organization_access(organization_id))
  );
create policy "active users read organizations" on public.organizations for select to authenticated
  using (private.has_organization_access(id));
create policy "active users read projects" on public.projects for select to authenticated
  using (private.has_organization_access(organization_id));
create policy "active users read buildings" on public.buildings for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = buildings.project_id and private.has_organization_access(p.organization_id)
  ));
create policy "active users read floors" on public.floors for select to authenticated
  using (exists (
    select 1 from public.buildings b join public.projects p on p.id = b.project_id
    where b.id = floors.building_id and private.has_organization_access(p.organization_id)
  ));
create policy "active users read unit types" on public.unit_types for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = unit_types.project_id and private.has_organization_access(p.organization_id)
  ));
create policy "active users read units" on public.units for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = units.project_id and private.has_organization_access(p.organization_id)
  ));
create policy "authorized users read status history" on public.unit_status_history for select to authenticated
  using (exists (
    select 1 from public.units u join public.projects p on p.id = u.project_id
    where u.id = unit_status_history.unit_id
      and (
        private.has_organization_role(p.organization_id, array['organization_admin'])
        or (
          unit_status_history.changed_by = (select auth.uid())
          and private.has_organization_role(p.organization_id, array['seller'])
        )
      )
  ));
