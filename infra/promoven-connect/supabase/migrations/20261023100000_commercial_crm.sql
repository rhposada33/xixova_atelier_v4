-- PC-06: extend the PC-05 entities; origin attribution remains immutable.
alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check check(status in ('new','contacted','qualified','proposal','won','lost'));
alter table public.leads add column version bigint not null default 1,
 add column last_activity_at timestamptz not null default now(),
 add column next_action text check(char_length(next_action)<=500),
 add column follow_up_at timestamptz,
 add column closed_at timestamptz,
 add column closure_reason text check(char_length(closure_reason)<=1000),
 add column responsible_user_id uuid references auth.users(id);
update public.leads set last_activity_at=created_at;
alter table public.lead_activities drop constraint lead_activities_activity_type_check;
alter table public.lead_activities add constraint lead_activities_activity_type_check check(activity_type in ('received','status_changed','contact_attempt','contact_completed','note_added','follow_up_scheduled','follow_up_completed','lead_closed','responsibility_transferred'));
alter table public.lead_activities add column actor_id uuid references auth.users(id), add column detail jsonb not null default '{}'::jsonb;
create index leads_activity_idx on public.leads(organization_id,last_activity_at desc,id);
create index lead_activities_lead_idx on public.lead_activities(lead_id,created_at,id);
create function private.crm_allowed(p public.leads) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_user() and (private.can_manage_brokers(p.organization_id) or
 (private.active_broker_access(p.project_id) and (p.responsible_user_id=auth.uid() or
 (p.responsible_user_id is null and exists(select 1 from public.lead_attributions a where a.lead_id=p.id and a.broker_user_id=auth.uid())))))
$$;
create function private.crm_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception using errcode='42501',message='immutable_history'; end $$;
create trigger crm_activity_immutable before update or delete on public.lead_activities for each row execute function private.crm_immutable();
create trigger crm_attribution_immutable before update or delete on public.lead_attributions for each row execute function private.crm_immutable();
create function public.connect_crm_change(p_id uuid,p_expected_version bigint,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.leads; old_status text; event text; target uuid; target_status text; reason text;
begin
 if auth.uid() is null or not private.is_active_user() then raise exception using errcode='42501',message='forbidden'; end if;
 if p_expected_version is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception using errcode='22023',message='invalid_request'; end if;
 select * into r from public.leads where id=p_id;
 if not found then raise exception using errcode='P0002',message='not_found'; end if;
 -- Same lock order as access revocation: access before lead. Lock both caller and transfer target.
 target:=case when p_action='transfer' then nullif(p_data->>'userId','')::uuid else null end;
 perform 1 from public.project_broker_access where project_id=r.project_id and broker_user_id in (auth.uid(),target) order by id for update;
 select * into r from public.leads where id=p_id for update;
 if not private.crm_allowed(r) then raise exception using errcode='42501',message='forbidden'; end if;
 if r.version<>p_expected_version then raise exception using errcode='PT409',message='version_conflict'; end if;
 old_status:=r.status;
 if p_action='status' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('status','reason')) then raise exception using errcode='22023',message='invalid_fields'; end if;
  target_status:=p_data->>'status';reason:=nullif(btrim(p_data->>'reason'),'');
  if target_status is null or target_status not in ('new','contacted','qualified','proposal','won','lost') or target_status=r.status then raise exception using errcode='22023',message='invalid_status'; end if;
  if r.status in ('won','lost') and not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='manager_required_to_reopen'; end if;
  if (target_status in ('won','lost') or r.status in ('won','lost')) and reason is null then raise exception using errcode='22023',message='reason_required'; end if;
  r.status:=target_status;r.closed_at:=case when target_status in ('won','lost') then now() else null end;r.closure_reason:=case when target_status in ('won','lost') then reason else null end;
  if r.closed_at is not null then r.next_action:=null;r.follow_up_at:=null;end if;
  event:=case when r.closed_at is not null then 'lead_closed' else 'status_changed' end;
 elsif p_action='activity' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('type','note')) or coalesce(p_data->>'type','') not in ('contact_attempt','contact_completed','note_added') or coalesce(char_length(btrim(p_data->>'note')),0) not between 1 and 2000 then raise exception using errcode='22023',message='invalid_activity'; end if;
  event:=p_data->>'type';
 elsif p_action='schedule' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('nextAction','followUpAt')) or coalesce(char_length(btrim(p_data->>'nextAction')),0) not between 1 and 500 or p_data->>'followUpAt' is null or r.status in ('won','lost') then raise exception using errcode='22023',message='invalid_follow_up'; end if;
  r.next_action:=btrim(p_data->>'nextAction');r.follow_up_at:=(p_data->>'followUpAt')::timestamptz;event:='follow_up_scheduled';
 elsif p_action='complete' then
  if p_data<>'{}'::jsonb or r.follow_up_at is null then raise exception using errcode='22023',message='no_follow_up'; end if;
  r.next_action:=null;r.follow_up_at:=null;event:='follow_up_completed';
 elsif p_action='transfer' then
  if not private.can_manage_brokers(r.organization_id) then raise exception using errcode='42501',message='manager_required'; end if;
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('userId','reason')) or coalesce(char_length(btrim(p_data->>'reason')),0) not between 1 and 1000 then raise exception using errcode='22023',message='reason_required'; end if;
  if target is not null and not exists(select 1 from public.project_broker_access a join public.profiles p on p.user_id=a.broker_user_id where a.project_id=r.project_id and a.broker_user_id=target and a.status='active' and a.verification_status='verified' and p.active) then raise exception using errcode='42501',message='target_not_authorized'; end if;
  r.responsible_user_id:=target;event:='responsibility_transferred';
 else raise exception using errcode='22023',message='invalid_action'; end if;
 update public.leads set status=r.status,version=version+1,last_activity_at=now(),next_action=r.next_action,follow_up_at=r.follow_up_at,closed_at=r.closed_at,closure_reason=r.closure_reason,responsible_user_id=r.responsible_user_id where id=r.id returning * into r;
 insert into public.lead_activities(lead_id,activity_type,actor_id,detail) values(r.id,event,auth.uid(),p_data||jsonb_build_object('oldStatus',old_status,'newStatus',r.status,'version',r.version));
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'crm.'||event,'lead',r.id,jsonb_build_object('version',r.version,'oldStatus',old_status,'newStatus',r.status));
 return jsonb_build_object('id',r.id,'version',r.version,'status',r.status);
