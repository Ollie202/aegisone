# Project State

**Last updated:** 2026-08-24  
**Phase:** M8 active — backend-first verified capability discovery; M8.1 merged, M8.2 is the current implementation gate  
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

## M8 backend implementation sequence

1. **M8.2 / Issue #21 — current:** pinned ARD v0.9 adapter + local catalog/search HTTP surface.
2. **M8.3 / Issue #22:** GitHub Agent Finder + Hugging Face Discover federation.
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

Implement **M8.2 / Issue #21 only** against the pinned ARD adapter plan. Merge with green CI, reconcile state, stop, then move to M8.3.
