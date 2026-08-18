-- M6: mutable application/job index only.
-- ProofRail MATCH/MISMATCH remains derived from canonical verification evidence,
-- not from any mutable status/value in this table.

create extension if not exists pgcrypto;

create table if not exists public.verification_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null default 'queued'
    check (status in ('queued', 'running', 'verified', 'failed')),
  artifact_kind text not null default 'software'
    check (artifact_kind in ('software', 'agent-skill')),

  project_id text not null check (length(project_id) between 1 and 200),
  source_repository text not null check (length(source_repository) between 1 and 2048),
  source_commit_sha text not null
    check (source_commit_sha ~ '^[0-9a-fA-F]{40}$'),
  source_subdirectory text null,
  publisher_artifact_name text not null check (length(publisher_artifact_name) between 1 and 512),
  publisher_artifact_sha256 text null
    check (publisher_artifact_sha256 is null or publisher_artifact_sha256 ~ '^[0-9a-fA-F]{64}$'),

  -- Immutable-evidence pointers/caches. These make jobs discoverable but do not
  -- replace verification against 0G Storage / Aristotle commitments.
  manifest_sha256 text null
    check (manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-fA-F]{64}$'),
  storage_root text null,
  storage_transaction text null,
  registry_contract text null,
  registry_transaction text null,
  registry_record_id text null,

  -- Optional convenience cache. The app MUST run this through ProofRail core's
  -- integrity checks before rendering a correspondence verdict.
  verification_json jsonb null,

  failure_code text null,
  failure_message text null,

  check ((failure_code is null) = (failure_message is null))
);

create index if not exists verification_jobs_owner_created_idx
  on public.verification_jobs (owner_id, created_at desc);
create index if not exists verification_jobs_source_idx
  on public.verification_jobs (source_repository, source_commit_sha);
create index if not exists verification_jobs_status_idx
  on public.verification_jobs (status, created_at desc);

create or replace function public.set_verification_job_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists verification_jobs_set_updated_at on public.verification_jobs;
create trigger verification_jobs_set_updated_at
before update on public.verification_jobs
for each row execute function public.set_verification_job_updated_at();

alter table public.verification_jobs enable row level security;

-- Authenticated clients can only see/manipulate their own rows. The ProofRail
-- server uses a server-side service-role secret and may process jobs on behalf
-- of users. No service-role key belongs in browser code or database rows.
drop policy if exists "verification_jobs_select_own" on public.verification_jobs;
create policy "verification_jobs_select_own"
on public.verification_jobs for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "verification_jobs_insert_own" on public.verification_jobs;
create policy "verification_jobs_insert_own"
on public.verification_jobs for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "verification_jobs_update_own" on public.verification_jobs;
create policy "verification_jobs_update_own"
on public.verification_jobs for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
