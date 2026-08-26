-- Performance advisor follow-up: add covering indexes for two foreign keys
-- flagged as unindexed_foreign_keys (INFO level) after applying the M8.4-M8.7
-- migrations to production. No schema/behavior change, index-only.

create index if not exists capability_verifications_verification_job_idx
  on public.capability_verifications (verification_job_id);

create index if not exists source_claims_supersedes_idx
  on public.source_claims (supersedes_claim_id);
