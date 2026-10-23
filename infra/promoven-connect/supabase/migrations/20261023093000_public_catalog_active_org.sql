-- Hide public catalog when its Connect organization is inactive.
create or replace function public.connect_public_project(p_public_slug text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; listed jsonb;
begin
  select * into p from public.projects where public_slug=p_public_slug and status='published';
  if not found or not exists(select 1 from public.organizations o where o.id=p.organization_id and o.status='active') then return null; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('code',u.code,'floor',case when (p.visibility->>'unitFeatures')::boolean then u.floor end,'type',case when (p.visibility->>'unitFeatures')::boolean then u.type end,'bedrooms',case when (p.visibility->>'unitFeatures')::boolean then u.bedrooms end,'bathrooms',case when (p.visibility->>'unitFeatures')::boolean then u.bathrooms end,'parkingSpaces',case when (p.visibility->>'unitFeatures')::boolean then u.parking_spaces end,'areaM2',case when (p.visibility->>'unitFeatures')::boolean then u.area_m2::text end,'priceBRL',case when (p.visibility->>'price')::boolean then u.price_brl::text end,'status',case when (p.visibility->>'availability')::boolean then u.status end)) order by u.code),'[]'::jsonb) into listed from public.units u where u.project_id=p.id and u.published;
  return jsonb_strip_nulls(jsonb_build_object('publicSlug',p.public_slug,'name',p.name,'city',p.city,'state',p.state,'description',case when (p.visibility->>'description')::boolean then p.description end,'units',listed));
end; $$;

