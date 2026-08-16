# Project State

**Last updated:** 2026-08-16  
**Phase:** M1 complete — M2 0G Storage round-trip next
**Product name:** ProofRail *(working name only)*

## Current product thesis

ProofRail does **not** determine whether code is good or bad and does **not** magically identify an official source repository.

The publisher supplies a source/release claim. ProofRail independently rebuilds the exact immutable commit under an explicit recipe, compares the reproduced artifact with the published artifact, and packages the resulting evidence for humans or AI agents.

Wave 3's headline is now:

> **publisher artifact vs independent 0G rebuild**

not merely "hash + blockchain".

## What is true now

- Repository foundation and project documentation exist.
- Core trust model has been refined around two separate proofs: source-claim identity and source-to-artifact correspondence.
- GitHub Artifact Attestations, Sigstore/SLSA, reproducible-build work, Kettle, Trustix, and Lila are acknowledged prior art; novelty is not claimed for provenance, TEEs, or reproducible builds themselves.
- The intended differentiation is productization of independent reproduction, portable evidence, policy-driven verification, developer/agent UX, and an open builder network.
- 0G Chain, Storage, and confidential execution remain meaningful candidate dependencies for Wave 3.
- Agentic ID / ERC-8004 are a later network identity/reputation direction, not a Wave 3 dependency.
- An LLM is explicitly outside the core MATCH/MISMATCH decision. 0G Compute may later explain divergence.
- Public repositories only for the first build path.
- The provider-independent M1 kernel now exists in `packages/core`, with a constrained fixture runner in `packages/runner-local` and stable JSON through `packages/cli`.
- `hello-proofrail` is a deterministic committed fixture. Tests create its reproducible Git commit (`85ce179a7487605112dd3e36129896082cc2cff0`), independently clone/check out that exact SHA, and rebuild its publisher artifact.
- Offline tests prove SHA-256 known vectors, byte-stable canonical manifests, genuine `MATCH`, one-byte `MISMATCH`, invalid-revision rejection, and output-size enforcement.
- The M1 local runner is deliberately fixture-oriented. It restricts executable names, time, environment, checkout revision, paths, and artifact size, but it is not an OS-level network/CPU/disk sandbox and must not be used for arbitrary untrusted repositories.
- No smart-contract deployment, real 0G Storage proof, or real 0G Sandbox build exists yet.
- Repository is currently private and must become public before submission.

## Highest-risk unknowns

1. Can the hosted/accessible 0G Sandbox path programmatically build an exact public commit and return artifact bytes?
2. What exact Tapp/TEE evidence is retrievable?
3. Can artifact/provenance digest data be directly bound into attestation report data through the accessible flow?
4. Can supported Node.js builds be made deterministic enough for a strong demo?
5. What canonical manifest encoding should become stable before on-chain commitments?

## Current objective

Execute M2 without weakening the completed M1 truth path:

- select and pin the current official 0G Storage TypeScript SDK;
- upload canonical M1 provenance bytes to the appropriate 0G test environment;
- retrieve identical bytes with proof verification where supported;
- record real root/transaction evidence and structured failures;
- keep all 0G-specific code in `packages/storage-0g`.

M2 requires the relevant 0G endpoint plus a minimally funded test wallet if the live SDK path charges test tokens. No wallet secret may enter source, logs, fixtures, or provenance.

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/mainnet/evidence links and no hidden "trust us" step.
