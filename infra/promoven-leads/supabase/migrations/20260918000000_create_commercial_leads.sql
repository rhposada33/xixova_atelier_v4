create type public.commercial_lead_status as enum ('new','contacted','qualified','meeting_scheduled','proposal','won','lost');
create type public.commercial_notification_status as enum ('pending','sent','failed','not_configured');
create type public.commercial_lead_source as enum ('website');

alter default privileges for role postgres in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated,service_role;

create table public.commercial_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120 and name=btrim(name)),
  company text not null check (char_length(company) between 1 and 120 and company=btrim(company)),
  role text check (role is null or role in ('Diretor(a)','Gerente comercial','Marketing','Vendas','Produto / Tecnologia','Arquiteto(a)','Outro')),
  whatsapp_e164 text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{9,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email=btrim(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  city_state text not null check (char_length(city_state) between 1 and 120 and city_state=btrim(city_state)),
  units_range text not null check (units_range in ('Até 30','31 a 80','81 a 150','151 a 300','Mais de 300','Ainda não definido')),
  launch_window text not null check (launch_window in ('Até 3 meses','De 3 a 6 meses','De 6 a 12 meses','Mais de 12 meses','Empreendimento já lançado','Ainda não definido')),
  model_3d_status text not null check (model_3d_status in ('Sim, pronto para uso','Sim, mas precisa ser avaliado','Ainda não','Não sei informar')),
  message text check (message is null or char_length(message) <= 1000),
  source public.commercial_lead_source not null default 'website',
  page_path text not null check (char_length(page_path) between 1 and 200 and page_path=btrim(page_path)),
  utm_source text check (utm_source is null or char_length(utm_source) <= 200),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 200),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  privacy_policy_version text not null check (char_length(privacy_policy_version) between 1 and 80 and privacy_policy_version=btrim(privacy_policy_version)),
  privacy_notice_accepted_at timestamptz not null,
  consent_at timestamptz not null,
  status public.commercial_lead_status not null default 'new',
  notification_status public.commercial_notification_status not null default 'pending',
  notification_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (whatsapp_e164 is not null or email is not null)
);

create table public.commercial_lead_idempotency (
  idempotency_hash bytea primary key check (octet_length(idempotency_hash)=32),
  payload_hash bytea not null check (octet_length(payload_hash)=32),
  lead_id uuid not null references public.commercial_leads(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.commercial_lead_rate_limits (
  rate_limit_hash bytea primary key check (octet_length(rate_limit_hash)=32),
  window_started_at timestamptz not null,
  request_count smallint not null check (request_count between 1 and 5),
  updated_at timestamptz not null default now()
);

create index commercial_leads_created_at_idx on public.commercial_leads (created_at desc);
create index commercial_leads_status_created_at_idx on public.commercial_leads (status,created_at desc);
create index commercial_lead_idempotency_expires_at_idx on public.commercial_lead_idempotency (expires_at);
create index commercial_lead_rate_limits_window_idx on public.commercial_lead_rate_limits (window_started_at);

create function public.set_commercial_lead_updated_at() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
create trigger commercial_leads_updated_at before update on public.commercial_leads for each row execute function public.set_commercial_lead_updated_at();

alter table public.commercial_leads enable row level security;
alter table public.commercial_lead_idempotency enable row level security;
alter table public.commercial_lead_rate_limits enable row level security;

revoke all on table public.commercial_leads,public.commercial_lead_idempotency,public.commercial_lead_rate_limits from public,anon,authenticated,service_role;
revoke all on function public.set_commercial_lead_updated_at() from public,anon,authenticated,service_role;

create function public.accept_commercial_lead(
  p_idempotency_hash bytea,
  p_payload_hash bytea,
  p_rate_limit_hash bytea,
  p_name text,
  p_company text,
  p_role text,
  p_whatsapp_e164 text,
  p_email text,
  p_city_state text,
  p_units_range text,
  p_launch_window text,
  p_model_3d_status text,
  p_message text,
  p_source public.commercial_lead_source,
  p_page_path text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_privacy_policy_version text,
  p_privacy_notice_accepted_at timestamptz,
  p_consent_at timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare
  v_now timestamptz:=now();
  v_existing public.commercial_lead_idempotency%rowtype;
  v_rate public.commercial_lead_rate_limits%rowtype;
  v_lead_id uuid;
begin
  if octet_length(p_idempotency_hash)<>32 or octet_length(p_payload_hash)<>32 or octet_length(p_rate_limit_hash)<>32 then
    raise exception using errcode='22023',message='invalid_request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(encode(p_idempotency_hash,'hex'),0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(encode(p_rate_limit_hash,'hex'),1));
  select * into v_existing from public.commercial_lead_idempotency where idempotency_hash=p_idempotency_hash for update;
  if found and v_existing.expires_at>v_now then
    if v_existing.payload_hash<>p_payload_hash then
      return 'idempotency_conflict';
    end if;
    return 'accepted';
  elsif found then
    delete from public.commercial_lead_idempotency where idempotency_hash=p_idempotency_hash;
  end if;

  select * into v_rate from public.commercial_lead_rate_limits where rate_limit_hash=p_rate_limit_hash for update;
  if not found then
    insert into public.commercial_lead_rate_limits(rate_limit_hash,window_started_at,request_count) values(p_rate_limit_hash,v_now,1);
  elsif v_rate.window_started_at<=v_now-interval '15 minutes' then
    update public.commercial_lead_rate_limits set window_started_at=v_now,request_count=1,updated_at=v_now where rate_limit_hash=p_rate_limit_hash;
  elsif v_rate.request_count>=5 then
    return 'rate_limited';
  else
    update public.commercial_lead_rate_limits set request_count=request_count+1,updated_at=v_now where rate_limit_hash=p_rate_limit_hash;
  end if;

  insert into public.commercial_leads(name,company,role,whatsapp_e164,email,city_state,units_range,launch_window,model_3d_status,message,source,page_path,utm_source,utm_medium,utm_campaign,privacy_policy_version,privacy_notice_accepted_at,consent_at)
  values(p_name,p_company,nullif(p_role,''),nullif(p_whatsapp_e164,''),nullif(p_email,''),p_city_state,p_units_range,p_launch_window,p_model_3d_status,nullif(p_message,''),p_source,p_page_path,nullif(p_utm_source,''),nullif(p_utm_medium,''),nullif(p_utm_campaign,''),p_privacy_policy_version,p_privacy_notice_accepted_at,p_consent_at)
  returning id into v_lead_id;
  insert into public.commercial_lead_idempotency(idempotency_hash,payload_hash,lead_id,expires_at) values(p_idempotency_hash,p_payload_hash,v_lead_id,v_now+interval '24 hours');
  return 'accepted';
end;
$$;

revoke all on function public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz) to service_role;
