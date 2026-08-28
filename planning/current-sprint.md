# Current Sprint — M8 Backend First

## Primary objective

Complete AegisOne M8 as a **trust-aware capability discovery backend** before building the new human Hub frontend.

Target flow:

```text
intent
  -> capability discovery
  -> source assurance
  -> AegisOne evidence
  -> consumer trust policy
  -> ALLOW / REVIEW / DENY
```

M8 master: Issue #18.  
Current implementation gate: **M8.11 / Issue #30 / branch `agent/m8-11-backend-freeze`** (M8.2 through M8.10 are all merged to `main`, PRs #34-#42; see `PROJECT_STATE.md` for authoritative per-milestone status). M8.11 is the final backend gate — M9/Issue #31 begins only once M8.11 merges and the backend is declared frontend-ready (`docs/24-m8-11-contract-freeze.md`).

## Proven foundation — unchanged

- [x] M1–M7 implemented, live-proven, and merged.
- [x] Agent Skill deterministic packaging, source correspondence, and separate security audit proven.
- [x] Real 0G Sandbox reproduction proven.
- [x] Proof-verified 0G Storage exact-byte evidence proven.
- [x] M5 software verification anchored/read back on Aristotle mainnet.
- [x] M7 Agent Skill commitments registered/read back on Galileo.
- [x] Production remains exactly `proofrail-app` + `proofrail-worker`.
- [x] Worker signer boundary remains controlled; public signing disabled.
- [x] **PR 3/4 (ADR-017)**: the 0G evidence publication path is built, wired and tested against
      injected fake transports. `aegisone-worker` gains one internal, token-authenticated,
      fail-closed publication route; the app gains an operator-only trigger; `/verified` becomes the
      real Verified Library with four independently-earned states. **No funded live run has been
      performed** — `STORED ON 0G` is currently `not established` for every resource, and the page
      says so rather than showing a number it cannot back. The live run is a separate approved step.

## M8.1 — COMPLETE

Issue #19 / PR #20 merged.

- [x] `@aegisone/capability-model` provider-independent package.
- [x] resource kinds: Agent Skill, MCP server, A2A agent, API.
- [x] discovery metadata structurally separate from trust evidence.
- [x] source inspection distinct from distribution correspondence.
- [x] `MATCH` / `MISMATCH` require separate distributed + independent digests.
- [x] deterministic `ALLOW` / `REVIEW` / `DENY` evaluator.
- [x] policy ignores discovery relevance and handles missing evidence explicitly.
- [x] ADR-010 records discovery/evidence/policy separation.
- [x] final CI green before merge.

Do not redo M8.1.

## Current gate — M8.2 ARD adapter

Issue #21.

Goal: make AegisOne itself expose a small pinned ARD-compatible local discovery surface before connecting real upstream providers.

Required:

