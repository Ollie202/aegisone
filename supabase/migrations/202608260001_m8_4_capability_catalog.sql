-- M8.4: capability catalog core tables (mutable discovery/version/ingestion state only).
--
-- These tables are ProofRail's mutable catalog/discovery index, not a proof authority.
-- They MUST NOT become a path to MATCH/MISMATCH, REPOSITORY_AUTHENTICATED, SIGNED_RELEASE,
-- security findings, or any other canonical ProofRail trust verdict. No column, default,
-- trigger, or policy in this migration writes a trust/evidence value; those only ever come
-- from the existing canonical verification pipeline (packages/core, packages/skill-audit,
-- the worker's 0G path) recorded in a later migration (M8.6+).
--
-- source_claims / source_claim_authority_observations / capability_verifications are
-- intentionally deferred to M8.5/M8.6 per docs/16-m8-database-plan.md; no foreign-key
-- skeleton for them is added here.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- agentic_resources: logical, version-independent capability identity.
-- ---------------------------------------------------------------------------

create table if not exists public.agentic_resources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  kind text not null
    check (kind in ('agent-skill', 'mcp-server', 'a2a-agent', 'api')),
  -- Deterministic/dedup key chosen by application normalization code
  -- (packages/catalog-store). Not a proof field; see docs/16-m8-database-plan.md.
  canonical_key text not null unique check (length(canonical_key) between 1 and 1024),
  name text not null check (length(name) between 1 and 512),
  description text not null default '' check (length(description) <= 8192),
  publisher_label text null check (publisher_label is null or length(publisher_label) <= 512),
  canonical_url text null check (canonical_url is null or length(canonical_url) <= 2048),

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists agentic_resources_kind_idx
  on public.agentic_resources (kind);

create or replace function public.set_agentic_resource_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agentic_resources_set_updated_at on public.agentic_resources;
create trigger agentic_resources_set_updated_at
before update on public.agentic_resources
for each row execute function public.set_agentic_resource_updated_at();

alter table public.agentic_resources enable row level security;

-- No anon/authenticated policies. Only the service-role-backed Edge Function
-- (supabase/functions/proofrail-catalog) may read/write this table; public reads
-- are served through proofrail-app's own versioned API, not raw table access.
drop policy if exists "agentic_resources_deny_clients" on public.agentic_resources;
create policy "agentic_resources_deny_clients"
on public.agentic_resources
for all
to anon, authenticated
using (false)
with check (false);

-- ---------------------------------------------------------------------------
-- resource_discoveries: provider-specific mutable discovery observations.
-- ---------------------------------------------------------------------------

create table if not exists public.resource_discoveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  resource_id uuid not null references public.agentic_resources(id) on delete cascade,
  provider_id text not null check (length(provider_id) between 1 and 256),
  provider_resource_id text not null check (length(provider_resource_id) between 1 and 1024),
  resource_url text null check (resource_url is null or length(resource_url) <= 2048),
  media_type text null check (media_type is null or length(media_type) <= 256),
  raw_relevance_score double precision null
    check (raw_relevance_score is null or (raw_relevance_score >= 0 and raw_relevance_score <= 1)),
  -- Relevance/discovery state only. Never consumed by the trust-policy evaluator.
  discovery_status text not null default 'INDEXED'
    check (discovery_status in ('INDEXED', 'STALE', 'UNAVAILABLE')),
  observed_at timestamptz not null,
  expires_at timestamptz null,
  -- Normalized/capped discovery metadata only; never unlimited raw upstream JSON.
  provider_metadata jsonb not null default '{}',

  unique (provider_id, provider_resource_id)
);

create index if not exists resource_discoveries_resource_idx
  on public.resource_discoveries (resource_id);
create index if not exists resource_discoveries_observed_idx
  on public.resource_discoveries (observed_at desc);

create or replace function public.set_resource_discovery_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resource_discoveries_set_updated_at on public.resource_discoveries;
create trigger resource_discoveries_set_updated_at
before update on public.resource_discoveries
for each row execute function public.set_resource_discovery_updated_at();

alter table public.resource_discoveries enable row level security;

