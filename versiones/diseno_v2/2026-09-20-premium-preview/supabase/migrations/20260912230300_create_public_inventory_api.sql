create function public.get_public_inventory(p_organization_slug text,p_project_slug text,p_unit_code text default null)
returns table(
  organization_slug text,project_slug text,project_name text,project_id uuid,building_id uuid,building_code text,
  building_name text,building_model_path text,unit_id uuid,unit_code text,floor_id uuid,floor_number integer,
  unit_type_id uuid,unit_type_name text,status text,price_brl numeric,parking_spaces integer,bedrooms integer,
  suites integer,private_area_m2 numeric,total_area_m2 numeric,orientation text,view_type text,sun_exposure text,
  model_object_id text,interior_project_id text,updated_at timestamptz
)
language sql stable security definer set search_path=''
as $$
  select o.slug,p.slug,p.name,p.id,b.id,b.code,b.name,b.model_path,u.id,u.code,f.id,f.number,
    ut.id,ut.name,u.status,u.price_brl,u.parking_spaces,ut.bedrooms,ut.suites,ut.private_area_m2,
    ut.total_area_m2,u.orientation,u.view_type,u.sun_exposure,u.model_object_id,ut.interior_project_id,u.updated_at
  from public.organizations o
  join public.projects p on p.organization_id=o.id
  join public.buildings b on b.project_id=p.id
  join public.units u on u.project_id=p.id and u.building_id=b.id
  join public.floors f on f.id=u.floor_id and f.building_id=b.id
  join public.unit_types ut on ut.id=u.unit_type_id and ut.project_id=p.id
  where o.slug=p_organization_slug and o.status='active' and p.slug=p_project_slug and p.status='published'
    and p.published_at is not null and u.published and u.status in ('available','reserved','sold')
    and (p_unit_code is null or u.code=p_unit_code)
  order by f.number,u.code;
$$;
revoke all on function public.get_public_inventory(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_inventory(text,text,text) to anon,authenticated;
