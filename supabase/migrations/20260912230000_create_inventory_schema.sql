create table public.organizations (
  id uuid primary key,
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('organization_admin','seller','viewer')),
  created_at timestamptz not null default now(), primary key (organization_id,user_id)
);
create table public.projects (
  id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (btrim(name) <> ''), slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text, status text not null check (status in ('draft','published','archived')),
  latitude numeric, longitude numeric, timezone text not null check (btrim(timezone) <> ''),
  north_offset_degrees numeric not null default 0 check (north_offset_degrees >= -180 and north_offset_degrees <= 180),
  theme_config jsonb not null default '{}'::jsonb, default_unit_code text,
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,slug), check ((status='published' and published_at is not null) or status<>'published')
);
create table public.buildings (
  id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (btrim(name)<>''), code text not null check (btrim(code)<>''), model_path text not null check (btrim(model_path)<>''),
  floor_count integer not null check (floor_count>0), default_camera_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,code)
);
create table public.floors (
  id uuid primary key, building_id uuid not null references public.buildings(id) on delete cascade,
  number integer not null check (number>0), label text not null check (btrim(label)<>''), model_object_id text,
  created_at timestamptz not null default now(), unique(building_id,number)
);
create table public.unit_types (
  id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (btrim(name)<>''), bedrooms integer not null check (bedrooms>=0), suites integer not null check (suites>=0),
  private_area_m2 numeric not null check (private_area_m2>0), total_area_m2 numeric check (total_area_m2>0),
  interior_project_id text, floor_plan_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,name)
);
create table public.units (
  id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade, floor_id uuid not null references public.floors(id) on delete cascade,
  unit_type_id uuid not null references public.unit_types(id), code text not null check (btrim(code)<>''),
  status text not null check (status in ('available','reserved','sold','blocked','coming_soon','hidden')),
  price_brl numeric check (price_brl>=0), parking_spaces integer not null check (parking_spaces>=0),
  orientation text not null check (orientation in ('north','northeast','east','southeast','south','southwest','west','northwest')),
  view_type text check (view_type in ('sea','city','garden','pool')), sun_exposure text check (sun_exposure in ('morning','afternoon')),
  model_object_id text not null check (btrim(model_object_id)<>''), published boolean not null default false,
  reserved_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(building_id,code), unique(building_id,model_object_id),
  check ((status='reserved' and reserved_until is not null) or (status<>'reserved' and reserved_until is null))
);
create table public.unit_status_history (
  id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id) on delete cascade,
  previous_status text check (previous_status is null or previous_status in ('available','reserved','sold','blocked','coming_soon','hidden')),
  new_status text not null check (new_status in ('available','reserved','sold','blocked','coming_soon','hidden')),
  changed_by uuid references auth.users(id), reason text, created_at timestamptz not null default now()
);

create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;
$$;
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger buildings_updated_at before update on public.buildings for each row execute function public.set_updated_at();
create trigger unit_types_updated_at before update on public.unit_types for each row execute function public.set_updated_at();
create trigger units_updated_at before update on public.units for each row execute function public.set_updated_at();
