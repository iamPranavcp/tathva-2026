create table if not exists public.site_content (
  id text primary key check (id = 'main'),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- The Node server uses the Supabase secret key after checking its CMS session.
-- Keep RLS enabled and do not create public read/write policies.
alter table public.site_content enable row level security;
