# Current Sprint — M3 Registry Contract + Infrastructure Feasibility

## Primary objective

Preserve the completed M1 independent-reproduction kernel and completed M2 real Storage round trip while proving the minimal on-chain registry path before any mainnet spend.

## M1 complete

- [x] Create `hello-proofrail` deterministic fixture.
- [x] Produce a known fixture artifact representing the publisher's release.
- [x] Define minimal `ReleaseClaim` / `SourceRef` structures.
- [x] Pin and independently check out a real, deterministic immutable Git commit.
- [x] Implement SHA-256 helper and known-vector tests.
- [x] Implement byte-stable canonical manifest/comparison representation.
- [x] Independently rebuild the fixture locally in a separate checkout.
- [x] Compare publisher artifact digest with reproduced artifact digest.
- [x] Genuine artifact returns `MATCH`.
- [x] One-byte/substitution mutation returns `MISMATCH`.
- [x] Stable versioned JSON result shape exists in core and CLI.
- [x] No 0G, LLM, or third-party runtime dependency entered `packages/core`.

## M2 complete

- [x] Reconfirm the current official 0G Storage TypeScript SDK and Galileo test environment.
- [x] Pin `@0gfoundation/0g-storage-ts-sdk@1.2.9` and `ethers@6.13.1` in `packages/storage-0g` only.
- [x] Implement real SDK upload/download adapter and proof-enabled round-trip command.
- [x] Add deterministic structured-error, receipt, wrong-network, byte-mismatch, and private-key validation tests.
- [x] Upload canonical M1 provenance bytes using a minimally funded test wallet.
- [x] Record root and upload transaction evidence in `hackathon/evidence.md`.
- [x] Retrieve identical bytes with proof verification enabled.
- [x] Confirm exact uploaded/downloaded byte equality and matching SHA-256.
- [x] Record durable SDK/live findings in `research/research-log.md` and `docs/06-integrations.md`.

## M3 active tasks

- [ ] Define the minimal registry commitment fields/events from the existing evidence model.
- [ ] Implement `contracts/ProofRailRegistry.sol`.
- [ ] Add local contract tests for valid registration/read behavior.
- [ ] Test invalid/empty inputs and duplicate semantics.
- [ ] Add typed `packages/registry-0g` client/adapter.
- [ ] Dry-run deployment and register/read flow on a non-mainnet 0G environment.
- [ ] Measure expected mainnet deployment and registration cost.
- [ ] Recheck `docs/09-deployment-runbook.md` pre-mainnet gate; do not deploy mainnet during M3 unless that gate is explicitly satisfied and approved.

## Following technical spikes

- [ ] Prove 0G Sandbox programmatic exact-commit build/retrieval path.
- [ ] Determine exact Tapp/TEE evidence available.
- [ ] Determine whether artifact/provenance digest can be bound to attestation report data.
- [ ] Measure resource/cost characteristics for the supported demo build.
- [ ] Update architecture/threat model based on real findings.

## Explicitly out of scope now

- polished frontend;
- accounts/authentication;
- automatic source discovery;
- private repositories;
- arbitrary huge repositories;
- multi-builder network;
- Agentic ID/ERC-8004 integration;
- MCP server;
- 0G Compute;
- token/rewards/marketplace;
- production branding.
