# Current Sprint — M8 Verified Capability Discovery

## Primary objective

Extend the proven M1–M7 verification engine into a trust-aware capability discovery hub for humans and agents without weakening ProofRail's existing evidence model.

The target flow is:

```text
intent -> capability discovery -> ProofRail evidence -> consumer trust policy -> ALLOW / REVIEW / DENY
```

Issue #18 is the M8 master plan. Issue #19 / branch `agent/m8-capability-model` is the active M8.1 gate.

## Proven foundation — unchanged

- [x] M1–M7 implemented, live-proven, and merged.
- [x] Agent Skill deterministic packaging, source correspondence, and separate security audit proven.
- [x] Real 0G Sandbox reproduction proven.
- [x] Proof-verified 0G Storage exact-byte evidence proven.
- [x] M5 software verification anchored/read back on Aristotle mainnet.
- [x] M7 Agent Skill commitments registered/read back on Galileo.
- [x] Production remains exactly `proofrail-app` + `proofrail-worker`.
- [x] Worker signer boundary remains controlled; public signing disabled.

## M8 scope

M8 makes discovery and policy first-class while preserving the existing trust boundary.

- Agent Skills: fully supported ProofRail verification target.
- MCP servers: discovery/indexing may be added after the Skill vertical slice; `INDEXED` must not imply ProofRail verification.
- A2A agents/APIs: model-ready, implementation is stretch scope only after the core demo works.
- ARD: adapter only; do not couple the provider-independent core to an evolving draft specification.
- Supabase: mutable catalog/job index only; cannot invent proof.
- No paid runtime LLM, embedding API, vector database, creator marketplace, auto-install, or new mainnet write is required.

## Active gate — M8.1 capability/evidence/policy model

- [x] M8 master plan created as Issue #18.
- [x] M8.1 created as Issue #19.
- [x] `@proofrail/capability-model` package started.
- [x] resource kinds distinguish Agent Skills, MCP servers, A2A agents, and APIs.
- [x] discovery metadata is structurally separate from trust evidence.
- [x] source inspection is distinct from distribution correspondence.
- [x] `MATCH` / `MISMATCH` require distinct distributed + independently reproduced digests.
- [x] deterministic `ALLOW` / `REVIEW` / `DENY` policy evaluator added.
- [x] policy ignores discovery relevance and fails required missing evidence closed/review.
- [x] ADR-010 records the separation.
- [ ] run M8.1 package tests and complete repository test suite.
- [ ] open M8.1 PR and merge only if CI is green.

## Next gates after M8.1

1. M8.2 — pinned ARD discovery adapter and `POST /search`.
2. M8.3 — real federated discovery sources with caching/failure isolation.
3. M8.4 — Supabase catalog persistence.
4. M8.5 — enrich Agent Skill resources with the existing ProofRail verification pipeline.
5. M8.6 — human Hub + Evidence Passport.
6. M8.7 — deterministic trust-policy API.
7. M8.8 — Claude/MCP agent interface.
8. M8.9 — real controlled substitution winner demo.
9. M8.10 — MCP Registry indexing only after the core vertical slice works.
10. M8.11 — final security/docs/demo/submission polish.

## Submission closure still pending

The previous technical submission packet remains complete, but user-authenticated/media actions remain separately pending: final recording, current AKINDO form confirmation, demo/social URL, and authenticated submission.

## Safety boundary

- No M7 Aristotle mainnet write is authorized or needed.
- Any future mainnet write still requires a fresh read-only preflight and separate explicit approval.
- No public verification route may expose the wallet/signer or permit unbounded 0G spend.
- Do not label discovered/indexed resources as verified unless canonical ProofRail evidence supports that claim.
