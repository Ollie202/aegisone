# M8 Backend Blueprint — Verified Capability Discovery

**Status:** architecture/implementation blueprint for M8.  
**Frontend:** intentionally deferred until the backend vertical slice is complete.

## Product objective

ProofRail M8 turns the existing M1–M7 verification engine into a trust-aware discovery backend for agent capabilities.

A human or agent should be able to ask for a capability, receive relevant resources, inspect what ProofRail actually knows about a selected resource, and apply a deterministic consumer policy before using it.

```text
intent
  -> discovery
  -> normalized capability
  -> source assurance
  -> source/distribution evidence
  -> deterministic security findings
  -> canonical ProofRail evidence
  -> consumer policy
  -> ALLOW | REVIEW | DENY
```

The initial fully verified artifact family is **Agent Skills**. MCP servers may be indexed/discovered, but they remain `INDEXED` until equivalent evidence exists. A2A agents and APIs remain model-supported but are not mandatory full-verification targets for the backend MVP.

## Existing proven foundation — do not rebuild

M8 reuses:

- deterministic canonicalization and SHA-256 comparison;
- explicit immutable Git source claims;
- local/0G independent reproduction adapters;
- Agent Skill parsing, deterministic package construction, format validation and static audit;
- 0G Sandbox independent execution;
- proof-enabled 0G Storage round trip;
- ProofRail registry commitments;
- Supabase-backed mutable job index;
- Railway `proofrail-app` + `proofrail-worker` topology;
- M8.1 `@proofrail/capability-model` and deterministic trust-policy evaluator.

M8 must not move discovery-provider logic into `packages/core` or rewrite M7 Skill verification.

## Production topology

Keep exactly the current two permanent Railway services:

```text
                          public internet
                               |
                        proofrail-app
                    /       |        \
            ARD/search   read API   GitHub claim auth
                 |           |           |
         discovery adapters  |       GitHub API
                 |           |
                 +------ Supabase ------+
                            |
                    internal job/claim
                            |
                    proofrail-worker
                       /      |      \
                  GitHub   0G Sandbox  0G Storage/registry
```

### `proofrail-app`

Public, non-secret-bearing control plane:

- `GET /.well-known/ai-catalog.json`
- `POST /search`
- resource/evidence read endpoints
- deterministic policy evaluation endpoint
- GitHub App user authorization/callback for source claims
- source-claim submission after repository authority is established
- read-only external discovery federation
- no 0G private key
- no arbitrary build execution

### `proofrail-worker`

Secret-bearing/internal execution boundary:

- currently standby + health only;
- receives only authenticated internal work;
- exact source acquisition;
- Skill verification orchestration;
- 0G Sandbox execution;
- 0G Storage upload/readback;
- registry writes when explicitly required;
- optional GitHub artifact-attestation cryptographic verification tooling;
- never directly exposed as a public generic execution API.

### Supabase

Mutable index and orchestration state only:

- discovered resources;
- exact resource versions;
- source claims and source-auth observations;
- pointers to canonical verification evidence;
- ingestion cursors/cache state;
- internal jobs.

A database write cannot create `MATCH`, `MISMATCH`, `REPOSITORY_AUTHENTICATED`, or `SIGNED_RELEASE` without evidence generated/validated by the corresponding verifier.

## Backend milestone order

### M8.2 — ARD adapter

Implement ProofRail's local/pinned ARD interface first.

Package boundary:

`@proofrail/discovery-ard`

Responsibilities:

- pin ARD v0.9 schema/contract;
- map provider-independent `CapabilityResource` objects into ARD catalog entries;
- parse/validate ARD search requests;
- deterministic local fixture search;
- emit namespaced ProofRail evidence metadata only from validated M8.1 models;
- enforce request/result limits;
- expose `/.well-known/ai-catalog.json` and `/search` through `proofrail-app`.

No upstream network discovery yet.

### M8.3 — Federated discovery

Add provider adapters behind a common interface:

```ts
interface DiscoveryProvider {
  readonly id: string;
  search(request: DiscoveryQuery, signal: AbortSignal): Promise<DiscoveryProviderResult>;
}
```

Initial providers:

1. GitHub Agent Finder — primary public ARD provider.
2. Hugging Face Discover — secondary/fallback provider.

Provider responses normalize into `CapabilityResource` discovery state with **zero ProofRail trust escalation**.

Recommended merge behavior:

