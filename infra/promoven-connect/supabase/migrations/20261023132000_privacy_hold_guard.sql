alter function public.connect_privacy(uuid,text,text) rename to connect_privacy_internal;
revoke all on function public.connect_privacy_internal(uuid,text,text) from public,anon,authenticated;
create function public.connect_privacy(p_lead uuid,p_action text,p_ticket text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.leads;
begin
 select * into l from public.leads where id=p_lead for update;
 if not found or not private.is_org_admin(l.organization_id) then raise exception using errcode='42501',message='forbidden';end if;
 if p_action in ('approved','export') and exists(select 1 from public.connect_privacy_requests where lead_id=p_lead and decision='hold') then raise exception using errcode='42501',message='legal_hold_review_required';end if;
 return public.connect_privacy_internal(p_lead,p_action,p_ticket);
end; $$;
revoke all on function public.connect_privacy(uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_privacy(uuid,text,text) to authenticated;
