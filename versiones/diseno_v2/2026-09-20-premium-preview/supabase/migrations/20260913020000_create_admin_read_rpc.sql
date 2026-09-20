create function public.admin_list_units(
  p_organization_id uuid default null,
  p_project_id uuid default null,
  p_building_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_search text default null,
  p_floor integer default null,
  p_status text default null,
  p_bedrooms integer default null,
  p_orientation text default null,
  p_published boolean default null,
  p_sort_by text default 'floor',
  p_sort_direction text default 'asc'
)
returns table(
  id uuid, organization_id uuid, project_id uuid, building_id uuid, floor_id uuid, unit_type_id uuid,
  code text, floor integer, unit_type_name text, status text, bedrooms integer, suites integer,
  parking_spaces integer, private_area_m2 numeric, total_area_m2 numeric, orientation text,
  view_type text, sun_exposure text, price_brl numeric, model_object_id text,
  interior_project_id text, published boolean, reserved_by uuid, reserved_at timestamptz,
  reserved_until timestamptz, version bigint, updated_at timestamptz, total_count bigint
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 100
     or (p_floor is not null and p_floor < 1)
     or (p_bedrooms is not null and p_bedrooms < 0)
     or p_sort_by not in ('code','floor','price','updated_at')
     or p_sort_direction not in ('asc','desc') then
    perform private.raise_admin_error('invalid_input');
  end if;

  return query
  select u.id, p.organization_id, u.project_id, u.building_id, u.floor_id, u.unit_type_id,
    u.code, f.number, ut.name, u.status, ut.bedrooms, ut.suites, u.parking_spaces,
    ut.private_area_m2, ut.total_area_m2, u.orientation, u.view_type, u.sun_exposure,
    u.price_brl, u.model_object_id, ut.interior_project_id, u.published,
    u.reserved_by, u.reserved_at, u.reserved_until, u.version, u.updated_at,
    count(*) over() as total_count
  from public.units u
  join public.projects p on p.id = u.project_id
  join public.floors f on f.id = u.floor_id
  join public.unit_types ut on ut.id = u.unit_type_id
  where private.has_organization_access(p.organization_id)
    and (p_organization_id is null or p.organization_id = p_organization_id)
    and (p_project_id is null or u.project_id = p_project_id)
    and (p_building_id is null or u.building_id = p_building_id)
    and (p_search is null or btrim(p_search) = '' or u.code ilike '%' || btrim(p_search) || '%')
    and (p_floor is null or f.number = p_floor)
    and (p_status is null or u.status = p_status)
    and (p_bedrooms is null or ut.bedrooms = p_bedrooms)
    and (p_orientation is null or u.orientation = p_orientation)
    and (p_published is null or u.published = p_published)
  order by
    case when p_sort_by='code' and p_sort_direction='asc' then u.code end asc,
    case when p_sort_by='code' and p_sort_direction='desc' then u.code end desc,
    case when p_sort_by='floor' and p_sort_direction='asc' then f.number end asc,
    case when p_sort_by='floor' and p_sort_direction='desc' then f.number end desc,
    case when p_sort_by='price' and p_sort_direction='asc' then u.price_brl end asc nulls last,
    case when p_sort_by='price' and p_sort_direction='desc' then u.price_brl end desc nulls last,
    case when p_sort_by='updated_at' and p_sort_direction='asc' then u.updated_at end asc,
    case when p_sort_by='updated_at' and p_sort_direction='desc' then u.updated_at end desc,
    u.code asc, u.id asc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

create function public.admin_get_project_summary(p_project_id uuid)
returns table(
  project_id uuid, total bigint, available bigint, reserved bigint, sold bigint,
  hidden bigint, recently_updated bigint
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and private.has_organization_access(p.organization_id)
  ) then perform private.raise_admin_error('not_found'); end if;

  return query select p_project_id,
    count(*)::bigint,
    count(*) filter (where u.status='available')::bigint,
    count(*) filter (where u.status='reserved')::bigint,
    count(*) filter (where u.status='sold')::bigint,
    count(*) filter (where not u.published)::bigint,
    count(*) filter (where u.updated_at >= now() - interval '7 days')::bigint
  from public.units u where u.project_id = p_project_id;
end;
$$;

revoke all on function public.admin_list_units(uuid,uuid,uuid,integer,integer,text,integer,text,integer,text,boolean,text,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_get_project_summary(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_list_units(uuid,uuid,uuid,integer,integer,text,integer,text,integer,text,boolean,text,text) to authenticated;
grant execute on function public.admin_get_project_summary(uuid) to authenticated;
