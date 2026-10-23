create function public.connect_privacy_work_item(p_request uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('leadId',lead_id,'completed',phase='completed') from public.connect_privacy_requests where id=p_request and purpose='erase'
$$;
revoke all on function public.connect_privacy_work_item(uuid) from public,anon,authenticated,service_role;
grant execute on function public.connect_privacy_work_item(uuid) to connect_privacy_worker;
-- Prevent a trusted resource inventory from accidentally crossing tenant or object ownership boundaries.
create function private.privacy_resource_scope() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.kind='mail' then
  if not exists(select 1 from private.mail_outbox m join public.leads l on l.organization_id=m.organization_id where m.id=new.mail_id and l.id=new.lead_id) then raise exception using errcode='42501',message='resource_tenant_mismatch';end if;
 elsif split_part(new.path,'/',1)<>new.lead_id::text then raise exception using errcode='42501',message='resource_owner_mismatch';end if;
 return new;end$$;
create trigger privacy_resource_scope before insert or update on private.privacy_resources for each row execute function private.privacy_resource_scope();
revoke all on function private.privacy_resource_scope() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
