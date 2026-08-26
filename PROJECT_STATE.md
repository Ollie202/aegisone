# Project State

**Last updated:** 2026-08-26  
**Phase:** M8 active — backend-first verified capability discovery; M8.2 merged (PR #34); M8.3 merged (PR #35); M8.4 merged (PR #36); M8.5 merged (PR #37); M8.6 implemented and locally green on its issue branch, merge gate pending; production Supabase migration application/advisor review and the GitHub App creation both pending repo-owner action
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

## M8.5 — IMPLEMENTED ON ISSUE BRANCH / MERGE GATE PENDING

Issue #24 on `agent/m8-github-source-auth` implements the first real source-authentication mechanism:

- `@proofrail/source-auth-github`: a new provider-specific package (GitHub-specific logic stays out of `@proofrail/capability-model`) with an HMAC-signed, expiring, single-use-by-cookie-clearing OAuth `state` (`oauth-state.ts`), a bounded GitHub REST client (`github-client.ts`: token exchange, authenticated user, installations, installation repositories, collaborator permission, repository, exact-commit resolution — strict timeout, response-size cap, no redirects, never logs the code/token/secret), the M8 authority ladder (`permission.ts`: `admin`/`write`/`maintain` sufficient, `read`/`triage`/`none`/unknown insufficient — never guessed from an unrecognized label), canonical source-claim construction and `SHA256` digesting reusing `packages/core`'s canonical JSON rules (`claim.ts`), and a process-local, non-persistent claim-session store for the short-lived GitHub user access token (`session.ts` — the token is never written to Supabase or logged);
- `@proofrail/catalog-store` extended with `source_claims`/`source_claim_authority_observations` persistence (`NewSourceClaim`, `SourceClaim`, `createSourceClaim`/`getSourceClaim`/`listActiveSourceClaimsByResourceVersion` on `CatalogStore`, implemented in both `InMemoryCatalogStore` and `SupabaseCatalogStore`) plus `source-claim-transition.ts`, the pure decision function (new / supersede / explicit `SOURCE_CLAIM_CONFLICT`) shared by the in-memory store and mirrored in the `proofrail-catalog` Edge Function (Deno cannot import it directly; both sides are covered by tests) — only a claim's `claimStatus` ever changes after insert, every evidence column is immutable, and a new mapping always creates a new row;
- `supabase/migrations/202608260002_m8_5_source_claims.sql`: `source_claims` and `source_claim_authority_observations`, following the exact `202608260001` convention (RLS enabled, `deny to anon, authenticated`, CHECK constraints on enums/commit-SHA/digest formats, indexes including a unique index on `claim_digest_sha256`);
- `apps/web`'s `GET /auth/github/start`, `GET /auth/github/callback`, `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`, `GET /api/v1/source-claims/:claimId` (`apps/web/src/source-auth.ts`), wired into `createProductRequestHandler`/`server.ts`: `/auth/github/*` and the repository-listing endpoint return `503 github_source_auth_unavailable` when the GitHub App is not configured (true in every environment right now), while `POST /api/v1/source-claims` still works without any GitHub App configured — it independently resolves the repository/exact commit from the public GitHub REST API and records a `DECLARED` claim. Only a request carrying a valid session cookie from a completed OAuth round trip, and only when the collaborator-permission lookup confirms effective `write`/`admin`/`maintain` authority, upgrades a claim to `REPOSITORY_AUTHENTICATED`; a session with `read`/`triage`/`none` authority is recorded (as an authority observation) but the claim stays `DECLARED`. Private repositories are rejected outright (`private_repository_unsupported`) rather than silently attempted. `GET /api/v1/source-claims/:claimId` recomputes the claim digest from the stored canonical JSON before responding and fails closed (`409 source_claim_integrity_check_failed`) if a stored row was mutated out from under its digest;
- regression coverage: OAuth state signature/expiry/replay (state is invalidated the moment the browser's cookie is cleared, which the callback handler always does), a full mocked-fetch OAuth round trip from `/auth/github/start` through an authenticated `REPOSITORY_AUTHENTICATED` claim, read-only/triage authority never upgrading a claim even with a valid session, an unauthenticated caller always landing on `DECLARED`, a private repository rejected, an unresolvable repository never becoming a claim, two claims for different repositories on the same resource version producing an explicit `SOURCE_CLAIM_CONFLICT` (both claims flagged `conflicted`, neither silently "wins"), a same-repository second claim superseding the first without mutating its immutable evidence fields, and the claim-digest integrity recheck on read.

Local `pnpm check` and `pnpm test` are green for `@proofrail/source-auth-github`, `@proofrail/catalog-store`, `@proofrail/web`, and every other package (the same two pre-existing, unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures remain and are unrelated to M8.5). **Live proof that a real public-repository claim reaches `REPOSITORY_AUTHENTICATED` in production is pending two repo-owner actions that no agent context can perform**: (1) creating/installing the `ProofRail Source Verifier` GitHub App per `docs/14-source-authentication.md` and supplying `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`/`GITHUB_APP_SLUG`/`GITHUB_OAUTH_CALLBACK_URL`/`GITHUB_OAUTH_STATE_SECRET` to `proofrail-app` via Railway (none of these exist anywhere in this environment); (2) one interactive browser authorization against a real public repository the owner controls, since the OAuth authorize step cannot be scripted. The full code path — state issuance/validation, token exchange, installation/repository listing, permission resolution, canonical claim construction/digest, persistence, conflict detection, immutability — is implemented and covered by deterministic tests against mocked GitHub API responses only. `SIGNED_RELEASE` (GitHub Artifact Attestations with actual `gh attestation verify` cryptographic verification) was not attempted in this issue and remains explicitly unavailable; no code path emits it.

Issue #24 / PR #37 merged to `main`. M8.5 is complete; do not redo it.

## M8.6 — IMPLEMENTED ON ISSUE BRANCH / MERGE GATE PENDING

Issue #25 on `agent/m8-skill-verification-enrichment` connects discovered/persisted Agent Skill resource versions and M8.5 source claims to the existing proven M7 Agent Skill verification pipeline, as orchestration/linkage only:

- new package `@proofrail/skill-verification-link`: bounded exact-commit Git source acquisition (`source-acquisition.ts`) reusing the same `git clone --no-checkout` / `git checkout --detach <sha>` / `rev-parse HEAD` verification pattern `packages/runner-local` already uses in the proven M1-M7 build path, plus `packages/skill-audit`'s existing, unmodified `readSkillDirectory`/`validateSkillPackage`/`auditSkillPackage`; an SSRF-hardened bounded distribution-artifact downloader (`distribution-fetch.ts`) — HTTPS-only, no userinfo, default port only, DNS-resolved loopback/RFC1918/link-local/CGNAT/multicast/reserved-address blocking, redirect re-validation capped at 3 hops, a 20 MiB response cap — scoped to ProofRail's own canonical `proofrail-agent-skill-package-v1` package format (decoded via the existing `decodeCanonicalSkillPackage`, never a second archive extractor, since the M7 source-claim contract already requires this exact format); the top-level orchestrator (`enrichment.ts`) whose source-only branch (`evaluateSourceOnly`) contains, by construction, no reference anywhere in its body to `verifySkillPackages`/`compareArtifacts`/`MATCH`/`MISMATCH` — a dedicated test reads the compiled source of that function and asserts none of those tokens appear, and its `correspondence.status` is a hardcoded `NOT_EVALUATED` literal, never derived from a comparison call; a distribution-present branch (`evaluateWithDistribution`) that always calls the existing unmodified `verifySkillPackages`; `authorization.ts` (a `VerificationAuthorization` type brandable only via a private module-scope symbol, constructible only by `authorizeVerificationTrigger` after a constant-time token-digest check, plus `VerificationConcurrencyLimiter` capping in-flight work rather than queuing unbounded concurrency);
- `@proofrail/catalog-store` extended with `capability_verifications` persistence (`NewCapabilityVerification`/`CapabilityVerification`, `createCapabilityVerification`/`getLatestCapabilityVerification`/`listCapabilityVerificationsByResourceVersion` on `CatalogStore`, implemented in both `InMemoryCatalogStore` and `SupabaseCatalogStore`) plus `capability-verification-validation.ts` — the same MATCH/MISMATCH/DIVERGED/NOT_EVALUATED digest-presence sanity rules from docs/16 enforced in application code before any write, mirrored again in the `proofrail-catalog` Edge Function, and enforced a third time as Postgres `CHECK` constraints in the migration; every verification always inserts a new row, never mutating a prior canonical verdict;
- `supabase/migrations/202608260003_m8_6_capability_verifications.sql`: `capability_verifications`, following the exact `202608260001`/`202608260002` convention (RLS enabled, `deny to anon, authenticated`, CHECK constraints on enums/SHA formats, and the docs/16 "Database-level sanity checks" as explicit named constraints);
- `apps/web`/`apps/worker` gain **no new route** in this issue — nothing public or otherwise can currently reach `runSkillVerificationEnrichment` except tests and the local fixture, satisfying "verification authorization prevents anonymous 0G spend" by there being no reachable trigger surface at all; `authorization.ts` exists specifically so the M8.7/M8.8 trigger surface reuses this gate instead of skipping it;
- regression coverage: source-only inspection never emits `MATCH`/`MISMATCH` (both by direct assertion and by the structural source-inspection test above); a genuine local distribution artifact plus the exact claimed source commit yields `MATCH`; a tampered/substituted distribution with the same claimed source yields `MISMATCH`, never a downgraded label; an invalid/mismatched distribution digest fails the entire enrichment call closed (never silently falls back to source-only `NOT_EVALUATED`); path-traversal subdirectories, non-full/invalid commit SHAs, nonexistent commits, and non-GitHub-HTTPS repository URLs are all rejected before any clone; SSRF tests covering loopback-by-default blocking, non-HTTPS schemes, userinfo credentials, oversized responses, malformed (non-canonical-package) bodies, and excess redirect hops; a DB-only row attempting `MATCH`/`MISMATCH`/`DIVERGED` without correct digest presence is rejected at both the in-memory store and the Supabase-store/Edge-Function boundary; a `VerificationAuthorization` cannot be fabricated by a plain object literal (brand-symbol check) and a missing/wrong/misconfigured token is rejected; a concurrency limiter rejects work beyond its cap instead of queuing unbounded concurrency;
- one bounded non-funded/local integration fixture (`packages/skill-verification-link/test/integration-fixture.test.ts`) proves the whole M8.6 surface end-to-end: a throwaway local Git repository plus a `127.0.0.1` HTTP server stand in for source/distribution (no 0G Sandbox/Storage/registry call, no secret/signer material, no network egress), covering both source-only `INSPECTED`/`NOT_EVALUATED` persistence into `InMemoryCatalogStore` and, once a genuine local distribution artifact is supplied, the same linkage upgrading to a persisted `MATCH` row.

Local `pnpm check` and `pnpm test` are green for `@proofrail/skill-verification-link`, `@proofrail/catalog-store`, and every other package (the same two pre-existing, unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures remain — confirmed present on `main` before this change by stashing and re-running — and are unrelated to M8.6). No new HTTP route, no live/funded 0G run, no UI change, no MCP Registry work, and no mainnet transaction were part of this issue.

## M8 backend implementation sequence

1. **M8.2 / Issue #21 — complete:** pinned ARD v0.9 adapter + local catalog/search HTTP surface.
2. **M8.3 / Issue #22 — complete:** GitHub Agent Finder + Hugging Face Discover federation.
3. **M8.4 / Issue #23 — complete:** existing-Supabase capability catalog/version/ingestion persistence.
4. **M8.5 / Issue #24 — complete:** GitHub App source authentication and canonical source claims.
5. **M8.6 / Issue #25 — current:** enrich Agent Skill resources with the existing ProofRail verification pipeline.
6. **M8.7 / Issue #26:** stable resource/evidence/policy API.
7. **M8.8 / Issue #27:** `proofrail_search`, `proofrail_inspect`, `proofrail_evaluate` through MCP.
8. **M8.9 / Issue #28:** repository-authenticated genuine distribution → `MATCH`; controlled substituted distribution → `MISMATCH`; policy ALLOW/DENY; real 0G evidence.
9. **M8.10 / Issue #29:** official MCP Registry indexing stretch after M8.9.
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

Open/review the **M8.6 / Issue #25** pull request, require green CI, merge. Three repo-owner actions remain outstanding and are not blocking further backend issues, but are required before live evidence can be produced: (1) apply `supabase/migrations/202608260001_m8_4_capability_catalog.sql`, `supabase/migrations/202608260002_m8_5_source_claims.sql`, and `supabase/migrations/202608260003_m8_6_capability_verifications.sql` to the production Supabase project and review the security/performance advisors; (2) create/install the `ProofRail Source Verifier` GitHub App per `docs/14-source-authentication.md` and supply `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`/`GITHUB_APP_SLUG`/`GITHUB_OAUTH_CALLBACK_URL`/`GITHUB_OAUTH_STATE_SECRET` to `proofrail-app` via Railway, then complete one interactive browser authorization against a real public repository; (3) none required specifically for M8.6 beyond the migration above, since M8.6 added no live/funded 0G path. Do not begin M8.7 in this context.
