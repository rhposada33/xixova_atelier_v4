-- PC-02 is isolated from Escobar and the public marketing database.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug)<=80),
  public_slug text not null unique check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(public_slug)<=100),
  description text check (char_length(description)<=2000),
  city text not null check (char_length(btrim(city)) between 1 and 120),
  state text not null check (state ~ '^[A-Z]{2}$'),
  address text check (char_length(address)<=300),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  visibility jsonb not null default '{"description":false,"unitFeatures":false,"price":false,"images":false,"floorPlans":false,"availability":false}'::jsonb,
  version bigint not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,slug), unique (organization_id,id)
);
create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  floor integer not null check (floor between 0 and 500),
  type text not null check (char_length(btrim(type)) between 1 and 80),
  bedrooms integer not null check (bedrooms between 0 and 30),
  bathrooms integer not null check (bathrooms between 0 and 30),
  parking_spaces integer not null check (parking_spaces between 0 and 30),
  area_m2 numeric(12,3) not null check (area_m2>0),
  price_brl numeric(14,2) check (price_brl>=0),
  status text not null check (status in ('available','reserved','sold','unavailable')),
  published boolean not null default false,
  version bigint not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  unique (project_id,code), unique (organization_id,project_id,id)
);
create index units_project_idx on public.units(project_id,code);
create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  unit_id uuid,
  asset_type text not null check (asset_type in ('image','floor_plan','document','3d_model')),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  visibility text not null default 'private' check (visibility in ('private','public')),
  mime_type text not null check (char_length(mime_type) between 1 and 100),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  version bigint not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key (organization_id,project_id,unit_id) references public.units(organization_id,project_id,id) on delete restrict,
  check (asset_type<>'document' or visibility='private')
);
create table public.inventory_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  total_rows integer not null check (total_rows between 1 and 2000),
  inserted_rows integer not null,
  updated_rows integer not null,
  unchanged_rows integer not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  unique (project_id,operation_id)
);
create trigger projects_updated_at before update on public.projects for each row execute function private.touch_updated_at();
create trigger units_updated_at before update on public.units for each row execute function private.touch_updated_at();

alter table public.projects enable row level security;
alter table public.units enable row level security;
alter table public.project_assets enable row level security;
alter table public.inventory_imports enable row level security;
revoke all on public.projects,public.units,public.project_assets,public.inventory_imports from public,anon,authenticated;
grant select on public.projects,public.units,public.project_assets,public.inventory_imports to authenticated;
create policy projects_member_read on public.projects for select to authenticated using (private.has_membership(organization_id));
create policy units_member_read on public.units for select to authenticated using (private.has_membership(organization_id));
create policy assets_member_read on public.project_assets for select to authenticated using (private.has_membership(organization_id));
create policy imports_member_read on public.inventory_imports for select to authenticated using (private.has_membership(organization_id));

create function private.valid_visibility(v jsonb) returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(v)='object' and (select count(*)=6 from jsonb_object_keys(v))
    and v ?& array['description','unitFeatures','price','images','floorPlans','availability']
    and (select bool_and(jsonb_typeof(value)='boolean') from jsonb_each(v))
$$;
create function private.project_auth(p_id uuid,p_admin boolean default false) returns public.projects
language plpgsql stable security definer set search_path='' as $$
declare p public.projects;
begin
  select * into p from public.projects where id=p_id;
  if not found then raise exception using errcode='P0002', message='not_found'; end if;
  if (p_admin and not private.is_org_admin(p.organization_id)) or (not p_admin and not private.has_membership(p.organization_id)) then
    raise exception using errcode='42501', message='forbidden';
  end if;
  return p;
