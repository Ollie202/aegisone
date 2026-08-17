# Research Log

## 2026-08-17 — 0G Storage live completion

**Live finding:** The M2 adapter completed a real canonical-evidence upload and proof-enabled retrieval on 0G Galileo Testnet from Railway using source commit `d1b340fb2b7636e5b10b5c0720b1c59a07a7e89e`.

**Observed evidence:** chain ID `16602`; root `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`; upload transaction `0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd`; storage sequence `147010`; payload size `1792` bytes. Uploaded and downloaded SHA-256 were both `f922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`. The runner reported `proofVerificationRequested=true`, `proofVerified=true`, and `bytesMatch=true`.

**Impact:** The 0G Storage dependency is now proven for the Wave 3 evidence path rather than merely mocked or unit-tested. The implementation can upload canonical provenance, preserve root/transaction identifiers, retrieve with SDK proof verification, and require exact byte equality. M2 is complete; subsequent milestones should consume the Storage root as evidence rather than redesign this adapter.

**References:**
- https://build.0g.ai/chain
- https://chainscan-galileo.0g.ai/tx/0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd
- https://scan-devnet.0g.ai/submission/147010

---

## 2026-08-16 — 0G Storage SDK

**Finding:** Official documentation exposes TypeScript/Go SDK paths. TypeScript supports file and in-memory uploads, Merkle root calculation, downloads, and proof-enabled retrieval. Current documented package: `@0gfoundation/0g-storage-ts-sdk` with `ethers` peer dependency.

**Version check:** The official repository's current `package.json` is `@0gfoundation/0g-storage-ts-sdk@1.2.9` and declares the exact peer `ethers@6.13.1`. The repository has no GitHub “latest release” object, so M2 should pin the package version rather than infer stability from a release tag.

**Current Galileo path:** Official examples use EVM RPC `https://evmrpc-testnet.0g.ai` and turbo indexer `https://indexer-storage-testnet-turbo.0g.ai`. `Indexer.upload` requires an ethers signer with enough test balance to pay storage/gas fees. `Indexer.download(root, output, true)` requests proof-enabled retrieval.

**Implementation recheck:** Galileo remains chain ID `16602`; the official faucet currently offers up to `0.1 0G` per wallet per day. The TypeScript SDK source confirms `downloadToBlob(root, { proof: true })` passes proof verification into the downloader, and `Indexer.upload` returns root hash, transaction hash, and transaction sequence for a single small payload. `packages/storage-0g` checks all three and refuses a receipt whose returned root differs from the locally calculated Merkle root.

**Impact:** The SDK path and failure model were established here; the live completion and resulting evidence are recorded in the 2026-08-17 entry above.

**Sources:**
- https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
- https://github.com/0gfoundation/0g-storage-ts-sdk

---

## 2026-08-16 — 0G Chain

**Finding:** 0G Chain is EVM-compatible and supports common Solidity tooling. Official ecosystem references list Aristotle mainnet chain ID 16661.

**Impact:** Minimal Solidity registry is feasible without introducing a new contract language/toolchain.

**Sources:**
- https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts
- https://github.com/0gfoundation/awesome-0g

---

## 2026-08-16 — 0G Sandbox/Tapp

**Finding:** 0G Sandbox is an active 2026 repository/service. 0G Tapp uses TDX remote attestation, and 0G technical material says report data can be embedded in attestation quotes.

**Open question:** Whether the accessible consumer Sandbox flow permits our artifact/provenance digest to be bound directly into the quote and retrieved in a clean programmatic flow.

**Impact:** This is a critical technical spike. Do not design security copy around a stronger guarantee until proven.

**Sources:**
- https://github.com/0gfoundation/0g-sandbox
- https://0g.ai/blog/0g-tapp-tee-security-without-ssh
- https://0g.ai/blog/tech-update-nov-2025

---

## 2026-08-16 — Product prior art

**Finding:** GitHub Artifact Attestations, Sigstore, SLSA, Reproducible Builds, and TEE-build research already cover important parts of the problem.

**Impact:** Product positioning is independent reproduction + explicit trust policies + developer-friendly evidence network, not "first cryptographic build proof."
