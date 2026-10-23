create function public.connect_onboarding(p_organization_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_manage_brokers(p_organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 return jsonb_build_object('administrators',(select count(*) from public.organization_members where organization_id=p_organization_id and active and role='organization_admin'),
 'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'publicSlug',p.public_slug,'published',p.status='published','visibility',p.visibility,
 'units',(select count(*) from public.units where project_id=p.id),
 'imports',(select count(*) from public.inventory_imports where project_id=p.id),
 'media',(select count(*) from public.project_assets where project_id=p.id and upload_state='ready'),
 'brokers',(select count(*) from public.project_broker_access where project_id=p.id and status='active' and verification_status='verified'),
 'links',(select count(*) from public.broker_links where project_id=p.id and status='active' and expires_at>now()),
 'leads',(select count(*) from public.leads where project_id=p.id)) order by p.created_at),'[]'::jsonb) from public.projects p where p.organization_id=p_organization_id));
end; $$;
create function public.connect_add_member_by_email(p_organization_id uuid,p_email text,p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; m public.organization_members;
begin
 if not private.is_org_admin(p_organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 select id into target from auth.users where lower(email)=lower(btrim(p_email));
 if not found then raise exception using errcode='P0002',message='account_not_provisioned'; end if;
 m:=public.connect_add_member(p_organization_id,target,p_role);
 return jsonb_build_object('userId',m.user_id,'role',m.role);
end; $$;
revoke all on function public.connect_onboarding(uuid),public.connect_add_member_by_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_onboarding(uuid),public.connect_add_member_by_email(uuid,text,text) to authenticated;
