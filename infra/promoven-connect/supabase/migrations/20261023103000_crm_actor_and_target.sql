create or replace function public.connect_crm_change(p_id uuid,p_expected_version bigint,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
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
  if target is null then raise exception using errcode='22023',message='target_required'; end if;
  if not exists(select 1 from public.project_broker_access a join public.profiles p on p.user_id=a.broker_user_id where a.project_id=r.project_id and a.broker_user_id=target and a.status='active' and a.verification_status='verified' and p.active and exists(select 1 from public.broker_profiles bp where bp.user_id=target and bp.verification_status='verified')) then raise exception using errcode='42501',message='target_not_authorized'; end if;
  r.responsible_user_id:=target;event:='responsibility_transferred';
 else raise exception using errcode='22023',message='invalid_action'; end if;
 update public.leads set status=r.status,version=version+1,last_activity_at=now(),next_action=r.next_action,follow_up_at=r.follow_up_at,closed_at=r.closed_at,closure_reason=r.closure_reason,responsible_user_id=r.responsible_user_id where id=r.id returning * into r;
 insert into public.lead_activities(lead_id,activity_type,actor_id,detail) values(r.id,event,auth.uid(),p_data||jsonb_build_object('oldStatus',old_status,'newStatus',r.status,'version',r.version));
 insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values(r.organization_id,auth.uid(),'crm.'||event,'lead',r.id,jsonb_build_object('version',r.version,'oldStatus',old_status,'newStatus',r.status));
 return jsonb_build_object('id',r.id,'version',r.version,'status',r.status);
end; $$;

create or replace function public.connect_crm_history(p_id uuid,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.connect_crm_lead(p_id);
 if p_offset is null or p_offset<0 then raise exception using errcode='22023',message='invalid_page'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select a.id,a.activity_type,a.actor_id,coalesce(nullif(p.full_name,''),b.display_name,'Usuário Connect') as actor_name,a.detail,a.created_at from public.lead_activities a left join public.profiles p on p.user_id=a.actor_id left join public.broker_profiles b on b.user_id=a.actor_id where a.lead_id=p_id order by a.created_at desc,a.id limit 30 offset p_offset) x);
end; $$;
