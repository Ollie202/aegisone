# Project State

**Last updated:** 2026-08-16  
**Phase:** M1 — technical feasibility spike  
**Product name:** ProofRail *(working name only)*

## What is true now

- The GitHub repository is initialized with the project operating foundation, Wave 3 scope, architecture, security model, roadmap, risks, budget controls, research, hackathon evidence system, and coding-agent rules.
- Foundation completion commit: `f7d1d9a010c8067b7a719fe97d1042c00a611ff4`.
- 0G Chain, Storage, and confidential execution are intended as core integrations rather than decorative additions.
- The repository is currently private; it must be made public before hackathon submission/public evidence review.
- No production implementation exists yet.
- No smart contract has been deployed yet.
- No 0G Storage upload has been produced yet.
- No 0G Sandbox build has been proven yet.
- No artifact-level TEE attestation binding has been proven yet.

## Current blockers / unknowns

1. **Repository visibility:** the repository must be made public before submission.
2. **Brand collision:** an active unrelated `ProofRail` project exists; final naming must be revisited before serious public brand commitment.
3. **0G Sandbox execution:** confirm the exact programmatic flow for creating a sandbox, running a build, and retrieving the built artifact.
4. **TEE artifact binding:** confirm whether the available 0G Sandbox/Tapp consumer path can bind our provenance/artifact digest directly into attestation report data.
5. **Mainnet funding:** a small funded 0G mainnet wallet will be required for contract deployment/registrations. Do not fund until the local/testnet path works.

## Current objective

Complete the technical feasibility milestones before polished frontend work:

- M1: local build -> digest -> canonical manifest -> verify;
- M2: 0G Storage upload/download/proof round trip;
- M3: minimal registry contract local/test deployment path;
- M4: 0G Sandbox build/retrieval + exact attestation capability assessment.

## Wave 3 success signal

A judge can watch a real repository get built, inspect real 0G evidence, verify the genuine artifact, then see a modified artifact fail verification deterministically.
