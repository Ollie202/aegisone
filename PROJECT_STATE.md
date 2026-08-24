# Project State

**Last updated:** 2026-08-24  
**Phase:** M8 active — verified capability discovery; M8.1 capability/evidence/policy model is the current merge gate  
**Product name:** ProofRail

## Current product thesis

ProofRail is evolving from a proof-first software/Agent Skill verifier into a **trust-aware discovery layer for agent capabilities**.

The intended M8 flow is:

> **intent → capability discovery → ProofRail evidence → consumer trust policy → ALLOW / REVIEW / DENY**

The original trust boundary remains unchanged:

> **publisher/distributed artifact vs independent reproduction — verified from canonical evidence, not from mutable application state**

Discovery adds a new question — *what resource might help?* — but does not change the existing verification questions. Search relevance, source assurance, correspondence, security findings, canonical evidence, and consumer policy remain separate dimensions.

## Proven foundation — M1–M7

- M1–M7 are complete and merged.
- Agent Skill verification/auditing is live-proven on 0G Galileo with durable evidence in `hackathon/m7-live-evidence.json`.
- Real 0G Sandbox independent execution, proof-verified 0G Storage, Galileo registry readback, and the M5 Aristotle mainnet anchor are proven.
- M4/M7 TDX evidence remains honestly classified as provider/runtime evidence only: the live legacy Tapp quote does not bind the artifact digest and does not prove the final artifact was computed inside the TEE.
- For Agent Skills, correspondence and deterministic security findings remain independent. `MATCH` never means safe.

## Stable production topology

```text
Supabase         = mutable app/job memory and future catalog index
proofrail-app    = proof-first API/UI and future Hub discovery surface
proofrail-worker = controlled secret-bearing worker, standby by default
0G Sandbox       = independent execution/reproduction
0G Storage       = durable canonical evidence
0G registry      = compact immutable commitments
```

Production intentionally remains exactly `proofrail-app` + `proofrail-worker`, both tracking `main`. Supabase is not a proof authority and must not be able to invent MATCH/MISMATCH or other canonical evidence.

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

Issue #18 defines the M8 master plan.

M8 is intentionally narrower than a universal agent marketplace:

- **Agent Skills:** full ProofRail verification target using the existing M7 engine.
- **MCP servers:** may be indexed/discovered after the Skill vertical slice; indexing alone is not verification.
- **A2A agents / APIs:** represented in the provider-independent model; implementation remains stretch scope until the core demo works.
- **ARD:** discovery adapter only. The provider-independent trust model must not depend on an evolving draft protocol.
- **Trust policy:** deterministic consumer-side evaluation, not an LLM safety score.

No paid runtime LLM/API, vector database, custom embeddings service, creator payments, auto-install, new Railway microservice, or new mainnet write is required for M8.

## M8.1 — capability/evidence/policy model

Issue #19 / PR #20 is the first M8 gate.

Implemented on `agent/m8-capability-model`:

- provider-independent `@proofrail/capability-model` package;
- resource kinds for Agent Skills, MCP servers, A2A agents, and APIs;
- mutable discovery/relevance metadata separated from ProofRail trust evidence;
- exact source inspection separated from distribution correspondence;
- validation that prevents source-only inspection from claiming `MATCH`/`MISMATCH`;
- `MATCH`/`MISMATCH` require a distinct distributed artifact plus independently reproduced digest;
- independent source-assurance, audit, canonical-evidence, and freshness dimensions;
- deterministic `ALLOW` / `REVIEW` / `DENY` consumer policy evaluation;
- missing required evidence fails closed or requires review according to explicit policy;
- search relevance has no path into policy evaluation;
- ADR-010 records the boundary.

GitHub Actions CI #163 passed on the pre-state-reconciliation M8.1 head. The final documentation head must pass CI again before merge.

## M8 sequence after M8.1

1. M8.2 — pinned ARD adapter + catalog/search HTTP surface.
2. M8.3 — real federated discovery source adapters with caching and failure isolation.
3. M8.4 — Supabase catalog persistence while preserving proof authority outside mutable DB state.
4. M8.5 — enrich Agent Skill resources with existing ProofRail verification evidence.
5. M8.6 — human Hub + Evidence Passport UI.
6. M8.7 — deterministic trust-policy API.
7. M8.8 — Claude/MCP agent interface.
8. M8.9 — controlled genuine-vs-substituted distribution demo with real 0G evidence.
9. M8.10 — MCP Registry indexing only after the core vertical slice works.
10. M8.11 — security/docs/demo/submission polish.

## Mainnet safety state

The existing M5 Aristotle registry remains the only completed ProofRail mainnet anchor. M7 commitments remain `PREPARED_NOT_SUBMITTED`.

No M8 mainnet transaction is required. Any future mainnet write requires a fresh read-only preflight and separate explicit approval.

## Submission state

The previous technical submission packet remains complete. Final user-authenticated/media actions still include recording the final demo, confirming the current AKINDO form/deadline, adding the demo/social URL, submitting, and confirming the entry appears.

M8 engineering must improve the judgeable product without invalidating the already-proven M1–M7 evidence.

## Current next action

Finish the M8.1 merge gate, then start M8.2. Do not begin discovery adapters before the capability/evidence/policy model is merged and green.
