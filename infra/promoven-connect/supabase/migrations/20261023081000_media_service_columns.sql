-- The Edge runtime needs only these columns after SQL authorization succeeds.
grant select(id,storage_path,mime_type) on public.project_assets to service_role;
