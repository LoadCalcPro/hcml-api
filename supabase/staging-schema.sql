-- LoadCalcPro staging database schema
-- Run ONLY in the LoadCalcPro Staging Supabase project.
-- This file creates structure only. It does not copy production customers.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  active boolean not null default false,
  aic_access boolean not null default false,
  generator_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_email_not_blank check (length(trim(email)) > 3),
  constraint members_email_lowercase check (email = lower(email))
);

create unique index if not exists members_email_unique_idx
  on public.members (lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

alter table public.members enable row level security;

-- Browser users must never query or modify membership rows directly.
-- The Render API uses the server-only Supabase secret/service-role key,
-- which bypasses RLS. No anon/authenticated policies are intentionally added.

revoke all on table public.members from anon, authenticated;
revoke all on sequence public.members_id_seq from anon, authenticated;

comment on table public.members is
  'Staging-only calculator entitlements. Do not copy production customer data.';
