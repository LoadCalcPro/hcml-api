-- LoadCalcPro staging database schema (use this file)
-- Run ONLY in the LoadCalcPro Staging Supabase project.
-- Creates structure only; no production customer data is copied.

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
revoke all on table public.members from anon, authenticated;

comment on table public.members is
  'Staging-only calculator entitlements. Do not copy production customer data.';
