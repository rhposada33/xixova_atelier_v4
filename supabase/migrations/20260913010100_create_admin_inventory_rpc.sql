create function private.raise_admin_error(p_code text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'inventory_admin_error',
    detail = jsonb_build_object('code', p_code)::text;
end;
$$;
revoke all on function private.raise_admin_error(text) from public, anon, authenticated;

create function public.admin_update_unit_price(
  p_unit_id uuid, p_expected_version bigint, p_new_price numeric
)
returns public.units language plpgsql security definer set search_path = '' as $$
declare v_unit public.units; v_org_id uuid; v_actor uuid := auth.uid(); v_old_price numeric;
begin
  if v_actor is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;
  if p_new_price is null or p_new_price = 'NaN'::numeric or p_new_price < 0
     or p_expected_version is null or p_expected_version < 1 then
    perform private.raise_admin_error('invalid_input');
  end if;

  select u.* into v_unit
  from public.units u join public.projects p on p.id = u.project_id
  where u.id = p_unit_id and private.has_organization_access(p.organization_id)
  for update of u;
  if not found then perform private.raise_admin_error('not_found'); end if;
  select p.organization_id into v_org_id from public.projects p where p.id = v_unit.project_id;
  if not private.has_organization_role(v_org_id, array['organization_admin']) then
    perform private.raise_admin_error('forbidden');
  end if;
  if v_unit.version <> p_expected_version then perform private.raise_admin_error('version_conflict'); end if;

  v_old_price := v_unit.price_brl;
  update public.units set price_brl = p_new_price, version = version + 1
  where id = p_unit_id returning * into v_unit;
  insert into public.unit_audit_logs(organization_id, project_id, unit_id, action, old_values, new_values, performed_by)
  values (v_org_id, v_unit.project_id, v_unit.id, 'unit.price_updated',
    jsonb_build_object('price_brl', v_old_price),
    jsonb_build_object('price_brl', p_new_price, 'version', v_unit.version), v_actor);
  return v_unit;
end;
$$;

create function public.admin_set_unit_published(
  p_unit_id uuid, p_expected_version bigint, p_published boolean
)
returns public.units language plpgsql security definer set search_path = '' as $$
declare v_unit public.units; v_org_id uuid; v_actor uuid := auth.uid(); v_old_published boolean;
begin
  if v_actor is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;
  if p_published is null or p_expected_version is null or p_expected_version < 1 then
    perform private.raise_admin_error('invalid_input');
  end if;
  select u.* into v_unit
  from public.units u join public.projects p on p.id = u.project_id
  where u.id = p_unit_id and private.has_organization_access(p.organization_id)
  for update of u;
  if not found then perform private.raise_admin_error('not_found'); end if;
  select p.organization_id into v_org_id from public.projects p where p.id = v_unit.project_id;
  if not private.has_organization_role(v_org_id, array['organization_admin']) then
    perform private.raise_admin_error('forbidden');
  end if;
  if v_unit.version <> p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  v_old_published := v_unit.published;
  update public.units set published = p_published, version = version + 1
  where id = p_unit_id returning * into v_unit;
  insert into public.unit_audit_logs(organization_id, project_id, unit_id, action, old_values, new_values, performed_by)
  values (v_org_id, v_unit.project_id, v_unit.id,
    case when p_published then 'unit.published' else 'unit.unpublished' end,
    jsonb_build_object('published', v_old_published),
    jsonb_build_object('published', p_published, 'version', v_unit.version), v_actor);
  return v_unit;
end;
$$;

create function public.admin_change_unit_status(
  p_unit_id uuid, p_expected_version bigint, p_expected_status text,
  p_new_status text, p_reason text
)
returns public.units language plpgsql security definer set search_path = '' as $$
declare
  v_unit public.units; v_org_id uuid; v_actor uuid := auth.uid();
  v_is_admin boolean; v_is_seller boolean; v_action text := 'unit.status_changed';
  v_old_values jsonb;
begin
  if v_actor is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;
  if p_expected_version is null or p_expected_version < 1
     or p_expected_status is null or p_new_status is null or btrim(coalesce(p_reason, '')) = '' then
    perform private.raise_admin_error('invalid_input');
  end if;

  select u.* into v_unit
  from public.units u join public.projects p on p.id = u.project_id
  where u.id = p_unit_id and private.has_organization_access(p.organization_id)
  for update of u;
  if not found then perform private.raise_admin_error('not_found'); end if;
  select p.organization_id into v_org_id from public.projects p where p.id = v_unit.project_id;
  v_is_admin := private.has_organization_role(v_org_id, array['organization_admin']);
  v_is_seller := private.has_organization_role(v_org_id, array['seller']);
  if not (v_is_admin or v_is_seller) then perform private.raise_admin_error('forbidden'); end if;
  if v_unit.version <> p_expected_version then perform private.raise_admin_error('version_conflict'); end if;
  if v_unit.status <> p_expected_status then perform private.raise_admin_error('status_conflict'); end if;
  if not (
    (v_is_admin and (v_unit.status, p_new_status) in (
      ('available','reserved'), ('reserved','available'), ('reserved','sold'),
      ('available','sold'), ('sold','available')
    ))
    or (v_is_seller and (
      (v_unit.status = 'available' and p_new_status = 'reserved')
      or (v_unit.status = 'reserved' and p_new_status = 'available' and v_unit.reserved_by = v_actor)
    ))
  ) then
    if v_is_admin or v_is_seller then
      perform private.raise_admin_error('invalid_transition');
    else
      perform private.raise_admin_error('forbidden');
    end if;
  end if;

  v_old_values := jsonb_build_object(
    'status', v_unit.status, 'reserved_by', v_unit.reserved_by,
    'reserved_at', v_unit.reserved_at, 'reserved_until', v_unit.reserved_until
  );
  if v_unit.status = 'sold' and p_new_status = 'available' then v_action := 'unit.sold_reverted'; end if;

  update public.units set
    status = p_new_status,
    reserved_by = case when p_new_status = 'reserved' then v_actor else null end,
    reserved_at = case when p_new_status = 'reserved' then now() else null end,
    reserved_until = null::timestamptz,
    version = version + 1
  where id = p_unit_id returning * into v_unit;

  insert into public.unit_status_history(unit_id, previous_status, new_status, changed_by, reason)
  values (v_unit.id, p_expected_status, p_new_status, v_actor, btrim(p_reason));
  insert into public.unit_audit_logs(organization_id, project_id, unit_id, action, old_values, new_values, reason, performed_by)
  values (v_org_id, v_unit.project_id, v_unit.id, v_action, v_old_values,
    jsonb_build_object('status', v_unit.status, 'reserved_by', v_unit.reserved_by,
      'reserved_at', v_unit.reserved_at, 'reserved_until', v_unit.reserved_until, 'version', v_unit.version),
    btrim(p_reason), v_actor);
  return v_unit;
end;
$$;

create function public.admin_get_unit_history(
  p_unit_id uuid default null, p_project_id uuid default null, p_action text default null,
  p_created_from timestamptz default null, p_created_to timestamptz default null
)
returns table(
  id uuid, organization_id uuid, project_id uuid, unit_id uuid, unit_code text,
  action text, old_values jsonb, new_values jsonb, reason text,
  performed_by uuid, created_at timestamptz
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.raise_admin_error('forbidden'); end if;
  if not private.is_active_user() then perform private.raise_admin_error('inactive_user'); end if;
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

revoke all on function public.admin_update_unit_price(uuid,bigint,numeric) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_unit_published(uuid,bigint,boolean) from public, anon, authenticated, service_role;
revoke all on function public.admin_change_unit_status(uuid,bigint,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.admin_get_unit_history(uuid,uuid,text,timestamptz,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_unit_price(uuid,bigint,numeric) to authenticated;
grant execute on function public.admin_set_unit_published(uuid,bigint,boolean) to authenticated;
grant execute on function public.admin_change_unit_status(uuid,bigint,text,text,text) to authenticated;
grant execute on function public.admin_get_unit_history(uuid,uuid,text,timestamptz,timestamptz) to authenticated;
