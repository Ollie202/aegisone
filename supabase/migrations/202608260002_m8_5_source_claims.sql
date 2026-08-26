-- M8.5: source claims / GitHub authority evidence (docs/16-m8-database-plan.md
-- "Table: source_claims" / "Table: source_claim_authority_observations",
-- docs/14-source-authentication.md).
--
-- These tables record *claims* about who authenticated a source mapping and with what
-- observed GitHub authority. They are historical evidence: once inserted, every column
-- except claim_status is immutable. A new source mapping always creates a new row rather
-- than mutating an existing authenticated claim in place (docs/17-m8-security-boundaries.md
-- Threat M8-012). No column, default, trigger, or policy in this migration writes a
-- MATCH/MISMATCH, security, or canonical-evidence value; assurance_level here only ever
-- reflects a GitHub-authenticated *authority* observation over a repository, never
-- correspondence/safety.
--
-- Never store GitHub OAuth access tokens, authorization codes, or the GitHub App client
-- secret/PEM in these (or any) tables (docs/16 "What not to store").

create table if not exists public.source_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  resource_version_id uuid not null references public.resource_versions(id) on delete cascade,
  provider text not null check (length(provider) between 1 and 64),

  assurance_level text not null
    check (assurance_level in ('NONE', 'DECLARED', 'REPOSITORY_AUTHENTICATED', 'SIGNED_RELEASE')),
  -- Lifecycle status only. This is the one column allowed to change after insert: a later
  -- claim for the same resource_version_id supersedes ('superseded') or conflicts with
  -- ('conflicted') this row. The evidence columns below never change once written.
  claim_status text not null default 'active'
    check (claim_status in ('active', 'superseded', 'conflicted', 'revoked')),

  source_repository text not null check (length(source_repository) between 1 and 2048),
  -- Stable numeric GitHub repository ID; identity does not depend on owner/name text alone
  -- (docs/17 Threat M8-009 repo rename/transfer confusion).
  source_repository_id bigint null,
  source_repository_node_id text null check (source_repository_node_id is null or length(source_repository_node_id) <= 256),
  source_owner_login text null check (source_owner_login is null or length(source_owner_login) <= 512),
  source_owner_id bigint null,

  source_commit_sha text not null check (source_commit_sha ~ '^[0-9a-fA-F]{40}$'),
  source_subdirectory text null check (source_subdirectory is null or length(source_subdirectory) <= 1024),

  distribution_url text null check (distribution_url is null or length(distribution_url) <= 2048),
  distribution_sha256 text null check (distribution_sha256 is null or distribution_sha256 ~ '^[0-9a-fA-F]{64}$'),

  claim_digest_sha256 text not null check (claim_digest_sha256 ~ '^[0-9a-fA-F]{64}$'),
  canonical_claim_json jsonb not null,

  authenticated_at timestamptz null,
  supersedes_claim_id uuid null references public.source_claims(id)
);

create unique index if not exists source_claims_digest_idx
  on public.source_claims (claim_digest_sha256);
create index if not exists source_claims_version_created_idx
  on public.source_claims (resource_version_id, created_at desc);
create index if not exists source_claims_version_active_idx
  on public.source_claims (resource_version_id)
  where claim_status = 'active';

alter table public.source_claims enable row level security;

-- No anon/authenticated policies. Only the service-role-backed Edge Function
-- (supabase/functions/proofrail-catalog) may read/write this table; public reads are served
-- through proofrail-app's own versioned API, not raw table access.
drop policy if exists "source_claims_deny_clients" on public.source_claims;
create policy "source_claims_deny_clients"
on public.source_claims
for all
to anon, authenticated
using (false)
with check (false);

-- ---------------------------------------------------------------------------
-- source_claim_authority_observations: provider-specific evidence explaining *why* an
-- assurance level was earned (or withheld). Immutable once inserted.
-- ---------------------------------------------------------------------------

create table if not exists public.source_claim_authority_observations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  source_claim_id uuid not null references public.source_claims(id) on delete cascade,
  provider text not null check (length(provider) between 1 and 64),
  subject_type text not null check (length(subject_type) between 1 and 64),
  -- Stable numeric GitHub user ID, serialized as text.
  subject_id text not null check (length(subject_id) between 1 and 256),
  subject_login text null check (subject_login is null or length(subject_login) <= 512),
  repository_id bigint null,
  observed_permission text null check (observed_permission is null or length(observed_permission) <= 64),
  observed_role_name text null check (observed_role_name is null or length(observed_role_name) <= 128),
  -- Small, redacted raw observation only; never an access token/code (docs/16 "What not to store").
  observation_json jsonb not null default '{}',
  observed_at timestamptz not null
);

create index if not exists source_claim_authority_observations_claim_idx
  on public.source_claim_authority_observations (source_claim_id);

alter table public.source_claim_authority_observations enable row level security;

drop policy if exists "source_claim_authority_observations_deny_clients" on public.source_claim_authority_observations;
create policy "source_claim_authority_observations_deny_clients"
on public.source_claim_authority_observations
for all
to anon, authenticated
using (false)
with check (false);
