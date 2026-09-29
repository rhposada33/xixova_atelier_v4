drop function if exists public.accept_commercial_lead(bytea,bytea,bytea,text,text,text,text,text,text,text,text,text,text,public.commercial_lead_source,text,text,text,text,text,timestamptz,timestamptz);
drop trigger if exists commercial_leads_updated_at on public.commercial_leads;
drop function if exists public.set_commercial_lead_updated_at();
drop table if exists public.commercial_lead_idempotency;
drop table if exists public.commercial_lead_rate_limits;
drop table if exists public.commercial_leads;
drop type if exists public.commercial_lead_source;
drop type if exists public.commercial_notification_status;
drop type if exists public.commercial_lead_status;
