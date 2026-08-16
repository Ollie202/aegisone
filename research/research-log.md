# Research Log

## 2026-08-16 — 0G Storage SDK

**Finding:** Official documentation exposes TypeScript/Go SDK paths. TypeScript supports file and in-memory uploads, Merkle root calculation, downloads, and proof-enabled retrieval. Current documented package: `@0gfoundation/0g-storage-ts-sdk` with `ethers` peer dependency.

**Impact:** Storage technical spike is low-risk enough to begin early.

**Source:** https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk

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