end; $$;
create function private.valid_unit(v jsonb,p_import boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(v)<>'object' or not (v ?& array['code','floor','type','bedrooms','bathrooms','parkingSpaces','areaM2','status','published'])
    or exists(select 1 from jsonb_object_keys(v) k where k not in ('code','floor','type','bedrooms','bathrooms','parkingSpaces','areaM2','priceBRL','status','published','expectedVersion','sourceLine'))
    or (not p_import and (v ? 'expectedVersion' or v ? 'sourceLine'))
    or (select count(*) from jsonb_object_keys(v)) > (case when p_import then 12 else 10 end)
    or upper(v->>'code') !~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'
    or char_length(btrim(v->>'type')) not between 1 and 80
    or v->>'status' not in ('available','reserved','sold','unavailable')
    or v->>'published' not in ('true','false')
    or v->>'floor' !~ '^(0|[1-9][0-9]{0,2})$' or (v->>'floor')::integer>500
    or v->>'bedrooms' !~ '^(0|[1-9][0-9]?)$' or (v->>'bedrooms')::integer>30
    or v->>'bathrooms' !~ '^(0|[1-9][0-9]?)$' or (v->>'bathrooms')::integer>30
    or v->>'parkingSpaces' !~ '^(0|[1-9][0-9]?)$' or (v->>'parkingSpaces')::integer>30
    or v->>'areaM2' !~ '^[0-9]{1,9}\.[0-9]{3}$' or (v->>'areaM2')::numeric<=0
    or (v->>'priceBRL' is not null and (v->>'priceBRL' !~ '^[0-9]{1,12}\.[0-9]{2}$' or (v->>'priceBRL')::numeric>999999999999.99))
    or (p_import and (not (v ? 'expectedVersion') or (v->>'expectedVersion' is not null and (v->>'expectedVersion' !~ '^[0-9]{1,10}$' or (v->>'expectedVersion')::bigint>2147483647)))) then return false;
  end if;
  return true;
exception when others then return false;
end; $$;

create function public.connect_create_project(p_data jsonb) returns public.projects
language plpgsql security definer set search_path='' as $$
declare r public.projects; org uuid;
begin
  if jsonb_typeof(p_data)<>'object' or not (p_data ?& array['organizationId','name','slug','publicSlug','city','state'])
    or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('organizationId','name','slug','publicSlug','description','city','state','address')) then
    raise exception using errcode='22023',message='invalid_project'; end if;
  org:=(p_data->>'organizationId')::uuid;
  if not private.is_org_admin(org) then raise exception using errcode='42501',message='forbidden'; end if;
  insert into public.projects(organization_id,name,slug,public_slug,description,city,state,address)
    values(org,btrim(p_data->>'name'),p_data->>'slug',p_data->>'publicSlug',p_data->>'description',btrim(p_data->>'city'),upper(p_data->>'state'),p_data->>'address') returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(org,auth.uid(),'project.created','project',r.id);
  return r;
end; $$;
create function public.connect_update_project(p_id uuid,p_expected_version bigint,p_data jsonb) returns public.projects
language plpgsql security definer set search_path='' as $$
declare r public.projects;
begin
  r:=private.project_auth(p_id,true);
  if jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('name','description','city','state','address','visibility'))
    or (p_data ? 'visibility' and not private.valid_visibility(p_data->'visibility')) then raise exception using errcode='22023',message='invalid_project'; end if;
  update public.projects set name=case when p_data ? 'name' then btrim(p_data->>'name') else name end,
    description=case when p_data ? 'description' then p_data->>'description' else description end,
    city=case when p_data ? 'city' then btrim(p_data->>'city') else city end,
    state=case when p_data ? 'state' then upper(p_data->>'state') else state end,
    address=case when p_data ? 'address' then p_data->>'address' else address end,
    visibility=coalesce(p_data->'visibility',visibility),version=version+1
    where id=p_id and version=p_expected_version returning * into r;
  if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'project.updated','project',r.id,jsonb_build_object('version',r.version));
  return r;
end; $$;
create function public.connect_publish_project(p_id uuid,p_expected_version bigint,p_status text) returns public.projects
language plpgsql security definer set search_path='' as $$
declare r public.projects;
begin
  r:=private.project_auth(p_id,true);
  if p_status not in ('draft','published','archived') then raise exception using errcode='22023',message='invalid_status'; end if;
  update public.projects set status=p_status,version=version+1 where id=p_id and version=p_expected_version returning * into r;
  if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'project.published','project',r.id,jsonb_build_object('status',p_status,'version',r.version));
  return r;
end; $$;
create function public.connect_create_unit(p_project_id uuid,p_data jsonb) returns public.units
language plpgsql security definer set search_path='' as $$
declare p public.projects; r public.units;
begin
  p:=private.project_auth(p_project_id,false);
  if not private.valid_unit(p_data) then raise exception using errcode='22023',message='invalid_unit'; end if;
  insert into public.units(organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,price_brl,status,published)
    values(p.organization_id,p.id,upper(p_data->>'code'),(p_data->>'floor')::integer,btrim(p_data->>'type'),(p_data->>'bedrooms')::integer,(p_data->>'bathrooms')::integer,(p_data->>'parkingSpaces')::integer,(p_data->>'areaM2')::numeric,(p_data->>'priceBRL')::numeric,p_data->>'status',(p_data->>'published')::boolean) returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(p.organization_id,auth.uid(),'unit.created','unit',r.id);
  return r;
