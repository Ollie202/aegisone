# AGENTS.md

This file governs AI coding-agent behavior for this repository.

## Mission

Build a trustworthy, minimal, testable software-artifact provenance and independent-rebuild system. The first release targets the 0G Bridge Buildathon while preserving a provider-independent core that can continue after the competition.

## Mandatory startup routine

Before meaningful code changes:

1. Read `PROJECT_STATE.md`.
2. Read `planning/current-sprint.md`.
3. Read the relevant PRD/requirements/architecture/integration/security docs.
4. Read all applicable ADRs under `docs/decisions/`.
5. Inspect the existing code before proposing a rewrite.

## Non-negotiable engineering rules

- Do not invent security guarantees.
- Do not claim TEE output binding unless the produced artifact digest is actually bound to verifiable attestation evidence.
- Do not call an artifact "safe" merely because it is verified.
- Do not mock a required 0G integration and present it as complete.
- Keep `packages/core` provider-independent.
- Put 0G-specific behavior behind adapters.
- Prefer a narrow working vertical slice over broad incomplete features.
- No token, staking, marketplace, reputation system, multi-chain support, or AI chatbot in Wave 3 unless the core acceptance criteria are already complete.
- No paid infrastructure or paid API may be added without explicit approval.
- Never commit private keys, seed phrases, API keys, RPC credentials, or secrets.

## Working architecture

Expected implementation areas:

- `packages/core` — canonical manifest, hashing, verification, trust-policy primitives.
- `packages/cli` — developer CLI.
- `packages/runner-local` — deterministic local runner for development/tests.
- `packages/runner-0g` — 0G Sandbox/Tapp execution adapter.
- `packages/storage-0g` — 0G Storage provenance adapter.
- `packages/registry-0g` — 0G Chain registry client.
- `contracts` — minimal Solidity registry.
- `apps/web` — public verification interface.

Do not collapse these boundaries merely to save a few files.

## Preferred stack for Wave 3

- TypeScript / Node.js 22
- pnpm workspace
- ethers v6 where 0G SDK interoperability requires it
- Solidity + Hardhat for the initial registry contract
- SHA-256 for user-facing artifact digests
- JSON with deterministic/canonical serialization for provenance records

If a tool/library change would materially alter this stack, create an ADR first.

## Definition of done for a feature

A feature is done only when:

- behavior matches an explicit requirement;
- relevant tests pass;
- failure paths are handled;
- security implications have been considered;
- documentation reflects the implementation;
- `PROJECT_STATE.md` is updated if project reality changed.

## External information discipline

0G APIs/SDKs are evolving. Do not rely on remembered endpoints or package behavior. Check current official 0G documentation or official 0G GitHub repositories before implementation and record meaningful findings in `research/research-log.md`.

## Git discipline

- Keep commits focused and descriptive.
- Do not combine unrelated architectural changes.
- Preserve public evidence of meaningful progress for the Buildathon.
- Avoid generated/binary build output in Git unless it is an intentional small fixture under `examples/`.

## Documentation discipline

Update:

- `PROJECT_STATE.md` when current truth changes.
- `planning/current-sprint.md` as tasks are completed/blocked.
- `hackathon/evidence.md` when a real integration, deployment, transaction, or demo proof is created.
- an ADR when a durable architectural decision changes.
