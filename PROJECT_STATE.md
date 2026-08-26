# Project State

**Last updated:** 2026-08-26  
**Phase:** M8 active — backend-first verified capability discovery; M8.2 merged (PR #34); M8.3 implemented and locally green on its issue branch, merge gate pending
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

## M8.3 — IMPLEMENTED ON ISSUE BRANCH / MERGE GATE PENDING

Issue #22 on `agent/m8-federated-discovery` now provides:

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

Local `pnpm check` and `pnpm test` are green (two pre-existing, unrelated failures in `packages/cli` and `packages/runner-local` — a fixture git-checkout byte-reproduction test — were confirmed present on `main` before this change and are not part of M8.3). M8.3 is not recorded as merged until the pull request CI and merge gate complete. No Supabase catalog persistence, GitHub publisher/source authentication, Skill verification orchestration, MCP Registry ingestion, frontend, or 0G write behavior was added.

## M8 backend implementation sequence

1. **M8.2 / Issue #21 — complete:** pinned ARD v0.9 adapter + local catalog/search HTTP surface.
2. **M8.3 / Issue #22 — current:** GitHub Agent Finder + Hugging Face Discover federation.
3. **M8.4 / Issue #23:** existing-Supabase capability catalog/version/ingestion persistence.
4. **M8.5 / Issue #24:** GitHub App source authentication and canonical source claims.
5. **M8.6 / Issue #25:** enrich Agent Skill resources with the existing ProofRail verification pipeline.
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

Open/review the **M8.3 / Issue #22** pull request, require green CI, merge, reconcile the final merged state, and stop. Do not begin M8.4 in this context.
