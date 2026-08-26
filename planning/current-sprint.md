# Current Sprint — M8 Backend First

## Primary objective

Complete ProofRail M8 as a **trust-aware capability discovery backend** before building the new human Hub frontend.

Target flow:

```text
intent
  -> capability discovery
  -> source assurance
  -> ProofRail evidence
  -> consumer trust policy
  -> ALLOW / REVIEW / DENY
```

M8 master: Issue #18.  
Current implementation gate: **M8.3 / Issue #22 / branch `agent/m8-federated-discovery`**.

## Proven foundation — unchanged

- [x] M1–M7 implemented, live-proven, and merged.
- [x] Agent Skill deterministic packaging, source correspondence, and separate security audit proven.
- [x] Real 0G Sandbox reproduction proven.
- [x] Proof-verified 0G Storage exact-byte evidence proven.
- [x] M5 software verification anchored/read back on Aristotle mainnet.
- [x] M7 Agent Skill commitments registered/read back on Galileo.
- [x] Production remains exactly `proofrail-app` + `proofrail-worker`.
- [x] Worker signer boundary remains controlled; public signing disabled.

## M8.1 — COMPLETE

Issue #19 / PR #20 merged.

- [x] `@proofrail/capability-model` provider-independent package.
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

Goal: make ProofRail itself expose a small pinned ARD-compatible local discovery surface before connecting real upstream providers.

Required:

- [x] `@proofrail/discovery-ard`
- [x] ARD v0.9 pinned to `ards-project/ard-spec@1d25abcf07e081f604dba3ae5398b16c79f20b7b`
- [x] `GET /.well-known/ai-catalog.json`
- [x] `POST /search`
- [x] deterministic local fixture/catalog search
- [x] all four M8.1 resource kinds mapped/tested
- [x] strict request/result limits
- [x] unsupported filters fail explicitly
- [x] `INDEXED`/relevance/trustManifest metadata cannot upgrade ProofRail evidence
- [x] local root `pnpm check` and `pnpm test` green
- [x] pull request CI green and M8.2 merged (PR #34)

No federation, Supabase schema, GitHub OAuth, MCP, UI redesign or 0G write belongs in M8.2.

M8.2 is merged to `main`. M8.2 is complete; do not redo it.

## Current gate — M8.3 federated discovery

Issue #22.

Goal: replace M8.2's local-only fixtures with real read-only federation to GitHub Agent Finder and Hugging Face Discover, normalized into the same M8.1 capability model, without letting upstream metadata create or upgrade ProofRail trust evidence.

Required:

- [x] `@proofrail/discovery-providers`
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
- [x] regression test proving forged `trustManifest`/`org.proofrail.*`-looking metadata/score cannot escalate ProofRail evidence
- [x] search relevance stays out of policy evaluation (unchanged `@proofrail/capability-model` policy engine; federated results only ever populate `discovery.relevanceScore`)
- [x] `apps/web` `POST /search` wired: `federation` accepts local `"none"` (unchanged M8.2 behavior) or a non-empty array of registered provider ids, which federates in parallel under the shared deadline
- [x] local root `pnpm check` and `pnpm test` green
- [ ] pull request CI green and M8.3 merged

Supabase catalog persistence, GitHub publisher/source authentication, Skill verification orchestration, MCP Registry ingestion, UI redesign, and any 0G write remain out of scope for M8.3.

## Backend queue after M8.3

1. **M8.4 / #23 — Supabase capability catalog**  
   Existing ProofRail project only; RLS; mutable catalog/version/ingestion state.

3. **M8.5 / #24 — GitHub source authentication**  
   Real GitHub App flow proving repository authority for exact source claims. `REPOSITORY_AUTHENTICATED` must not be inferred from discovery metadata.

4. **M8.6 / #25 — Agent Skill verification enrichment**  
   Connect resources/claims to existing M7 pipeline; source inspection remains separate from distribution correspondence.

5. **M8.7 / #26 — stable read/evidence/policy API**  
   Freeze machine-readable backend JSON.

6. **M8.8 / #27 — MCP agent interface**  
   Only `proofrail_search`, `proofrail_inspect`, `proofrail_evaluate`.

7. **M8.9 / #28 — controlled substitution vertical slice**  
   Repository-authenticated genuine Skill -> `MATCH` -> policy ALLOW; same claimed identity/source with substituted bytes -> `MISMATCH` -> policy DENY; real 0G evidence.

8. **M8.10 / #29 — MCP Registry indexing (stretch)**  
   Read-only official Registry ingestion; remains INDEXED unless stronger evidence actually exists.

9. **M8.11 / #30 — hardening/deploy/backend freeze**  
   Security regression, Supabase advisors, Railway health, CI/Gitleaks, contract freeze.

## Frontend

**M9 / Issue #31** starts only when M8.11 explicitly says the backend is frontend-ready.

The frontend will add:

- human capability search;
- Evidence Passport;
- GitHub publisher/source-claim UX;
- deterministic policy playground;
- 90–120 second judge path.

It must consume the frozen backend and must not become a second trust engine.

## Planning artifacts

Coding agents should read:

- `CODEX.md`
- `docs/13-m8-backend-blueprint.md`
- `docs/14-source-authentication.md`
- `docs/15-m8-api-inventory.md`
- `docs/16-m8-database-plan.md`
- `docs/17-m8-security-boundaries.md`
- `docs/18-m9-frontend-plan.md`
- `docs/19-m8-implementation-checklist.md`

## Cost / architecture boundary

- Reuse exactly `proofrail-app` + `proofrail-worker`.
- Extend the existing ProofRail Supabase project; do not create another one.
- No runtime OpenAI/Anthropic API is required.
- No embeddings/vector DB is required.
- No third Railway service is required.
- No new Aristotle mainnet write is required.
- Public search/read routes must never trigger uncontrolled/funded 0G work.

## User/manual dependency later

At M8.5 live integration the user must create/install the GitHub App and add the generated client ID/client secret to the app service. Code/tests should be ready before asking for those values.

## Submission closure remains separate

The prior technical submission packet remains valid; user-authenticated/media actions (recording/current AKINDO form/demo URL/submission) are separate from this M8 product expansion.
