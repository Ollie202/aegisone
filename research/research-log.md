# Research Log

## 2026-08-16 — 0G Storage SDK

**Finding:** Official documentation exposes TypeScript/Go SDK paths. TypeScript supports file and in-memory uploads, Merkle root calculation, downloads, and proof-enabled retrieval. Current documented package: `@0gfoundation/0g-storage-ts-sdk` with `ethers` peer dependency.

**Version check:** The official repository's current `package.json` is `@0gfoundation/0g-storage-ts-sdk@1.2.9` and declares the exact peer `ethers@6.13.1`. The repository has no GitHub “latest release” object, so M2 should pin the package version rather than infer stability from a release tag.

**Current Galileo path:** Official examples use EVM RPC `https://evmrpc-testnet.0g.ai` and turbo indexer `https://indexer-storage-testnet-turbo.0g.ai`. `Indexer.upload` requires an ethers signer with enough test balance to pay storage/gas fees. `Indexer.download(root, output, true)` requests proof-enabled retrieval.

**Implementation recheck:** Galileo remains chain ID `16602`; the official faucet currently offers up to `0.1 0G` per wallet per day. The TypeScript SDK source confirms `downloadToBlob(root, { proof: true })` passes proof verification into the downloader, and `Indexer.upload` returns root hash, transaction hash, and transaction sequence for a single small payload. `packages/storage-0g` checks all three and refuses a receipt whose returned root differs from the locally calculated Merkle root.

**Impact:** The code path is identified, but a real M2 completion is blocked until a test-only wallet is supplied through a secret environment variable and funded. No signer exists in the current workspace. Do not commit the key or replace the live round trip with a mock.

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
