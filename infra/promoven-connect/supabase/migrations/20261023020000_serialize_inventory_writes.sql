-- Every inventory mutation participates in the same project-level serialization as CSV confirmation.
create function private.lock_inventory_project() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    perform 1 from public.projects where id=old.project_id for update;
    return old;
  end if;
  perform 1 from public.projects where id=new.project_id for update;
  return new;
end; $$;
create trigger units_project_lock before insert or update or delete on public.units
  for each row execute function private.lock_inventory_project();
revoke all on function private.lock_inventory_project() from public,anon,authenticated;
