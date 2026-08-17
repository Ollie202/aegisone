# ADR 008 — Minimal registry commitments

**Status:** Accepted and frozen for the Wave 3 path after successful Galileo deploy/register/read-back on 2026-08-17.

## Context

ProofRail needs a public tamper-evident anchor for reproduction evidence without putting full provenance, logs, URLs, or mutable product labels onchain. The existing trust model separates source identity from source-to-artifact correspondence and forbids treating a matching build as a claim that software is safe.

M2 already produces a canonical provenance manifest and a real 0G Storage root. M3 therefore needs to anchor enough data for a verifier to bind an on-chain record back to that evidence while keeping the contract small.

## Decision

Each immutable registry record commits to exactly five 32-byte values:

1. `manifestDigest` — SHA-256 of canonical provenance bytes;
2. `sourceClaimDigest` — SHA-256 of the canonical release/source claim;
3. `publisherArtifactDigest` — SHA-256 of publisher artifact bytes;
4. `reproducedArtifactDigest` — SHA-256 of reproduced artifact bytes;
5. `provenanceRoot` — 0G Storage root for the canonical evidence.

The contract derives `recordId = keccak256(abi.encode(all five commitments))`, rejects an exact duplicate, and records only the submitter address and block timestamp as metadata.

The contract does **not** store a PASS/FAIL, source-officialness, malware, safety, trust, or TEE-output-binding claim. In particular, publisher and reproduced digests are allowed to differ: the registry anchors evidence rather than deciding what policy should do with it.

Registration is permissionless in M3. `submitter` means the address that anchored the record, not an authenticated publisher identity.

## Galileo validation

The schema was validated end-to-end on 0G Galileo Testnet (chain ID `16602`) on 2026-08-17:

- contract: `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`;
- deployment transaction: `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`;
- registration transaction: `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`;
- registered Storage root: the real M2 root `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`;
- registered manifest digest: the canonical M2 manifest SHA-256 `0xf922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`;
- exact read-back equality: `true`.

This successful run freezes the field set and ordering for the Wave 3 implementation. A later incompatible schema should use explicit versioning rather than silently reinterpreting existing records.

## Consequences

- Full evidence remains independently retrievable from 0G Storage.
- On-chain storage and registration gas stay bounded and easy to measure.
- MATCH/MISMATCH semantics remain deterministic in the provider-independent verification layer.
- A future authenticated publisher or builder identity layer can be added without rewriting what this record claims.
- The commitment ordering is now part of the Wave 3 contract interface.

## Toolchain note

Current 0G Builder Hub guidance simultaneously recommends Solidity `0.8.19` and `evmVersion: cancun`. Solidity's compiler history indicates Cancun targeting was added after 0.8.19. M3 therefore used Solidity `0.8.24` + Cancun for the compatibility spike. The contract compiled and deployed successfully on Galileo, and the register/read path completed, so `0.8.24` + Cancun is the validated Wave 3 toolchain unless a later migration is deliberately tested.