- cap each provider independently;
- preserve provider attribution and original identifiers;
- normalize URLs/media types;
- deduplicate using strongest stable identifier available, otherwise normalized canonical URL;
- do not compare raw relevance scores across providers as if globally calibrated;
- prefer source-balanced results rather than simply sorting every provider score into one list;
- cache successful responses briefly;
- partial outage must not fail the entire search request.

### M8.4 — Catalog persistence

Add Supabase schema described in `docs/16-m8-database-plan.md`.

Persistence is primarily for:

- cache/search continuity;
- stable ProofRail resource IDs;
- linking versions to source claims and canonical evidence;
- incremental ingestion.

Do not put upstream raw JSON into security-critical code paths without schema validation.

### M8.5 — Source authentication

Implement the source-assurance ladder specified in `docs/14-source-authentication.md`.

MVP mandatory levels:

- `NONE`
- `DECLARED`
- `REPOSITORY_AUTHENTICATED`

Optional stronger level if completed cleanly:

- `SIGNED_RELEASE`

`REPOSITORY_AUTHENTICATED` uses a GitHub App user authorization flow plus effective repository authority, stable repository identity, and an exact immutable source claim.

### M8.6 — Verification enrichment

Connect discovered `agent-skill` versions to the proven M7 verification flow.

Two distinct modes:

#### Source inspection

ProofRail has exact source commit + subdirectory and can retrieve/parse/audit it, but there is no separate publisher/distribution package.

Result must remain:

- source inspection `INSPECTED`;
- correspondence `NOT_EVALUATED` or `INSUFFICIENT_EVIDENCE`;
- never `MATCH`/`MISMATCH`.

#### Distribution correspondence

Requires both:

1. distinct distributed/publisher package bytes/digest;
2. independent canonical package derived from exact source commit.

Only this path may emit `MATCH`, `MISMATCH` or `DIVERGED`.

The existing Skill auditor remains separate.

### M8.7 — Stable public read API + policy

Expose a compact stable JSON surface over the catalog/evidence model.

Recommended routes:

```text
GET  /api/v1/resources/:resourceId
GET  /api/v1/resources/:resourceId/versions/:versionId
GET  /api/v1/resources/:resourceId/evidence
POST /api/v1/policy/evaluate
```

The policy endpoint wraps the deterministic M8.1 evaluator only. It must not call an LLM, upstream provider, blockchain, or build system.

### M8.8 — MCP agent interface

Expose only three read/policy operations initially:

```text
proofrail_search
proofrail_inspect
proofrail_evaluate
```

The MCP interface wraps the same services used by REST; it must not contain parallel trust logic.

It must not auto-install, connect, execute or approve discovered resources.

### M8.9 — Controlled substitution vertical slice

Build one judgeable end-to-end Skill release fixture with:

- repository-authenticated exact source claim;
- distinct genuine distribution package;
- independent 0G reproduction;
- genuine `MATCH`;
- controlled substituted package that preserves claimed resource identity/source metadata but changes bytes;
- resulting `MISMATCH`;
- policy requiring `MATCH` returns `ALLOW` for genuine and `DENY` for substitution;
- canonical evidence stored/retrieved through existing 0G path.

This is the backend MVP's strongest demo gate.

### M8.10 — MCP Registry indexing

After M8.9 works, ingest official MCP Registry `/v0.1/` metadata.

MCP records start as `INDEXED`. Do not manufacture exact source correspondence from a registry package/repository link.

### M8.11 — Hardening/deployment/backend freeze

Before frontend work:

- complete threat-model updates;
- full CI/Gitleaks;
- verify deployment watch paths include new packages/migrations;
- confirm `proofrail-app` and `proofrail-worker` health;
- ensure no signer secret is present in app service;
- load-test search/request limits lightly;
- document live upstream availability behavior;
- freeze the backend JSON contract that M9 frontend will consume.

## Internal service decomposition

Prefer packages/services rather than one oversized `product.ts`.

Suggested package boundaries:

```text
packages/capability-model       # already exists; provider independent
packages/discovery-ard          # ARD mapping/request/response
packages/discovery-providers    # GitHub Agent Finder / HF adapters
packages/source-auth-github     # GitHub App user flow + claim evidence parsing
packages/catalog-store          # Supabase resource/catalog access
packages/policy                 # use M8.1 evaluator; do not duplicate
packages/mcp-proofrail          # M8.8 adapter only
```

Avoid splitting into network microservices. They are workspace packages loaded by the existing two Railway applications.

## Public HTTP contract

### Search

`POST /search`

ARD-compatible endpoint. M8.2 begins local; M8.3 federates.

Constraints recommended for MVP:

