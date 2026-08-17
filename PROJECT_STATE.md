# Project State

**Last updated:** 2026-08-17  
**Phase:** M4 complete — M5 judgeable Wave 3 slice next
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
- An LLM is explicitly outside the core MATCH/MISMATCH decision. 0G Compute may later explain divergence.
- Public repositories only for the first build path.
- The provider-independent M1 kernel exists in `packages/core`, with a constrained fixture runner in `packages/runner-local` and stable JSON through `packages/cli`.
- `hello-proofrail` is deterministic. M1 tests independently clone/check out an immutable fixture commit and rebuild its publisher artifact.
- Offline tests cover SHA-256 known vectors, byte-stable canonical manifests, genuine `MATCH`, one-byte `MISMATCH`, invalid-revision rejection, output-size enforcement, M2 orchestration failures, receipt validation, wrong-network handling, exact-byte mismatch handling, private-key shape validation, M3 commitment derivation, contract registration/read behavior, and M4 Sandbox/Tapp protocol and live-ABI behavior.
- `packages/storage-0g` contains the pinned official SDK adapter, proof-enabled round-trip orchestration, exact-byte verification, structured errors, and the live Galileo command.
- M2 has real 0G Storage evidence: Galileo chain ID `16602`, root `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`, transaction `0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd`, sequence `147010`, proof verification enabled/verified, and exact byte equality.
- `contracts/src/ProofRailRegistry.sol` and `packages/registry-0g` implement the minimal append-only evidence registry and typed client.
- M3 has real 0G Chain evidence on Galileo: registry `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`, deployment transaction `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`, registration transaction `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`, and exact on-chain read-back of the canonical M2 commitments.
- The measured M3 gas was `299829` for deployment and `161123` for first registration. At the read-only Aristotle fee snapshot used by the runner, the combined estimate was `0.001843808003226664 0G`; this is an estimate, not a mainnet spend.
- M4 has a real hosted 0G Sandbox build. The live runner used `https://provider-private-sandbox.0g.ai`, toolbox-cloned exact commit `e9c82277cef2f7630977e2473664e14eed2f860d`, verified detached `.git/HEAD`, ran Node `v22.14.0`, executed the committed `hello-proofrail` build, downloaded the produced 53-byte artifact, and matched SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154` exactly.
- M4 captured real TDX evidence from the provider's registered Tapp node, but the live quote v5 `report_data` uses the legacy provider-signer-only padding scheme. It does **not** bind the caller artifact digest. The public toolbox build is non-sealed, while the observed sealed-only provider rejects toolbox operations. Therefore M4 proves independent 0G execution and provider TDX evidence, **not** a TEE-attested artifact build or TEE-bound output digest.
- The successful M4 sandbox was deleted after the run. The Railway execution service was returned to the read-only inspection configuration.
- M4 recorded authoritative on-chain provider pricing and observed testnet-token balance deltas; no mainnet write occurred.
- No Aristotle mainnet contract has been deployed. The pre-mainnet gate and explicit approval remain required.
- Repository is public.

## Highest-risk unknowns

1. Can M1–M4 be assembled into one judgeable flow without duplicating or weakening the core verification logic?
2. Can the first supported real-world Node.js build family remain deterministic outside the controlled fixture?
3. Can the CLI and web viewer derive the same status from the same core evidence without a UI-only trust step?
4. Can the live 0G Tapp/provider path be upgraded later to bind caller/runtime data or build output without replacing the proven public toolbox path?
5. What Aristotle mainnet deployment/registration cost is acceptable at the eventual explicit mainnet gate?

## Current objective

Execute Issue #5 / M5: assemble the first judgeable Wave 3 independent-reproduction slice:

- explicit release/source claim with visible assurance level;
- exact immutable commit and inspectable build recipe;
- publisher artifact digest from the actual publisher bytes;
- real independent 0G rebuild with retrievable artifact bytes;
- genuine artifact returns `MATCH` and a substituted artifact returns `MISMATCH`;
- canonical evidence flows through real 0G Storage and the registry path;
- CLI/JSON and web UI derive status from the same core checks;
- TDX/provider evidence is represented precisely, without implying unsupported output binding;
- README/demo instructions expose reproducible evidence links.

The Aristotle mainnet transaction required by the eventual judgeable path remains separately gated. Do **not** send a mainnet transaction without re-running the pre-mainnet checks and obtaining explicit approval.

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/registry/evidence links and no hidden "trust us" step.
