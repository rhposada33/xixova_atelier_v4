-- PC-05A. All objects remain in a private Connect bucket; only the Edge runtime has Storage credentials.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('connect-media-private','connect-media-private',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

create table public.connect_media_limits (
  id boolean primary key default true check (id),
  max_file_bytes bigint not null check (max_file_bytes between 1024 and 5242880),
  max_project_bytes bigint not null check (max_project_bytes between 5242880 and 1073741824),
  max_project_assets integer not null check (max_project_assets between 1 and 10000)
);
insert into public.connect_media_limits(id,max_file_bytes,max_project_bytes,max_project_assets)
values(true,5242880,209715200,200);
revoke all on public.connect_media_limits from public,anon,authenticated;

alter table public.project_assets add column media_role text check (media_role in ('cover','gallery','floor_plan')),
  add column size_bytes bigint check (size_bytes>0),
  add column published boolean not null default false,
  add column upload_state text not null default 'legacy' check (upload_state in ('legacy','pending','ready','deleted')),
  add column uploaded_by uuid references auth.users(id) on delete restrict,
  add column updated_at timestamptz not null default now();
create trigger project_assets_updated_at before update on public.project_assets for each row execute function private.touch_updated_at();
create index project_assets_delivery_idx on public.project_assets(project_id,unit_id,media_role) where upload_state='ready';

create function public.connect_reserve_media(p_project_id uuid,p_unit_id uuid,p_role text,p_mime text,p_size bigint,p_checksum text)
returns public.project_assets language plpgsql security definer set search_path='' as $$
declare p public.projects; u public.units; lim public.connect_media_limits; r public.project_assets; used_bytes bigint; used_count integer; suffix text;
begin
  select * into p from public.projects where id=p_project_id;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.can_manage_brokers(p.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if p_role not in ('cover','gallery','floor_plan') or p_mime not in ('image/png','image/jpeg','image/webp')
     or p_checksum !~ '^[a-f0-9]{64}$' or p_size is null or p_size<1024 then
    raise exception using errcode='22023',message='invalid_media';
  end if;
  if (p_role='cover' and p_unit_id is not null) or (p_role='floor_plan' and p_unit_id is null) then
    raise exception using errcode='22023',message='invalid_media_role';
  end if;
  if p_unit_id is not null then
    select * into u from public.units where id=p_unit_id and project_id=p.id;
    if not found then raise exception using errcode='P0002',message='unit_not_found'; end if;
  end if;
  select * into lim from public.connect_media_limits where id=true;
  if p_size>lim.max_file_bytes then raise exception using errcode='22023',message='media_too_large'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));
  select coalesce(sum(size_bytes),0),count(*) into used_bytes,used_count from public.project_assets
    where project_id=p.id and upload_state in ('pending','ready');
  if used_bytes+p_size>lim.max_project_bytes or used_count>=lim.max_project_assets then
    raise exception using errcode='22023',message='media_quota_exceeded';
  end if;
  suffix:=case p_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' else 'webp' end;
  insert into public.project_assets(organization_id,project_id,unit_id,asset_type,media_role,storage_path,visibility,mime_type,checksum,size_bytes,upload_state,uploaded_by)
    values(p.organization_id,p.id,p_unit_id,case when p_role='floor_plan' then 'floor_plan' else 'image' end,p_role,
      p.organization_id::text||'/'||p.id::text||'/'||gen_random_uuid()::text||'.'||suffix,
      'private',p_mime,p_checksum,p_size,'pending',auth.uid()) returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
    values(p.organization_id,auth.uid(),'media.reserved','asset',r.id);
  return r;
end; $$;

create function public.connect_finish_media(p_asset_id uuid) returns public.project_assets
language plpgsql security definer set search_path='' as $$
declare r public.project_assets;
begin
  select * into r from public.project_assets where id=p_asset_id for update;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if r.upload_state<>'pending' then raise exception using errcode='PT409',message='media_state_conflict'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='connect-media-private' and o.name=r.storage_path) then
    raise exception using errcode='PT409',message='upload_missing';
  end if;
  update public.project_assets set upload_state='ready',version=version+1 where id=r.id returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
    values(r.organization_id,auth.uid(),'media.uploaded','asset',r.id);
  return r;
end; $$;

