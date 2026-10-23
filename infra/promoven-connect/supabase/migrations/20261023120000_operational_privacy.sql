create table public.connect_privacy_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 lead_id uuid not null references public.leads, requested_by uuid not null references auth.users,
 ticket text not null check(ticket ~ '^[A-Z0-9-]{4,64}$'), decision text not null default 'pending' check(decision in ('pending','approved','hold','exported')),
 decided_by uuid references auth.users, created_at timestamptz not null default now());
alter table public.connect_privacy_requests enable row level security;
revoke all on public.connect_privacy_requests from public,anon,authenticated;
create function public.connect_privacy(p_lead uuid,p_action text,p_ticket text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.leads; r public.connect_privacy_requests; result jsonb;
begin
 select * into l from public.leads where id=p_lead;
 if not found or not private.is_org_admin(l.organization_id) then raise exception using errcode='42501',message='forbidden';end if;
 if p_action='request' then
 insert into public.connect_privacy_requests(organization_id,lead_id,requested_by,ticket) values(l.organization_id,l.id,auth.uid(),p_ticket) returning * into r;
 result:=jsonb_build_object('requestId',r.id);
 else
 select * into r from public.connect_privacy_requests where lead_id=l.id and ticket=p_ticket order by created_at desc limit 1 for update;
 if not found then raise exception using errcode='P0002',message='request_required';end if;
 if p_action in ('approved','hold') then
 if r.requested_by=auth.uid() or r.decision<>'pending' then raise exception using errcode='42501',message='independent_review_required';end if;
 update public.connect_privacy_requests set decision=p_action,decided_by=auth.uid() where id=r.id;
 result:=jsonb_build_object('decision',p_action);
 elsif p_action='export' then
 if r.decision<>'approved' then raise exception using errcode='42501',message='approval_required';end if;
 result:=jsonb_build_object('lead',to_jsonb(l),'activities',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.lead_activities a where lead_id=l.id),'attribution',(select to_jsonb(a) from public.lead_attributions a where lead_id=l.id));
 update public.connect_privacy_requests set decision='exported' where id=r.id;
 else raise exception using errcode='55000',message='erasure_requires_approved_history_and_backup_procedure';end if;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id) values(l.organization_id,auth.uid(),'privacy.'||p_action,'privacy_request',r.id);
 return result;
end; $$;
revoke all on function public.connect_privacy(uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_privacy(uuid,text,text) to authenticated;
