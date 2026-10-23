create table public.broker_profiles (
 user_id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
 professional_email text not null check (char_length(professional_email) between 3 and 254),
 professional_phone text not null check (char_length(professional_phone) between 8 and 30),
 creci_number text not null check (creci_number ~ '^[A-Za-z0-9./-]{3,30}$'),
 creci_state text not null check (creci_state ~ '^[A-Z]{2}$'),
 verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_broker_access (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null, project_id uuid not null,
 broker_user_id uuid not null references auth.users(id) on delete restrict,
 status text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
 approved_by uuid references auth.users(id) on delete restrict,
 activated_at timestamptz, suspended_at timestamptz, revoked_at timestamptz,
 reason text check (char_length(reason)<=500),
 version bigint not null default 1 check (version>0),
 created_at timestamptz not null default now(),
 foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
 unique(project_id,broker_user_id),
 check (status<>'active' or (approved_by is not null and activated_at is not null))
);
create table public.broker_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null, project_id uuid not null,
 invited_email text not null check (invited_email=lower(btrim(invited_email)) and char_length(invited_email) between 3 and 254),
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
 expires_at timestamptz not null,
 accepted_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 operation_id uuid not null unique,
 version bigint not null default 1 check (version>0),
 created_at timestamptz not null default now(),
 foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict
);
create unique index broker_pending_email_project_idx on public.broker_invitations(project_id,invited_email) where status='pending';
create index broker_access_user_idx on public.project_broker_access(broker_user_id,status);
create trigger broker_profiles_updated_at before update on public.broker_profiles for each row execute function private.touch_updated_at();

alter table public.broker_profiles enable row level security;
alter table public.project_broker_access enable row level security;
alter table public.broker_invitations enable row level security;
revoke all on public.broker_profiles,public.project_broker_access,public.broker_invitations from public,anon,authenticated;
grant select on public.broker_profiles,public.project_broker_access to authenticated;
grant select(id,organization_id,project_id,invited_email,status,expires_at,accepted_at,created_by,version,created_at) on public.broker_invitations to authenticated;
create policy broker_profile_self_read on public.broker_profiles for select to authenticated using (user_id=auth.uid());
create policy broker_access_scoped_read on public.project_broker_access for select to authenticated using (broker_user_id=auth.uid() or private.has_membership(organization_id));
create policy broker_invitations_manager_read on public.broker_invitations for select to authenticated using (private.has_membership(organization_id));

create function private.can_manage_brokers(p_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_membership(p_organization_id) and exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.active and m.role in ('organization_admin','sales_manager'))
$$;
create function private.active_broker_access(p_project_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_user() and exists (
   select 1 from public.project_broker_access a join public.broker_profiles b on b.user_id=a.broker_user_id
   join public.organizations o on o.id=a.organization_id
   where a.project_id=p_project_id and a.broker_user_id=auth.uid() and a.status='active' and b.verification_status='verified' and o.status='active'
 )
$$;
create policy broker_profile_manager_read on public.broker_profiles for select to authenticated using (
 exists(select 1 from public.project_broker_access a where a.broker_user_id=user_id and private.has_membership(a.organization_id))
);

create function public.connect_upsert_broker_profile(p_data jsonb) returns public.broker_profiles
language plpgsql security definer set search_path='' as $$
declare r public.broker_profiles; email text;
begin
 if not private.is_active_user() then raise exception using errcode='42501',message='forbidden'; end if;
 if jsonb_typeof(p_data)<>'object' or not (p_data ?& array['displayName','professionalEmail','professionalPhone','creciNumber','creciState'])
  or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('displayName','professionalEmail','professionalPhone','creciNumber','creciState')) then raise exception using errcode='22023',message='invalid_profile'; end if;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null or lower(btrim(p_data->>'professionalEmail'))<>email then raise exception using errcode='42501',message='email_mismatch'; end if;
 insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state)
 values(auth.uid(),btrim(p_data->>'displayName'),email,btrim(p_data->>'professionalPhone'),upper(btrim(p_data->>'creciNumber')),upper(btrim(p_data->>'creciState')))
 on conflict(user_id) do update set display_name=excluded.display_name,professional_email=excluded.professional_email,professional_phone=excluded.professional_phone,creci_number=excluded.creci_number,creci_state=excluded.creci_state,verification_status='pending' returning * into r;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(null,auth.uid(),'broker.profile_updated','broker',auth.uid());
 return r;
