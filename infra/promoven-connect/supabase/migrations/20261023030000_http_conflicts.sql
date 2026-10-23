-- PostgREST maps PT409 to HTTP 409 for optimistic conflicts.

create or replace function public.connect_update_project(p_id uuid,p_expected_version bigint,p_data jsonb) returns public.projects
language plpgsql security definer set search_path='' as $$
declare r public.projects;
begin
  r:=private.project_auth(p_id,true);
  if jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('name','description','city','state','address','visibility'))
    or (p_data ? 'visibility' and not private.valid_visibility(p_data->'visibility')) then raise exception using errcode='22023',message='invalid_project'; end if;
  update public.projects set name=case when p_data ? 'name' then btrim(p_data->>'name') else name end,
    description=case when p_data ? 'description' then p_data->>'description' else description end,
    city=case when p_data ? 'city' then btrim(p_data->>'city') else city end,
    state=case when p_data ? 'state' then upper(p_data->>'state') else state end,
    address=case when p_data ? 'address' then p_data->>'address' else address end,
    visibility=coalesce(p_data->'visibility',visibility),version=version+1
    where id=p_id and version=p_expected_version returning * into r;
  if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'project.updated','project',r.id,jsonb_build_object('version',r.version));
  return r;
end; $$;

create or replace function public.connect_publish_project(p_id uuid,p_expected_version bigint,p_status text) returns public.projects
language plpgsql security definer set search_path='' as $$
declare r public.projects;
begin
  r:=private.project_auth(p_id,true);
  if p_status not in ('draft','published','archived') then raise exception using errcode='22023',message='invalid_status'; end if;
  update public.projects set status=p_status,version=version+1 where id=p_id and version=p_expected_version returning * into r;
  if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'project.published','project',r.id,jsonb_build_object('status',p_status,'version',r.version));
  return r;
end; $$;

create or replace function public.connect_update_unit(p_id uuid,p_expected_version bigint,p_data jsonb) returns public.units
language plpgsql security definer set search_path='' as $$
declare r public.units;
begin
  select * into r from public.units where id=p_id;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.has_membership(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('floor','type','bedrooms','bathrooms','parkingSpaces','areaM2','priceBRL','status','published')) then raise exception using errcode='22023',message='invalid_unit'; end if;
  if not private.valid_unit(jsonb_build_object('code',r.code,'floor',coalesce(p_data->'floor',to_jsonb(r.floor)),'type',coalesce(p_data->'type',to_jsonb(r.type)),'bedrooms',coalesce(p_data->'bedrooms',to_jsonb(r.bedrooms)),'bathrooms',coalesce(p_data->'bathrooms',to_jsonb(r.bathrooms)),'parkingSpaces',coalesce(p_data->'parkingSpaces',to_jsonb(r.parking_spaces)),'areaM2',coalesce(p_data->'areaM2',to_jsonb(r.area_m2::text)),'priceBRL',coalesce(p_data->'priceBRL',to_jsonb(r.price_brl::text)),'status',coalesce(p_data->'status',to_jsonb(r.status)),'published',coalesce(p_data->'published',to_jsonb(r.published)))) then raise exception using errcode='22023',message='invalid_unit'; end if;
  update public.units set floor=coalesce((p_data->>'floor')::integer,floor),type=coalesce(p_data->>'type',type),bedrooms=coalesce((p_data->>'bedrooms')::integer,bedrooms),bathrooms=coalesce((p_data->>'bathrooms')::integer,bathrooms),parking_spaces=coalesce((p_data->>'parkingSpaces')::integer,parking_spaces),area_m2=coalesce((p_data->>'areaM2')::numeric,area_m2),price_brl=case when p_data ? 'priceBRL' then (p_data->>'priceBRL')::numeric else price_brl end,status=coalesce(p_data->>'status',status),published=coalesce((p_data->>'published')::boolean,published),version=version+1 where id=p_id and version=p_expected_version returning * into r;
  if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'unit.updated','unit',r.id,jsonb_build_object('version',r.version));
  return r;