- [x] `@aegisone/discovery-ard`
- [x] ARD v0.9 pinned to `ards-project/ard-spec@1d25abcf07e081f604dba3ae5398b16c79f20b7b`
- [x] `GET /.well-known/ai-catalog.json`
- [x] `POST /search`
- [x] deterministic local fixture/catalog search
- [x] all four M8.1 resource kinds mapped/tested
- [x] strict request/result limits
- [x] unsupported filters fail explicitly
- [x] `INDEXED`/relevance/trustManifest metadata cannot upgrade AegisOne evidence
- [x] local root `pnpm check` and `pnpm test` green
- [x] pull request CI green and M8.2 merged (PR #34)

No federation, Supabase schema, GitHub OAuth, MCP, UI redesign or 0G write belongs in M8.2.

M8.2 is merged to `main`. M8.2 is complete; do not redo it.

## Current gate — M8.3 federated discovery

Issue #22.

Goal: replace M8.2's local-only fixtures with real read-only federation to GitHub Agent Finder and Hugging Face Discover, normalized into the same M8.1 capability model, without letting upstream metadata create or upgrade AegisOne trust evidence.

Required:

- [x] `@aegisone/discovery-providers`
- [x] `DiscoveryProvider` interface (`id`, `search(query, signal)`)
- [x] GitHub Agent Finder adapter, pinned to `ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07`, fixture-tested
- [x] live smoke test proving the Agent Finder endpoint works (`test/live/github-agent-finder.live.test.ts`, not part of `pnpm check`/`pnpm test`)
- [x] Hugging Face Discover adapter, pinned to `huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa`, fixture-tested (both live endpoints were reachable and stable, so both providers were implemented rather than deferring one)
- [x] live smoke test for both providers, plus a combined federated live smoke test
- [x] normalized provider results map only to `CapabilityResource` discovery state, never trust/evidence
- [x] stable provider attribution retained (`discovery.source` / `discovery.sourceResourceId`)
- [x] deterministic deduplication, tested
- [x] partial outage (one provider mocked failing) returns useful partial results, tested
- [x] timeout / malformed / oversized response tests
- [x] regression test proving forged `trustManifest`/`org.aegisone.*`-looking metadata/score cannot escalate AegisOne evidence
- [x] search relevance stays out of policy evaluation (unchanged `@aegisone/capability-model` policy engine; federated results only ever populate `discovery.relevanceScore`)
- [x] `apps/web` `POST /search` wired: `federation` accepts local `"none"` (unchanged M8.2 behavior) or a non-empty array of registered provider ids, which federates in parallel under the shared deadline
- [x] local root `pnpm check` and `pnpm test` green
- [x] pull request CI green and M8.3 merged (PR #35)

Supabase catalog persistence, GitHub publisher/source authentication, Skill verification orchestration, MCP Registry ingestion, UI redesign, and any 0G write remain out of scope for M8.3.

M8.3 is merged to `main`. M8.3 is complete; do not redo it.

## Current gate — M8.4 Supabase capability catalog

Issue #23.

Goal: persist normalized mutable discovery/catalog data (M8.1's `CapabilityResource` shape, as produced by M8.2/M8.3) in the existing AegisOne Supabase project, without moving proof authority into the database.

Required:

- [x] SQL migration `supabase/migrations/202608260001_m8_4_capability_catalog.sql` creating `agentic_resources`, `resource_discoveries`, `resource_versions`, `ingestion_sources`
- [x] RLS enabled on all four new public tables, deny-by-default (no anon/authenticated policy), mirroring `proofrail_app_auth`
- [x] token-gated Edge Function `supabase/functions/aegisone-catalog`, service-role credential held only inside the function, same `proofrail_app_auth` app-token gate `packages/job-store` uses
- [x] `@aegisone/catalog-store` package: `computeCanonicalKeyFromResource` (deterministic dedup key), `buildResourceUpsertPlan` (pure DB-free field mapping), `catalogRecordToCapabilityResource` (always empty/unverified trust), `InMemoryCatalogStore`, `SupabaseCatalogStore`
- [x] resource + provider-observation upsert tests, stable dedup-key tests
- [x] regression: a DB-only inserted `INDEXED` resource remains unverified end-to-end
- [x] regression: provider outage/staleness (`markProviderDiscoveriesStale`) mutates `discovery_status` only, never resource/version identity or trust evidence
- [x] local root `pnpm check` and `pnpm test` green
- [x] pull request CI green and M8.4 merged (PR #36)
- [ ] migration applied to the production Supabase project (requires repo-owner Supabase credentials, not available to this agent)
- [ ] Supabase security/performance advisors reviewed after that application

`source_claims` / `source_claim_authority_observations` were added in M8.5 (below); `capability_verifications` remains deferred to M8.6.

M8.4 is merged to `main`. M8.4 is complete; do not redo it.

## Current gate — M8.5 GitHub source authentication

Issue #24.

Goal: implement the first real source-authentication mechanism so AegisOne can distinguish a random/declarative repository mapping from a source claim authenticated by a GitHub identity with real authority over the repository. `REPOSITORY_AUTHENTICATED` must not be inferred from discovery metadata.

Required:

- [x] `@aegisone/source-auth-github`: HMAC-signed/expiring/cookie-bound OAuth state, bounded GitHub REST client (token exchange, user, installations, installation repositories, collaborator permission, repository, exact-commit resolution), the M8 authority ladder (admin/write/maintain sufficient; read/triage/none/unknown insufficient), canonical source-claim construction + SHA-256 digest reusing `packages/core`'s canonical JSON, and a process-local non-persistent claim-session store (the GitHub access token is never written to Supabase or logged)
- [x] `@aegisone/catalog-store` extended with `source_claims`/`source_claim_authority_observations` persistence and `source-claim-transition.ts` (new / supersede / explicit `SOURCE_CLAIM_CONFLICT`), implemented in both `InMemoryCatalogStore` and `SupabaseCatalogStore`
- [x] SQL migration `supabase/migrations/202608260002_m8_5_source_claims.sql`, same convention as `202608260001` (RLS, deny-by-default, CHECK constraints, indexes)
- [x] `aegisone-catalog` Edge Function extended with `createSourceClaim`/`getSourceClaim`/`listActiveSourceClaimsByResourceVersion` actions
- [x] `apps/web`: `GET /auth/github/start`, `GET /auth/github/callback`, `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`, `GET /api/v1/source-claims/:claimId`, wired into `createProductRequestHandler`/`server.ts`
- [x] `/auth/github/*` and the repository-listing endpoint return `503` when the GitHub App is not configured; `POST /api/v1/source-claims` still works unauthenticated and always produces `DECLARED`, never `REPOSITORY_AUTHENTICATED`
- [x] private repositories rejected explicitly (`private_repository_unsupported`)
- [x] `GET /api/v1/source-claims/:claimId` recomputes/verifies the claim digest before responding
- [x] regression: OAuth state signature/expiry/replay, full mocked OAuth round trip to `REPOSITORY_AUTHENTICATED`, read-only/triage authority never upgrades a claim, unauthenticated caller always `DECLARED`, private repo rejected, unresolvable repo never becomes a claim, same-repository claim supersedes without mutating prior evidence, different-repository claim produces an explicit `SOURCE_CLAIM_CONFLICT`
- [x] local root `pnpm check` and `pnpm test` green
- [x] pull request CI green and M8.5 merged (PR #37)
- [ ] GitHub App created/installed by the repo owner and `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`/`GITHUB_APP_SLUG`/`GITHUB_OAUTH_CALLBACK_URL`/`GITHUB_OAUTH_STATE_SECRET` supplied to `proofrail-app` via Railway (not available to this agent)
- [ ] one interactive browser authorization against a real public repository, proving `REPOSITORY_AUTHENTICATED` live
- [ ] migration `202608260002_m8_5_source_claims.sql` applied to the production Supabase project

`SIGNED_RELEASE` was not attempted in M8.5 and remains explicitly unavailable; no code path emits it.

M8.5 is merged to `main`. M8.5 is complete; do not redo it.

## Current gate — M8.6 Agent Skill verification enrichment

Issue #25.

Goal: connect discovered/persisted Agent Skill resource versions and M8.5 source claims to the existing proven M7 Agent Skill verification pipeline (`packages/skill-audit` + `packages/core`), without forking/rewriting its deterministic packaging, audit, or correspondence-comparison logic, and while keeping source-only inspection structurally incapable of emitting `MATCH`/`MISMATCH`.

Required:

- [x] new package `@aegisone/skill-verification-link`: bounded exact-commit Git source acquisition (`source-acquisition.ts`, reusing the same clone/checkout/verify pattern `packages/runner-local` already uses in production, plus the existing `readSkillDirectory`/`validateSkillPackage`/`auditSkillPackage` from `packages/skill-audit`, never forked); an SSRF-hardened bounded distribution-artifact downloader (`distribution-fetch.ts`) scoped to AegisOne's own canonical `proofrail-agent-skill-package-v1` package format (decoded via the existing `decodeCanonicalSkillPackage`, never a second archive extractor); the top-level orchestrator `enrichment.ts`, whose source-only branch (`evaluateSourceOnly`) contains no reference anywhere in its body to `verifySkillPackages`/`compareArtifacts`/`MATCH`/`MISMATCH` (a dedicated regression test reads the compiled source and asserts this); a distribution-present branch that always calls the existing unmodified `verifySkillPackages`; `authorization.ts` (a nominally-typed `VerificationAuthorization`, constructible only via a token-digest check, plus an in-process concurrency limiter)
- [x] `@aegisone/catalog-store` extended with `capability_verifications` persistence (`NewCapabilityVerification`/`CapabilityVerification`, `createCapabilityVerification`/`getLatestCapabilityVerification`/`listCapabilityVerificationsByResourceVersion` on `CatalogStore`, implemented in both `InMemoryCatalogStore` and `SupabaseCatalogStore`) plus `capability-verification-validation.ts`, the same MATCH/MISMATCH/DIVERGED digest-presence sanity rules mirrored in the `aegisone-catalog` Edge Function and enforced again as Postgres `CHECK` constraints
- [x] SQL migration `supabase/migrations/202608260003_m8_6_capability_verifications.sql`: `capability_verifications`, same convention as `202608260001`/`202608260002` (RLS, deny-by-default, CHECK constraints including the MATCH/MISMATCH/DIVERGED/NOT_EVALUATED digest-presence sanity checks from docs/16)
- [x] `aegisone-catalog` Edge Function extended with `createCapabilityVerification`/`getLatestCapabilityVerification`/`listCapabilityVerificationsByResourceVersion` actions
- [x] regression: a DB-only row attempting `MATCH`/`MISMATCH`/`DIVERGED` without both digests (or with equal digests claimed as `MISMATCH`) is rejected before any write, at both the in-memory store and the Supabase-store/Edge-Function boundary
- [x] regression: every verification creates a new historical row; nothing mutates a prior canonical verdict
- [x] no new `apps/web`/`apps/worker` HTTP route was added in this issue — nothing public or otherwise can currently reach the expensive enrichment path except tests and the local fixture; `authorization.ts` exists so a future M8.7/M8.8 trigger surface reuses the same gate instead of skipping it
- [x] local non-funded integration fixture (`packages/skill-verification-link/test/integration-fixture.test.ts`): a throwaway local Git repository plus a `127.0.0.1` HTTP server stand in for source/distribution, proving source-only `INSPECTED`/`NOT_EVALUATED` persistence and, once a genuine local distribution artifact is added, the same linkage upgrading to `MATCH` — no 0G Sandbox/Storage/registry call, no secret/signer material, no network egress
- [x] local root `pnpm check` and `pnpm test` green (two pre-existing, unrelated `packages/cli`/`packages/runner-local` fixture git-checkout failures remain, confirmed present on `main` before this change too, and are not part of M8.6)
- [x] pull request CI green and M8.6 merged (PR #38)

Out of scope, not attempted: arbitrary npm/Python/Docker build systems, auto-verifying every discovered Skill, UI/frontend, MCP Registry verification, any new mainnet transaction, any real/live/funded 0G run.

## Backend queue after M8.6

1. **M8.7 / #26 — stable read/evidence/policy API — merged (PR #39).**

2. **M8.8 / #27 — MCP agent interface — merged (PR #40).**  
   Only `aegisone_search`, `aegisone_inspect`, `aegisone_evaluate`.

3. **M8.9 / #28 — controlled substitution vertical slice — merged (PR #41).**  
   Repository-authenticated genuine Skill -> `MATCH` -> policy ALLOW; same claimed identity/source with substituted bytes -> `MISMATCH` -> policy DENY; local/deterministic proof complete, real 0G evidence still pending per `docs/22-m8-9-live-run-runbook.md`.

4. **M8.10 / #29 — MCP Registry indexing (stretch) — merged (PR #42).**  
   Read-only official Registry ingestion (`packages/discovery-providers`'s `mcp-registry.ts`/`mcp-registry-sync.ts`); remains INDEXED unless stronger evidence actually exists; live-verified against production, no pin deviation required. See `PROJECT_STATE.md`'s "M8.10" section for full detail.

5. **M8.11 / #30 — hardening/deploy/backend freeze — code/contract complete on `agent/m8-11-backend-freeze`, PR pending review/merge.**  
   Security regression closure (including a new cross-cutting hostile-full-stack test,
   `apps/web/test/m8-11-hostile-full-stack.test.ts`), contract freeze
   (`docs/24-m8-11-contract-freeze.md`), and an explicit production-readiness checklist
   (`docs/23-m8-11-production-readiness.md`) for the deployment/Supabase/GitHub-App items this
   agent environment cannot perform. See `PROJECT_STATE.md`'s "M8.11" section for full detail.

## Frontend

**M9 / Issue #31 — implemented on `agent/m9-hub-frontend`, PR pending review/merge.**

Built on the M8.11-frozen backend contract (`docs/24-m8-11-contract-freeze.md`) with no new
production dependency/build step (ADR-013, Option A: evolve the existing lightweight Node app):

- `/` — Hub/Search, server-rendered with a debounced client re-search against real `POST /search`
  (local catalog and, optionally, federated providers);
- `/resources/:resourceId` — Evidence Passport rendering every independent M8 dimension
  (capability, source assurance, correspondence, security, independent execution, canonical
  evidence, verification history) plus an embedded policy playground calling
  `POST /api/v1/policy/evaluate` live, decision/reasons rendered verbatim;
- `/source/claim` — the real M8.5 GitHub OAuth/source-claim flow, gracefully degrading (clearly
  labeled, not crashing) when the GitHub App is not configured, matching M8.5's existing `503`
  behavior;
- a labeled demo-seed path (`apps/web/src/demo-seed.ts`) reusing M8.9's own tested fixture
  identity/content, computing real SHA-256 digests through the real production hashing functions —
  no invented evidence values, rendered through the exact same components as real data;
- explicit XSS-sanitization and no-secret-in-frontend-bundle test coverage
  (`apps/web/test/ui-render.test.ts`, `apps/web/test/m9-frontend-security-audit.test.ts`), and an
  explicit no-`SAFE`/`TRUSTED`-badge, no-numeric-trust-score regression test.

Local `pnpm check`/`pnpm test` green except the same two pre-existing, unrelated
`packages/cli`/`packages/runner-local` fixture git-checkout failures every prior M8 issue already
noted (confirmed unrelated: this issue's diff touches only `apps/web` and `docs/`). Deferred to the
repo owner, unchanged from M8.5/M8.9: a live GitHub OAuth click-through (no GitHub App credentials
exist in this environment) and live 0G evidence links (no live M8.9 run has been performed yet).

## Active gate — product restructure, four-section IA (PR 1 of 4)

Branch `feature/skills-library-ia`. Decision record:
`docs/decisions/016-four-section-product-ia-and-skill-library.md`.

Primary navigation becomes exactly **SKILLS** (`/`) · **AUDIT** (`/audit`) · **VERIFIED**
(`/verified`) · **FOR AGENTS** (`/agents`).

### PR 1 — nav shell + SKILLS section — MERGED (PR #51)

- [x] Four-section primary nav; no nav route 404s or renders a dead control.
- [x] SKILLS complete: real catalog-backed library, nine deterministic categories, per-category
      bespoke illustrations, separate live-federated discovery strip.
- [x] One real seeded resource (`Ollie202/goat_cookbook` @ `1471116222…`) with genuine digest,
      genuine audit, and a genuine *failing* format validation shown honestly. No wrapping applied.
- [x] AUDIT: `/audit` and `/scan` serve the identical working paste-to-scan page.
- [x] VERIFIED / FOR AGENTS: real pages from what works today, each with a visible "not built yet"
      section for the parts PRs 3–4 add.
- [x] `Claim` and `Ledger` leave primary nav; `/source/claim`, `/proof`, `/scan` still work by
      direct URL and from the footer. No M8.5 code removed.
- [x] ARD fixtures still back `POST /search` and `/.well-known/ai-catalog.json`, and are asserted
      unable to appear in the human library.
- [x] Regression tests: category classifier, category/relevance non-escalation, seeded digests and
      audit values, escaping, no-SAFE-badge on every new page.
- [x] Both entrypoints (`server.ts`, `vercel-entry.ts`) verified serving every route.

### PR 2 — AUDIT section build-out ("Audit Lab") — IN REVIEW, NOT MERGED

Branch `feature/audit-lab`. Decision record:
`docs/decisions/017-audit-lab-and-package-verification-deferral.md`.

- [x] `/audit` (alias `/scan`) opens with a four-card audit-type selector: **Agent Skill Audit**
      (LIVE — the existing deterministic paste-to-scan tool), **Package / Artifact Verification**,
      **Smart Contract Audit**, **MCP / Agent Capability Audit** (all three explicitly UPCOMING,
      each stating plainly why, none linking to a dead route or fake result).
- [x] Report upgraded to plain English: a new "What AegisOne inspected" panel (real file list +
      byte counts, additive `inspected` field on `ScanApiResponse`), a plain-English "why this
      matters" paragraph per finding keyed by rule id (`ui/rule-explanations.mjs`, secondary to the
      still-visible rule id), and an unconditional "What AegisOne did NOT prove" section rendered
      on every result regardless of verdict (Threat M8-019).
- [x] Package/Artifact Verification (`packages/skill-verification-link`, fully built in M8.6) is
      **deliberately deferred**, not wired to a public route, in this PR — see ADR-017 for the full
      reasoning (its `VerificationAuthorization` brand-gate has no provisioned end-user-facing
      trigger design yet, and rushing one around a real-compute/real-clone security boundary was
      judged worse than an honest "upcoming"). Existing verification evidence already in the
      catalog remains fully readable through the unchanged Evidence Passport / `/api/v1` routes.
- [x] Smart Contract Audit and MCP/Agent Capability Audit remain honestly NOT implemented — no
      shallow scanner was built for either.
- [x] Library grew with two real, well-formed Agent Skill fixtures
      (`apps/web/src/library-seed-fixtures.ts`): `clean-review` (genuine CLEAN / 0 findings) and
      `malicious-sync` (genuine CRITICAL, 8 real deterministic findings across all 7 rule ids),
      both packaged/audited through the unmodified production functions and labelled as repository
      fixtures, never a third-party discovery.
- [x] Regression tests: Audit Lab card markup (exactly one LIVE, three UPCOMING, no embedded
      links), inspected-panel rendering and escaping, plain-English mapping (including an
      unrecognised-rule-id fallback and a `__proto__` lookup-safety test), the unconditional
      not-proven section on every verdict, and pinned real digests/audit results for both new
      fixtures.
- [x] No existing trust semantic, verdict threshold, rate limit, or advisory non-override behaviour
      changed; the full pre-existing `apps/web` test suite (191 tests before this PR) still passes
      unchanged, plus this PR's new tests.

### PRs 3–4 — NOT STARTED

- [ ] PR 3 — VERIFIED section: browsable index of resources carrying a real correspondence verdict.
- [ ] PR 4 — FOR AGENTS: guided onboarding, per-agent credentials, worked client examples.

Do not begin PR 3 until PR 2 is merged.

### Standing invariants for every PR in this restructure

- Category and relevance can never reach trust evidence or policy evaluation.
- `INDEXED` stays visually and semantically distinct from audited/verified states.
- No generic `SAFE`/`TRUSTED` badge, no invented numeric trust score, no bare `verified:true`.
- Colour is never the only signal for any state; unknown renders as the word "unknown".
- Backend fields rendered verbatim; no client-side reinterpretation of any verdict.
- Production stays Vercel + the two Railway services. No new hosting, service, or dependency.

## Planning artifacts

Coding agents should read:

- `CODEX.md`
- `docs/decisions/016-four-section-product-ia-and-skill-library.md`
- `docs/13-m8-backend-blueprint.md`
- `docs/14-source-authentication.md`
- `docs/15-m8-api-inventory.md`
- `docs/16-m8-database-plan.md`
- `docs/17-m8-security-boundaries.md`
- `docs/18-m9-frontend-plan.md`
- `docs/19-m8-implementation-checklist.md`

## Cost / architecture boundary

- Reuse exactly `proofrail-app` + `proofrail-worker`.
- Extend the existing AegisOne Supabase project; do not create another one.
- No runtime OpenAI/Anthropic API is required.
- No embeddings/vector DB is required.
- No third Railway service is required.
- No new Aristotle mainnet write is required.
- Public search/read routes must never trigger uncontrolled/funded 0G work.

## User/manual dependency

For M8.5 live integration the user must create/install the GitHub App and add the generated client ID/client secret (plus callback URL/state secret/app slug) to `proofrail-app`, then complete one interactive browser authorization. Code/tests are ready; this remains outstanding.

## Submission closure remains separate

The prior technical submission packet remains valid; user-authenticated/media actions (recording/current AKINDO form/demo URL/submission) are separate from this M8 product expansion.
