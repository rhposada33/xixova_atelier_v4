-- PC-05B lock order follows access then link, matching access revocation.
create or replace function public.connect_submit_interest(p_token_hash text,p_public_slug text,p_payload jsonb,p_idempotency_id uuid,p_payload_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.interest_idempotency; l public.broker_links; a public.project_broker_access; p public.projects; u public.units; r public.leads;
  buyer_name text; channel text; contact text; note text; unit_code text;
begin
  if p_idempotency_id is null or p_payload_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_payload)<>'object'
     or not (p_payload ?& array['buyerName','contactChannel','contactValue','privacyNoticeVersion'])
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('buyerName','contactChannel','contactValue','message','privacyNoticeVersion','unitCode'))
     or (p_token_hash is null)=(p_public_slug is null) then
    raise exception using errcode='22023',message='invalid_interest';
  end if;
  buyer_name:=btrim(p_payload->>'buyerName');channel:=p_payload->>'contactChannel';contact:=btrim(p_payload->>'contactValue');
  note:=nullif(btrim(coalesce(p_payload->>'message','')),'');unit_code:=nullif(upper(btrim(coalesce(p_payload->>'unitCode',''))),'');
  if char_length(buyer_name) not between 2 and 160 or channel not in ('email','phone') or char_length(contact) not between 5 and 254
     or (channel='email' and lower(contact) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     or (channel='phone' and contact !~ '^\+?[0-9() -]{8,30}$')
     or char_length(note)>1000 or p_payload->>'privacyNoticeVersion'<>'2026-10-23'
     or (unit_code is not null and unit_code !~ '^[A-Z0-9][A-Z0-9_-]{0,31}$') then
    raise exception using errcode='22023',message='invalid_interest';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_id::text,0));
  select * into existing from public.interest_idempotency where id=p_idempotency_id;
  if found then
    if existing.payload_hash<>p_payload_hash then raise exception using errcode='PT409',message='idempotency_conflict'; end if;
    return jsonb_build_object('receiptId',existing.receipt_id,'status','accepted');
  end if;
  if p_token_hash is not null then
    if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception using errcode='P0002',message='not_found'; end if;
    select * into l from public.broker_links where token_hash=p_token_hash;
    if not found then raise exception using errcode='P0002',message='not_found'; end if;
    select * into a from public.project_broker_access where id=l.access_id for update;
    select * into l from public.broker_links where token_hash=p_token_hash for update;
    if not found or l.status<>'active' or l.expires_at<=now() then raise exception using errcode='P0002',message='not_found'; end if;
    if not found or a.status<>'active' or a.verification_status<>'verified'
       or not exists(select 1 from public.broker_profiles b join public.profiles pr on pr.user_id=b.user_id
         where b.user_id=l.broker_user_id and b.verification_status='verified' and pr.active) then
      raise exception using errcode='P0002',message='not_found';
    end if;
    select * into p from public.projects where id=l.project_id and status='published';
    if not found then raise exception using errcode='P0002',message='not_found'; end if;
    if l.unit_id is not null then
      select * into u from public.units where id=l.unit_id and project_id=p.id and published and status='available';
      if not found or (unit_code is not null and unit_code<>u.code) then raise exception using errcode='P0002',message='not_found'; end if;
    end if;
  else
    select * into p from public.projects where public_slug=p_public_slug and status='published';
    if not found then raise exception using errcode='P0002',message='not_found'; end if;
  end if;
  if not exists(select 1 from public.organizations o where o.id=p.organization_id and o.status='active') then
    raise exception using errcode='P0002',message='not_found'; end if;
  if u.id is null and unit_code is not null then
    select * into u from public.units where project_id=p.id and code=unit_code and published and status='available';
    if not found then raise exception using errcode='P0002',message='not_found'; end if;
  end if;
  insert into public.leads(organization_id,project_id,unit_id,buyer_name,contact_channel,contact_value,message,source,privacy_notice_version)
    values(p.organization_id,p.id,u.id,buyer_name,channel,contact,note,case when l.id is null then 'public' else 'broker_link' end,'2026-10-23') returning * into r;
  if l.id is not null then
    insert into public.lead_attributions(lead_id,broker_user_id,access_id,broker_link_id,access_status_at_submit)
      values(r.id,l.broker_user_id,a.id,l.id,'active');
  end if;
  insert into public.lead_activities(lead_id,activity_type) values(r.id,'received');
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail)
    values(p.organization_id,null,'lead.received','lead',r.id,jsonb_build_object('source',case when l.id is null then 'public' else 'broker_link' end));
  insert into public.interest_idempotency(id,payload_hash,receipt_id) values(p_idempotency_id,p_payload_hash,r.receipt_id);
  return jsonb_build_object('receiptId',r.receipt_id,'status','accepted');
end; $$;

-- Resolve public media using published slugs, without exposing private asset paths.
create or replace function public.connect_public_media_by_slug(p_public_slug text,p_unit_code text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; u public.units;
begin
  select * into p from public.projects where public_slug=p_public_slug and status='published';
  if not found or not exists(select 1 from public.organizations o where o.id=p.organization_id and o.status='active') then return '[]'::jsonb; end if;
  if p_unit_code is not null then
    select * into u from public.units where project_id=p.id and code=p_unit_code and published and status='available';
    if not found then return '[]'::jsonb; end if;
  end if;
  return public.connect_public_media_manifest(p.id,u.id);
end; $$;
revoke all on function public.connect_public_media_by_slug(text,text) from public,anon,authenticated;
grant execute on function public.connect_public_media_by_slug(text,text) to anon,authenticated;