end; $$;
create function public.connect_update_unit(p_id uuid,p_expected_version bigint,p_data jsonb) returns public.units
language plpgsql security definer set search_path='' as $$
declare r public.units;
begin
  select * into r from public.units where id=p_id;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.has_membership(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('floor','type','bedrooms','bathrooms','parkingSpaces','areaM2','priceBRL','status','published')) then raise exception using errcode='22023',message='invalid_unit'; end if;
  if not private.valid_unit(jsonb_build_object('code',r.code,'floor',coalesce(p_data->'floor',to_jsonb(r.floor)),'type',coalesce(p_data->'type',to_jsonb(r.type)),'bedrooms',coalesce(p_data->'bedrooms',to_jsonb(r.bedrooms)),'bathrooms',coalesce(p_data->'bathrooms',to_jsonb(r.bathrooms)),'parkingSpaces',coalesce(p_data->'parkingSpaces',to_jsonb(r.parking_spaces)),'areaM2',coalesce(p_data->'areaM2',to_jsonb(r.area_m2::text)),'priceBRL',coalesce(p_data->'priceBRL',to_jsonb(r.price_brl::text)),'status',coalesce(p_data->'status',to_jsonb(r.status)),'published',coalesce(p_data->'published',to_jsonb(r.published)))) then raise exception using errcode='22023',message='invalid_unit'; end if;
  update public.units set floor=coalesce((p_data->>'floor')::integer,floor),type=coalesce(p_data->>'type',type),bedrooms=coalesce((p_data->>'bedrooms')::integer,bedrooms),bathrooms=coalesce((p_data->>'bathrooms')::integer,bathrooms),parking_spaces=coalesce((p_data->>'parkingSpaces')::integer,parking_spaces),area_m2=coalesce((p_data->>'areaM2')::numeric,area_m2),price_brl=case when p_data ? 'priceBRL' then (p_data->>'priceBRL')::numeric else price_brl end,status=coalesce(p_data->>'status',status),published=coalesce((p_data->>'published')::boolean,published),version=version+1 where id=p_id and version=p_expected_version returning * into r;
  if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'unit.updated','unit',r.id,jsonb_build_object('version',r.version));
  return r;
