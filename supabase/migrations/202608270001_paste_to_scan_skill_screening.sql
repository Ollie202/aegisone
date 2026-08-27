-- Paste-to-scan skill screening: hash-based cache/blacklist memory for the deterministic Tier-1
-- @aegisone/skill-audit static analysis of raw, publisher-less pasted Agent Skill content.
--
-- Follows the exact 202608260001_m8_4_capability_catalog.sql convention: RLS enabled, deny-by-
-- default anon/authenticated policy (only the token-gated aegisone-catalog Edge Function may
-- read/write), CHECK constraints on enum-like columns, an updated_at trigger, and indexes.
--
-- This table MUST NOT become a path to REPOSITORY_AUTHENTICATED, SIGNED_RELEASE, MATCH/MISMATCH,
-- or any source-claim/correspondence value: a pasted skill has no claimed publisher and no
-- claimed source, so no column here represents source assurance or distribution correspondence.
-- `verdict` is derived *only* from the deterministic Tier-1 audit's highest severity
-- (packages/catalog-store/src/pasted-skill-verdict.ts); an optional Tier-2 0G Compute LLM
-- advisory finding is never persisted here (it is per-request/rate-limited/opt-in and never
-- authoritative — see apps/web/src/scan-service.ts).

create table if not exists public.pasted_skill_scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Cache key: the canonical skill-package content SHA-256 digest
  -- (packages/skill-audit's canonicalSkillPackageBytes -> sha256Bytes over the submitted files).
  content_sha256 text not null unique check (content_sha256 ~ '^[0-9a-fA-F]{64}$'),

  verdict text not null
    check (verdict in ('CLEAN', 'FLAGGED', 'BLACKLISTED')),
  highest_severity text not null
    check (highest_severity in ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  finding_count integer not null check (finding_count >= 0),
  -- Deterministic Tier-1 findings only, bounded/capped by the application before insert
  -- (apps/web/src/scan-service.ts MAX_STORED_FINDINGS) — never unlimited raw findings.
  findings_json jsonb not null default '[]',

  first_scanned_at timestamptz not null default now(),
  last_scanned_at timestamptz not null default now(),
  scan_count integer not null default 1 check (scan_count >= 1)
);

create index if not exists pasted_skill_scans_verdict_idx
  on public.pasted_skill_scans (verdict);

create or replace function public.set_pasted_skill_scan_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pasted_skill_scans_set_updated_at on public.pasted_skill_scans;
create trigger pasted_skill_scans_set_updated_at
before update on public.pasted_skill_scans
for each row execute function public.set_pasted_skill_scan_updated_at();

alter table public.pasted_skill_scans enable row level security;

-- No anon/authenticated policies. Only the service-role-backed Edge Function
-- (supabase/functions/aegisone-catalog) may read/write this table; public reads/writes are
-- served through proofrail-app's own POST /api/v1/scan route, not raw table access.
drop policy if exists "pasted_skill_scans_deny_clients" on public.pasted_skill_scans;
create policy "pasted_skill_scans_deny_clients"
on public.pasted_skill_scans
for all
to anon, authenticated
using (false)
with check (false);
