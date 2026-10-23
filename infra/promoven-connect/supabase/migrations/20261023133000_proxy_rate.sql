-- Dedicated local proxy role: no access to customer tables, Auth or Storage.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='connect_proxy') then create role connect_proxy nologin; end if;
end $$;
grant connect_proxy to authenticator;
grant usage on schema public to connect_proxy;
create table private.connect_proxy_buckets (
 key text primary key check(key ~ '^[a-f0-9]{64}$'),
 window_start timestamptz not null,
 requests integer not null check(requests > 0)
);
alter table private.connect_proxy_buckets enable row level security;
revoke all on private.connect_proxy_buckets from public,anon,authenticated,connect_proxy;
create function public.connect_proxy_rate(p_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer; t timestamptz := clock_timestamp();
begin
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='invalid_rate_key'; end if;
 -- Cleanup is bounded by the last hour of active clients; no IP or token stored.
 delete from private.connect_proxy_buckets where window_start < t - interval '1 hour';
 insert into private.connect_proxy_buckets as b values(p_key,t,1)
 on conflict(key) do update set
 requests=case when b.window_start <= t-interval '60 seconds' then 1 else least(b.requests+1,31) end,
 window_start=case when b.window_start <= t-interval '60 seconds' then t else b.window_start end
 returning requests into n;
 return n <= 30;
end $$;
revoke all on function public.connect_proxy_rate(text) from public,anon,authenticated;
grant execute on function public.connect_proxy_rate(text) to connect_proxy;
notify pgrst,'reload schema';
