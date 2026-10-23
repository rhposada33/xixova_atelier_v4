-- Asset publication also respects the project-level visibility switches.
create or replace function public.connect_public_media_allowed(p_asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.project_assets a join public.projects p on p.id=a.project_id
    join public.organizations o on o.id=p.organization_id
    left join public.units u on u.id=a.unit_id and u.project_id=p.id
    where a.id=p_asset_id and a.upload_state='ready' and a.published and a.visibility='public'
      and a.asset_type in ('image','floor_plan') and a.media_role is not null
      and p.status='published' and o.status='active'
      and case when a.media_role='floor_plan' then (p.visibility->>'floorPlans')::boolean
               else (p.visibility->>'images')::boolean end
      and (a.unit_id is null or (u.published and u.status='available')))
$$;
