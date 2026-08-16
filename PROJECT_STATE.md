# Project State

**Last updated:** 2026-08-16  
**Phase:** M1 — local independent-reproduction kernel  
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
- No production implementation, smart-contract deployment, 0G Storage proof, or 0G Sandbox build exists yet.
- Repository is currently private and must become public before submission.

## Highest-risk unknowns

1. Can the hosted/accessible 0G Sandbox path programmatically build an exact public commit and return artifact bytes?
2. What exact Tapp/TEE evidence is retrievable?
3. Can artifact/provenance digest data be directly bound into attestation report data through the accessible flow?
4. Can supported Node.js builds be made deterministic enough for a strong demo?
5. What canonical manifest encoding should become stable before on-chain commitments?

## Current objective

Complete M1 before product polish:

- create a tiny deterministic fixture with a known "publisher artifact";
- model an explicit source/release claim;
- rebuild the exact source locally;
- compare publisher and reproduced SHA-256 digests;
- prove MATCH for the genuine artifact;
- prove MISMATCH after a one-byte change;
- expose the result as stable machine-readable JSON;
- keep all 0G SDKs out of `packages/core`.

Then execute the 0G Storage, registry, and Sandbox spikes.

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/mainnet/evidence links and no hidden "trust us" step.