end; $$;
create function public.connect_crm_lead(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.leads; result jsonb;
begin
 select * into r from public.leads where id=p_id;
 if not found or not private.crm_allowed(r) then raise exception using errcode='42501',message='forbidden'; end if;
 select to_jsonb(r)-'receipt_id' || jsonb_build_object('project_name',p.name,'unit_code',u.code,'origin_broker_id',a.broker_user_id,'origin_broker_name',b.display_name,'responsible_name',rb.display_name)
 into result from public.projects p left join public.units u on u.id=r.unit_id left join public.lead_attributions a on a.lead_id=r.id left join public.broker_profiles b on b.user_id=a.broker_user_id left join public.broker_profiles rb on rb.user_id=r.responsible_user_id where p.id=r.project_id;
 return result;
end; $$;
create function public.connect_crm_history(p_id uuid,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.connect_crm_lead(p_id);
 if p_offset is null or p_offset<0 then raise exception using errcode='22023',message='invalid_page'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select id,activity_type,actor_id,detail,created_at from public.lead_activities where lead_id=p_id order by created_at desc,id limit 30 offset p_offset) x);
end; $$;
create function private.crm_filtered(p_filters jsonb) returns setof public.leads language plpgsql stable security definer set search_path='' as $$
begin
 if p_filters is null or jsonb_typeof(p_filters)<>'object' or exists(select 1 from jsonb_object_keys(p_filters) k where k not in ('organizationId','projectId','brokerId','status','search','from','to','personal')) or char_length(coalesce(p_filters->>'search',''))>160 then raise exception using errcode='22023',message='invalid_filters'; end if;
 return query select l.* from public.leads l where private.crm_allowed(l)
 and (not coalesce((p_filters->>'personal')::boolean,false) or (private.active_broker_access(l.project_id) and (l.responsible_user_id=auth.uid() or (l.responsible_user_id is null and exists(select 1 from public.lead_attributions a where a.lead_id=l.id and a.broker_user_id=auth.uid())))))
 and (p_filters->>'organizationId' is null or l.organization_id=(p_filters->>'organizationId')::uuid)
 and (p_filters->>'projectId' is null or l.project_id=(p_filters->>'projectId')::uuid)
 and (p_filters->>'brokerId' is null or exists(select 1 from public.lead_attributions a where a.lead_id=l.id and a.broker_user_id=(p_filters->>'brokerId')::uuid))
 and (p_filters->>'status' is null or l.status=p_filters->>'status')
 and (p_filters->>'from' is null or l.created_at>=(p_filters->>'from')::timestamptz)
 and (p_filters->>'to' is null or l.created_at<(p_filters->>'to')::timestamptz)
 and (p_filters->>'search' is null or position(lower(p_filters->>'search') in lower(l.buyer_name||' '||l.contact_value))>0);
end; $$;
create function public.connect_crm_list(p_filters jsonb default '{}'::jsonb,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_offset is null or p_offset<0 then raise exception using errcode='22023',message='invalid_page'; end if;
 return jsonb_build_object('total',(select count(*) from private.crm_filtered(p_filters)), 'items',(select coalesce(jsonb_agg(public.connect_crm_lead(x.id) order by x.last_activity_at desc,x.id),'[]'::jsonb) from (select id,last_activity_at from private.crm_filtered(p_filters) order by last_activity_at desc,id limit 20 offset p_offset) x));
end; $$;
create function public.connect_crm_analytics(p_filters jsonb default '{}'::jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 with scoped as materialized(select * from private.crm_filtered(p_filters))
 select jsonb_build_object('received',(select count(*) from scoped),'pending',(select count(*) from scoped where follow_up_at<=now() and status not in ('won','lost')),
 'statuses',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from scoped group by status) a),
 'projects',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from (select p.id,p.name,count(*) total from scoped s join public.projects p on p.id=s.project_id group by p.id,p.name) a),
 'brokers',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from (select b.user_id as id,b.display_name as name,count(*) total from scoped s join public.lead_attributions la on la.lead_id=s.id join public.broker_profiles b on b.user_id=la.broker_user_id group by b.user_id,b.display_name) a),
 'units',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from (select u.id,u.code as name,count(*) total from scoped s join public.units u on u.id=s.unit_id group by u.id,u.code order by total desc,u.id limit 10) a))
$$;
revoke all on function private.crm_allowed(public.leads),private.crm_immutable(),private.crm_filtered(jsonb) from public,anon,authenticated;
revoke all on function public.connect_crm_change(uuid,bigint,text,jsonb),public.connect_crm_lead(uuid),public.connect_crm_history(uuid,integer),public.connect_crm_list(jsonb,integer),public.connect_crm_analytics(jsonb) from public,anon,authenticated;
grant execute on function public.connect_crm_change(uuid,bigint,text,jsonb),public.connect_crm_lead(uuid),public.connect_crm_history(uuid,integer),public.connect_crm_list(jsonb,integer),public.connect_crm_analytics(jsonb) to authenticated;