create function public.connect_publish_media(p_asset_id uuid,p_expected_version bigint,p_visible boolean) returns public.project_assets
language plpgsql security definer set search_path='' as $$
declare r public.project_assets; p public.projects;
begin
  select * into r from public.project_assets where id=p_asset_id for update;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.is_org_admin(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if r.upload_state<>'ready' or r.version<>p_expected_version or p_visible is null then
    raise exception using errcode='PT409',message='media_state_conflict';
  end if;
  select * into p from public.projects where id=r.project_id;
  if p_visible and (p.status<>'published' or (r.unit_id is not null and not exists(
    select 1 from public.units u where u.id=r.unit_id and u.project_id=p.id and u.published))) then
    raise exception using errcode='PT409',message='publication_required';
  end if;
  update public.project_assets set published=p_visible,visibility=case when p_visible then 'public' else 'private' end,version=version+1
    where id=r.id returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(r.organization_id,auth.uid(),'media.published','asset',r.id,jsonb_build_object('published',p_visible,'version',r.version));
  return r;
end; $$;

create function public.connect_delete_media(p_asset_id uuid,p_expected_version bigint) returns public.project_assets
language plpgsql security definer set search_path='' as $$
declare r public.project_assets;
begin
  select * into r from public.project_assets where id=p_asset_id for update;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if r.version<>p_expected_version or r.upload_state not in ('pending','ready') then
    raise exception using errcode='PT409',message='media_state_conflict';
  end if;
  update public.project_assets set upload_state='deleted',published=false,visibility='private',version=version+1 where id=r.id returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
    values(r.organization_id,auth.uid(),'media.deleted','asset',r.id);
  return r;
end; $$;

create function public.connect_replace_media(p_old_id uuid,p_new_id uuid,p_expected_version bigint) returns public.project_assets
language plpgsql security definer set search_path='' as $$
declare old_asset public.project_assets; new_asset public.project_assets;
begin
  select * into old_asset from public.project_assets where id=p_old_id for update;
  select * into new_asset from public.project_assets where id=p_new_id for update;
  if old_asset.id is null or new_asset.id is null then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.is_org_admin(old_asset.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if old_asset.version<>p_expected_version or old_asset.upload_state<>'ready' or new_asset.upload_state<>'ready'
     or old_asset.project_id<>new_asset.project_id or old_asset.unit_id is distinct from new_asset.unit_id
     or old_asset.media_role<>new_asset.media_role then raise exception using errcode='PT409',message='replace_conflict'; end if;
  update public.project_assets set upload_state='deleted',published=false,visibility='private',version=version+1 where id=old_asset.id;
  update public.project_assets set published=old_asset.published,visibility=old_asset.visibility,version=version+1 where id=new_asset.id returning * into new_asset;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(old_asset.organization_id,auth.uid(),'media.replaced','asset',old_asset.id,jsonb_build_object('newAssetId',new_asset.id));
  return new_asset;
end; $$;

create function public.connect_public_media_allowed(p_asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.project_assets a join public.projects p on p.id=a.project_id
    join public.organizations o on o.id=p.organization_id
    left join public.units u on u.id=a.unit_id and u.project_id=p.id
    where a.id=p_asset_id and a.upload_state='ready' and a.published and a.visibility='public'
      and a.asset_type in ('image','floor_plan') and a.media_role is not null
      and p.status='published' and o.status='active' and (a.unit_id is null or u.published))
$$;

create function public.connect_private_media_allowed(p_asset_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_active_user() and exists(select 1 from public.project_assets a
    join public.projects p on p.id=a.project_id
    left join public.units u on u.id=a.unit_id and u.project_id=p.id
    where a.id=p_asset_id and a.upload_state='ready' and a.media_role is not null
      and a.asset_type in ('image','floor_plan') and (
        private.has_membership(a.organization_id) or
        (p.status='published' and (a.unit_id is null or u.published) and private.active_broker_access(a.project_id))
      ))
$$;

create function public.connect_public_media_manifest(p_project_id uuid,p_unit_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('assetId',a.id,'role',a.media_role,'unitId',a.unit_id,'mimeType',a.mime_type,'checksum',a.checksum,'version',a.version) order by a.created_at,a.id),'[]'::jsonb)
  from public.project_assets a where a.project_id=p_project_id and
    (a.unit_id is null or a.unit_id=p_unit_id) and public.connect_public_media_allowed(a.id)
$$;

create function public.connect_private_media_manifest(p_project_id uuid,p_unit_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; result jsonb;
begin
  p:=private.broker_catalog_project(p_project_id);
  select coalesce(jsonb_agg(jsonb_build_object('assetId',a.id,'role',a.media_role,'unitId',a.unit_id,'mimeType',a.mime_type,'checksum',a.checksum,'version',a.version) order by a.created_at,a.id),'[]'::jsonb)
    into result from public.project_assets a where a.project_id=p.id and
      (a.unit_id is null or a.unit_id=p_unit_id) and public.connect_private_media_allowed(a.id);
  return result;
end; $$;

revoke all on function public.connect_reserve_media(uuid,uuid,text,text,bigint,text),public.connect_finish_media(uuid),public.connect_publish_media(uuid,bigint,boolean),public.connect_delete_media(uuid,bigint),public.connect_replace_media(uuid,uuid,bigint),public.connect_public_media_allowed(uuid),public.connect_private_media_allowed(uuid),public.connect_public_media_manifest(uuid,uuid),public.connect_private_media_manifest(uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_reserve_media(uuid,uuid,text,text,bigint,text),public.connect_finish_media(uuid),public.connect_publish_media(uuid,bigint,boolean),public.connect_delete_media(uuid,bigint),public.connect_replace_media(uuid,uuid,bigint),public.connect_private_media_allowed(uuid),public.connect_private_media_manifest(uuid,uuid) to authenticated;
grant execute on function public.connect_public_media_allowed(uuid),public.connect_public_media_manifest(uuid,uuid) to anon,authenticated;
