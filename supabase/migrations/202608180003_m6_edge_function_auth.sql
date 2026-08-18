-- M6: replace the token-gated SECURITY DEFINER RPC experiment with a
-- Supabase Edge Function that receives Supabase's service-role credential
-- internally. This removes anonymously executable SECURITY DEFINER functions.

drop function if exists public.proofrail_job_update(text, uuid, jsonb);
drop function if exists public.proofrail_job_list(text, boolean, uuid);
drop function if exists public.proofrail_job_get(text, uuid);
drop function if exists public.proofrail_job_create(text, uuid, text, text, text, text, text, text, text);
drop schema if exists proofrail_private cascade;

create table if not exists public.proofrail_app_auth (
  singleton boolean primary key default true check (singleton),
  token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now()
);

alter table public.proofrail_app_auth enable row level security;

-- Deliberately no anon/authenticated policies. Only Supabase's server-side
-- service role (used inside the Edge Function) may read this row.
revoke all on table public.proofrail_app_auth from anon, authenticated;