end; $$;
create function public.connect_delete_unit(p_id uuid,p_expected_version bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.units;
begin
  select * into r from public.units where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.has_membership(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if r.version<>p_expected_version then raise exception using errcode='PT409',message='version_conflict'; end if;
  delete from public.units where id=p_id;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'unit.deleted','unit',r.id,jsonb_build_object('code',r.code));
  return true;
end; $$;

-- Pure database preview. Confirmation runs the same validation and diff while holding a project lock.
create function private.inventory_diff(p_project_id uuid,p_rows jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; u public.units; lines jsonb:='[]'::jsonb; seen text[]:=array[]::text[]; cls text; n integer:=0;
begin
  perform private.project_auth(p_project_id,false);
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 2000 or octet_length(p_rows::text)>2097152 then raise exception using errcode='22023',message='invalid_import'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    n:=n+1;
    if not private.valid_unit(item,true) or upper(item->>'code')=any(seen) then raise exception using errcode='22023',message='invalid_import_row'; end if;
    seen:=array_append(seen,upper(item->>'code'));
    select * into u from public.units where project_id=p_project_id and code=upper(item->>'code');
    if not found then cls:=case when item->>'expectedVersion' is null then 'new' else 'conflict' end;
    elsif (item->>'expectedVersion')::bigint is distinct from u.version then cls:='conflict';
    elsif u.floor=(item->>'floor')::integer and u.type=item->>'type' and u.bedrooms=(item->>'bedrooms')::integer and u.bathrooms=(item->>'bathrooms')::integer and u.parking_spaces=(item->>'parkingSpaces')::integer and u.area_m2=(item->>'areaM2')::numeric and u.price_brl is not distinct from (item->>'priceBRL')::numeric and u.status=item->>'status' and u.published=(item->>'published')::boolean then cls:='unchanged';
    else cls:='changed'; end if;
    lines:=lines||jsonb_build_array(jsonb_build_object('row',coalesce((item->>'sourceLine')::integer,n+1),'code',upper(item->>'code'),'classification',cls,'beforeVersion',u.version));
  end loop;
  return jsonb_build_object('lines',lines,'hash',encode(extensions.digest(p_rows::text,'sha256'),'hex'),'totalRows',n);
end; $$;
create function public.connect_preview_inventory(p_project_id uuid,p_rows jsonb) returns jsonb
language sql stable security definer set search_path='' as $$ select private.inventory_diff(p_project_id,p_rows) $$;
create function public.connect_confirm_inventory(p_project_id uuid,p_rows jsonb,p_expected_hash text,p_operation_id uuid) returns public.inventory_imports
language plpgsql security definer set search_path='' as $$
declare p public.projects; d jsonb; item jsonb; line jsonb; r public.inventory_imports; inserted_count int:=0; updated_count int:=0; unchanged_count int:=0; u public.units;
begin
  p:=private.project_auth(p_project_id,false);
  perform 1 from public.projects where id=p_project_id for update;
  d:=private.inventory_diff(p_project_id,p_rows);
  if d->>'hash' is distinct from p_expected_hash then raise exception using errcode='PT409',message='preview_changed'; end if;
  select * into r from public.inventory_imports where project_id=p_project_id and operation_id=p_operation_id;
  if found then
    if r.file_hash<>p_expected_hash then raise exception using errcode='PT409',message='operation_conflict'; end if;
    return r;
  end if;
  if exists(select 1 from jsonb_array_elements(d->'lines') l where l->>'classification'='conflict') then raise exception using errcode='PT409',message='version_conflict'; end if;
  for item,line in select a.value,b.value from jsonb_array_elements(p_rows) with ordinality a(value,n) join jsonb_array_elements(d->'lines') with ordinality b(value,n) using(n) loop
    if line->>'classification'='new' then
      insert into public.units(organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,price_brl,status,published)
        values(p.organization_id,p.id,upper(item->>'code'),(item->>'floor')::integer,item->>'type',(item->>'bedrooms')::integer,(item->>'bathrooms')::integer,(item->>'parkingSpaces')::integer,(item->>'areaM2')::numeric,(item->>'priceBRL')::numeric,item->>'status',(item->>'published')::boolean) returning * into u;
      inserted_count:=inserted_count+1;
    elsif line->>'classification'='changed' then
      update public.units set floor=(item->>'floor')::integer,type=item->>'type',bedrooms=(item->>'bedrooms')::integer,bathrooms=(item->>'bathrooms')::integer,parking_spaces=(item->>'parkingSpaces')::integer,area_m2=(item->>'areaM2')::numeric,price_brl=(item->>'priceBRL')::numeric,status=item->>'status',published=(item->>'published')::boolean,version=version+1
        where project_id=p.id and code=upper(item->>'code') and version=(item->>'expectedVersion')::bigint returning * into u;
      if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
      updated_count:=updated_count+1;
    else unchanged_count:=unchanged_count+1; continue; end if;
    insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(p.organization_id,auth.uid(),'unit.imported','unit',u.id,jsonb_build_object('operationId',p_operation_id,'code',u.code));
  end loop;
  insert into public.inventory_imports(organization_id,project_id,actor_id,operation_id,file_hash,total_rows,inserted_rows,updated_rows,unchanged_rows)
    values(p.organization_id,p.id,auth.uid(),p_operation_id,p_expected_hash,(d->>'totalRows')::integer,inserted_count,updated_count,unchanged_count) returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(p.organization_id,auth.uid(),'inventory.imported','project',p.id,jsonb_build_object('importId',r.id,'inserted',inserted_count,'updated',updated_count,'unchanged',unchanged_count));
  return r;
end; $$;

create function public.connect_public_project(p_public_slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; listed jsonb;
begin
  select * into p from public.projects where public_slug=p_public_slug and status='published';
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('code',u.code,'floor',case when (p.visibility->>'unitFeatures')::boolean then u.floor end,'type',case when (p.visibility->>'unitFeatures')::boolean then u.type end,'bedrooms',case when (p.visibility->>'unitFeatures')::boolean then u.bedrooms end,'bathrooms',case when (p.visibility->>'unitFeatures')::boolean then u.bathrooms end,'parkingSpaces',case when (p.visibility->>'unitFeatures')::boolean then u.parking_spaces end,'areaM2',case when (p.visibility->>'unitFeatures')::boolean then u.area_m2::text end,'priceBRL',case when (p.visibility->>'price')::boolean then u.price_brl::text end,'status',case when (p.visibility->>'availability')::boolean then u.status end)) order by u.code),'[]'::jsonb) into listed from public.units u where u.project_id=p.id and u.published;
  return jsonb_strip_nulls(jsonb_build_object('publicSlug',p.public_slug,'name',p.name,'city',p.city,'state',p.state,'description',case when (p.visibility->>'description')::boolean then p.description end,'units',listed));
end; $$;

revoke all on function private.valid_visibility(jsonb),private.valid_unit(jsonb,boolean),private.project_auth(uuid,boolean),private.inventory_diff(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.connect_create_project(jsonb),public.connect_update_project(uuid,bigint,jsonb),public.connect_publish_project(uuid,bigint,text),public.connect_create_unit(uuid,jsonb),public.connect_update_unit(uuid,bigint,jsonb),public.connect_delete_unit(uuid,bigint),public.connect_preview_inventory(uuid,jsonb),public.connect_confirm_inventory(uuid,jsonb,text,uuid),public.connect_public_project(text) from public,anon,authenticated;
grant execute on function public.connect_create_project(jsonb),public.connect_update_project(uuid,bigint,jsonb),public.connect_publish_project(uuid,bigint,text),public.connect_create_unit(uuid,jsonb),public.connect_update_unit(uuid,bigint,jsonb),public.connect_delete_unit(uuid,bigint),public.connect_preview_inventory(uuid,jsonb),public.connect_confirm_inventory(uuid,jsonb,text,uuid) to authenticated;
grant execute on function public.connect_public_project(text) to anon,authenticated;
