# Key Findings — Current Product Thesis

This is the short research digest agents and humans should read when asking "why are we building this?"

## What survived deep research

- The source-to-distributed-artifact trust gap is real.
- Public source code alone does not prove downloaded release bytes came from that source.
- Independent reproduction is a recognized way to corroborate build provenance.
- 0G's confidential execution + Storage + Chain can form a meaningful evidence path if the real Sandbox/Tapp spike succeeds.
- Humans, CI, and autonomous agents can consume the same deterministic evidence.

## What did not survive

- Claiming we invented build provenance.
- Claiming TEE-attested builds are novel.
- Claiming decentralized/multi-builder rebuild networks are novel.
- Treating AegisOne as the source of truth.
- Using an LLM to decide whether the artifact matches.
- Supporting arbitrary repositories in Wave 3.

## Strongest product framing

> **AegisOne independently rebuilds software from its publisher-declared source and gives humans and AI agents evidence of whether the published software actually matches.**

## Strongest Wave 3 demo

1. Show clean public source + publisher release artifact.
2. Pin exact commit.
3. Independently rebuild through real 0G execution.
4. Published artifact hash and rebuilt hash match.
5. Show Storage/mainnet/attestation evidence.
6. Replace one byte / substitute artifact.
7. Verification fails immediately.

## Strongest longer-term direction

A software verification network where multiple independent builder/verifier agents produce portable evidence and consumers enforce explicit policies such as `2-of-3 matching` or `require one TEE builder`.

## Biggest risks

- Reproducibility/nondeterminism.
- 0G Sandbox artifact/evidence access may not expose the exact desired binding.
- Source/publisher identity needs separate authentication.
- Arbitrary build compute can become expensive/unsafe.
- Long-term differentiation depends on adoption and UX, not primitive novelty.
