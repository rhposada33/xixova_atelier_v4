create or replace function public.connect_private_media_allowed(p_asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_user() and exists(select 1 from public.project_assets a
    join public.projects p on p.id=a.project_id
    left join public.units u on u.id=a.unit_id and u.project_id=p.id
    where a.id=p_asset_id and a.upload_state='ready' and a.media_role is not null
      and a.asset_type in ('image','floor_plan') and (
        private.has_membership(a.organization_id) or
        (a.published and p.status='published' and (a.unit_id is null or u.published) and private.active_broker_access(a.project_id))
      ))
$$;
