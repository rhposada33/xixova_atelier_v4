-- PC-04: private, read-only broker catalog. No Storage URL is exposed.
alter table public.projects add column broker_price_visible boolean not null default false;

create table public.broker_favorites (
  broker_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null,
  project_id uuid not null,
  unit_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (broker_user_id, unit_id),
  foreign key (organization_id, project_id, unit_id) references public.units(organization_id, project_id, id) on delete restrict
);
create index broker_favorites_project_idx on public.broker_favorites(broker_user_id, project_id);
alter table public.broker_favorites enable row level security;
revoke all on public.broker_favorites from public, anon, authenticated;

create function private.broker_catalog_project(p_project_id uuid) returns public.projects
language plpgsql stable security definer set search_path='' as $$
declare p public.projects;
begin
  select * into p from public.projects where id=p_project_id and status='published';
  if not found or not private.active_broker_access(p_project_id) then
    raise exception using errcode='P0002', message='not_found';
  end if;
  return p;
end; $$;

create function public.connect_set_broker_price_visibility(p_project_id uuid, p_expected_version bigint, p_visible boolean) returns bigint
language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
  select * into p from public.projects where id=p_project_id for update;
  if not found then raise exception using errcode='P0002', message='not_found'; end if;
  if not private.is_org_admin(p.organization_id) then raise exception using errcode='42501', message='forbidden'; end if;
  if p.version<>p_expected_version or p_visible is null then raise exception using errcode='PT409', message='version_conflict'; end if;
  update public.projects set broker_price_visible=p_visible, version=version+1 where id=p.id returning * into p;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(p.organization_id,auth.uid(),'broker.catalog_price_policy','project',p.id,jsonb_build_object('visible',p_visible,'version',p.version));
  return p.version;
end; $$;

create function public.connect_broker_catalog_projects() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'projectId',p.id,'organizationName',o.name,'name',p.name,'city',p.city,'state',p.state,
    'status',p.status,'types',coalesce(s.types,'[]'::jsonb),'availableCount',coalesce(s.available_count,0)
  ) order by o.name,p.name),'[]'::jsonb)
  from public.project_broker_access a
  join public.projects p on p.id=a.project_id and p.status='published'
  join public.organizations o on o.id=p.organization_id and o.status='active'
  left join lateral (
    select jsonb_agg(distinct u.type) as types,
      count(*) filter (where u.status='available') as available_count
    from public.units u where u.project_id=p.id and u.published
  ) s on true
  where a.broker_user_id=auth.uid() and private.active_broker_access(p.id)
$$;

