create or replace function public.connect_leads(p_organization_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'projectId',x.project_id,'projectName',x.project_name,
    'unitCode',x.unit_code,'buyerName',x.buyer_name,'contactChannel',x.contact_channel,'contactValue',x.contact_value,
    'source',x.source,'status',x.status,'brokerName',x.broker_name,'createdAt',x.created_at) order by x.created_at desc,x.id),'[]'::jsonb)
  from (select l.*,p.name as project_name,u.code as unit_code,b.display_name as broker_name
    from public.leads l join public.projects p on p.id=l.project_id
    left join public.units u on u.id=l.unit_id left join public.lead_attributions la on la.lead_id=l.id
    left join public.broker_profiles b on b.user_id=la.broker_user_id
    where (p_organization_id is null or l.organization_id=p_organization_id) and private.is_active_user()
      and private.crm_allowed(l)
    order by l.created_at desc,l.id limit 100) x
$$;
