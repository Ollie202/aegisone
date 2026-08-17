# Project State

**Last updated:** 2026-08-17  
**Phase:** M2 complete — M3 0G registry contract/dry-run next
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
- 0G Chain, Storage, and confidential execution remain meaningful dependencies/candidates for Wave 3.
- Agentic ID / ERC-8004 are a later network identity/reputation direction, not a Wave 3 dependency.
- An LLM is explicitly outside the core MATCH/MISMATCH decision. 0G Compute may later explain divergence.
- Public repositories only for the first build path.
- The provider-independent M1 kernel exists in `packages/core`, with a constrained fixture runner in `packages/runner-local` and stable JSON through `packages/cli`.
- `hello-proofrail` is a deterministic committed fixture. Tests create its reproducible Git commit (`85ce179a7487605112dd3e36129896082cc2cff0`), independently clone/check out that exact SHA, and rebuild its publisher artifact.
- Offline tests cover SHA-256 known vectors, byte-stable canonical manifests, genuine `MATCH`, one-byte `MISMATCH`, invalid-revision rejection, output-size enforcement, M2 orchestration failures, receipt validation, wrong-network handling, exact-byte mismatch handling, and private-key shape validation.
- The M1 local runner is deliberately fixture-oriented. It restricts executable names, time, environment, checkout revision, paths, and artifact size, but it is not an OS-level network/CPU/disk sandbox and must not be used for arbitrary untrusted repositories.
- `packages/storage-0g` contains the pinned official SDK adapter, proof-enabled round-trip orchestration, exact-byte verification, structured errors, and the live Galileo command.
- M2 has real 0G Storage evidence: Galileo chain ID `16602`, root `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`, transaction `0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd`, sequence `147010`, proof verification enabled/verified, and exact byte equality for the uploaded/downloaded canonical payload.
- No smart-contract deployment or real 0G Sandbox build exists yet.
- Repository is public.

## Highest-risk unknowns

1. Can the hosted/accessible 0G Sandbox path programmatically build an exact public commit and return artifact bytes?
2. What exact Tapp/TEE evidence is retrievable?
3. Can artifact/provenance digest data be directly bound into attestation report data through the accessible flow?
4. Can supported Node.js builds be made deterministic enough for a strong demo beyond the controlled fixture?
5. What exact compact commitment schema should be frozen for the first on-chain registry record?

## Current objective

Execute Issue #3 / M3 without weakening M1 or M2:

- implement the smallest credible `ProofRailRegistry.sol` interface required by Wave 3;
- add local contract tests for valid registration/read, invalid/empty inputs, and duplicate behavior;
- add a typed `packages/registry-0g` client/adapter;
- dry-run deploy and register/read on a non-mainnet 0G environment;
- measure expected mainnet deployment/registration cost;
- do **not** spend mainnet funds or deploy to mainnet until the pre-mainnet gate in `docs/09-deployment-runbook.md` is satisfied.

M2's Storage root is now available as real evidence for the registry design. Secrets remain environment-only and must never enter source, browser code, fixtures, provenance, evidence logs, or chat.

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/mainnet/evidence links and no hidden "trust us" step.