create function public.connect_broker_project_detail(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; o public.organizations; result jsonb;
begin
  p:=private.broker_catalog_project(p_project_id);
  select * into o from public.organizations where id=p.organization_id;
  select jsonb_build_object('projectId',p.id,'organizationName',o.name,'name',p.name,
    'city',p.city,'state',p.state,'status',p.status,'description',p.description,
    'priceVisible',p.broker_price_visible,
    'types',coalesce(jsonb_agg(distinct u.type) filter (where u.id is not null),'[]'::jsonb),
    'availableCount',count(u.id) filter (where u.status='available'))
  into result from public.units u where u.project_id=p.id and u.published;
  return result;
end; $$;

create function public.connect_broker_inventory(p_project_id uuid, p_filters jsonb default '{}'::jsonb, p_limit integer default 20, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; result jsonb; items jsonb; total integer; sort_key text; sort_dir text;
begin
  p:=private.broker_catalog_project(p_project_id);
  if p_filters is null or jsonb_typeof(p_filters)<>'object' or
     exists(select 1 from jsonb_object_keys(p_filters) k where k not in ('floor','type','bedrooms','minArea','maxArea','minPrice','maxPrice','status','sort','direction')) or
     p_limit not between 1 and 40 or p_offset not between 0 and 1000000 then
    raise exception using errcode='22023', message='invalid_filters';
  end if;
  if (p_filters ? 'minPrice' or p_filters ? 'maxPrice' or p_filters->>'sort'='price') and not p.broker_price_visible then
    raise exception using errcode='42501', message='price_not_visible';
  end if;
  sort_key:=coalesce(p_filters->>'sort','code'); sort_dir:=coalesce(p_filters->>'direction','asc');
  if sort_key not in ('code','price','area','floor') or sort_dir not in ('asc','desc') or
    (p_filters ? 'floor' and (p_filters->>'floor' !~ '^[0-9]{1,3}$' or (p_filters->>'floor')::integer>500)) or
    (p_filters ? 'bedrooms' and (p_filters->>'bedrooms' !~ '^[0-9]{1,2}$' or (p_filters->>'bedrooms')::integer>30)) or
    (p_filters ? 'type' and char_length(p_filters->>'type')>80) or
    (p_filters ? 'status' and p_filters->>'status' not in ('available','reserved','sold','unavailable')) or
    (p_filters ? 'minArea' and p_filters->>'minArea' !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$') or
    (p_filters ? 'maxArea' and p_filters->>'maxArea' !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$') or
    (p_filters ? 'minPrice' and p_filters->>'minPrice' !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$') or
    (p_filters ? 'maxPrice' and p_filters->>'maxPrice' !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$') then
    raise exception using errcode='22023', message='invalid_filters';
  end if;
  with filtered as (
    select u.* from public.units u where u.project_id=p.id and u.published
      and (not p_filters ? 'floor' or u.floor=(p_filters->>'floor')::integer)
      and (not p_filters ? 'type' or u.type=p_filters->>'type')
      and (not p_filters ? 'bedrooms' or u.bedrooms=(p_filters->>'bedrooms')::integer)
      and (not p_filters ? 'status' or u.status=p_filters->>'status')
      and (not p_filters ? 'minArea' or u.area_m2>=(p_filters->>'minArea')::numeric)
      and (not p_filters ? 'maxArea' or u.area_m2<=(p_filters->>'maxArea')::numeric)
      and (not p_filters ? 'minPrice' or u.price_brl>=(p_filters->>'minPrice')::numeric)
      and (not p_filters ? 'maxPrice' or u.price_brl<=(p_filters->>'maxPrice')::numeric)
  ), ranked as (
    select f.*,row_number() over (order by
      case when sort_key='price' and sort_dir='asc' then f.price_brl end asc nulls last,
      case when sort_key='price' and sort_dir='desc' then f.price_brl end desc nulls last,
      case when sort_key='area' and sort_dir='asc' then f.area_m2 end asc,
      case when sort_key='area' and sort_dir='desc' then f.area_m2 end desc,
      case when sort_key='floor' and sort_dir='asc' then f.floor end asc,
      case when sort_key='floor' and sort_dir='desc' then f.floor end desc,
      case when sort_key='code' and sort_dir='desc' then f.code end desc,
      f.code asc, f.id asc) as rn from filtered f
  )
  select (select count(*) from filtered),
    coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'floor',r.floor,
      'type',r.type,'bedrooms',r.bedrooms,'bathrooms',r.bathrooms,'parkingSpaces',r.parking_spaces,
      'areaM2',r.area_m2::text,'priceBRL',case when p.broker_price_visible then r.price_brl::text end,
      'status',r.status) order by r.rn) from ranked r where r.rn>p_offset and r.rn<=p_offset+p_limit),'[]'::jsonb)
  into total,items;
  return jsonb_build_object('data',items,'total',total,'nextOffset',case when p_offset+p_limit<total then p_offset+p_limit end);
end; $$;

create function public.connect_broker_unit_detail(p_project_id uuid, p_unit_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; u public.units;
begin
  p:=private.broker_catalog_project(p_project_id);
  select * into u from public.units where id=p_unit_id and project_id=p.id and published;
  if not found then raise exception using errcode='P0002', message='not_found'; end if;
  return jsonb_build_object('id',u.id,'code',u.code,'floor',u.floor,'type',u.type,
    'bedrooms',u.bedrooms,'bathrooms',u.bathrooms,'parkingSpaces',u.parking_spaces,
    'areaM2',u.area_m2::text,'priceBRL',case when p.broker_price_visible then u.price_brl::text end,
    'status',u.status);
end; $$;

create function public.connect_broker_favorites(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; result jsonb;
begin
  p:=private.broker_catalog_project(p_project_id);
  select coalesce(jsonb_agg(f.unit_id),'[]'::jsonb) into result
    from public.broker_favorites f join public.units u on u.id=f.unit_id and u.published
    where f.broker_user_id=auth.uid() and f.project_id=p.id;
  return result;
end; $$;

create function public.connect_set_broker_favorite(p_project_id uuid, p_unit_id uuid, p_saved boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare p public.projects; u public.units;
begin
  p:=private.broker_catalog_project(p_project_id);
  select * into u from public.units where id=p_unit_id and project_id=p.id and published;
  if not found then raise exception using errcode='P0002', message='not_found'; end if;
  if p_saved is null then raise exception using errcode='22023', message='invalid_favorite'; end if;
  if p_saved then
    insert into public.broker_favorites(broker_user_id,organization_id,project_id,unit_id)
      values(auth.uid(),p.organization_id,p.id,u.id) on conflict do nothing;
  else
    delete from public.broker_favorites where broker_user_id=auth.uid() and unit_id=u.id;
  end if;
  return p_saved;
end; $$;

revoke all on function private.broker_catalog_project(uuid) from public,anon,authenticated;
revoke all on function public.connect_set_broker_price_visibility(uuid,bigint,boolean),public.connect_broker_catalog_projects(),public.connect_broker_project_detail(uuid),public.connect_broker_inventory(uuid,jsonb,integer,integer),public.connect_broker_unit_detail(uuid,uuid),public.connect_broker_favorites(uuid),public.connect_set_broker_favorite(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.connect_set_broker_price_visibility(uuid,bigint,boolean),public.connect_broker_catalog_projects(),public.connect_broker_project_detail(uuid),public.connect_broker_inventory(uuid,jsonb,integer,integer),public.connect_broker_unit_detail(uuid,uuid),public.connect_broker_favorites(uuid),public.connect_set_broker_favorite(uuid,uuid,boolean) to authenticated;