end; $$;

create function public.connect_create_broker_invitation(p_project_id uuid,p_email text,p_token_hash text,p_operation_id uuid) returns public.broker_invitations
language plpgsql security definer set search_path='' as $$
declare p public.projects; r public.broker_invitations; normalized text;
begin
 p:=private.project_auth(p_project_id,false);
 if not private.can_manage_brokers(p.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 normalized:=lower(btrim(p_email));
 if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(normalized)>254 or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='invalid_invitation'; end if;
 insert into public.broker_invitations(organization_id,project_id,invited_email,token_hash,expires_at,created_by,operation_id)
 values(p.organization_id,p_project_id,normalized,p_token_hash,now()+interval '48 hours',auth.uid(),p_operation_id) returning * into r;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(p.organization_id,auth.uid(),'broker.invited','invitation',r.id,jsonb_build_object('projectId',p_project_id));
 return r;
end; $$;
create function public.connect_cancel_broker_invitation(p_id uuid,p_expected_version bigint) returns public.broker_invitations
language plpgsql security definer set search_path='' as $$
declare r public.broker_invitations;
begin
 select * into r from public.broker_invitations where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 if not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 if r.version<>p_expected_version or r.status<>'pending' then raise exception using errcode='PT409',message='invitation_conflict'; end if;
 update public.broker_invitations set status='cancelled',version=version+1 where id=p_id returning * into r;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(r.organization_id,auth.uid(),'broker.invitation_cancelled','invitation',r.id);
 return r;
end; $$;
create function public.connect_resend_broker_invitation(p_id uuid,p_expected_version bigint,p_token_hash text,p_operation_id uuid) returns public.broker_invitations
language plpgsql security definer set search_path='' as $$
declare old public.broker_invitations; r public.broker_invitations;
begin
 select * into old from public.broker_invitations where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 if not private.can_manage_brokers(old.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 if old.version<>p_expected_version or old.status<>'pending' then raise exception using errcode='PT409',message='invitation_conflict'; end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='invalid_token_hash'; end if;
 update public.broker_invitations set status='cancelled',version=version+1 where id=p_id;
 insert into public.broker_invitations(organization_id,project_id,invited_email,token_hash,expires_at,created_by,operation_id)
 values(old.organization_id,old.project_id,old.invited_email,p_token_hash,now()+interval '48 hours',auth.uid(),p_operation_id) returning * into r;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(old.organization_id,auth.uid(),'broker.invitation_resent','invitation',r.id,jsonb_build_object('previousId',p_id));
 return r;
end; $$;
create function public.connect_accept_broker_invitation(p_token text) returns public.project_broker_access
language plpgsql security definer set search_path='' as $$
declare i public.broker_invitations; r public.project_broker_access; email text;
begin
 if not private.is_active_user() or p_token !~ '^[a-f0-9]{64}$' then raise exception using errcode='42501',message='invalid_invitation'; end if;
 select * into i from public.broker_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found then raise exception using errcode='P0002',message='invalid_invitation'; end if;
 if i.status<>'pending' or i.expires_at<=now() then raise exception using errcode='PT409',message='invitation_unavailable'; end if;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null or email<>i.invited_email then raise exception using errcode='42501',message='identity_mismatch'; end if;
 if not exists(select 1 from public.broker_profiles where user_id=auth.uid()) then raise exception using errcode='22023',message='profile_required'; end if;
 insert into public.project_broker_access(organization_id,project_id,broker_user_id,status)
 values(i.organization_id,i.project_id,auth.uid(),'invited')
 on conflict(project_id,broker_user_id) do update set status=case when public.project_broker_access.status='revoked' then 'invited' else public.project_broker_access.status end,version=public.project_broker_access.version+1
 returning * into r;
 update public.broker_invitations set status='accepted',accepted_at=now(),version=version+1 where id=i.id;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(i.organization_id,auth.uid(),'broker.invitation_accepted','access',r.id,jsonb_build_object('invitationId',i.id));
 return r;
end; $$;
create function public.connect_verify_broker(p_access_id uuid,p_expected_version bigint,p_decision text,p_reason text default null) returns public.project_broker_access
language plpgsql security definer set search_path='' as $$
declare r public.project_broker_access;
begin
 select * into r from public.project_broker_access where id=p_access_id for update;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 if not private.is_org_admin(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 if r.version<>p_expected_version or r.status<>'invited' or p_decision not in ('verified','rejected') or char_length(p_reason)>500 then raise exception using errcode='PT409',message='verification_conflict'; end if;
 update public.broker_profiles set verification_status=p_decision where user_id=r.broker_user_id;
 if not found then raise exception using errcode='P0002',message='profile_required'; end if;
 update public.project_broker_access set reason=p_reason,version=version+1 where id=r.id returning * into r;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
 values(r.organization_id,auth.uid(),'broker.verification_reviewed','access',r.id,jsonb_build_object('decision',p_decision));
 return r;
end; $$;
create function public.connect_set_broker_access(p_id uuid,p_expected_version bigint,p_status text,p_reason text default null) returns public.project_broker_access
language plpgsql security definer set search_path='' as $$
declare r public.project_broker_access;
begin
 select * into r from public.project_broker_access where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 if not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
 if r.version<>p_expected_version or char_length(p_reason)>500 or
   not ((r.status in ('invited','suspended') and p_status='active') or (r.status in ('invited','active','suspended') and p_status in ('suspended','revoked'))) then
   raise exception using errcode='PT409',message='access_conflict'; end if;
 if p_status='active' and not exists(select 1 from public.broker_profiles b where b.user_id=r.broker_user_id and b.verification_status='verified') then
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

create function public.connect_broker_projects() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('projectId',p.id,'organizationId',p.organization_id,'organizationName',o.name,'name',p.name,'city',p.city,'state',p.state,'status',a.status) order by o.name,p.name),'[]'::jsonb)
 from public.project_broker_access a join public.projects p on p.id=a.project_id join public.organizations o on o.id=p.organization_id
 where a.broker_user_id=auth.uid() and private.is_active_user() and o.status='active' and exists(select 1 from public.broker_profiles b where b.user_id=auth.uid() and b.verification_status='verified') and a.status='active'
$$;
create function public.connect_broker_access_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('projectId',p.id,'organizationName',o.name,'name',p.name,'status',a.status,'version',a.version) order by o.name,p.name),'[]'::jsonb)
 from public.project_broker_access a join public.projects p on p.id=a.project_id join public.organizations o on o.id=p.organization_id
 where a.broker_user_id=auth.uid() and private.is_active_user()
$$;

revoke all on function private.can_manage_brokers(uuid),private.active_broker_access(uuid) from public,anon,authenticated;
revoke all on function public.connect_upsert_broker_profile(jsonb),public.connect_create_broker_invitation(uuid,text,text,uuid),public.connect_cancel_broker_invitation(uuid,bigint),public.connect_resend_broker_invitation(uuid,bigint,text,uuid),public.connect_accept_broker_invitation(text),public.connect_verify_broker(uuid,bigint,text,text),public.connect_set_broker_access(uuid,bigint,text,text),public.connect_broker_projects(),public.connect_broker_access_status() from public,anon,authenticated;
grant execute on function public.connect_upsert_broker_profile(jsonb),public.connect_create_broker_invitation(uuid,text,text,uuid),public.connect_cancel_broker_invitation(uuid,bigint),public.connect_resend_broker_invitation(uuid,bigint,text,uuid),public.connect_accept_broker_invitation(text),public.connect_verify_broker(uuid,bigint,text,text),public.connect_set_broker_access(uuid,bigint,text,text),public.connect_broker_projects(),public.connect_broker_access_status() to authenticated;
