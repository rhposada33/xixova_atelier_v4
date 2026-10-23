-- Persist the completed import result. Preview remains read-only and creates no row.
alter table public.inventory_imports
  add column status text not null default 'completed' check (status='completed'),
  add column valid_rows integer generated always as (total_rows) stored,
  add column invalid_rows integer not null default 0 check (invalid_rows=0),
  add column confirmed_at timestamptz not null default now();
