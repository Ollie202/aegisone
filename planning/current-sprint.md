# Current Sprint — M4 Sandbox / Tapp Execution Proof

## Primary objective

Preserve the completed M1 independent-reproduction kernel, M2 real Storage round trip, and M3 Galileo registry proof while testing the highest-risk Wave 3 assumption: whether the accessible 0G Sandbox/Tapp path can perform the real build and expose defensible attestation evidence.

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

## M3 complete

- [x] Define the minimal registry commitment fields/events from the existing evidence model.
- [x] Implement `contracts/src/ProofRailRegistry.sol`.
- [x] Add local contract tests for valid registration/read behavior.
- [x] Test invalid/empty inputs and duplicate semantics.
- [x] Add typed `packages/registry-0g` client/adapter.
- [x] Dry-run deployment and register/read flow on 0G Galileo Testnet.
- [x] Measure expected mainnet deployment and registration cost.
- [x] Keep Aristotle mainnet untouched; no mainnet transaction was sent during M3.

## M4 active tasks

- [ ] Reconfirm the current official 0G Sandbox/Tapp usage and SDK/API path.
- [ ] Create/access a sandbox programmatically.
- [ ] Clone an exact public repository commit.
- [ ] Run a constrained Node.js build.
- [ ] Retrieve the built artifact bytes.
- [ ] Capture every available sandbox/TEE attestation evidence field.
- [ ] Test direct artifact/provenance-digest binding into attestation report data.
- [ ] Classify output binding as PROVEN, NOT AVAILABLE, or BLOCKED with evidence.
- [ ] Measure and record Sandbox resource/cost characteristics.
- [ ] Update architecture/trust/threat-model language to match only what M4 proves.

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
- production branding;
- Aristotle mainnet deployment unless the separate pre-mainnet gate is later satisfied and explicitly approved.
