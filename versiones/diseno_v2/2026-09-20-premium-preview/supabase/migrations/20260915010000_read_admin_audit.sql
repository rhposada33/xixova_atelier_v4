-- Local-only proposal: safe, paginated onboarding/structure audit reading.
-- No staging or production application is authorized at this checkpoint.
create function private.audit_display_values(p_values jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, case
    when jsonb_typeof(v) = 'string' then to_jsonb(
      regexp_replace(v #>> '{}', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redigido]', 'gi'))
    else v end), '{}'::jsonb)
  from jsonb_each(coalesce(p_values, '{}'::jsonb)) as fields(k,v)
  where k = any(array[
    'name','slug','status','role','active','code','label','version',
    'country','state','city','timezone','default_currency','currency',
    'public_inventory_enabled','visual_experience_enabled','number',
    'private_area_m2','total_area_m2','bedrooms','suites','bathrooms',
    'parking_spaces','count','start','end','rows','new','updated',
    'unchanged','affected_units','error_code'
  ]) and jsonb_typeof(v) in ('string','number','boolean','null');
$$;
revoke all on function private.audit_display_values(jsonb) from public, anon, authenticated;

-- Clients receive only projected fields from the RPC, never raw audit JSON.
revoke select on public.admin_audit_logs from authenticated;
drop policy if exists "organization managers read admin audit" on public.admin_audit_logs;

create index admin_audit_logs_actor_created_idx
  on public.admin_audit_logs(performed_by,created_at desc,id);

create function public.admin_list_audit_logs(
  p_organization_id uuid default null,
  p_project_id uuid default null,
  p_action text default null,
  p_resource_type text default null,
  p_actor_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns table(
  id uuid, organization_id uuid, organization_name text,
  project_id uuid, project_name text, action text, resource_type text,
  resource_name text, actor_id uuid, actor_name text, created_at timestamptz,
  old_values jsonb, new_values jsonb, reason text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or (p_date_from is not null and p_date_to is not null and p_date_from > p_date_to)
    or length(coalesce(p_action,'')) > 100
    or length(coalesce(p_resource_type,'')) > 50 then
    perform private.raise_admin_error('invalid_input');
  end if;
  if not private.is_platform_admin() and not exists (
    select 1 from public.organization_members m
      join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.role='organization_admin'
      and m.active and m.removed_at is null and o.status='active'
  ) then perform private.raise_admin_error('forbidden'); end if;
  if p_organization_id is not null and not (
    private.is_platform_admin() or exists (
      select 1 from public.organization_members m
        join public.organizations o on o.id=m.organization_id
      where m.organization_id=p_organization_id and m.user_id=auth.uid()
        and m.role='organization_admin' and m.active
        and m.removed_at is null and o.status='active')) then
    perform private.raise_admin_error('not_found');
  end if;
  return query
  select a.id, o.id,
    regexp_replace(o.name,'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[redigido]','gi'),
    p.id, regexp_replace(coalesce(p.name,''),'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[redigido]','gi'),
    a.action, a.resource_type,
    regexp_replace(coalesce(case a.resource_type
      when 'organization' then o.name
      when 'project' then p.name
      when 'building' then b.name
      when 'floor' then f.label
      when 'unit_type' then t.name
      when 'unit' then u.code
      when 'membership' then member_profile.full_name
      else null end, 'Registro administrativo'),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redigido]', 'gi') as resource_name,
    a.performed_by,
    regexp_replace(coalesce(actor_profile.full_name,'Usuário'),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redigido]', 'gi') as actor_name,
    a.created_at, private.audit_display_values(a.old_values),
    private.audit_display_values(a.new_values),
    regexp_replace(coalesce(a.reason,''),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redigido]', 'gi') as reason,
    count(*) over() as total_count
  from public.admin_audit_logs a
  join public.organizations o on o.id=a.organization_id
  left join public.projects p on p.id=a.project_id
  left join public.buildings b on a.resource_type='building' and b.id=a.resource_id
  left join public.floors f on a.resource_type='floor' and f.id=a.resource_id
  left join public.unit_types t on a.resource_type='unit_type' and t.id=a.resource_id
  left join public.units u on a.resource_type='unit' and u.id=a.resource_id
  left join public.profiles actor_profile on actor_profile.user_id=a.performed_by
  left join public.profiles member_profile on a.resource_type='membership' and member_profile.user_id=a.resource_id
  where (private.is_platform_admin() or (
    o.status='active' and exists (
      select 1 from public.organization_members m
      where m.organization_id=o.id and m.user_id=auth.uid()
        and m.role='organization_admin' and m.active and m.removed_at is null)))
    and (p_organization_id is null or o.id=p_organization_id)
    and (p_project_id is null or a.project_id=p_project_id)
    and (p_action is null or a.action=p_action)
    and (p_resource_type is null or a.resource_type=p_resource_type)
    and (p_actor_id is null or a.performed_by=p_actor_id)
    and (p_date_from is null or a.created_at>=p_date_from)
    and (p_date_to is null or a.created_at<=p_date_to)
  order by a.created_at desc,a.id desc
  offset (p_page-1)*p_page_size limit p_page_size;
end;
$$;
revoke all on function public.admin_list_audit_logs(uuid,uuid,text,text,uuid,timestamptz,timestamptz,integer,integer)
  from public, anon, authenticated;
grant execute on function public.admin_list_audit_logs(uuid,uuid,text,text,uuid,timestamptz,timestamptz,integer,integer)
  to authenticated;

create function public.admin_list_audit_actors(
  p_organization_id uuid default null,p_search text default null,p_limit integer default 50
)
returns table(actor_id uuid,actor_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active_user();
  if p_limit < 1 or p_limit > 100 or length(coalesce(p_search,'')) > 100 then
    perform private.raise_admin_error('invalid_input');
  end if;
  if not private.is_platform_admin() and not exists (
    select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.role='organization_admin' and m.active
      and m.removed_at is null and o.status='active') then perform private.raise_admin_error('forbidden'); end if;
  if p_organization_id is not null and not (
    private.is_platform_admin() or exists (
      select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
      where m.organization_id=p_organization_id and m.user_id=auth.uid()
        and m.role='organization_admin' and m.active and m.removed_at is null
        and o.status='active')) then perform private.raise_admin_error('not_found'); end if;
  return query select distinct a.performed_by,
    regexp_replace(coalesce(pr.full_name,'Usuário'),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[redigido]','gi') as name
  from public.admin_audit_logs a join public.organizations o on o.id=a.organization_id
    left join public.profiles pr on pr.user_id=a.performed_by
  where (private.is_platform_admin() or (o.status='active' and exists (
    select 1 from public.organization_members m where m.organization_id=o.id
      and m.user_id=auth.uid() and m.role='organization_admin'
      and m.active and m.removed_at is null)))
    and (p_organization_id is null or a.organization_id=p_organization_id)
    and (p_search is null or coalesce(pr.full_name,'Usuário') ilike '%'||p_search||'%')
  order by name,a.performed_by limit p_limit;
end;
$$;
revoke all on function public.admin_list_audit_actors(uuid,text,integer)
  from public,anon,authenticated;
grant execute on function public.admin_list_audit_actors(uuid,text,integer)
  to authenticated;
