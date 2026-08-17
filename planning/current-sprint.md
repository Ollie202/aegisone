# Current Sprint — M5 Judgeable Wave 3 Slice

## Primary objective

Preserve completed M1–M4 and connect them into one judgeable ProofRail flow without weakening the trust model or replacing independent reproduction with publisher-provided hash anchoring.

## M1–M4

- [x] M1 deterministic provider-independent verification kernel, local rebuild, canonical evidence, MATCH/MISMATCH, CLI JSON.
- [x] M2 real Galileo 0G Storage upload/retrieval with proof verification and exact-byte equality.
- [x] M3 minimal registry contract/client, Galileo deploy/register/read-back, gas measurement, no mainnet write.
- [x] M4 real hosted 0G Sandbox exact-commit build, artifact retrieval, provider TDX evidence, precise unsupported output-binding classification, cleanup.

## M5 — Issue #5

- [x] Source claim and assurance level are inspectable in the end-to-end flow.
- [x] Publisher artifact bytes and exact immutable commit/build recipe flow through the same core model.
- [x] Independent build routes through the proven real 0G Sandbox path.
- [x] Genuine artifact returns `MATCH` through the shared digest-comparison core.
- [x] Deterministic one-byte publisher substitution returns `MISMATCH` with unchanged reproduced bytes.
- [x] Canonical genuine evidence completes a real proof-verified exact-byte 0G Storage round trip.
- [x] Registry commitments are derived from the exact stored evidence without changing M3 semantics.
- [x] Stable CLI inspection and web view derive status from the same integrity-checked core projection.
- [x] M4 TDX evidence is surfaced as `PROVIDER_EVIDENCE_ONLY`; unsupported TEE-bound output is not implied.
- [x] Durable M5 live evidence summary and README demo/evidence instructions are in the repository.
- [x] Re-confirm current Aristotle network details and run the read-only mainnet deploy/register fee gate.
- [x] Record proposed contract address, record ID, gas limits, current fee envelope, wallet address, nonce, and balance without signing anything.
- [ ] Fund the selected Aristotle wallet; current mainnet balance is `0.0 0G`.
- [ ] Re-run the read-only gate after funding and immediately before approval.
- [ ] Obtain explicit user approval for the refreshed Aristotle mainnet write.
- [ ] Submit approved deployment + registration, record contract/transaction evidence, and verify read-back.
- [ ] Final CI green on the completed mainnet-evidence head; merge PR #10 and close Issue #5.

## Explicitly out of scope now

- automatic source discovery;
- private repositories;
- arbitrary huge repositories;
- multi-builder consensus network;
- Agentic ID/ERC-8004 integration;
- MCP server;
- 0G Compute;
- token/rewards/marketplace;
- production branding;
- any Aristotle mainnet write before wallet funding, refreshed read-only gate, and separate explicit approval.