drop policy if exists "resource_discoveries_deny_clients" on public.resource_discoveries;
create policy "resource_discoveries_deny_clients"
on public.resource_discoveries
for all
to anon, authenticated
using (false)
with check (false);

-- ---------------------------------------------------------------------------
-- resource_versions: exact version/source/distribution context.
--
-- Deviation from docs/16-m8-database-plan.md's suggested column list: this table
-- adds `version_key text not null`, an application-computed stable dedup key
-- (packages/catalog-store's canonical-key logic), because the plan document
-- itself flags that nullable-column uniqueness (e.g. on version_label alone,
-- which is frequently null for discovered-but-unversioned resources) is unsafe
-- for upsert. `version_key` is discovery bookkeeping, not a proof field.
-- ---------------------------------------------------------------------------

create table if not exists public.resource_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  resource_id uuid not null references public.agentic_resources(id) on delete cascade,
  version_key text not null check (length(version_key) between 1 and 1024),
  version_label text null check (version_label is null or length(version_label) <= 512),

  source_provider text null check (source_provider is null or length(source_provider) <= 256),
  source_repository text null check (source_repository is null or length(source_repository) <= 2048),
  source_repository_id bigint null,
  source_commit_sha text null
    check (source_commit_sha is null or source_commit_sha ~ '^[0-9a-fA-F]{40}$'),
  source_subdirectory text null check (source_subdirectory is null or length(source_subdirectory) <= 1024),

  -- A row with source-only fields does not imply correspondence. Presence of
  -- source/distribution data here is discovery/version bookkeeping only.
  distribution_url text null check (distribution_url is null or length(distribution_url) <= 2048),
  distribution_sha256 text null
    check (distribution_sha256 is null or distribution_sha256 ~ '^[0-9a-fA-F]{64}$'),

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  unique (resource_id, version_key)
);

create index if not exists resource_versions_resource_idx
  on public.resource_versions (resource_id);
create index if not exists resource_versions_source_idx
  on public.resource_versions (source_repository_id, source_commit_sha);

create or replace function public.set_resource_version_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resource_versions_set_updated_at on public.resource_versions;
create trigger resource_versions_set_updated_at
before update on public.resource_versions
for each row execute function public.set_resource_version_updated_at();

alter table public.resource_versions enable row level security;

drop policy if exists "resource_versions_deny_clients" on public.resource_versions;
create policy "resource_versions_deny_clients"
on public.resource_versions
for all
to anon, authenticated
using (false)
with check (false);

-- ---------------------------------------------------------------------------
-- ingestion_sources: incremental sync/cache state per discovery provider.
-- ---------------------------------------------------------------------------

create table if not exists public.ingestion_sources (
  id text primary key check (length(id) between 1 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  provider_type text not null check (length(provider_type) between 1 and 128),
  enabled boolean not null default true,
  last_success_at timestamptz null,
  last_attempt_at timestamptz null,
  cursor text null check (cursor is null or length(cursor) <= 4096),
  updated_since timestamptz null,
  last_error_code text null check (last_error_code is null or length(last_error_code) <= 256),
  last_error_at timestamptz null,
  -- Public/non-secret ingestion configuration only. Never OAuth tokens, App
  -- secrets/PEM, or any credential; see docs/16-m8-database-plan.md "What not
  -- to store".
  config_public jsonb not null default '{}'
);

create or replace function public.set_ingestion_source_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ingestion_sources_set_updated_at on public.ingestion_sources;
create trigger ingestion_sources_set_updated_at
before update on public.ingestion_sources
for each row execute function public.set_ingestion_source_updated_at();

alter table public.ingestion_sources enable row level security;

drop policy if exists "ingestion_sources_deny_clients" on public.ingestion_sources;
create policy "ingestion_sources_deny_clients"
on public.ingestion_sources
for all
to anon, authenticated
using (false)
with check (false);

insert into public.ingestion_sources (id, provider_type, enabled)
values
  ('github-agent-finder', 'discovery-provider', true),
  ('huggingface-discover', 'discovery-provider', true),
  ('mcp-official-registry', 'discovery-provider', true)
on conflict (id) do nothing;
