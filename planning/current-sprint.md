# Current Sprint — M2 Storage + Infrastructure Feasibility

## Primary objective

Preserve the completed local independent-reproduction kernel while proving the first real 0G evidence round trip.

## M1 tasks

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

## M2 active tasks

- [x] Reconfirm the current official 0G Storage TypeScript SDK and Galileo test environment.
- [x] Pin `@0gfoundation/0g-storage-ts-sdk@1.2.9` and `ethers@6.13.1` in `packages/storage-0g` only.
- [x] Implement real SDK upload/download adapter and proof-enabled round-trip command.
- [x] Add deterministic structured-error, receipt, wrong-network, and byte-mismatch tests.
- [ ] Upload canonical M1 provenance bytes using a minimally funded test wallet.
- [ ] Record root and upload transaction evidence in `hackathon/evidence.md`.
- [ ] Retrieve identical bytes with proof verification where the SDK supports it.
- [ ] Test deterministic failure for missing/incorrect data.
- [ ] Record durable SDK findings in `research/research-log.md` and `docs/06-integrations.md`.

## Following technical spikes

- [ ] Scaffold/test minimal registry locally and dry-run non-mainnet deployment.
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
