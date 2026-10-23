-- PC-05B. Links and buyer inquiries are separate from Promoven's marketing leads.
alter table public.project_broker_access add constraint project_broker_access_scope_unique unique(id,organization_id,project_id,broker_user_id);
alter table public.audit_events alter column actor_id drop not null; -- null marks public system events, without inventing an Auth user.

create table public.broker_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  unit_id uuid,
  broker_user_id uuid not null references auth.users(id) on delete restrict,
  access_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active','revoked','invalidated')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  version bigint not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key (organization_id,project_id,unit_id) references public.units(organization_id,project_id,id) on delete restrict,
  foreign key (access_id,organization_id,project_id,broker_user_id)
    references public.project_broker_access(id,organization_id,project_id,broker_user_id) on delete restrict
);
create index broker_links_broker_idx on public.broker_links(broker_user_id,created_at desc);
create index broker_links_access_idx on public.broker_links(access_id,status);
alter table public.broker_links enable row level security;
revoke all on public.broker_links from public,anon,authenticated;

create function private.invalidate_broker_links() returns trigger language plpgsql security definer set search_path='' as $$
declare changed public.broker_links;
begin
  if old.status='active' and (new.status<>'active' or new.verification_status<>'verified') then
    for changed in update public.broker_links set status='invalidated',revoked_at=now(),version=version+1
      where access_id=new.id and status='active' returning * loop
      insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
        values(changed.organization_id,auth.uid(),'broker.link_invalidated','link',changed.id);
    end loop;
  end if;
  return new;
end; $$;
create trigger invalidate_links_on_access after update of status,verification_status on public.project_broker_access
  for each row execute function private.invalidate_broker_links();

create function public.connect_create_broker_link(p_broker_user_id uuid,p_project_id uuid,p_unit_id uuid,p_token_hash text,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects; a public.project_broker_access; r public.broker_links;
begin
  select * into p from public.projects where id=p_project_id and status='published';
  if not found or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null
     or p_expires_at<=now() or p_expires_at>now()+interval '90 days' then
    raise exception using errcode='22023',message='invalid_link';
  end if;
  select * into a from public.project_broker_access where project_id=p.id and broker_user_id=p_broker_user_id for update;
  if not found or a.status<>'active' or a.verification_status<>'verified'
    or not exists(select 1 from public.broker_profiles b join public.profiles pr on pr.user_id=b.user_id
      where b.user_id=p_broker_user_id and b.verification_status='verified' and pr.active)
    or not exists(select 1 from public.organizations o where o.id=p.organization_id and o.status='active') then
    raise exception using errcode='42501',message='broker_access_required';
  end if;
  if p_unit_id is not null and not exists(select 1 from public.units u where u.id=p_unit_id and u.project_id=p.id and u.published and u.status='available') then
    raise exception using errcode='P0002',message='unit_not_found';
  end if;
  insert into public.broker_links(organization_id,project_id,unit_id,broker_user_id,access_id,token_hash,expires_at)
    values(p.organization_id,p.id,p_unit_id,p_broker_user_id,a.id,p_token_hash,p_expires_at) returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
    values(p.organization_id,p_broker_user_id,'broker.link_created','link',r.id);
  return jsonb_build_object('id',r.id,'projectId',r.project_id,'unitId',r.unit_id,'status',r.status,'version',r.version,'expiresAt',r.expires_at);
end; $$;

create function public.connect_revoke_broker_link(p_id uuid,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.broker_links;
begin
  select * into r from public.broker_links where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='not_found'; end if;
  if not private.is_active_user() or not (r.broker_user_id=auth.uid() or private.can_manage_brokers(r.organization_id)) then
    raise exception using errcode='42501',message='forbidden';
  end if;
  if r.version<>p_expected_version or r.status<>'active' then raise exception using errcode='PT409',message='link_conflict'; end if;
  update public.broker_links set status='revoked',revoked_at=now(),version=version+1 where id=r.id returning * into r;
  insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id)
    values(r.organization_id,auth.uid(),'broker.link_revoked','link',r.id);
  return jsonb_build_object('id',r.id,'status',r.status,'version',r.version);
end; $$;

create function public.connect_broker_links() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'projectId',l.project_id,'projectName',p.name,
    'unitId',l.unit_id,'unitCode',u.code,'status',case when l.status='active' and l.expires_at<=now() then 'expired' else l.status end,
    'expiresAt',l.expires_at,'createdAt',l.created_at,'version',l.version) order by l.created_at desc,l.id),'[]'::jsonb)
  from public.broker_links l join public.projects p on p.id=l.project_id left join public.units u on u.id=l.unit_id
  where l.broker_user_id=auth.uid() and private.is_active_user()
$$;

