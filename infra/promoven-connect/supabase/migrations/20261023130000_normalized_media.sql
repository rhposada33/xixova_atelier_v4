create or replace function public.connect_reserve_media(p_project_id uuid,p_unit_id uuid,p_role text,p_mime text,p_size bigint,p_checksum text)
returns public.project_assets language plpgsql security definer set search_path='' as $$
declare p public.projects; u public.units; lim public.connect_media_limits; r public.project_assets; used_bytes bigint; used_count integer; suffix text;
begin
  select * into p from public.projects where id=p_project_id;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.can_manage_brokers(p.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if p_role not in ('cover','gallery','floor_plan') or p_mime not in ('image/png','image/jpeg','image/webp')
     or p_checksum !~ '^[a-f0-9]{64}$' or p_size is null or p_size<1 then
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
  perform pg_advisory_xact_lock(hashtextextended(p.organization_id::text,1));
  if (select coalesce(sum(size_bytes),0) from public.project_assets where organization_id=p.organization_id and upload_state in ('pending','ready'))+p_size>1073741824 then raise exception using errcode='22023',message='organization_media_quota_exceeded';end if;
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
