# Current Sprint — M5 Judgeable Wave 3 Slice

## Primary objective

Preserve completed M1–M4 and connect them into one judgeable ProofRail flow without weakening the trust model or replacing independent reproduction with publisher-provided hash anchoring.

## M1 complete

- [x] Deterministic `hello-proofrail` fixture and publisher artifact.
- [x] Explicit source/release claim structures and immutable Git revision.
- [x] SHA-256, canonical evidence, independent local rebuild, `MATCH` and one-byte `MISMATCH`.
- [x] Stable provider-independent core and CLI JSON shape.

## M2 complete

- [x] Pinned official 0G Storage SDK adapter.
- [x] Real Galileo upload/download with retrieval proof verification.
- [x] Exact uploaded/downloaded byte equality and durable evidence ledger entry.

## M3 complete

- [x] Minimal append-only registry contract and typed client.
- [x] Local contract/client tests.
- [x] Real Galileo deploy, register, and exact read-back.
- [x] Gas/cost measurement with Aristotle queried read-only only.
- [x] No mainnet transaction.

## M4 complete

- [x] Reconfirmed the live hosted 0G Sandbox/Tapp API and provider surface.
- [x] Created/accessed a real sandbox programmatically.
- [x] Toolbox-cloned exact public commit `e9c82277cef2f7630977e2473664e14eed2f860d` and independently verified detached `.git/HEAD`.
- [x] Ran the committed Node.js build under sandbox Node `v22.14.0`.
- [x] Retrieved the built 53-byte artifact and matched SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154` exactly.
- [x] Captured live TappRegistry node identity/code hashes and real TDX quote evidence.
- [x] Tested artifact-digest challenge binding against the live TDX quote.
- [x] Classified provider TDX evidence as `PROVEN`, live artifact-digest challenge binding as `NOT AVAILABLE`, and artifact computation inside the TEE as `NOT AVAILABLE` on the public toolbox flow.
- [x] Measured authoritative on-chain Sandbox fee/resource terms and observed testnet-token balance deltas.
- [x] Updated architecture, trust model, threat model, budget, evidence ledger, and ADR language to match only what M4 proves.
- [x] Deleted the successful sandbox and returned Railway to read-only inspection mode.

## M5 active tasks — Issue #5

- [ ] Make the source claim and assurance level inspectable in the end-to-end flow.
- [ ] Feed the publisher artifact bytes and exact immutable commit/build recipe through the same core model.
- [ ] Route the independent build through the proven real 0G Sandbox path.
- [ ] Return `MATCH` for the genuine artifact using the same digest comparison core.
- [ ] Return `MISMATCH` for a one-byte/substituted artifact.
- [ ] Package the resulting canonical evidence and pass it through real 0G Storage.
- [ ] Connect the registry commitment path without changing its M3 semantics.
- [ ] Expose one stable CLI/JSON result and a web view derived from the same core checks.
- [ ] Surface M4 TDX evidence as provider/runtime evidence only; do not imply TEE-bound output.
- [ ] Add reproducible README/demo instructions and evidence links.
- [ ] Re-run the pre-mainnet gate before any Aristotle action; obtain explicit approval before any mainnet transaction.

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
- any Aristotle mainnet write before the separate pre-mainnet gate and explicit approval.