create function public.connect_public_share(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare l public.broker_links; p public.projects; b public.broker_profiles; u public.units;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into l from public.broker_links where token_hash=p_token_hash and status='active' and expires_at>now();
  if not found then return null; end if;
  select * into p from public.projects where id=l.project_id and status='published';
  if not found or not exists(select 1 from public.organizations o where o.id=p.organization_id and o.status='active') then return null; end if;
  if not exists(select 1 from public.project_broker_access a join public.profiles pr on pr.user_id=a.broker_user_id
      where a.id=l.access_id and a.status='active' and a.verification_status='verified' and pr.active) then return null; end if;
  select * into b from public.broker_profiles where user_id=l.broker_user_id and verification_status='verified';
  if not found then return null; end if;
  if l.unit_id is not null then
    select * into u from public.units where id=l.unit_id and project_id=p.id and published and status='available';
    if not found then return null; end if;
  end if;
  return jsonb_build_object('project',public.connect_public_project(p.public_slug),
    'unitCode',u.code,'broker',jsonb_build_object('name',b.display_name,'creciNumber',b.creci_number,'creciState',b.creci_state));
end; $$;

create function public.connect_public_unit(p_public_slug text,p_unit_code text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.projects; u jsonb;
begin
  select * into p from public.projects where public_slug=p_public_slug and status='published';
  if not found then return null; end if;
  if not exists(select 1 from public.units x where x.project_id=p.id and x.code=p_unit_code and x.published and x.status='available') then return null; end if;
  select value into u from jsonb_array_elements(public.connect_public_project(p_public_slug)->'units') value where value->>'code'=p_unit_code;
  return u;
end; $$;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  unit_id uuid,
  buyer_name text not null check (char_length(btrim(buyer_name)) between 2 and 160),
  contact_channel text not null check (contact_channel in ('email','phone')),
  contact_value text not null check (char_length(contact_value) between 5 and 254),
  message text check (char_length(message)<=1000),
  source text not null check (source in ('public','broker_link')),
  status text not null default 'new' check (status in ('new')),
  privacy_notice_version text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key (organization_id,project_id,unit_id) references public.units(organization_id,project_id,id) on delete restrict
);
create index leads_org_date_idx on public.leads(organization_id,created_at desc);
create table public.lead_attributions (
  lead_id uuid primary key references public.leads(id) on delete restrict,
  broker_user_id uuid not null references auth.users(id) on delete restrict,
  access_id uuid not null references public.project_broker_access(id) on delete restrict,
  broker_link_id uuid not null references public.broker_links(id) on delete restrict,
  access_status_at_submit text not null check (access_status_at_submit='active'),
  created_at timestamptz not null default now()
);
create index lead_attributions_broker_idx on public.lead_attributions(broker_user_id,created_at desc);
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  activity_type text not null check (activity_type in ('received')),
  created_at timestamptz not null default now()
);
create table public.interest_idempotency (
  id uuid primary key,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  receipt_id uuid not null references public.leads(receipt_id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.interest_rate_counters (
  rate_key text primary key check (rate_key ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts>=0)
);
alter table public.leads enable row level security;
alter table public.lead_attributions enable row level security;
alter table public.lead_activities enable row level security;
alter table public.interest_idempotency enable row level security;
alter table public.interest_rate_counters enable row level security;
revoke all on public.leads,public.lead_attributions,public.lead_activities,public.interest_idempotency,public.interest_rate_counters from public,anon,authenticated;

create function public.connect_rate_interest(p_rate_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_count integer;
begin
  if p_rate_key !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='invalid_rate_key'; end if;
  insert into public.interest_rate_counters(rate_key,window_start,attempts) values(p_rate_key,now(),1)
  on conflict(rate_key) do update set window_start=case when public.interest_rate_counters.window_start<now()-interval '1 hour' then now() else public.interest_rate_counters.window_start end,
    attempts=case when public.interest_rate_counters.window_start<now()-interval '1 hour' then 1 else public.interest_rate_counters.attempts+1 end
  returning attempts into current_count;
  return current_count<=30;
end; $$;

create function public.connect_submit_interest(p_token_hash text,p_public_slug text,p_payload jsonb,p_idempotency_id uuid,p_payload_hash text)
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
    select * into l from public.broker_links where token_hash=p_token_hash for update;
    if not found or l.status<>'active' or l.expires_at<=now() then raise exception using errcode='P0002',message='not_found'; end if;
    select * into a from public.project_broker_access where id=l.access_id for update;
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

create function public.connect_leads(p_organization_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'projectId',x.project_id,'projectName',x.project_name,
    'unitCode',x.unit_code,'buyerName',x.buyer_name,'contactChannel',x.contact_channel,'contactValue',x.contact_value,
    'source',x.source,'status',x.status,'brokerName',x.broker_name,'createdAt',x.created_at) order by x.created_at desc,x.id),'[]'::jsonb)
  from (select l.*,p.name as project_name,u.code as unit_code,b.display_name as broker_name
    from public.leads l join public.projects p on p.id=l.project_id
    left join public.units u on u.id=l.unit_id left join public.lead_attributions la on la.lead_id=l.id
    left join public.broker_profiles b on b.user_id=la.broker_user_id
    where (p_organization_id is null or l.organization_id=p_organization_id) and private.is_active_user()
      and (private.can_manage_brokers(l.organization_id) or
        (la.broker_user_id=auth.uid() and private.active_broker_access(l.project_id)))
    order by l.created_at desc,l.id limit 100) x
$$;

revoke all on function private.invalidate_broker_links(),public.connect_create_broker_link(uuid,uuid,uuid,text,timestamptz),public.connect_revoke_broker_link(uuid,bigint),public.connect_broker_links(),public.connect_public_share(text),public.connect_public_unit(text,text),public.connect_rate_interest(text),public.connect_submit_interest(text,text,jsonb,uuid,text),public.connect_leads(uuid) from public,anon,authenticated;
grant execute on function public.connect_create_broker_link(uuid,uuid,uuid,text,timestamptz),public.connect_rate_interest(text),public.connect_submit_interest(text,text,jsonb,uuid,text) to service_role;
grant execute on function public.connect_revoke_broker_link(uuid,bigint),public.connect_broker_links(),public.connect_leads(uuid) to authenticated;
grant execute on function public.connect_public_share(text),public.connect_public_unit(text,text) to anon,authenticated;
