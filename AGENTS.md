# AGENTS.md

This file governs AI coding-agent behavior for this repository and is authoritative when other handoff docs conflict.

## Mission

Build AegisOne as **evidence infrastructure** for software and agent capabilities.

The proven core independently reconstructs an explicitly claimed source revision, compares the result with the bytes a publisher distributes, and preserves independently checkable evidence.

M8 extends that proven engine into **trust-aware capability discovery** for humans and agents:

```text
intent -> discovery -> source assurance -> AegisOne evidence -> consumer policy -> ALLOW / REVIEW / DENY
```

AegisOne is not a generic AI auditor, not a central source of truth, and not a universal “safe” certification service.

## Mandatory startup routine

Before meaningful changes:

1. Read `PROJECT_STATE.md`.
2. Read `planning/current-sprint.md`.
3. Read `CODEX.md` or the active coding-agent handoff.
4. Read `docs/03-architecture.md` and `docs/11-trust-model.md`.
5. For M8, read `docs/13-m8-backend-blueprint.md` and the relevant detailed M8 docs.
6. Read relevant integration/security docs and all applicable ADRs.
7. Read the **single active GitHub issue** being implemented.
8. Inspect existing code before proposing a rewrite.

Do not combine multiple milestone issues into one unbounded change unless explicitly authorized.

## Non-negotiable product rules

- Never claim AegisOne automatically knows the official source.
- Source identity/assurance must be explicit: none, declared, repository-authenticated, signed, future domain/package/onchain bindings, etc. Missing identity evidence remains visible.
- A repository existing or appearing in ARD/search metadata does **not** authenticate the publisher's source claim.
- Always pin source/build/security claims to immutable commit SHAs; never use a mutable branch name as a security claim.
- The core `MATCH` / `MISMATCH` result is deterministic and must not depend on an LLM.
- `MATCH` requires a **distinct distributed/publisher artifact** compared with an independent exact-source reproduction. Do not package the same source twice and call that correspondence proof.
- Source inspection alone cannot emit `MATCH` / `MISMATCH`.
- Do not call correspondence verification “safe”, “secure code”, “malware-free”, “trusted developer”, or equivalent.
- Agent Skill deterministic security findings remain separate from correspondence.
- Search relevance/ranking is never a trust or safety score and must not enter deterministic policy evaluation.
- `INDEXED` discovery state never means AegisOne-verified.
- A new commit is a new source revision, not a broken fingerprint.
- Legitimate build divergence is `DIVERGED` / insufficient reproducibility evidence, not `MALICIOUS`.
- Missing evidence is unavailable/insufficient; never infer it to make a flow look complete.
- Do not mock a required 0G integration and present it as complete.
- Do not claim TEE output binding unless the artifact/provenance digest is actually bound to independently verifiable attestation evidence.
- Supabase is mutable application/catalog/job memory; it cannot create canonical AegisOne verdicts.
- Public discovery/read/policy routes must never implicitly trigger uncontrolled/funded 0G work.
- No automatic install/execute/sign behavior is part of M8's initial agent interface.

## Source-authentication rules

M8 source assurance is independent from correspondence.

- `NONE`: no authenticated source mapping.
- `DECLARED`: explicit mapping supplied, authority not proven.
- `REPOSITORY_AUTHENTICATED`: only after a real GitHub-authenticated identity with sufficient effective write/push or admin-equivalent authority authenticates the exact claim for the stable repository identity.
- `SIGNED_RELEASE`: only after actual cryptographic provenance/signature verification under expected artifact/repository/source/signer constraints.

A GitHub Artifact Attestation API response/listing alone does not earn `SIGNED_RELEASE`; the attestation must be cryptographically verified.

Historical authenticated claims are evidence. New mappings supersede/create new claims rather than silently rewriting the old one.

See `docs/14-source-authentication.md`.

## Architecture rules

- `packages/core` stays provider-independent.
- `packages/capability-model` stays provider-independent and ARD/GitHub/Supabase/MCP-agnostic.
- 0G-specific behavior lives behind adapters.
- ARD/discovery-provider behavior lives behind discovery adapters.
- GitHub source-auth provider details live behind a GitHub adapter rather than leaking into the provider-independent trust model.
- Source-claim authentication, source inspection, distribution correspondence, security assessment, and consumer policy are separate concerns.
- Every external integration returns explicit capability/evidence fields; unavailable evidence is `null`/unavailable, never inferred.
- Build/package execution must support hard CPU/time/disk/download/output limits before broader repository support is considered.
- Prefer one supported artifact family done well over broad best-effort arbitrary builds.
- Keep current production topology at exactly `proofrail-app` + `proofrail-worker` unless explicit approval and an ADR justify another permanent service.
- Extend the existing AegisOne Supabase project; do not create a parallel project/database for M8.
- Browser/frontend clients consume AegisOne APIs rather than becoming direct proof authorities over raw Supabase rows.

