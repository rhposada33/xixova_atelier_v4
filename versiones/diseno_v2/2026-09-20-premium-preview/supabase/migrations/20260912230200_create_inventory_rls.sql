alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.unit_types enable row level security;
alter table public.units enable row level security;
alter table public.unit_status_history enable row level security;

alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon,authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated;
revoke execute on function public.set_updated_at() from public,anon,authenticated;
revoke all on table public.organizations,public.organization_members,public.projects,public.buildings,public.floors,public.unit_types,public.units,public.unit_status_history from anon,authenticated;
grant select on table public.organizations,public.organization_members,public.projects,public.buildings,public.floors,public.unit_types,public.units,public.unit_status_history to authenticated;

create policy "members read own membership" on public.organization_members for select to authenticated using (user_id=(select auth.uid()));
create policy "members read own organizations" on public.organizations for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=organizations.id and m.user_id=(select auth.uid())));
create policy "members read own projects" on public.projects for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=projects.organization_id and m.user_id=(select auth.uid())));
create policy "members read own buildings" on public.buildings for select to authenticated using (exists(select 1 from public.projects p join public.organization_members m on m.organization_id=p.organization_id where p.id=buildings.project_id and m.user_id=(select auth.uid())));
create policy "members read own floors" on public.floors for select to authenticated using (exists(select 1 from public.buildings b join public.projects p on p.id=b.project_id join public.organization_members m on m.organization_id=p.organization_id where b.id=floors.building_id and m.user_id=(select auth.uid())));
create policy "members read own unit types" on public.unit_types for select to authenticated using (exists(select 1 from public.projects p join public.organization_members m on m.organization_id=p.organization_id where p.id=unit_types.project_id and m.user_id=(select auth.uid())));
create policy "members read own units" on public.units for select to authenticated using (exists(select 1 from public.projects p join public.organization_members m on m.organization_id=p.organization_id where p.id=units.project_id and m.user_id=(select auth.uid())));
create policy "members read own unit history" on public.unit_status_history for select to authenticated using (exists(select 1 from public.units u join public.projects p on p.id=u.project_id join public.organization_members m on m.organization_id=p.organization_id where u.id=unit_status_history.unit_id and m.user_id=(select auth.uid())));
