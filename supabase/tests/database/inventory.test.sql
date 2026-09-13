begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select is((select count(*)::integer from public.organizations),1,'seed creates one organization');
select is((select count(*)::integer from public.projects),1,'seed creates one project');
select is((select count(*)::integer from public.floors),18,'seed creates 18 floors');
select is((select count(*)::integer from public.units),72,'seed creates 72 units');
select is((select count(*)::integer from public.units where status='available'),54,'54 units are available');
select is((select count(*)::integer from public.units where status='reserved'),6,'6 units are reserved');
select is((select count(*)::integer from public.units where status='sold'),12,'12 units are sold');

set local role anon;
select is((select count(*)::integer from public.get_public_inventory('escobar','escobar-residences',null)),72,'anon reads published inventory through RPC');
select throws_ok($$select * from public.units$$,'42501','permission denied for table units','anon cannot read units directly');
select throws_ok($$insert into public.units(id,project_id,building_id,floor_id,unit_type_id,code,status,parking_spaces,orientation,model_object_id) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'x','available',0,'north','x')$$,'42501',null,'anon cannot insert units');
reset role;

update public.projects set status='draft',published_at=null where slug='escobar-residences';
select is((select count(*)::integer from public.get_public_inventory('escobar','escobar-residences',null)),0,'draft project is excluded');
update public.projects set status='published',published_at='2026-09-12T00:00:00Z' where slug='escobar-residences';
update public.organizations set status='inactive' where slug='escobar';
select is((select count(*)::integer from public.get_public_inventory('escobar','escobar-residences',null)),0,'inactive organization is excluded');
update public.organizations set status='active' where slug='escobar';
update public.units set published=false where code='1203';
select is((select count(*)::integer from public.get_public_inventory('escobar','escobar-residences','1203')),0,'unpublished unit is excluded');
update public.units set published=true where code='1203';
update public.units set status='hidden' where code='1203';
select is((select count(*)::integer from public.get_public_inventory('escobar','escobar-residences','1203')),0,'hidden unit is excluded');
update public.units set status='available' where code='1203';

select ok(position('reserved_until' in pg_get_function_result('public.get_public_inventory(text,text,text)'::regprocedure))=0,'RPC excludes reserved_until');
select ok(position('organization_members' in pg_get_function_result('public.get_public_inventory(text,text,text)'::regprocedure))=0,'RPC excludes memberships');
select ok(not has_function_privilege('public','public.get_public_inventory(text,text,text)','execute'),'PUBLIC cannot execute RPC');
select ok(has_function_privilege('anon','public.get_public_inventory(text,text,text)','execute') and has_function_privilege('authenticated','public.get_public_inventory(text,text,text)','execute'),'only API roles receive RPC execute');
set local role anon;
select throws_ok($$select * from public.organization_members$$,'42501','permission denied for table organization_members','memberships are not public');
reset role;

select * from finish();
rollback;