## Expected M8 areas

Existing/proven:

- `packages/core` — source claims, canonical manifests, hashing, correspondence, core validation.
- `packages/capability-model` — M8 resource/evidence/policy abstraction.
- `packages/skill-audit` — deterministic Agent Skill package/format/security analysis.
- `packages/job-store` — mutable job lifecycle/pointers.
- `packages/runner-local` — deterministic local runner.
- `packages/sandbox-0g` — 0G independent-execution adapter.
- `packages/storage-0g` — evidence storage adapter.
- `packages/registry-0g` — 0G Chain registry client.
- `contracts` — compact commitment registry.
- `apps/web` / `proofrail-app` — public HTTP runtime/UI.
- `apps/worker` / `proofrail-worker` — secret-bearing internal execution boundary.

Planned M8 package boundaries, create only when their issue requires them:

- `packages/discovery-ard` — pinned ARD catalog/search adapter.
- `packages/discovery-providers` — GitHub Agent Finder / Hugging Face adapters.
- `packages/catalog-store` — Supabase capability/catalog/source-claim persistence abstraction.
- `packages/source-auth-github` — GitHub App/source-authority adapter.
- `packages/mcp-aegisone` — thin MCP transport adapter.

Do not mechanically create empty packages early; use the issue acceptance criteria and current code layout.

## M8 issue order / stop rule

Current sequence is documented in `CODEX.md` and Issue #18:

- #21 M8.2 ARD adapter
- #22 M8.3 federated discovery
- #23 M8.4 Supabase catalog
- #24 M8.5 source authentication
- #25 M8.6 Agent Skill verification enrichment
- #26 M8.7 stable API/policy
- #27 M8.8 MCP interface
- #28 M8.9 substitution vertical slice
- #29 M8.10 MCP Registry stretch
- #30 M8.11 backend freeze
- #31 M9 frontend only after backend freeze

For each issue: implement, test, PR, green CI, reconcile state, merge, **stop**. Start the next issue from updated `main` in a fresh context.

## External integration discipline

M8 external contract pins/endpoints are recorded in `docs/15-m8-api-inventory.md`.

Do not silently switch an implementation from a recorded immutable upstream pin to `main`. If upstream evolution forces a pin change:

1. inspect official current docs/repo;
2. explain the incompatibility/reason in the PR;
3. update fixtures/tests/docs together;
4. preserve provider-independent contracts where possible.

Live network calls are separate smoke/integration evidence; unit/CI tests should use deterministic fixtures by default.

## Security / ingestion rules

Follow `docs/17-m8-security-boundaries.md`.

At minimum:

- fixed allowlisted upstream origins for discovery providers;
- SSRF prevention for any required arbitrary distribution fetch;
- redirect re-validation;
- request/download/response/time/file-count/decompression limits;
- safe archive path handling;
- no user-controlled shell interpolation;
- OAuth state/replay protection;
- no OAuth/client/0G secret logging;
- no long-term plaintext user token persistence by default;
- no public generic worker execution/signing route;
- no DB/provider metadata trust escalation;
- MCP read/policy tools only in M8.

## Preferred stack

- TypeScript / Node.js 22
- pnpm workspace
- ethers v6 where 0G SDK interoperability requires it
- Solidity + Hardhat for the existing registry
- SHA-256 for user-facing artifact/source-claim digests
- deterministic/canonical JSON representation for evidence/source claims
- PostgreSQL/Supabase for mutable catalog state

No runtime OpenAI/Anthropic API, embeddings API, paid vector database, or additional permanent Railway service is required for M8.

Create an ADR before materially changing the stack, trust model, or permanent production topology.

## Definition of done

A feature/issue is done only when:

- behavior maps to the issue's explicit acceptance criteria;
- tests cover success and relevant failure/malformed/trust-escalation paths;
- evidence labels match the actual observed guarantee;
- resource/security implications are handled;
- documentation reflects implementation reality;
- `PROJECT_STATE.md`/current sprint are updated only when project truth changes;
- real integration/deployment evidence is recorded when that issue requires it;
- repository-wide checks/CI are green;
- the issue is merged before proceeding to the next gate.

If a capability cannot be proven, label it unavailable/insufficient rather than inferring or marketing around the gap.

## Cost discipline

No paid API, large compute service, arbitrary live verification spend, or mainnet transaction without explicit approval.

Search/discovery should be cheap/read-only. Expensive independent verification is an explicit controlled job, not something triggered for every result.

Huge/unsupported builds or packages must fail cleanly rather than silently consuming unbounded resources.
