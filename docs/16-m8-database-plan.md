# M8 Supabase / Catalog Database Plan

## Current production state

The existing AegisOne Supabase project is active and currently has two public tables:

1. `verification_jobs`
2. `proofrail_app_auth`

Both have RLS enabled.

M8 must extend this same project. Do not create a parallel database/project.

## Database role in the trust model

Supabase is mutable application/catalog memory.

It may store:

- discovery/cache records;
- resource identities and versions;
- source-auth observations;
- verification job state;
- pointers to immutable/canonical evidence.

It may **not** become the authority that creates:

- `MATCH` / `MISMATCH`;
- `REPOSITORY_AUTHENTICATED`;
- `SIGNED_RELEASE`;
- security audit results;
- 0G proof/readback state.

Those values must be derived from validated evidence produced by their respective verifier and, when shown from cache, cross-checked against integrity-protected evidence/pointers according to the existing presentation rules.

## Migration strategy

Add one migration per coherent backend issue rather than one giant migration.

Suggested sequence:

```text
M8.4  capability catalog core tables
M8.5  source claims / GitHub authority evidence
M8.6  verification linkage/evidence pointers
M8.10 MCP ingestion fields only if actually needed
```

Do not alter historical `verification_jobs` semantics gratuitously. Link new resource versions to existing verification jobs where useful.

## Table: `agentic_resources`

Logical, version-independent capability identity.

Suggested columns:

```text
id                    uuid primary key default gen_random_uuid()
kind                  text not null
canonical_key         text not null unique
name                  text not null
description           text not null default ''
publisher_label       text null
canonical_url         text null
first_seen_at         timestamptz not null default now()
last_seen_at          timestamptz not null default now()
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()
```

`kind` check:

```text
agent-skill
mcp-server
a2a-agent
api
```

### `canonical_key`

Deterministic/deduplication key chosen by normalization code, not a proof field.

Preference order can be:

1. valid globally stable ARD identifier;
2. provider stable ID plus provider namespace;
3. normalized canonical URL.

Do not derive trust from this key.

## Table: `resource_discoveries`

Provider-specific mutable discovery observations.

```text
id                    uuid primary key
resource_id           uuid not null references agentic_resources(id)
provider_id           text not null
provider_resource_id  text not null
resource_url          text null
media_type            text null
raw_relevance_score   double precision null
discovery_status      text not null
observed_at           timestamptz not null
expires_at            timestamptz null
provider_metadata     jsonb not null default '{}'
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()
```

Unique suggestion:

```text
(provider_id, provider_resource_id)
```

`discovery_status`:

```text
INDEXED
STALE
UNAVAILABLE
```

Relevance belongs only here. It is never consumed by the trust-policy evaluator.

Do not persist unlimited upstream JSON. Normalize and cap `provider_metadata` fields/size.

## Table: `resource_versions`

Exact version/source/distribution context.

```text
id                       uuid primary key
resource_id              uuid not null references agentic_resources(id)
version_label            text null
source_provider          text null
source_repository        text null
source_repository_id     bigint null
source_commit_sha        text null
source_subdirectory      text null
distribution_url         text null
distribution_sha256      text null
first_seen_at            timestamptz not null default now()
last_seen_at             timestamptz not null default now()
created_at               timestamptz not null default now()
updated_at               timestamptz not null default now()
```

Checks:

- `source_commit_sha is null OR source_commit_sha ~ '^[0-9a-fA-F]{40}$'`
- `distribution_sha256 is null OR distribution_sha256 ~ '^[0-9a-fA-F]{64}$'`
- URLs length bounded.

A row with source only does not imply correspondence.

Suggested uniqueness must be chosen carefully because some discovered resources have no formal version. Prefer an application-computed stable version key if necessary rather than nullable-column uniqueness surprises.

## Table: `source_claims`

Immutable-ish historical source claims. Application should not overwrite an authenticated claim in place; superseding mappings create a new claim.

Suggested columns:

```text
id                         uuid primary key
resource_version_id        uuid not null references resource_versions(id)
provider                   text not null
assurance_level            text not null
claim_status               text not null default 'active'
source_repository          text not null
source_repository_id       bigint null
source_repository_node_id  text null
source_owner_login         text null
source_owner_id            bigint null
source_commit_sha          text not null
source_subdirectory        text null
distribution_url           text null
distribution_sha256        text null
claim_digest_sha256        text not null
canonical_claim_json       jsonb not null
authenticated_at           timestamptz null
created_at                 timestamptz not null default now()
supersedes_claim_id        uuid null references source_claims(id)
```

Checks:

```text
assurance_level in ('NONE','DECLARED','REPOSITORY_AUTHENTICATED','SIGNED_RELEASE')
claim_status in ('active','superseded','conflicted','revoked')
source_commit_sha ~ '^[0-9a-fA-F]{40}$'
claim_digest_sha256 ~ '^[0-9a-fA-F]{64}$'
distribution_sha256 is null OR distribution_sha256 ~ '^[0-9a-fA-F]{64}$'
```

### Critical invariant

Application code must recompute/validate `claim_digest_sha256` against the canonical claim before presenting authenticated source evidence. Do not trust an arbitrary row mutation.

A DB admin could mutate rows; canonical evidence/0G commitments are the stronger historical evidence path once verification is completed.

## Table: `source_claim_authority_observations`

Provider-specific evidence that explains *why* an assurance level was earned.

```text
id                    uuid primary key
source_claim_id       uuid not null references source_claims(id)
provider              text not null
subject_type          text not null
subject_id            text not null
subject_login         text null
repository_id         bigint null
observed_permission   text null
observed_role_name    text null
observation_json      jsonb not null
observed_at           timestamptz not null
created_at            timestamptz not null default now()
```

For GitHub M8:

```text
provider = 'github'
subject_type = 'github-user'
subject_id = stable numeric GitHub user ID serialized as text
observed_permission = 'write' | 'admin' | etc.
```

Do not store access tokens or OAuth codes in this table.

Keep provider raw observation small and redacted; only fields necessary to independently explain the decision.

## Table: `capability_verifications`

Links a resource version/source claim to existing canonical AegisOne evidence.

Suggested columns:

```text
id                         uuid primary key
resource_version_id        uuid not null references resource_versions(id)
source_claim_id            uuid null references source_claims(id)
verification_job_id        uuid null references verification_jobs(id)
artifact_kind              text not null
source_inspection_status   text not null
correspondence_status      text not null
publisher_sha256           text null
reproduced_sha256          text null
security_status            text not null
security_highest_severity  text null
security_finding_count     integer null
canonical_evidence_sha256  text null
storage_root               text null
storage_transaction        text null
registry_contract          text null
registry_record_id         text null
registry_transaction       text null
verified_at                timestamptz null
created_at                 timestamptz not null default now()
```

Checks should mirror M8.1 enum values.

### Database-level sanity checks

Useful constraints:

- if `correspondence_status = 'MATCH'`, both publisher/reproduced digests non-null;
- if `MATCH`, DB can additionally require digest equality as a sanity check;
- if `MISMATCH`, both digests non-null and unequal;
- `source_inspection_status = 'INSPECTED'` does not require correspondence;
- `security_status = 'COMPLETED'` requires severity + count;
- canonical evidence digest format must be 64 hex when present.

These checks reduce accidental bad rows but do not turn Supabase into proof authority.

## Table: `ingestion_sources`

Tracks incremental sync/cache state.

```text
id                    text primary key
provider_type         text not null
enabled               boolean not null default true
last_success_at       timestamptz null
last_attempt_at       timestamptz null
cursor                text null
updated_since         timestamptz null
last_error_code       text null
last_error_at         timestamptz null
config_public         jsonb not null default '{}'
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()
```

Initial IDs:

```text
github-agent-finder
huggingface-discover
mcp-official-registry
```

Do not put tokens/secrets in `config_public`.

## Table: `trust_policies` — optional for backend MVP

The M8.1 policy can be request-scoped, so this table is **not required** for the MVP.

Only add if saved policies become an explicit frontend requirement.