end; $$;

create or replace function public.connect_delete_unit(p_id uuid,p_expected_version bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.units;
begin
  select * into r from public.units where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.has_membership(r.organization_id) then raise exception using errcode='42501',message='forbidden'; end if;
  if r.version<>p_expected_version then raise exception using errcode='PT409',message='version_conflict'; end if;
  delete from public.units where id=p_id;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'unit.deleted','unit',r.id,jsonb_build_object('code',r.code));
  return true;
end; $$;

create or replace function public.connect_confirm_inventory(p_project_id uuid,p_rows jsonb,p_expected_hash text,p_operation_id uuid) returns public.inventory_imports
language plpgsql security definer set search_path='' as $$
declare p public.projects; d jsonb; item jsonb; line jsonb; r public.inventory_imports; inserted_count int:=0; updated_count int:=0; unchanged_count int:=0; u public.units;
begin
  p:=private.project_auth(p_project_id,false);
  perform 1 from public.projects where id=p_project_id for update;
  d:=private.inventory_diff(p_project_id,p_rows);
  if d->>'hash' is distinct from p_expected_hash then raise exception using errcode='PT409',message='preview_changed'; end if;
  select * into r from public.inventory_imports where project_id=p_project_id and operation_id=p_operation_id;
  if found then
    if r.file_hash<>p_expected_hash then raise exception using errcode='PT409',message='operation_conflict'; end if;
    return r;
  end if;
  if exists(select 1 from jsonb_array_elements(d->'lines') l where l->>'classification'='conflict') then raise exception using errcode='PT409',message='version_conflict'; end if;
  for item,line in select a.value,b.value from jsonb_array_elements(p_rows) with ordinality a(value,n) join jsonb_array_elements(d->'lines') with ordinality b(value,n) using(n) loop
    if line->>'classification'='new' then
      insert into public.units(organization_id,project_id,code,floor,type,bedrooms,bathrooms,parking_spaces,area_m2,price_brl,status,published)
        values(p.organization_id,p.id,upper(item->>'code'),(item->>'floor')::integer,item->>'type',(item->>'bedrooms')::integer,(item->>'bathrooms')::integer,(item->>'parkingSpaces')::integer,(item->>'areaM2')::numeric,(item->>'priceBRL')::numeric,item->>'status',(item->>'published')::boolean) returning * into u;
      inserted_count:=inserted_count+1;
    elsif line->>'classification'='changed' then
      update public.units set floor=(item->>'floor')::integer,type=item->>'type',bedrooms=(item->>'bedrooms')::integer,bathrooms=(item->>'bathrooms')::integer,parking_spaces=(item->>'parkingSpaces')::integer,area_m2=(item->>'areaM2')::numeric,price_brl=(item->>'priceBRL')::numeric,status=item->>'status',published=(item->>'published')::boolean,version=version+1
        where project_id=p.id and code=upper(item->>'code') and version=(item->>'expectedVersion')::bigint returning * into u;
      if not found then raise exception using errcode='PT409',message='version_conflict'; end if;
      updated_count:=updated_count+1;
    else unchanged_count:=unchanged_count+1; continue; end if;
    insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(p.organization_id,auth.uid(),'unit.imported','unit',u.id,jsonb_build_object('operationId',p_operation_id,'code',u.code));
  end loop;
  insert into public.inventory_imports(organization_id,project_id,actor_id,operation_id,file_hash,total_rows,inserted_rows,updated_rows,unchanged_rows)
    values(p.organization_id,p.id,auth.uid(),p_operation_id,p_expected_hash,(d->>'totalRows')::integer,inserted_count,updated_count,unchanged_count) returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(p.organization_id,auth.uid(),'inventory.imported','project',p.id,jsonb_build_object('importId',r.id,'inserted',inserted_count,'updated',updated_count,'unchanged',unchanged_count));
  return r;
end; $$;
