# Current Sprint — M5 Judgeable Wave 3 Slice

## Primary objective

Preserve completed M1–M4 and connect them into one judgeable ProofRail flow without weakening the trust model or replacing independent reproduction with publisher-provided hash anchoring.

## M1–M4

- [x] M1 deterministic provider-independent verification kernel, local rebuild, canonical evidence, MATCH/MISMATCH, CLI JSON.
- [x] M2 real Galileo 0G Storage upload/retrieval with proof verification and exact-byte equality.
- [x] M3 minimal registry contract/client, Galileo deploy/register/read-back, gas measurement.
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
- [x] Re-confirm Aristotle network details and run read-only mainnet deploy/register fee gates.
- [x] Fund the selected Aristotle wallet and refresh balance/nonce/fee state.
- [x] Obtain explicit user approval for exactly two Aristotle transactions under a `0.002246628007863198 0G` combined fee cap.
- [x] Deploy `ProofRailRegistry` at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`.
- [x] Register M5 evidence record `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`.
- [x] Independently verify deployment receipt, registration event, exact contract read-back, submitter, and actual fees without access to the signer secret.
- [x] Record durable final Aristotle evidence in `hackathon/m5-aristotle-mainnet.json`.
- [ ] Final CI green on the completed mainnet-evidence head.
- [ ] Mark PR #10 ready, merge it, and confirm Issue #5 closes.

## Final Aristotle evidence

- deployment tx: `0x7a23a2564784252647505f21b714280d20d5c209785ff4a67c878e3bc684582c`;
- registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`;
- actual combined fee: `0.001843856003226748 0G`;
- independent verification: GitHub Actions run `32068243865`, job `95506685727`, status `VERIFIED`.

## Explicitly out of scope now

- automatic source discovery;
- private repositories;
- arbitrary huge repositories;
- multi-builder consensus network;
- Agentic ID/ERC-8004 integration;
- MCP server;
- 0G Compute;
- token/rewards/marketplace;
- production branding.
