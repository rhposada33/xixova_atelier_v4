-- Only the server-side worker can read pending leads through these narrow RPCs.
create function public.claim_commercial_notifications(p_limit integer default 10)
returns table(lead_id uuid,name text,company text,role text,whatsapp_e164 text,email text,city_state text,units_range text,launch_window text,model_3d_status text,message text)
language plpgsql security definer set search_path='' as $$
begin
  return query
  with chosen as (
    select l.id from public.commercial_leads l
    where l.notification_status in ('pending','failed')
      and (l.notification_attempted_at is null or l.notification_attempted_at < now()-interval '5 minutes')
    order by l.created_at
    for update skip locked
    limit least(greatest(p_limit,1),25)
  )
  update public.commercial_leads l
     set notification_status='pending',notification_attempted_at=now()
    from chosen where l.id=chosen.id
  returning l.id,l.name,l.company,l.role,l.whatsapp_e164,l.email,l.city_state,l.units_range,l.launch_window,l.model_3d_status,l.message;
end;
$$;

create function public.mark_commercial_notification(p_lead_id uuid,p_status public.commercial_notification_status)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('sent','failed') then raise exception using errcode='22023',message='invalid_status'; end if;
  update public.commercial_leads set notification_status=p_status,notification_attempted_at=now() where id=p_lead_id;
end;
$$;

revoke all on function public.claim_commercial_notifications(integer) from public,anon,authenticated;
revoke all on function public.mark_commercial_notification(uuid,public.commercial_notification_status) from public,anon,authenticated;
grant execute on function public.claim_commercial_notifications(integer) to service_role;
grant execute on function public.mark_commercial_notification(uuid,public.commercial_notification_status) to service_role;