If added later:

```text
id
owner_id
name
policy_json
created_at
updated_at
```

The policy evaluator must validate JSON against M8.1 model on every use.

## Search strategy

M8 does not need a vector database.

For cached/local resources use PostgreSQL capabilities:

- normalized lowercase text fields;
- `to_tsvector`/full-text search if needed;
- optional `pg_trgm` for fuzzy name similarity;
- tags/capabilities in normalized columns or bounded arrays/json.

Do not mix local Postgres relevance with AegisOne trust evidence.

M8.3 can primarily rely on upstream semantic discovery and use Supabase for cache/dedup/history.

## RLS / access boundary

Current tables have RLS enabled; new public-schema tables should also enable RLS.

Recommended MVP rule:

- browser/public clients do **not** write catalog/source-verification tables directly;
- `proofrail-app` performs server-side mutations using the established server authentication boundary;
- read APIs are served through `proofrail-app`, not by exposing broad anonymous Supabase table policies;
- direct anonymous table access can remain denied unless a later frontend specifically benefits from safe read-only views.

This keeps the public contract at AegisOne's versioned API rather than binding frontend clients to DB schema.

## Server token model

The existing `proofrail_app_auth` singleton contains a hash of a high-entropy app token. Preserve the distinction between:

- Supabase/app database credentialing;
- GitHub OAuth credentials;
- app-to-worker internal auth;
- 0G signer.

Never reuse one secret for another boundary.

## Migration quality gates

For every migration:

- [ ] SQL committed under existing `supabase/migrations` convention;
- [ ] all enum-like text fields have checks;
- [ ] SHA formats constrained;
- [ ] foreign keys explicit;
- [ ] useful indexes added for resource/provider/version lookups;
- [ ] RLS enabled;
- [ ] no anonymous write policy by default;
- [ ] migration is idempotent only where repository convention expects it; otherwise normal ordered migration semantics;
- [ ] local/store tests updated;
- [ ] Supabase security advisor checked after applying to production/staging;
- [ ] performance advisor reviewed for obvious missing indexes;
- [ ] schema documentation reconciled.

## Recommended indexes

At minimum:

```text
agentic_resources(kind)
agentic_resources(canonical_key unique)
resource_discoveries(resource_id)
resource_discoveries(provider_id, provider_resource_id unique)
resource_discoveries(observed_at desc)
resource_versions(resource_id)
resource_versions(source_repository_id, source_commit_sha)
source_claims(resource_version_id, created_at desc)
source_claims(claim_digest_sha256 unique)
capability_verifications(resource_version_id, verified_at desc)
capability_verifications(canonical_evidence_sha256)
ingestion_sources(id primary key)
```

## Data lifecycle

### Discovery rows

Mutable/refreshable. May become `STALE` or be replaced by newer provider observations.

### Resource/version identity

Longer-lived logical index. Do not delete simply because one provider temporarily stops returning it; mark discovery state stale/unavailable.

### Source claims

Historical. Supersede, don't silently overwrite.

### Verification evidence pointers

Historical. New verification creates a new observation/evidence record; do not mutate the old canonical verdict because a new version appeared.

## What not to store

Do not store in ordinary tables:

- GitHub OAuth access tokens;
- GitHub authorization codes;
- GitHub App client secret;
- GitHub App PEM/private key;
- 0G private key;
- arbitrary downloaded repositories;
- full Skill archives unless explicitly needed for a bounded temporary job;
- secret-containing build logs.

## M8.4 acceptance criteria

- [ ] schema migrations create catalog/resource/version/ingestion core tables;
- [ ] RLS enabled on new public tables;
- [ ] server-side store package can upsert provider observations deterministically;
- [ ] stable resource dedup keys tested;
- [ ] provider outage/stale state does not delete trust evidence;
- [ ] a DB-only inserted discovery record remains unverified;
- [ ] no DB mutation path can legitimately create canonical `MATCH` without validated evidence linkage;
- [ ] production migration applied only after tests/PR review;
- [ ] Supabase security/performance advisors reviewed after apply.
