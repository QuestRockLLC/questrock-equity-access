-- QuestRock Core — Equity Access intake
create table if not exists public.equity_access_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'QuestHELOC · Equity Access',
  status text not null default 'New inquiry',
  purpose text,
  amount text,
  property_state text,
  occupancy text,
  property_type text,
  value_range text,
  balance_range text,
  current_mortgage text,
  first_name text,
  last_name text,
  email text,
  phone text,
  preferred_contact text,
  other_products boolean not null default false,
  contact_consent boolean not null default false,
  route text,
  route_label text,
  flags jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb
);

alter table public.equity_access_inquiries enable row level security;
grant all on public.equity_access_inquiries to service_role;
