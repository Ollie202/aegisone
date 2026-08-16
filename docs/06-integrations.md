# Integrations

**Last reviewed:** 2026-08-16

External APIs evolve. Verify current official documentation before implementation.

## 0G Chain

**Purpose:** public, tamper-evident registry of compact build/provenance commitments.

Current official ecosystem references list Aristotle mainnet as chain ID `16661` and the public RPC as `https://evmrpc.0g.ai`. 0G contracts are EVM-compatible; official docs support familiar tools such as Hardhat/Foundry and document current EVM compatibility.

Wave 3 policy: any Chain integration used for the competition should be real mainnet evidence once the local/testnet flow is proven.

References:
- https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts
- https://github.com/0gfoundation/awesome-0g

## 0G Storage

**Purpose:** store full provenance/evidence without putting large documents into the registry contract.

The official TypeScript SDK currently supports file/in-memory uploads, Merkle root calculation, downloads, and proof-enabled retrieval. The documented TypeScript package is `@0gfoundation/0g-storage-ts-sdk` with `ethers` as a peer dependency.

Wave 3 spike:
1. create a small provenance JSON file/in-memory payload;
2. calculate root;
3. upload to Galileo/test environment;
4. retrieve with proof verification enabled;
5. record transaction/root evidence.

References:
- https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
- https://github.com/0gfoundation/0g-storage-ts-sdk

## 0G Sandbox / Tapp

**Purpose:** reduce trust in the machine executing the build.

The current 0G Sandbox repository describes a wallet-authenticated, metered sandbox service. 0G Tapp uses Intel TDX-backed trusted execution and exposes remote-attestation/evidence concepts. 0G's technical material states the Tapp SDK can embed report data in attestation quotes, but we must prove whether the consumer-facing Sandbox path lets this project bind our artifact/provenance digest directly to that evidence.

Wave 3 spike questions:
- Can we create/use the sandbox programmatically?
- Can it clone a repo and execute a constrained build?
- Can we retrieve the produced artifact bytes?
- What exact attestation/evidence object can we retrieve?
- Can artifact/provenance digest data be bound into the attestation quote using the available consumer path?

If direct output binding is unavailable, Wave 3 must make the weaker claim accurately and promote stronger binding to a later milestone.

References:
- https://github.com/0gfoundation/0g-sandbox
- https://github.com/0gfoundation/0g-tapp
- https://0g.ai/blog/0g-tapp-tee-security-without-ssh
- https://0g.ai/blog/tech-update-nov-2025

## GitHub

**Purpose:** initial source provider and eventual CI integration.

Wave 3 supports public repositories only. Resolve tags/branches to immutable commit SHA before build. Do not make GitHub's mutable branch name part of the security claim.

## 0G Compute

**Wave 3:** not required for the core verification path.

Potential later use: diagnose why independent rebuilds diverge. Do not add an LLM solely to increase the number of 0G products listed in the submission.

## 0G DA / Agentic ID

Not required by the current product architecture. Do not integrate unless a future requirement makes them functionally necessary.
