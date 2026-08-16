# AGENTS.md

This file governs AI coding-agent behavior for this repository.

## Mission

Build a minimal, testable software-release verification system that independently rebuilds an explicitly claimed source revision and compares the resulting artifact with the bytes a publisher distributes.

The core product is **evidence infrastructure**, not an AI auditor and not a central source of truth.

## Mandatory startup routine

Before meaningful changes:

1. Read `PROJECT_STATE.md`.
2. Read `planning/current-sprint.md`.
3. Read `docs/01-prd.md`, `docs/03-architecture.md`, and `docs/11-trust-model.md`.
4. Read relevant integration/security docs and all applicable ADRs.
5. Inspect existing code before proposing a rewrite.

## Non-negotiable product rules

- Never claim ProofRail knows the official source automatically.
- Source identity must be explicit: publisher-declared, repository-authenticated, domain-bound, signed, etc. Missing identity evidence must remain visible.
- Always pin builds to immutable commit SHAs; never use a mutable branch name as a security claim.
- The core MATCH/MISMATCH result is deterministic and must not depend on an LLM.
- Do not call correspondence verification "safe", "secure code", "malware-free", or equivalent.
- A new commit is a new source revision, not a broken fingerprint.
- A legitimate build divergence is `NOT REPRODUCIBLE` / `DIVERGED`, not `MALICIOUS`.
- Do not mock a required 0G integration and present it as complete.
- Do not claim TEE output binding unless the artifact/provenance digest is actually bound to verifiable attestation evidence.
- Wave 3 must demonstrate a publisher artifact compared against an **independent rebuild**, not merely register a publisher-provided hash.

## Architecture rules

- `packages/core` stays provider-independent.
- 0G-specific behavior lives behind adapters.
- Source-claim verification and build-correspondence verification are separate concerns.
- Every external integration returns explicit capability/evidence fields; unavailable evidence is `null`/unavailable, never inferred.
- Build execution must support hard CPU/time/disk/output limits before arbitrary repository support is considered.
- Prefer one supported build family done well over broad best-effort arbitrary repositories.

Expected areas:

- `packages/core` — source claims, canonical manifests, hashing, reproduction comparison, trust-policy primitives.
- `packages/cli` — human/agent CLI and stable JSON output.
- `packages/runner-local` — deterministic local runner.
- `packages/runner-0g` — 0G Sandbox/Tapp adapter.
- `packages/storage-0g` — evidence storage adapter.
- `packages/registry-0g` — 0G Chain registry client.
- `contracts` — minimal commitment registry.
- `apps/web` — human-readable evidence viewer.

## Wave 3 interfaces

CLI/JSON first. REST/SDK/MCP are later interface layers unless the vertical slice is already stable. Agents can consume deterministic JSON without an MCP server.

## Preferred stack

- TypeScript / Node.js 22
- pnpm workspace
- ethers v6 where 0G SDK interoperability requires it
- Solidity + Hardhat for the initial registry contract
- SHA-256 for user-facing artifact digests
- deterministic/canonical JSON representation for provenance records

Create an ADR before materially changing the stack or trust model.

## Definition of done

A feature is done only when:

- behavior maps to an explicit requirement;
- tests cover success and failure paths;
- evidence labels match the actual guarantee;
- resource/security implications are handled;
- documentation reflects implementation reality;
- `PROJECT_STATE.md` is updated when project truth changes;
- real integration/deployment evidence is added to `hackathon/evidence.md`.

## External information discipline

0G APIs and SDKs evolve. Check current official documentation or official repositories before implementation. Record durable findings in `research/research-log.md`.

## Cost discipline

No paid API, large compute service, or mainnet spend without explicit approval. Huge/unsupported builds must fail cleanly rather than silently consuming unbounded resources.
