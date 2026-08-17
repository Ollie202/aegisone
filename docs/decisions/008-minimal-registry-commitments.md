# ADR 008 — Minimal registry commitments

**Status:** Accepted for M3 spike; freeze only after the Galileo dry-run succeeds.

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

## Consequences

- Full evidence remains independently retrievable from 0G Storage.
- On-chain storage and registration gas stay bounded and easy to measure.
- MATCH/MISMATCH semantics remain deterministic in the provider-independent verification layer.
- A future authenticated publisher or builder identity layer can be added without rewriting what this record claims.
- The commitment ordering becomes part of the Wave 3 contract interface once the Galileo dry-run succeeds and the interface is frozen.

## Toolchain note

Current 0G Builder Hub guidance simultaneously recommends Solidity `0.8.19` and `evmVersion: cancun`. Solidity's own compiler history indicates Cancun targeting was added after 0.8.19. M3 therefore uses Solidity `0.8.24` + Cancun for the compatibility spike and treats the real Galileo compile/deploy/read run as authoritative before freezing this toolchain choice.
