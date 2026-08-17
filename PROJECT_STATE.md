# Project State

**Last updated:** 2026-08-17  
**Phase:** M3 complete — M4 0G Sandbox / Tapp execution proof next
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
- Offline tests cover SHA-256 known vectors, byte-stable canonical manifests, genuine `MATCH`, one-byte `MISMATCH`, invalid-revision rejection, output-size enforcement, M2 orchestration failures, receipt validation, wrong-network handling, exact-byte mismatch handling, private-key shape validation, M3 commitment derivation, contract registration/read behavior, zero commitments, duplicate rejection, and missing-record reads.
- The M1 local runner is deliberately fixture-oriented. It restricts executable names, time, environment, checkout revision, paths, and artifact size, but it is not an OS-level network/CPU/disk sandbox and must not be used for arbitrary untrusted repositories.
- `packages/storage-0g` contains the pinned official SDK adapter, proof-enabled round-trip orchestration, exact-byte verification, structured errors, and the live Galileo command.
- M2 has real 0G Storage evidence: Galileo chain ID `16602`, root `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`, transaction `0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd`, sequence `147010`, proof verification enabled/verified, and exact byte equality for the uploaded/downloaded canonical payload.
- `contracts/src/ProofRailRegistry.sol` and `packages/registry-0g` implement the minimal append-only evidence registry and typed client. The Wave 3 commitment ordering is manifest digest, source-claim digest, publisher artifact digest, reproduced artifact digest, then 0G Storage provenance root.
- M3 has real 0G Chain evidence on Galileo: registry `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`, deployment transaction `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`, registration transaction `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`, and exact on-chain read-back of the canonical M2 commitments.
- The measured M3 gas was `299829` for deployment and `161123` for first registration. At the read-only Aristotle fee snapshot used by the runner, the combined estimate was `0.001843808003226664 0G`; this is an estimate, not a mainnet spend.
- No Aristotle mainnet contract has been deployed. The pre-mainnet gate and explicit approval remain required.
- No real 0G Sandbox build exists yet; that is M4.
- Repository is public.

## Highest-risk unknowns

1. Can the hosted/accessible 0G Sandbox path programmatically build an exact public commit and return artifact bytes?
2. What exact Tapp/TEE evidence is retrievable?
3. Can artifact/provenance digest data be directly bound into attestation report data through the accessible flow?
4. Can supported Node.js builds be made deterministic enough for a strong demo beyond the controlled fixture?
5. What measured Sandbox cost/resource envelope is practical for the Wave 3 demo?

## Current objective

Execute Issue #4 / M4 without weakening M1–M3:

- confirm the current official 0G Sandbox/Tapp programmatic SDK/API path;
- create or access a real sandbox programmatically;
- clone an exact public repository commit and run a constrained Node.js build;
- retrieve the produced artifact bytes;
- capture every attestation/TEE evidence field actually available through the accessible flow;
- test whether artifact/provenance digest data can be bound directly into attestation report data and classify the result as PROVEN, NOT AVAILABLE, or BLOCKED with evidence;
- measure and record any Sandbox cost;
- do not make a stronger TEE/output-binding claim in product copy than the evidence supports.

M1's deterministic comparison, M2's Storage root, and M3's registry commitments are now proven building blocks. Secrets remain environment-only and must never enter source, browser code, fixtures, provenance, evidence logs, or chat.

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/mainnet/evidence links and no hidden "trust us" step.
