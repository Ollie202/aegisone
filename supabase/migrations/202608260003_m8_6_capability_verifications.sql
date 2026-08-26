-- M8.6: verification linkage/evidence pointers (docs/16-m8-database-plan.md
-- "Table: capability_verifications").
--
-- This table links a resource version (and, when present, the source claim used for
-- reproduction) to canonical ProofRail evidence already produced by the existing M7
-- Agent Skill verification pipeline (packages/skill-audit + packages/core). It is a
-- mutable *pointer/cache* row, never proof authority: canonical evidence living in 0G
-- Storage/registry (and the deterministic comparison that produced it) remains the
-- authoritative source. Application code must not trust an arbitrary row mutation over
-- validated canonical evidence (docs/17-m8-security-boundaries.md Threat M8-012 applies
-- to this table the same way it applies to source_claims).
--
-- Historical: a new verification always inserts a new row. Nothing here mutates a prior
-- canonical verdict because a newer resource version appeared (docs/16 "Data lifecycle").
--
-- source_inspection_status = 'INSPECTED' never implies correspondence. correspondence_status
-- can only be 'MATCH' / 'MISMATCH' / 'DIVERGED' when both publisher_sha256 and
-- reproduced_sha256 are present (source-only inspection has no publisher digest, so it is
-- structurally impossible for those rows to satisfy this constraint).

create table if not exists public.capability_verifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  resource_version_id uuid not null references public.resource_versions(id) on delete cascade,
  source_claim_id uuid null references public.source_claims(id),
  verification_job_id uuid null references public.verification_jobs(id),

  artifact_kind text not null check (artifact_kind in ('agent-skill')),

  source_inspection_status text not null
    check (source_inspection_status in ('NOT_RUN', 'INSPECTED')),

  correspondence_status text not null
    check (correspondence_status in ('NOT_EVALUATED', 'INSUFFICIENT_EVIDENCE', 'MATCH', 'MISMATCH', 'DIVERGED')),
  publisher_sha256 text null check (publisher_sha256 is null or publisher_sha256 ~ '^[0-9a-fA-F]{64}$'),
  reproduced_sha256 text null check (reproduced_sha256 is null or reproduced_sha256 ~ '^[0-9a-fA-F]{64}$'),

  security_status text not null check (security_status in ('NOT_RUN', 'COMPLETED')),
  security_highest_severity text null
    check (security_highest_severity is null or security_highest_severity in ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  security_finding_count integer null check (security_finding_count is null or security_finding_count >= 0),

  canonical_evidence_sha256 text null check (canonical_evidence_sha256 is null or canonical_evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  storage_root text null check (storage_root is null or length(storage_root) <= 512),
  storage_transaction text null check (storage_transaction is null or length(storage_transaction) <= 512),
  registry_contract text null check (registry_contract is null or length(registry_contract) <= 128),
  registry_record_id text null check (registry_record_id is null or length(registry_record_id) <= 128),
  registry_transaction text null check (registry_transaction is null or length(registry_transaction) <= 128),

  verified_at timestamptz null,

  -- Database-level sanity checks (docs/16 "Database-level sanity checks"). These reduce
  -- accidental bad rows; they do not turn Supabase into proof authority.
  constraint capability_verifications_match_requires_digests
    check (correspondence_status <> 'MATCH' or (publisher_sha256 is not null and reproduced_sha256 is not null and publisher_sha256 = reproduced_sha256)),
  constraint capability_verifications_mismatch_requires_digests
    check (correspondence_status <> 'MISMATCH' or (publisher_sha256 is not null and reproduced_sha256 is not null and publisher_sha256 <> reproduced_sha256)),
  constraint capability_verifications_diverged_requires_digests
    check (correspondence_status <> 'DIVERGED' or (publisher_sha256 is not null and reproduced_sha256 is not null)),
  constraint capability_verifications_not_evaluated_has_no_digests
    check (correspondence_status <> 'NOT_EVALUATED' or (publisher_sha256 is null and reproduced_sha256 is null)),
  constraint capability_verifications_completed_security_has_findings
    check (security_status <> 'COMPLETED' or (security_highest_severity is not null and security_finding_count is not null)),
  constraint capability_verifications_not_run_security_has_no_findings
    check (security_status <> 'NOT_RUN' or (security_highest_severity is null and security_finding_count is null))
);

create index if not exists capability_verifications_version_verified_idx
  on public.capability_verifications (resource_version_id, verified_at desc);
create index if not exists capability_verifications_canonical_evidence_idx
  on public.capability_verifications (canonical_evidence_sha256);
create index if not exists capability_verifications_source_claim_idx
  on public.capability_verifications (source_claim_id);

alter table public.capability_verifications enable row level security;

-- No anon/authenticated policies, matching every other M8 catalog table: only the
-- service-role-backed Edge Function (supabase/functions/proofrail-catalog) may read/write
-- this table; public reads are served through proofrail-app's own versioned API.
drop policy if exists "capability_verifications_deny_clients" on public.capability_verifications;
create policy "capability_verifications_deny_clients"
on public.capability_verifications
for all
to anon, authenticated
using (false)
with check (false);
