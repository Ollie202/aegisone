# Project State

**Last updated:** 2026-08-26  
**Phase:** M8 active — backend-first verified capability discovery; M8.2 merged (PR #34); M8.3 merged (PR #35); M8.4 merged (PR #36); M8.5 merged (PR #37); M8.6 merged (PR #38); M8.7 merged (PR #39); M8.8 merged (PR #40); M8.9 merged (PR #41) — local/deterministic substitution proof only; the live repository-authenticated + real-0G-evidence version remains pending repo-owner GitHub App credentials and explicit 0G testnet spend approval; M8.10 merged (PR #42, official MCP Registry indexing); M8.11 (backend security/deployment/contract-freeze, Issue #30) code/contract complete on `agent/m8-11-backend-freeze`, merge gate pending — the backend JSON/MCP contract is declared frontend-ready for M9, but production deployment verification (Railway health, Supabase advisors, pending migration application, GitHub App creation) remains deferred to the repo owner per `docs/23-m8-11-production-readiness.md`
**Product name:** ProofRail

## Current product thesis

ProofRail is evolving from a proof-first software/Agent Skill verifier into a **trust-aware discovery layer for agent capabilities**.

The M8 backend flow is:

> **intent → capability discovery → source assurance → ProofRail evidence → consumer trust policy → ALLOW / REVIEW / DENY**

The original trust boundary remains unchanged:

> **publisher/distributed artifact vs independent reproduction — verified from canonical evidence, not from mutable application state**

Discovery answers *what resource might help*. It does not authenticate a publisher or prove correspondence. Search relevance, source assurance, source inspection, distribution correspondence, security findings, canonical evidence, and consumer policy remain separate dimensions.

The new human Hub frontend is explicitly deferred to M9 after the M8 backend contract is frozen.

## Proven foundation — M1–M7

- M1–M7 are complete and merged.
- Agent Skill verification/auditing is live-proven on 0G Galileo with durable evidence in `hackathon/m7-live-evidence.json`.
- Real 0G Sandbox independent execution, proof-verified 0G Storage, Galileo registry readback, and the M5 Aristotle mainnet anchor are proven.
- M4/M7 TDX evidence remains honestly classified as provider/runtime evidence only: the live legacy Tapp quote does not bind the artifact digest and does not prove the final artifact was computed inside the TEE.
- For Agent Skills, correspondence and deterministic security findings remain independent. `MATCH` never means safe.

## Stable production topology

```text
Supabase         = mutable app/job memory and M8 catalog/source-claim index
proofrail-app    = public proof/API surface and future ARD/source-auth/policy/MCP surface
proofrail-worker = controlled secret-bearing verification/0G worker
0G Sandbox       = independent execution/reproduction
0G Storage       = durable canonical evidence
0G registry      = compact immutable commitments
```

Production intentionally remains exactly `proofrail-app` + `proofrail-worker`, both tracking `main`.

Supabase is **not** a proof authority. It may index/cache discovery, source claims and evidence pointers, but it must not be able to invent `MATCH`/`MISMATCH`, authenticated-source evidence, security findings, or canonical proof.

## Current production data/infrastructure observed during M8 planning

The existing ProofRail Supabase project remains the only database project to extend. Its current public tables are:

- `verification_jobs`
- `proofrail_app_auth`

Both currently have RLS enabled.

M8.4 (`agent/m8-supabase-catalog`) adds four more tables via a committed, reviewed, but **not yet applied** migration (`supabase/migrations/202608260001_m8_4_capability_catalog.sql`): `agentic_resources`, `resource_discoveries`, `resource_versions`, `ingestion_sources`. Applying it and reviewing the Supabase security/performance advisors afterward requires the repo owner's real Supabase project credentials, which this agent does not have.

Railway production contains exactly:

- `proofrail-app`
- `proofrail-worker`

The app has Supabase/application variables and **does not** hold the 0G signer. The worker holds `ZEROG_STORAGE_PRIVATE_KEY` and currently exposes health only; public signing remains disabled.

M8 planning must preserve those boundaries and must not create a third permanent Railway service without explicit approval.

## M7 live Agent Skill proof

Durable source of truth: `hackathon/m7-live-evidence.json`.

Key observed proof:

- exact source commit: `2f193aad92d2f807c2e25f67eb28c5090fa945cf`
- publisher + independent package SHA-256: `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878` → `MATCH`
- controlled substituted publisher SHA-256: `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb` → `MISMATCH`
- deterministic clean-fixture audit: 0 findings / `INFO`
- canonical evidence SHA-256: `16bbfe2235cdb28cf3f5019c326edc9d619f7a920bee01dc120d7dced4f5837a`
- 0G Storage root: `0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66`
- Galileo registry record: `0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a`
- Storage proof verification and exact byte equality: true
- M7 Aristotle state: `PREPARED_NOT_SUBMITTED`

## M8 — ProofRail Hub / verified capability discovery

Issue #18 is the backend-first M8 master plan.

M8 is intentionally narrower than a universal agent marketplace:

- **Agent Skills:** full ProofRail verification target using the existing M7 engine.
- **MCP servers:** real discovery/indexing is stretch scope after the core Skill vertical slice; `INDEXED` does not imply ProofRail verification.
- **A2A agents / APIs:** represented in the provider-independent model; no full-verification promise in the M8 MVP.
- **ARD:** discovery adapter only. The provider-independent trust model does not depend on ARD internals.
- **Trust policy:** deterministic consumer-side evaluation, not an LLM safety score.
- **Source authentication:** a repository existing is insufficient. `REPOSITORY_AUTHENTICATED` requires a real authenticated GitHub identity with sufficient effective repository authority over an exact source claim.

No paid runtime LLM/API, vector database, custom embeddings service, creator payments, auto-install, new Railway microservice, or new mainnet write is required for M8.

## M8.1 — COMPLETE

Issue #19 / PR #20 merged to `main`.

Completed:

- provider-independent `@proofrail/capability-model` package;
- resource kinds for Agent Skills, MCP servers, A2A agents, and APIs;
- mutable discovery/relevance metadata separated from ProofRail trust evidence;
- exact source inspection separated from distribution correspondence;
- validation preventing source-only inspection from claiming `MATCH`/`MISMATCH`;
- `MATCH`/`MISMATCH` require a distinct distributed artifact plus independently reproduced digest;
- source-assurance, audit, canonical-evidence, and freshness dimensions remain independent;
- deterministic `ALLOW` / `REVIEW` / `DENY` policy evaluation;
- missing required evidence fails closed or requires review according to explicit policy;
- search relevance has no path into policy evaluation;
- ADR-010 records the discovery/evidence/policy boundary.

Final M8.1 CI passed before merge. Do not redo this milestone.

## M8.2 — COMPLETE

Issue #21 / PR #34 merged to `main`.

- `@proofrail/discovery-ard`, isolated from the provider-independent capability model;
- the exact ARD v0.9 upstream pin and schema/blob provenance;
- `GET /.well-known/ai-catalog.json` and `POST /search` in `proofrail-app`;
- deterministic bounded in-memory search across Agent Skill, MCP server, A2A agent, and generic OpenAPI resource fixtures;
- strict JSON/body/query/page-size limits and explicit unsupported-filter/federation errors;
- `url` xor `data` validation;
- namespaced ProofRail evidence-state output only from validated M8.1 resources;
- regression coverage proving ARD `trustManifest`, trust-looking metadata, `INDEXED` state, and relevance scores cannot upgrade ProofRail evidence or policy results.

Final M8.2 CI passed before merge. Do not redo this milestone.

## M8.3 — COMPLETE

Issue #22 / PR #35 merged to `main`. Provides:

- `@proofrail/discovery-providers`, a new package that owns real read-only HTTP federation to two fixed allowlisted origins and normalizes their results into `@proofrail/capability-model`'s `CapabilityResource`;
- a `DiscoveryProvider` interface (`id`, `search(query, signal)`) and one shared ARD-wire-shaped provider factory reused by both concrete adapters;
- **GitHub Agent Finder** adapter, pinned to `ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07`, endpoint `POST https://agentfinder.github.com/api/v1/search`;
- **Hugging Face Discover** adapter, pinned to `huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa`, endpoint `POST https://huggingface-hf-discover.hf.space/search`; both live endpoints were reachable and stable during implementation, so both were built rather than deferring one;
- a bounded HTTP layer: fixed origin allowlist, no redirect following, ~3s per-provider timeout / ~5s total federated deadline via `AbortSignal.any`, a streamed 1 MiB response cap, a 25-result-per-provider cap, and at most one retry for a transient failure;
- `federatedDiscoverySearch`, which fans a query out to every configured provider in parallel, isolates one provider's failure from the others (partial results plus a per-provider status), and deterministically deduplicates merged results by normalized resource URL;
- a deliberately lenient inbound entry normalizer (`normalizeProviderEntry`) that is separate from `@proofrail/discovery-ard`'s stricter outbound `urn:air:` catalog validator — the live GitHub Agent Finder response uses `urn:ai:...` identifiers, so reusing the outbound validator for inbound third-party data would have silently dropped every one of its results;
- `apps/web`'s `POST /search` now accepts `federation` as `"none"` (unchanged M8.2 local-catalog behavior, byte-for-byte) or as a non-empty array of registered provider ids, in which case it returns federated `CapabilityResource`/provider-status results instead of the local `ArdEntry` shape;
- regression coverage proving forged upstream `trustManifest`, forged `org.proofrail.*`-looking metadata, `verified` flags, and out-of-range/maximum scores can never create or upgrade `trust` on a normalized resource — `trust` is always emitted empty/unavailable for federated results;
- live smoke tests (`packages/discovery-providers/test/live/*.live.test.ts`, run via `pnpm m8.3:live`, not part of `pnpm check`/`pnpm test`) that made real calls to both pinned endpoints and to the combined federated path; all three passed.

Final M8.3 CI passed before merge. No Supabase catalog persistence, GitHub publisher/source authentication, Skill verification orchestration, MCP Registry ingestion, frontend, or 0G write behavior was added. Do not redo M8.3.

## M8.4 — COMPLETE

Issue #23 / PR #36 merged to `main`. Extends the existing ProofRail Supabase project (no new project/database) with:

- four new public tables (`supabase/migrations/202608260001_m8_4_capability_catalog.sql`): `agentic_resources` (version-independent capability identity, deduplicated by a deterministic `canonical_key`), `resource_discoveries` (provider-specific mutable discovery observations, unique on `(provider_id, provider_resource_id)`), `resource_versions` (exact source/distribution *claims* only — never implying correspondence — unique on an application-computed `(resource_id, version_key)`, a documented deviation from the plan doc's suggested columns because nullable-column uniqueness is unsafe for upsert), and `ingestion_sources` (incremental-refresh cursor/state per provider, seeded with `github-agent-finder`, `hugging-face-discover`, `mcp-official-registry`);
- all four tables have RLS enabled with an explicit `deny to anon, authenticated` policy and no anonymous/authenticated read or write path, mirroring `proofrail_app_auth`'s M6 pattern;
- a token-gated Supabase Edge Function (`supabase/functions/proofrail-catalog`) that holds the service-role credential internally and checks the same `proofrail_app_auth` app-token digest `packages/job-store`'s Edge Function already uses — Railway still never holds the service-role secret;
- `@proofrail/catalog-store`: a provider-independent (Supabase-specific code stays out of `@proofrail/capability-model`) persistence package with `computeCanonicalKeyFromResource` (deterministic dedup key: `urn:air:` identifier, else `<providerSlug>::<providerResourceId>`, else a normalized resource URL — dedup bookkeeping only, never proof), `buildResourceUpsertPlan` (pure DB-free mapping from a validated `CapabilityResource` to the persisted row shape), `catalogRecordToCapabilityResource` (the one function that reconstructs a `CapabilityResource` from catalog rows — it always emits empty/`NOT_RUN`/`NONE` trust evidence because it has no evidence table to read from yet), `InMemoryCatalogStore`, and `SupabaseCatalogStore`;
- regression coverage proving: a DB-only inserted `INDEXED` resource remains unverified end-to-end; `markProviderDiscoveriesStale` (incremental-refresh outage handling) only ever mutates `discovery_status` and never deletes or mutates resource/version identity or trust evidence; forged `provider_metadata`/injected `trustManifest`-shaped fields cannot reach a stored row or the reconstructed `CapabilityResource`; stable dedup-key behavior across repeated observations and across ARD-shaped vs. federated-shaped resources.

Local `pnpm check` and `pnpm test` were green for `@proofrail/catalog-store` and every other package before merge (the same two pre-existing, unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures noted below remain and are not part of M8.4). **The migration has not been applied to the production Supabase project** — no agent context in this environment has `SUPABASE_ACCESS_TOKEN`/project ref/db password. Applying `supabase/migrations/202608260001_m8_4_capability_catalog.sql` (and the M8.5 migration below) and reviewing the Supabase security/performance advisors afterward remains the repo owner's action (`supabase link` + `supabase db push`, or the dashboard SQL editor). source_claims / source_claim_authority_observations were deferred to M8.5 (below); capability_verifications remains deferred to M8.6 per `docs/16-m8-database-plan.md`.

## M8.5 — COMPLETE

Issue #24 on `agent/m8-github-source-auth` implements the first real source-authentication mechanism:

- `@proofrail/source-auth-github`: a new provider-specific package (GitHub-specific logic stays out of `@proofrail/capability-model`) with an HMAC-signed, expiring, single-use-by-cookie-clearing OAuth `state` (`oauth-state.ts`), a bounded GitHub REST client (`github-client.ts`: token exchange, authenticated user, installations, installation repositories, collaborator permission, repository, exact-commit resolution — strict timeout, response-size cap, no redirects, never logs the code/token/secret), the M8 authority ladder (`permission.ts`: `admin`/`write`/`maintain` sufficient, `read`/`triage`/`none`/unknown insufficient — never guessed from an unrecognized label), canonical source-claim construction and `SHA256` digesting reusing `packages/core`'s canonical JSON rules (`claim.ts`), and a process-local, non-persistent claim-session store for the short-lived GitHub user access token (`session.ts` — the token is never written to Supabase or logged);
- `@proofrail/catalog-store` extended with `source_claims`/`source_claim_authority_observations` persistence (`NewSourceClaim`, `SourceClaim`, `createSourceClaim`/`getSourceClaim`/`listActiveSourceClaimsByResourceVersion` on `CatalogStore`, implemented in both `InMemoryCatalogStore` and `SupabaseCatalogStore`) plus `source-claim-transition.ts`, the pure decision function (new / supersede / explicit `SOURCE_CLAIM_CONFLICT`) shared by the in-memory store and mirrored in the `proofrail-catalog` Edge Function (Deno cannot import it directly; both sides are covered by tests) — only a claim's `claimStatus` ever changes after insert, every evidence column is immutable, and a new mapping always creates a new row;
- `supabase/migrations/202608260002_m8_5_source_claims.sql`: `source_claims` and `source_claim_authority_observations`, following the exact `202608260001` convention (RLS enabled, `deny to anon, authenticated`, CHECK constraints on enums/commit-SHA/digest formats, indexes including a unique index on `claim_digest_sha256`);
- `apps/web`'s `GET /auth/github/start`, `GET /auth/github/callback`, `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`, `GET /api/v1/source-claims/:claimId` (`apps/web/src/source-auth.ts`), wired into `createProductRequestHandler`/`server.ts`: `/auth/github/*` and the repository-listing endpoint return `503 github_source_auth_unavailable` when the GitHub App is not configured (true in every environment right now), while `POST /api/v1/source-claims` still works without any GitHub App configured — it independently resolves the repository/exact commit from the public GitHub REST API and records a `DECLARED` claim. Only a request carrying a valid session cookie from a completed OAuth round trip, and only when the collaborator-permission lookup confirms effective `write`/`admin`/`maintain` authority, upgrades a claim to `REPOSITORY_AUTHENTICATED`; a session with `read`/`triage`/`none` authority is recorded (as an authority observation) but the claim stays `DECLARED`. Private repositories are rejected outright (`private_repository_unsupported`) rather than silently attempted. `GET /api/v1/source-claims/:claimId` recomputes the claim digest from the stored canonical JSON before responding and fails closed (`409 source_claim_integrity_check_failed`) if a stored row was mutated out from under its digest;
- regression coverage: OAuth state signature/expiry/replay (state is invalidated the moment the browser's cookie is cleared, which the callback handler always does), a full mocked-fetch OAuth round trip from `/auth/github/start` through an authenticated `REPOSITORY_AUTHENTICATED` claim, read-only/triage authority never upgrading a claim even with a valid session, an unauthenticated caller always landing on `DECLARED`, a private repository rejected, an unresolvable repository never becoming a claim, two claims for different repositories on the same resource version producing an explicit `SOURCE_CLAIM_CONFLICT` (both claims flagged `conflicted`, neither silently "wins"), a same-repository second claim superseding the first without mutating its immutable evidence fields, and the claim-digest integrity recheck on read.

Local `pnpm check` and `pnpm test` are green for `@proofrail/source-auth-github`, `@proofrail/catalog-store`, `@proofrail/web`, and every other package (the same two pre-existing, unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures remain and are unrelated to M8.5). **Live proof that a real public-repository claim reaches `REPOSITORY_AUTHENTICATED` in production is pending two repo-owner actions that no agent context can perform**: (1) creating/installing the `ProofRail Source Verifier` GitHub App per `docs/14-source-authentication.md` and supplying `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`/`GITHUB_APP_SLUG`/`GITHUB_OAUTH_CALLBACK_URL`/`GITHUB_OAUTH_STATE_SECRET` to `proofrail-app` via Railway (none of these exist anywhere in this environment); (2) one interactive browser authorization against a real public repository the owner controls, since the OAuth authorize step cannot be scripted. The full code path — state issuance/validation, token exchange, installation/repository listing, permission resolution, canonical claim construction/digest, persistence, conflict detection, immutability — is implemented and covered by deterministic tests against mocked GitHub API responses only. `SIGNED_RELEASE` (GitHub Artifact Attestations with actual `gh attestation verify` cryptographic verification) was not attempted in this issue and remains explicitly unavailable; no code path emits it.

Issue #24 / PR #37 merged to `main`. M8.5 is complete; do not redo it.

## M8.6 — COMPLETE

Issue #25 on `agent/m8-skill-verification-enrichment` connects discovered/persisted Agent Skill resource versions and M8.5 source claims to the existing proven M7 Agent Skill verification pipeline, as orchestration/linkage only:

- new package `@proofrail/skill-verification-link`: bounded exact-commit Git source acquisition (`source-acquisition.ts`) reusing the same `git clone --no-checkout` / `git checkout --detach <sha>` / `rev-parse HEAD` verification pattern `packages/runner-local` already uses in the proven M1-M7 build path, plus `packages/skill-audit`'s existing, unmodified `readSkillDirectory`/`validateSkillPackage`/`auditSkillPackage`; an SSRF-hardened bounded distribution-artifact downloader (`distribution-fetch.ts`) — HTTPS-only, no userinfo, default port only, DNS-resolved loopback/RFC1918/link-local/CGNAT/multicast/reserved-address blocking, redirect re-validation capped at 3 hops, a 20 MiB response cap — scoped to ProofRail's own canonical `proofrail-agent-skill-package-v1` package format (decoded via the existing `decodeCanonicalSkillPackage`, never a second archive extractor, since the M7 source-claim contract already requires this exact format); the top-level orchestrator (`enrichment.ts`) whose source-only branch (`evaluateSourceOnly`) contains, by construction, no reference anywhere in its body to `verifySkillPackages`/`compareArtifacts`/`MATCH`/`MISMATCH` — a dedicated test reads the compiled source of that function and asserts none of those tokens appear, and its `correspondence.status` is a hardcoded `NOT_EVALUATED` literal, never derived from a comparison call; a distribution-present branch (`evaluateWithDistribution`) that always calls the existing unmodified `verifySkillPackages`; `authorization.ts` (a `VerificationAuthorization` type brandable only via a private module-scope symbol, constructible only by `authorizeVerificationTrigger` after a constant-time token-digest check, plus `VerificationConcurrencyLimiter` capping in-flight work rather than queuing unbounded concurrency);
- `@proofrail/catalog-store` extended with `capability_verifications` persistence (`NewCapabilityVerification`/`CapabilityVerification`, `createCapabilityVerification`/`getLatestCapabilityVerification`/`listCapabilityVerificationsByResourceVersion` on `CatalogStore`, implemented in both `InMemoryCatalogStore` and `SupabaseCatalogStore`) plus `capability-verification-validation.ts` — the same MATCH/MISMATCH/DIVERGED/NOT_EVALUATED digest-presence sanity rules from docs/16 enforced in application code before any write, mirrored again in the `proofrail-catalog` Edge Function, and enforced a third time as Postgres `CHECK` constraints in the migration; every verification always inserts a new row, never mutating a prior canonical verdict;
- `supabase/migrations/202608260003_m8_6_capability_verifications.sql`: `capability_verifications`, following the exact `202608260001`/`202608260002` convention (RLS enabled, `deny to anon, authenticated`, CHECK constraints on enums/SHA formats, and the docs/16 "Database-level sanity checks" as explicit named constraints);
- `apps/web`/`apps/worker` gain **no new route** in this issue — nothing public or otherwise can currently reach `runSkillVerificationEnrichment` except tests and the local fixture, satisfying "verification authorization prevents anonymous 0G spend" by there being no reachable trigger surface at all; `authorization.ts` exists specifically so the M8.7/M8.8 trigger surface reuses this gate instead of skipping it;
- regression coverage: source-only inspection never emits `MATCH`/`MISMATCH` (both by direct assertion and by the structural source-inspection test above); a genuine local distribution artifact plus the exact claimed source commit yields `MATCH`; a tampered/substituted distribution with the same claimed source yields `MISMATCH`, never a downgraded label; an invalid/mismatched distribution digest fails the entire enrichment call closed (never silently falls back to source-only `NOT_EVALUATED`); path-traversal subdirectories, non-full/invalid commit SHAs, nonexistent commits, and non-GitHub-HTTPS repository URLs are all rejected before any clone; SSRF tests covering loopback-by-default blocking, non-HTTPS schemes, userinfo credentials, oversized responses, malformed (non-canonical-package) bodies, and excess redirect hops; a DB-only row attempting `MATCH`/`MISMATCH`/`DIVERGED` without correct digest presence is rejected at both the in-memory store and the Supabase-store/Edge-Function boundary; a `VerificationAuthorization` cannot be fabricated by a plain object literal (brand-symbol check) and a missing/wrong/misconfigured token is rejected; a concurrency limiter rejects work beyond its cap instead of queuing unbounded concurrency;
- one bounded non-funded/local integration fixture (`packages/skill-verification-link/test/integration-fixture.test.ts`) proves the whole M8.6 surface end-to-end: a throwaway local Git repository plus a `127.0.0.1` HTTP server stand in for source/distribution (no 0G Sandbox/Storage/registry call, no secret/signer material, no network egress), covering both source-only `INSPECTED`/`NOT_EVALUATED` persistence into `InMemoryCatalogStore` and, once a genuine local distribution artifact is supplied, the same linkage upgrading to a persisted `MATCH` row.

Local `pnpm check` and `pnpm test` are green for `@proofrail/skill-verification-link`, `@proofrail/catalog-store`, and every other package (the same two pre-existing, unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures remain — confirmed present on `main` before this change by stashing and re-running — and are unrelated to M8.6). No new HTTP route, no live/funded 0G run, no UI change, no MCP Registry work, and no mainnet transaction were part of this issue.

## M8.7 — COMPLETE

Issue #26 on `agent/m8-stable-api` freezes a small versioned machine-readable API over the M8.1-M8.6
capability/evidence/policy model, so humans, CI, and later MCP/frontend clients consume stable
ProofRail JSON instead of scraping HTML or reading Supabase directly:

- `apps/web/src/api-v1.ts`: `GET /api/v1/resources/:resourceId`, `GET /api/v1/resources/:resourceId/versions/:versionId`,
  `GET /api/v1/resources/:resourceId/evidence`, `POST /api/v1/policy/evaluate`, wired into
  `createProductRequestHandler`. This is a read/serialization layer only — it adds no new
  verification logic, wraps the existing M8.1 `evaluateTrustPolicy` unchanged, and never lets a
  discovery/relevance score, ARD `trustManifest`, or raw catalog-store/provider row reach a
  response;
- every response exposes the M8 trust dimensions independently (discovery, source assurance,
  source inspection, correspondence, security, canonical evidence) with a stable `schemaVersion`
  and a stable `error`/`errorCode` taxonomy; no response anywhere contains an ambiguous
  `verified: true`/`safe: true` field (docs/17-m8-security-boundaries.md Threat M8-020);
- `assembleTrustEvidence` is the one place a stored row is allowed to produce a strong verdict
  (`REPOSITORY_AUTHENTICATED`/`SIGNED_RELEASE`/`MATCH`/`MISMATCH`/`DIVERGED`) over HTTP: it
  recomputes the M8.5 source-claim digest (`computeSourceClaimDigest`) and re-runs the M8.6
  `validateNewCapabilityVerification` structural sanity check before presenting either dimension,
  and fails closed (to `NONE`/`NOT_EVALUATED`/`NOT_RUN`, never a downgraded-but-trusted verdict)
  the moment a stored row no longer satisfies its own invariants — covered by a direct simulated
  DB-tampering regression test for both dimensions;
- `@proofrail/catalog-store` gained `getResourceById`/`getResourceVersionById` (both stores + the
  `proofrail-catalog` Edge Function) so the stable API can address catalog rows by their own stable
  id, and a new nullable `capability_verifications.source_snapshot_sha256` column
  (`supabase/migrations/202608260004_m8_7_source_snapshot_digest.sql`, additive/backward-compatible)
  so the exact-source-snapshot digest an M8.6 `INSPECTED` result already computes is no longer
  dropped before it reaches this API — `@proofrail/skill-verification-link`'s
  `buildCapabilityVerificationInput` now populates it; a row without it (including every row
  written before this column existed) presents `sourceInspection` as `NOT_RUN` rather than a
  partially-populated `INSPECTED`;
- `docs/20-m8-api-contract.md`: the frozen contract doc for M8.8 (MCP) and M9 (frontend) to consume;
- regression coverage (`apps/web/test/api-v1.test.ts`): 404 taxonomy for unknown/mismatched
  resource and version ids; malformed policy/resource request validation (bad content type,
  oversized body, missing/invalid policy fields, neither/both of `resource`/`resourceId`,
  structurally invalid inline resource); policy ALLOW/REVIEW/DENY across missing evidence,
  MISMATCH, exceeded audit severity, and stale canonical evidence; policy evaluation by
  `resourceId` reusing the same integrity-checked assembly as the resource endpoint; the two
  DB-tampering fail-closed cases above; and an explicit assertion that no response byte-string
  contains a bare `"verified":true`/`"safe":true`.

Local `pnpm check` and `pnpm test` are green for `@proofrail/web`, `@proofrail/catalog-store`, and
`@proofrail/skill-verification-link` (the same two pre-existing, unrelated `packages/cli`/
`packages/runner-local` fixture git-checkout failures remain — confirmed present on `main` before
this change by stashing and re-running — and are unrelated to M8.7). The new migration has not
been applied to the production Supabase project, consistent with M8.4-M8.6 (repo-owner action,
tracked below). No MCP transport, UI, auto-install, or new verification algorithm was added.

## M8.8 — COMPLETE

Issue #27 on `agent/m8-mcp-interface` exposes `proofrail_search`, `proofrail_inspect`, and
`proofrail_evaluate` through MCP (docs/17-m8-security-boundaries.md Threat M8-018 "MCP becomes a
privileged backdoor"), as a thin transport adapter over the exact application services already
proven in M8.2/M8.3/M8.7 — full detail in `docs/21-m8-mcp-interface.md`:

- `apps/web/src/mcp.ts`: builds a fresh `McpServer` (`@modelcontextprotocol/sdk` 1.30.0, newly
  added dependency, no prior MCP SDK existed in this repo) per request and mounts it at
  `POST /mcp` via `StreamableHTTPServerTransport` in stateless mode
  (`sessionIdGenerator: undefined`) — chosen over stdio because the server already runs as a
  shared, always-on HTTP service (`proofrail-app`), and over session-stateful mode because these
  three tools are pure request/response reads with no need for server-initiated notifications;
- exactly three tools, matching Threat M8-018's allowlist; none of the denylisted tools
  (`proofrail_install`, `proofrail_execute`, `proofrail_sign`, `proofrail_run_arbitrary_build`,
  `proofrail_upload_secret`) exist anywhere in this codebase, and a regression test asserts the
  connected tool list is exactly the three allowed names;
- `proofrail_search` calls `apps/web/src/search-service.ts`'s `performCapabilitySearch` — the
  M8.2/M8.3 local-catalog/federated dispatch logic, moved out of `product.ts`'s inline `POST
  /search` handler into its own module (with `apps/web/src/errors.ts` holding the shared
  `ProductRequestError` class) specifically so neither `product.ts` nor `mcp.ts` needs to import
  the other — `POST /search` and `proofrail_search` now share one function byte-for-byte rather
  than two copies of the same dispatch logic;
- `proofrail_inspect` calls a new exported `buildEvidenceResponse` in `apps/web/src/api-v1.ts`,
  extracted (behavior-preserving) from the M8.7 `GET /api/v1/resources/:resourceId/evidence`
  handler, so both surfaces present the same M8.5/M8.6 integrity-rechecked evidence, itemized
  history, and independent trust dimensions byte-identically — never a collapsed verified/safe
  boolean, and a regression test proves a purely `INDEXED` (discovery-only) resource still reports
  every dimension as `NONE`/`NOT_RUN`/`NOT_EVALUATED` through this transport, the same invariant
  M8.1-M8.7 already enforced at every other layer;
- `proofrail_evaluate` calls a new exported `runPolicyEvaluation` in `apps/web/src/api-v1.ts`,
  extracted from the M8.7 `POST /api/v1/policy/evaluate` handler, which itself calls the unmodified
  M8.1 `evaluateTrustPolicy` — deterministic, no LLM, and a search-relevance score can never enter
  this evaluation since `proofrail_search`'s output is never threaded into `proofrail_evaluate` as
  evidence;
- this implementation deliberately does not create the `packages/mcp-proofrail` package
  `AGENTS.md`'s planned-package-boundaries list names — creating it would require it to import back
  from `apps/web` (a circular dependency, since `apps/web` must also mount the MCP HTTP route) or
  reimplement the M8.7 assembly logic a second time; the reasoning and the correct follow-up if a
  future milestone needs this logic outside `apps/web` are recorded in `docs/21-m8-mcp-interface.md`;
- `apps/web/test/mcp.test.ts` (14 new tests): a **real** `@modelcontextprotocol/sdk` TypeScript
  `Client` (not a hand-rolled test double) connects over an actual `StreamableHTTPClientTransport`
  to a real `node:http` server running `createProductRequestHandler`, lists tools, and calls all
  three tools end-to-end — success paths, an INDEXED-only missing-evidence regression, a fully
  `REPOSITORY_AUTHENTICATED`/`MATCH` resource, and malformed-input cases (empty search text,
  missing `resourceId`, both/neither of `resource`/`resourceId`, an unsupported federation provider
  id, a malformed policy, a non-JSON `POST /mcp` body, `GET /mcp`) — proving the wire protocol,
  tool schemas, and handler wiring work end-to-end against a real in-process server using the
  official SDK's own client. **Not proven in this environment**: that a specific external product
  (Claude Desktop, Claude Code's own `/mcp` config, etc.) renders/consumes these tools correctly in
  its UI — that requires a human to point a real external client at a running deployment, per
  `docs/21-m8-mcp-interface.md`'s explicit "what is proven vs. what still needs a human" section.

Local `pnpm check` and `pnpm test` are green for `@proofrail/web` (69/69 tests, including the 14
new MCP tests) and every other package (the same two pre-existing, unrelated `packages/cli`/
`packages/runner-local` fixture git-checkout failures remain — confirmed present on `main` before
this change since this issue's diff touches only `apps/web` and `docs/`). No new privileged
install/execute/sign route, new verification algorithm, new permanent Railway service, UI, or
paid API dependency was added.

## M8.9 — LOCAL/DETERMINISTIC PROOF IMPLEMENTED / LIVE RUN PENDING

Issue #28 on `agent/m8-substitution-proof` produces the backend's decisive end-to-end
demonstration, using 100% local/deterministic/non-funded means (no real GitHub OAuth, no real 0G
Sandbox/Storage/registry call, no spend of any kind):

- `apps/web/test/m8-9-substitution-demo.test.ts`: one real-server integration test that drives, in
  order, (1) M8.2-M8.4-shaped catalog discovery of a resource/version pointing at an exact claimed
  commit; (2) a full mocked-GitHub OAuth round trip (the exact same fixture-backend pattern
  `apps/web/test/source-auth.test.ts` already established for M8.5, extended so the fake commit
  resolution returns the real SHA of a throwaway local Git repository standing in for the public
  GitHub repository) reaching `REPOSITORY_AUTHENTICATED`; (3) the unmodified M8.6
  `runSkillVerificationEnrichment` against a genuine local distribution artifact -> `MATCH`,
  persisted via `CatalogStore.createCapabilityVerification`; (4) `POST /api/v1/policy/evaluate`
  (M8.7 REST) and the `proofrail_evaluate` MCP tool (M8.8) both returning `ALLOW` under a policy
  requiring `REPOSITORY_AUTHENTICATED` + `MATCH`; (5) a second, deliberately tampered distribution
  artifact (same claimed identity/version/source, a bounded unambiguous content change — an
  injected exfiltration instruction, never confusable with ordinary version drift) against the
  *same* exact source commit -> `MISMATCH`, persisted as a new historical row without mutating the
  genuine row; (6) the same REST and MCP calls both returning `DENY`; (7) an explicit check that
  `GET /api/v1/resources/:resourceId/evidence` and `GET /api/v1/source-claims/:claimId` report the
  *same* claim id, the *same* `REPOSITORY_AUTHENTICATED` level, and `integrityCheckPassed: true`
  both immediately after the genuine `MATCH` run and again after the substituted `MISMATCH` run —
  the central invariant this milestone exists to demonstrate: correspondence outcome never
  rewrites, downgrades, or otherwise touches source assurance;
- no new correspondence/comparison/policy logic was written; every step calls the existing
  unmodified M8.1 (`evaluateTrustPolicy`), M8.5 (`buildCanonicalSourceClaim`,
  `computeSourceClaimDigest`), M8.6 (`runSkillVerificationEnrichment`,
  `buildCapabilityVerificationInput`), M8.7 (`runPolicyEvaluation`, the evidence/resource
  serializers), and M8.8 (the `proofrail_evaluate`/MCP transport) functions;
- `docs/22-m8-9-live-run-runbook.md`: a step-by-step runbook (repository/commit setup, real GitHub
  App OAuth, real 0G Sandbox reproduction via `packages/sandbox-0g`, real 0G Storage upload/proof
  readback via `packages/storage-0g` following the exact `hackathon/m7-live-evidence.json`
  pattern, the same REST/MCP ALLOW-then-DENY demo, and a `hackathon/m8-9-live-evidence.json`
  ledger-entry template) that a human with real GitHub App credentials and 0G Galileo testnet
  funds can follow to produce the live version of this same proof — not executed by this agent.

Local `pnpm check` and `pnpm test` are green, including the new test (`@proofrail/web` now 70/70
tests). **Not proven in this environment and explicitly left unavailable, per this repository's
"leave a gap explicit rather than inferring/marketing around it" discipline**: (1) a real
repository-authenticated GitHub source claim — the M8.5 GitHub App still has no live credentials
in any environment (verified: `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET` do not exist here);
(2) any real 0G Sandbox independent execution, 0G Storage upload/readback, or Galileo registry
write for this milestone — AGENTS.md's cost discipline and this repository's working method both
require a separate explicit approval for live funded 0G spend, which this task did not receive, so
none of `packages/sandbox-0g`/`packages/storage-0g`/`packages/registry-0g` were run against real
network endpoints and no run ID/digest/Storage root/transaction/registry ID was fabricated anywhere
in this codebase or its docs. Do not treat the local proof above as satisfying Issue #28's full
acceptance criteria; only the local/deterministic substitution invariant is proven.

Issue #28 / PR #41 merged to `main`. The local/deterministic proof above is complete; the live
repository-authenticated + real-0G-evidence version remains pending per `docs/22-m8-9-live-run-runbook.md`.

## M8.10 — COMPLETE

Issue #29 on `agent/m8-mcp-registry` adds the official MCP Registry as a second real discovery
provider family, following the exact M8.3 `DiscoveryProvider` boundary/safety envelope rather than
inventing a parallel path:

- `packages/discovery-providers/src/mcp-registry.ts` (`createMcpOfficialRegistryProvider`,
  `fetchMcpRegistryServersPage`), `mcp-registry-normalize.ts` (`normalizeMcpRegistryEntry`), and
  `mcp-registry-sync.ts` (`runMcpOfficialRegistryIngestion`) added to the existing
  `@proofrail/discovery-providers` package (not a new package: the pinned contract is a third
  provider, not a new trust boundary);
- pinned to `modelcontextprotocol/registry@6036804f1c62633b5e7d2927f411a6f4127f148a`, base
  `https://registry.modelcontextprotocol.io`, read family `/v0.1/`
  (`GET /v0.1/servers`, `/v0.1/servers/{serverName}/versions`,
  `/v0.1/servers/{serverName}/versions/{version}`) — verified live and reachable against
  production during implementation; the observed response shape
  (`{ servers: [{ server, _meta }], metadata: { nextCursor?, count } }`) matches
  `docs/15-m8-api-inventory.md` section 4 exactly, so **no pin/contract deviation was required**;
- `packages/discovery-providers/src/http.ts` gained `getBoundedJson` (GET counterpart to the
  existing `postBoundedJson`: same fixed-origin allowlist, timeout, streamed response-size cap,
  no-redirect, at-most-one-retry discipline), since the Registry speaks a paginated `GET` list API
  rather than the M8.3 providers' `POST` ARD search wire shape;
- `normalizeMcpRegistryEntry` maps one `{ server, _meta }` entry into a validated
  `CapabilityResource` (`kind: "mcp-server"`, `discovery.status: "INDEXED"`) and always emits empty
  trust evidence (`sourceAssurance.level: "NONE"`, `correspondence.status: "NOT_EVALUATED"`) and a
  `null` `currentVersion.source`/`distribution` — the Registry entry's own `repository`/`packages`
  fields are read only to pick a discovery `resourceUrl` pointer (preferring a live `remotes[]`
  endpoint, then `repository.url`, then a stable Registry web URL) and are never promoted into a
  source claim or correspondence evidence, exactly the M8.3 `normalize.ts` discipline;
- `createMcpOfficialRegistryProvider` implements the shared `DiscoveryProvider` interface (maps
  `query.text` to the Registry's `search` list parameter, `version=latest`) so it plugs directly
  into the existing `federatedDiscoverySearch`/`POST /search` surface and the `proofrail_search`
  MCP tool without any changes to either — `apps/web/src/product.ts`'s `defaultDiscoveryProviders`
  now registers `mcp-official-registry` alongside the two M8.3 providers;
- `runMcpOfficialRegistryIngestion` is the bounded incremental-sync path into the M8.4 catalog
  (`@proofrail/catalog-store`, already seeded with an `mcp-official-registry` `ingestion_sources`
  row by the M8.4 migration): it resumes from the persisted `cursor`, walks up to
  `MCP_REGISTRY_MAX_PAGES_PER_SYNC` (20) pages per call (docs/17 Threat M8-015 response
  amplification — a full backfill spans multiple scheduled runs via the persisted cursor rather
  than one unbounded download), upserts every normalized resource via the unmodified
  `catalogStore.upsertDiscoveredResource`, and persists `cursor`/`lastSuccessAt` or
  `lastErrorCode`/`lastErrorAt` back onto `ingestion_sources` — a transport failure stops the walk
  without fabricating resources and is recorded as availability state only (docs/17 Threat
  M8-014), matching M8.4's `markProviderDiscoveriesStale` discipline;
- like every other M8.2-M8.9 discovery/ingestion path, no `apps/web`/`apps/worker` route currently
  triggers `runMcpOfficialRegistryIngestion` automatically — it is a tested, reusable function, not
  a wired cron/HTTP job, consistent with the fact that no M8.3 provider's catalog persistence is
  wired to an HTTP trigger yet either;
- regression coverage: stable/deterministic resource and version ids (`normalizeMcpRegistryEntry`
  produces the same `resourceId` across versions and a distinct `currentVersion.id` per version);
  repository/package metadata cannot fabricate `sourceAssurance`/`correspondence` (a Registry entry
  carrying a real `repository.url` plus forged `verified`/`trustScore`/`signatureVerified`-looking
  `_meta` fields still normalizes to empty trust evidence and a `null` `currentVersion.source`);
  malformed top-level response, non-JSON body, timeout, oversized streamed response, redirect, and
  disallowed-origin cases at the HTTP layer; a `mediaTypes` filter that excludes `mcp-server` skips
  the upstream call entirely; multi-page pagination via `nextCursor`, a bounded page-cap stopping
  a walk that still has more pages (`truncatedByPageCap`), cursor resumption from a persisted
  `ingestion_sources` row, and a transport failure recording `lastErrorCode`/`lastErrorAt` without
  upserting any resource; an end-to-end regression that an MCP resource ingested purely through
  `runMcpOfficialRegistryIngestion` remains `INDEXED` with zero `capability_verifications` rows
  through the catalog store, the same invariant class enforced for every other M8 provider;
- three live smoke tests (`packages/discovery-providers/test/live/mcp-registry.live.test.ts`, run
  via `pnpm m8.3:live` alongside the existing M8.3 live tests since both share the package's
  `test:live` script/glob, not part of `pnpm check`/`pnpm test`) made real calls to the production
  Registry: a `provider.search({ text: "filesystem", ... })` call returned 5 real, normalized,
  `INDEXED`/`NONE`/`NOT_EVALUATED` resources; a bare `fetchMcpRegistryServersPage` call returned 5
  real entries plus a real `nextCursor`; and one bounded `runMcpOfficialRegistryIngestion` pass
  persisted 10 real Registry resources into an in-memory catalog store and recorded a real
  `lastSuccessAt`. All three passed against `https://registry.modelcontextprotocol.io` on
  2026-08-26.

Local `pnpm check` and `pnpm test` are green for `@proofrail/discovery-providers` (71/71 tests),
`@proofrail/catalog-store`, `@proofrail/web`, and every other package (the same two pre-existing,
unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures remain — confirmed
present on `main` before this change too, and are unrelated to M8.10). No Supabase migration
change, no new HTTP route beyond the existing `POST /search`/MCP surface already accepting a
`federation` provider id, no GitHub source authentication, no Skill verification orchestration, no
UI, and no 0G write was added.

## M8.11 — CODE/CONTRACT COMPLETE / PRODUCTION DEPLOYMENT VERIFICATION DEFERRED

Issue #30 on `agent/m8-11-backend-freeze` performs the final backend security/deployment pass and
freezes the JSON/MCP contracts M9 will consume, per `docs/17-m8-security-boundaries.md`'s security
test matrix and operational pre-frontend gate, and `docs/19-m8-implementation-checklist.md`:

- **Security regression closure**: every item in the security gate was re-verified against current
  `main`. Static checks (no live 0G import/dependency/env-var read anywhere in `apps/web`; the
  worker exposes only `GET /health` and 404s everything else) confirm the two structural
  guarantees the issue calls out by name. One genuine gap was found and closed: prior "DB/discovery
  metadata cannot manufacture trust evidence" coverage (`apps/web/test/api-v1.test.ts`) called
  `assembleTrustEvidence` directly at the unit level rather than through the live HTTP+MCP
  transport. `apps/web/test/m8-11-hostile-full-stack.test.ts` closes that gap: a hostile
  discovery-provider-shaped payload (forged `REPOSITORY_AUTHENTICATED`/`MATCH`/`AVAILABLE` trust,
  submitted through the real `upsertDiscoveredResource` entry point every discovery/ingestion path
  uses) plus a hostile catalog-store row (a `CatalogStore` subclass whose read paths return a
  tampered source claim and a structurally-invalid capability-verification row, bypassing
  write-time validation to model a mutated Supabase row rather than a rejected write) are both
  proven, through a real `node:http` server and a real `@modelcontextprotocol/sdk` client, to never
  reach `ALLOW`/`MATCH`/`REPOSITORY_AUTHENTICATED` on any of `GET /api/v1/resources/:id`,
  `GET /api/v1/resources/:id/evidence`, `POST /api/v1/policy/evaluate`, `proofrail_inspect`, or
  `proofrail_evaluate`. Every other security-matrix item already had adequate regression coverage
  from M8.2–M8.10 and is cited (not duplicated) in `docs/24-m8-11-contract-freeze.md`'s closure
  table;
- **Contract freeze**: `docs/24-m8-11-contract-freeze.md` is the new consolidated index — a table
  pointing to every already-frozen contract doc (`docs/20-m8-api-contract.md`,
  `docs/21-m8-mcp-interface.md`, `docs/15-m8-api-inventory.md`), a new
  "Implemented HTTP response shapes" section added to `docs/14-source-authentication.md` for the
  five `/auth/github/*`/`/api/v1/source-claims*` routes (previously undocumented at the response-JSON
  level), a single consolidated error-code reference across all three `apps/web` routers (they
  intentionally do not share one error-envelope shape — `api-v1.ts`/`mcp.ts` use
  `{error, errorCode, message, details?}`, `product.ts` uses `{error, errorCode, message}`,
  `source-auth.ts` uses `{error, message}` — documented rather than silently normalized), and an
  explicit confirmation that every M9 frontend-plan data point (search, resource detail/Evidence
  Passport, GitHub source-claim UX, policy playground) has a corresponding JSON endpoint with no
  direct Supabase access or HTML scraping required;
- **Production readiness checklist**: `docs/23-m8-11-production-readiness.md` lists, as explicit
  dated action items with exact commands/URLs, every item this agent environment cannot perform:
  applying the four pending Supabase migrations (`202608260001`–`202608260004`) and reviewing the
  security/performance advisors, confirming both Railway health endpoints and that production
  topology is still exactly two services, confirming/updating Railway watch paths for the newer M8
  packages, creating the GitHub App and completing one live `REPOSITORY_AUTHENTICATED` browser
  authorization, a real external MCP client smoke test, and the live M8.9 evidence-ledger run (which
  additionally requires separate explicit 0G testnet spend approval per `AGENTS.md`'s cost
  discipline). None of these were fabricated, simulated, or marked done;
- **Documentation reconciliation**: this file's M8.5/M8.6/M8.7/M8.8/M8.10 section headers were
  corrected from a stale "IMPLEMENTED ON ISSUE BRANCH / MERGE GATE PENDING" to "COMPLETE" — `git
  log` confirms PRs #37–#42 (covering all of M8.5 through M8.10) are already merged to `main`; the
  prior wording no longer matched reality and is fixed here as part of "PROJECT_STATE reconciled";
- **CI/evidence gate**: full root `pnpm check`/`pnpm test` green (71/71 in `@proofrail/web`,
  including the new hostile full-stack test; the same two pre-existing, unrelated
  `packages/cli`/`packages/runner-local` git-checkout fixture failures remain — confirmed present on
  unmodified `main` by stashing this issue's changes and re-running, so they are not a regression
  from this issue). CI's `gitleaks/gitleaks-action@v3` step (`.github/workflows/ci.yml`) was not
  bypassed or modified by this issue and no secret-shaped value was added to any tracked file.
  `apps/web/test/m8-9-substitution-demo.test.ts` still passes unmodified, confirming the M8.9 local
  proof remains reproducible.

**M9 declaration**: the backend JSON/MCP **contract and code** are frontend-ready as of this issue —
M9 can build against `docs/24-m8-11-contract-freeze.md` today. This is explicitly **not** the same
claim as "production is verified healthy": the eight items in
`docs/23-m8-11-production-readiness.md` remain outstanding and are the repo owner's next action,
independent of M9 code starting.

Issue #30 on `agent/m8-11-backend-freeze`, PR not yet opened/merged at the time this section was
written from within the issue's own branch — see the PR itself for final CI status.

## M8 backend implementation sequence

1. **M8.2 / Issue #21 — complete:** pinned ARD v0.9 adapter + local catalog/search HTTP surface.
2. **M8.3 / Issue #22 — complete:** GitHub Agent Finder + Hugging Face Discover federation.
3. **M8.4 / Issue #23 — complete:** existing-Supabase capability catalog/version/ingestion persistence.
4. **M8.5 / Issue #24 — complete:** GitHub App source authentication and canonical source claims.
5. **M8.6 / Issue #25 — complete:** enrich Agent Skill resources with the existing ProofRail verification pipeline.
6. **M8.7 / Issue #26 — complete:** stable resource/evidence/policy API.
7. **M8.8 / Issue #27 — complete:** `proofrail_search`, `proofrail_inspect`, `proofrail_evaluate` through MCP.
8. **M8.9 / Issue #28 — current:** local/deterministic substitution proof implemented (repository-authenticated genuine distribution → `MATCH`; controlled substituted distribution → `MISMATCH`; policy ALLOW/DENY through REST and MCP; source assurance unchanged); the real-0G-evidence live run remains pending per `docs/22-m8-9-live-run-runbook.md`.
9. **M8.10 / Issue #29 — complete (PR #42):** official MCP Registry indexing stretch, following the M8.3 provider/safety envelope; live-verified against production, no pin deviation required.
10. **M8.11 / Issue #30:** security/deployment/backend contract freeze.

**M9 / Issue #31** is the human Hub frontend and begins only after M8.11 declares the backend frontend-ready.

## M8 planning artifacts

The backend implementation is pre-specified in:

- `CODEX.md`
- `docs/13-m8-backend-blueprint.md`
- `docs/14-source-authentication.md`
- `docs/15-m8-api-inventory.md`
- `docs/16-m8-database-plan.md`
- `docs/17-m8-security-boundaries.md`
- `docs/18-m9-frontend-plan.md`
- `docs/19-m8-implementation-checklist.md`

External contracts currently pinned for implementation:

- ARD: `ards-project/ard-spec@1d25abcf07e081f604dba3ae5398b16c79f20b7b`
- Agent Finder connector reference: `ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07`
- Hugging Face Discover: `huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa`
- MCP Registry: `modelcontextprotocol/registry@6036804f1c62633b5e7d2927f411a6f4127f148a`

Those pins are implementation targets, not claims that upstream standards are final.

## Source-authentication manual dependency

M8.5 requires one user-authenticated setup action that cannot be fabricated by a coding agent: create/install the ProofRail GitHub App and supply the generated client ID/client secret to `proofrail-app` through Railway.

The integration should be implemented/tested first, then request only the real values needed for the live flow.

`SIGNED_RELEASE` remains optional and must stay unavailable unless a cryptographic attestation verifier actually succeeds under the expected repository/source/signer constraints.

## Mainnet safety state

The existing M5 Aristotle registry remains the only completed ProofRail mainnet anchor. M7 commitments remain `PREPARED_NOT_SUBMITTED`.

No M8 mainnet transaction is required. Any future mainnet write requires a fresh read-only preflight and separate explicit approval.

## Submission state

The previous technical submission packet remains complete. Final user-authenticated/media actions still include recording the final demo, confirming the current AKINDO form/deadline, adding the demo/social URL, submitting, and confirming the entry appears.

M8 engineering improves the judgeable product without invalidating the already-proven M1–M7 evidence.

## Current next action

Open/review the **M8.11 / Issue #30** pull request (backend security regression closure, contract
freeze, production-readiness checklist), require green CI, merge. This is the last backend gate:
once merged, `PROJECT_STATE.md` (this file) declares the backend contract frontend-ready and
**M9 / Issue #31** may begin, consuming `docs/24-m8-11-contract-freeze.md`.

Repo-owner actions remain outstanding and do not block M9 **code** from starting, but are required
before this can be called a verified-healthy production deployment or before M8's live-evidence
acceptance criteria are fully met — the full list with exact commands/URLs is
`docs/23-m8-11-production-readiness.md`: (1) apply the four pending Supabase migrations
(`202608260001`–`202608260004`) and review the security/performance advisors; (2) confirm both
Railway health endpoints and that production topology is still exactly two services after this and
every other pending branch deploys; (3) create/install the `ProofRail Source Verifier` GitHub App
and supply its credentials to `proofrail-app` via Railway, then complete one interactive browser
authorization against a real public repository; (4) a human should point a real external MCP client
at a running `proofrail-app` deployment to confirm the three tools render/behave correctly; (5)
follow `docs/22-m8-9-live-run-runbook.md` end-to-end (requires (3) above plus explicit approval for
real 0G Galileo testnet spend) to produce the live M8.9 evidence ledger entry. This environment
cannot perform any of (1)-(5).
