-- Authenticated administrator context required; review by creation date, no deletion.
-- psql parameters: organization_id, review_days, page_offset. Values are SQL quoted.
begin read only;
select public.connect_crm_list(jsonb_build_object(
 'organizationId',:'organization_id',
 'to',(now()-make_interval(days=>greatest(30,least(3650,:'review_days'::integer))))::text
), :'page_offset'::integer);
rollback;