- JSON only;
- body max 32 KiB;
- query text 1–2,000 Unicode characters;
- page size default 10, maximum 25;
- supported filters explicitly enumerated;
- unsupported filter => `400 unsupported_filter`;
- per-provider timeout 2.5–4 seconds;
- total request deadline about 5 seconds;
- no arbitrary URL passed by caller to a server-side fetcher.

### Resource reads

Return stable ProofRail resource/version/evidence structures rather than raw provider documents.

Every result should make these states independently available:

- discovery source/status;
- source assurance;
- source inspection;
- correspondence;
- security assessment;
- canonical evidence availability/freshness.

### Source-claim/auth routes

Recommended routes:

```text
GET  /auth/github/start
GET  /auth/github/callback
GET  /api/v1/source-auth/github/repositories
POST /api/v1/source-claims
GET  /api/v1/source-claims/:claimId
```

See `docs/14-source-authentication.md` for exact flow and evidence.

### Internal worker routes

Do not expose these publicly. If HTTP is used between app/worker, require an independent high-entropy internal bearer token and Railway-private networking where available.

Conceptual surface:

```text
POST /internal/v1/source-claims/:claimId/verify
POST /internal/v1/verifications/:verificationId/run
GET  /internal/v1/jobs/:jobId
```

A queue/polling approach backed by Supabase is also acceptable and may be simpler than adding worker HTTP mutations. Prefer the approach that reuses the existing job-store cleanly and keeps the worker inaccessible to anonymous traffic.

## State semantics

Do not create one global `verified: true` boolean.

A resource may simultaneously be:

```text
INDEXED
sourceAssurance = REPOSITORY_AUTHENTICATED
sourceInspection = INSPECTED
correspondence = MATCH
security.highestSeverity = HIGH
canonicalEvidence = AVAILABLE
```

That does not mean `SAFE`.

Likewise an externally discovered resource can be:

```text
INDEXED
sourceAssurance = NONE
sourceInspection = NOT_RUN
correspondence = NOT_EVALUATED
security = NOT_RUN
canonicalEvidence = NONE
```

and still be a valid search result.

## Error taxonomy

Use stable machine-readable error codes. Suggested initial set:

```text
invalid_request
request_too_large
unsupported_filter
provider_timeout
provider_unavailable
resource_not_found
version_not_found
source_claim_not_found
source_claim_conflict
source_not_immutable
source_authority_insufficient
source_auth_expired
source_auth_failed
artifact_unavailable
artifact_too_large
insufficient_evidence
verification_not_authorized
verification_failed
internal_error
```

Never turn an upstream error into evidence state.

## Cache strategy

MVP does not need Redis.

Use:

- bounded in-process short TTL for hot upstream search responses if useful;
- Supabase as longer-lived discovery/catalog cache;
- ETag/If-None-Match where supported by upstreams;
- ingestion timestamps and explicit `STALE` state.

Do not cache GitHub OAuth/user tokens in Supabase as ordinary plaintext data.

## Observability

Minimum structured events:

```text
search.request
search.provider.result
search.provider.failure
catalog.upsert
source_claim.created
source_claim.authenticated
source_claim.rejected
verification.queued
verification.started
verification.completed
verification.failed
policy.evaluated
```

Never log:

- GitHub access tokens;
- GitHub client secret;
- OAuth authorization codes;
- 0G private key;
- full user-supplied package bytes;
- arbitrary Skill content unless explicitly scrubbed for development.

## Cost model

M8 backend architecture intentionally requires no runtime OpenAI/Anthropic API, embeddings API, vector DB, additional permanent Railway service, or mainnet transaction.

External discovery is read-only/free at MVP scale. Supabase and current Railway services are reused. Live 0G work occurs only for explicit verification jobs rather than every search result.

## Backend completion gate before frontend

Do not begin the new M9 Hub frontend until all of the following are demonstrably true:

1. `/search` returns real federated resources.
2. stable resource IDs survive provider/cache refreshes.
3. source claims can reach `REPOSITORY_AUTHENTICATED` through a real GitHub flow.
4. a real Agent Skill distribution can produce `MATCH` against independent exact-source reproduction.
5. a substituted distribution produces `MISMATCH`.
6. policy returns deterministic `ALLOW/REVIEW/DENY` with structured reasons.
7. an MCP/agent client can call search/inspect/evaluate without scraping HTML.
8. canonical evidence pointers remain integrity-checked and independently inspectable.
9. CI is green and backend JSON contracts are documented/frozen for frontend consumption.
