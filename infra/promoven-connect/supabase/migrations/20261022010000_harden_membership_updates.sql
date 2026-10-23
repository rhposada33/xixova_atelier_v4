create or replace function public.connect_set_member(p_organization_id uuid,p_user_id uuid,p_expected_version bigint,p_role text,p_active boolean) returns public.organization_members
language plpgsql security definer set search_path = '' as $$
declare result public.organization_members; old_role text; old_active boolean; old_version bigint;
begin
  if not private.is_org_admin(p_organization_id) then raise exception using errcode='42501', message='forbidden'; end if;
  if p_role not in ('organization_admin','sales_manager') or p_active is null or p_expected_version is null then
    raise exception using errcode='22023', message='invalid_member';
  end if;
  -- Serialize role changes per organization, including simultaneous demotions of admins.
  perform 1 from public.organizations where id=p_organization_id for update;
  select role,active,version into old_role,old_active,old_version from public.organization_members
    where organization_id=p_organization_id and user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002', message='not_found'; end if;
  if old_version<>p_expected_version then raise exception using errcode='40001', message='version_conflict'; end if;
  if old_role='organization_admin' and old_active and (p_role<>'organization_admin' or not p_active) and
    (select count(*) from public.organization_members where organization_id=p_organization_id and role='organization_admin' and active)=1 then
    raise exception using errcode='23514', message='last_admin';
  end if;
  update public.organization_members set role=p_role,active=p_active,version=version+1
    where organization_id=p_organization_id and user_id=p_user_id returning * into result;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(p_organization_id,auth.uid(),'membership.updated','membership',p_user_id,jsonb_build_object('role',p_role,'active',p_active));
  return result;
end; $$;
revoke all on function public.connect_set_member(uuid,uuid,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.connect_set_member(uuid,uuid,bigint,text,boolean) to authenticated;
