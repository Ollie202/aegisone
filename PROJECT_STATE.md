# Project State

**Last updated:** 2026-08-16  
**Phase:** M0 — project foundation  
**Product name:** ProofRail *(working name only)*

## What is true now

- Product problem and long-term direction are defined.
- Wave 3 scope is frozen at a high level.
- 0G Chain, Storage, and confidential execution are intended as core integrations rather than decorative additions.
- GitHub repository `Ollie202/proofrail-0g` now exists and is being initialized with the project foundation.
- The repository is currently private; it must be made public before hackathon submission.
- No production implementation exists yet.
- No smart contract has been deployed yet.
- No 0G Storage upload has been produced yet.
- No 0G Sandbox build has been proven yet.
- No artifact-level TEE attestation binding has been proven yet.

## Current blockers / unknowns

1. **Repository visibility:** the repository is currently private and must be made public before the submission/public-evidence phase.
2. **Brand collision:** an active unrelated `ProofRail` project exists; final naming must be revisited before public brand commitment.
3. **0G Sandbox execution:** confirm the exact programmatic flow for creating a sandbox, running a build, and retrieving the built artifact.
4. **TEE artifact binding:** confirm whether the available 0G Sandbox/Tapp consumer path can bind our provenance/artifact digest directly into attestation report data.
5. **Mainnet funding:** a small funded 0G mainnet wallet will be required for contract deployment/registrations. Do not fund until the testnet/local path works.

## Immediate next objective

Complete M1/M2 technical spikes before any polished frontend work:

- local build -> digest -> verify;
- 0G Storage upload/download/proof round trip;
- minimal registry deployment test;
- 0G Sandbox build/retrieval test.

## Wave 3 success signal

A judge can watch a real repository get built, see provenance stored and anchored using real 0G integrations, verify the genuine artifact, then see a modified artifact fail verification.
