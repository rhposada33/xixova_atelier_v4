alter table public.project_broker_access add column verification_status text not null default 'pending'
  check (verification_status in ('pending','verified','rejected'));

create or replace function public.connect_upsert_broker_profile(p_data jsonb) returns public.broker_profiles
language plpgsql security definer set search_path='' as $$
declare r public.broker_profiles; email text; changed public.project_broker_access;
begin
 if not private.is_active_user() then raise exception using errcode='42501',message='forbidden'; end if;
 if jsonb_typeof(p_data)<>'object' or not (p_data ?& array['displayName','professionalEmail','professionalPhone','creciNumber','creciState'])
  or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('displayName','professionalEmail','professionalPhone','creciNumber','creciState')) then raise exception using errcode='22023',message='invalid_profile'; end if;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null or lower(btrim(p_data->>'professionalEmail'))<>email then raise exception using errcode='42501',message='email_mismatch'; end if;
 insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state)
 values(auth.uid(),btrim(p_data->>'displayName'),email,btrim(p_data->>'professionalPhone'),upper(btrim(p_data->>'creciNumber')),upper(btrim(p_data->>'creciState')))
 on conflict(user_id) do update set display_name=excluded.display_name,professional_email=excluded.professional_email,professional_phone=excluded.professional_phone,creci_number=excluded.creci_number,creci_state=excluded.creci_state,verification_status='pending' returning * into r;
 for changed in update public.project_broker_access set verification_status='pending',
   status=case when status='active' then 'suspended' else status end,
   suspended_at=case when status='active' then now() else suspended_at end,
   reason='Perfil profissional alterado',version=version+1
   where broker_user_id=auth.uid() and status<>'revoked' returning * loop
   insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
   values(changed.organization_id,auth.uid(),'broker.profile_review_reset','access',changed.id);
 end loop;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(null,auth.uid(),'broker.profile_updated','broker',auth.uid());
 return r;
end; $$;

create or replace function public.connect_verify_broker(p_access_id uuid,p_expected_version bigint,p_decision text,p_reason text default null) returns public.project_broker_access
language plpgsql security definer set search_path='' as $$
declare r public.project_broker_access; aggregate_status text;
begin
 select * into r from public.project_broker_access where id=p_access_id for update;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 if not private.is_org_admin(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 if r.version<>p_expected_version or r.status not in ('invited','suspended') or p_decision not in ('verified','rejected') or char_length(p_reason)>500 then raise exception using errcode='PT409',message='verification_conflict'; end if;
 update public.project_broker_access set verification_status=p_decision,
   status=case when p_decision='rejected' then 'revoked' else status end,
   revoked_at=case when p_decision='rejected' then now() else revoked_at end,
   reason=p_reason,version=version+1 where id=r.id returning * into r;
 select case when exists(select 1 from public.project_broker_access where broker_user_id=r.broker_user_id and verification_status='verified') then 'verified' else p_decision end into aggregate_status;
 update public.broker_profiles set verification_status=aggregate_status where user_id=r.broker_user_id;
 if not found then raise exception using errcode='P0002',message='profile_required'; end if;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(r.organization_id,auth.uid(),'broker.verification_reviewed','access',r.id,jsonb_build_object('decision',p_decision));
 return r;
end; $$;

create or replace function public.connect_set_broker_access(p_id uuid,p_expected_version bigint,p_status text,p_reason text default null) returns public.project_broker_access
language plpgsql security definer set search_path='' as $$
declare r public.project_broker_access;
begin
 select * into r from public.project_broker_access where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 if not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 if r.version<>p_expected_version or char_length(p_reason)>500 or
   not ((r.status in ('invited','suspended') and p_status='active') or (r.status in ('invited','active','suspended') and p_status in ('suspended','revoked'))) then
   raise exception using errcode='PT409',message='access_conflict'; end if;
 if p_status='active' and (r.verification_status<>'verified' or not exists(select 1 from public.broker_profiles b where b.user_id=r.broker_user_id and b.verification_status='verified')) then
   raise exception using errcode='42501',message='verification_required'; end if;
 update public.project_broker_access set status=p_status,reason=p_reason,version=version+1,
   approved_by=case when p_status='active' then auth.uid() else approved_by end,
   activated_at=case when p_status='active' then now() else activated_at end,
   suspended_at=case when p_status='suspended' then now() else suspended_at end,
   revoked_at=case when p_status='revoked' then now() else revoked_at end
 where id=p_id returning * into r;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(r.organization_id,auth.uid(),'broker.access_changed','access',r.id,jsonb_build_object('status',p_status,'version',r.version));
 return r;
end; $$;

create or replace function private.active_broker_access(p_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_user() and exists (
   select 1 from public.project_broker_access a join public.broker_profiles b on b.user_id=a.broker_user_id
   join public.organizations o on o.id=a.organization_id
   where a.project_id=p_project_id and a.broker_user_id=auth.uid() and a.status='active' and a.verification_status='verified' and b.verification_status='verified' and o.status='active'
 )
$$;
create or replace function public.connect_broker_projects() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('projectId',p.id,'organizationId',p.organization_id,'organizationName',o.name,'name',p.name,'city',p.city,'state',p.state,'status',a.status) order by o.name,p.name),'[]'::jsonb)
 from public.project_broker_access a join public.projects p on p.id=a.project_id join public.organizations o on o.id=p.organization_id
 where a.broker_user_id=auth.uid() and private.active_broker_access(p.id)
$$;
create or replace function public.connect_broker_access_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('projectId',p.id,'organizationName',o.name,'name',p.name,'status',a.status,'verificationStatus',a.verification_status,'version',a.version) order by o.name,p.name),'[]'::jsonb)
 from public.project_broker_access a join public.projects p on p.id=a.project_id join public.organizations o on o.id=p.organization_id
 where a.broker_user_id=auth.uid() and private.is_active_user()
$$;
