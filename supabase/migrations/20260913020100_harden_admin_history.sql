create or replace function public.admin_get_unit_history(
  p_unit_id uuid default null, p_project_id uuid default null, p_action text default null,
  p_created_from timestamptz default null, p_created_to timestamptz default null
)
returns table(
  id uuid, organization_id uuid, project_id uuid, unit_id uuid, unit_code text,
  action text, old_values jsonb, new_values jsonb, reason text,
  performed_by uuid, created_at timestamptz
)
language plpgsql volatile security definer set search_path = '' as $$
declare v_scope_organization uuid;
begin
  if auth.uid() is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;

  if p_project_id is not null then
    select p.organization_id into v_scope_organization from public.projects p
    where p.id = p_project_id and private.has_organization_access(p.organization_id);
    if not found then perform private.raise_admin_error('not_found'); end if;
  elsif p_unit_id is not null then
    select p.organization_id into v_scope_organization
    from public.units u join public.projects p on p.id = u.project_id
    where u.id = p_unit_id and private.has_organization_access(p.organization_id);
    if not found then perform private.raise_admin_error('not_found'); end if;
  end if;

  if v_scope_organization is not null then
    if not private.has_organization_role(v_scope_organization, array['organization_admin','seller']) then
      perform private.raise_admin_error('forbidden');
    end if;
  elsif not private.is_platform_admin() and not exists (
    select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.active and o.status='active'
      and m.role in ('organization_admin','seller')
  ) then
    perform private.raise_admin_error('forbidden');
  end if;

  return query
  select a.id, a.organization_id, a.project_id, a.unit_id, u.code, a.action,
    a.old_values, a.new_values, a.reason, a.performed_by, a.created_at
  from public.unit_audit_logs a join public.units u on u.id = a.unit_id
  where private.has_organization_access(a.organization_id)
    and (
      private.has_organization_role(a.organization_id, array['organization_admin'])
      or (a.performed_by = auth.uid() and a.action = 'unit.status_changed'
          and private.has_organization_role(a.organization_id, array['seller']))
    )
    and (p_unit_id is null or a.unit_id = p_unit_id)
    and (p_project_id is null or a.project_id = p_project_id)
    and (p_action is null or a.action = p_action)
    and (p_created_from is null or a.created_at >= p_created_from)
    and (p_created_to is null or a.created_at <= p_created_to)
  order by a.created_at desc, a.id desc;
end;
$$;

revoke all on function public.admin_get_unit_history(uuid,uuid,text,timestamptz,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.admin_get_unit_history(uuid,uuid,text,timestamptz,timestamptz) to authenticated;
