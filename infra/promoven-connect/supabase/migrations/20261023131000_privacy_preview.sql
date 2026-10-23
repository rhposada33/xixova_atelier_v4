-- Preview and hold are additive. Erasure stays disabled until indirect references are covered.
create function public.connect_privacy_preview(p_lead uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.leads;
begin
 select * into l from public.leads where id=p_lead;
 if not found or not private.is_org_admin(l.organization_id) then raise exception using errcode='42501',message='forbidden';end if;
 return jsonb_build_object('leadId',l.id,'version',l.version,'executionEnabled',false,
 'hold',exists(select 1 from public.connect_privacy_requests where lead_id=l.id and decision='hold'),
 'directFields',jsonb_build_array('buyer_name','contact_value','message','next_action','closure_reason'),
 'activityRecords',(select count(*) from public.lead_activities where lead_id=l.id),
 'indirectReferences',jsonb_build_array('lead_id','receipt_id','project_id','unit_id','broker_link_id','created_at','audit_events','exports','backups'),
 'reason','indirect_reference_and_backup_policy_required');
end; $$;
revoke all on function public.connect_privacy_preview(uuid) from public,anon,authenticated;
grant execute on function public.connect_privacy_preview(uuid) to authenticated;
