# Prior Art

## Provenance and policy
- SLSA provenance and artifact verification
- in-toto attestations
- SBOM formats
- GitHub Artifact Attestations

## Signing/transparency
- Sigstore/Cosign
- Rekor/transparency-log patterns

## Reproducible builds
- Reproducible Builds ecosystem
- deterministic build practices
- verified reproducibility with multiple independent build systems

## Independent rebuild / decentralized verification
- Trustix
- Lila and recent decentralized reproducibility work
- other build-verification-network approaches

## TEE build provenance
- Kettle and related attested-build research
- academic TEE source-to-binary provenance work
- 0G Tapp/TDX evidence capabilities

## Emerging agent trust
- 0G Agentic ID direction
- ERC-8004 Identity/Reputation registries

Identity/reputation may help identify builders, but it does not replace artifact-reproduction evidence.

## Current lessons

1. Provenance is established prior art.
2. Hardware-attested builds are established prior art.
3. Independent reproducibility is established prior art.
4. GitHub already makes publisher-side provenance easy.
5. ProofRail must therefore win on integration, independent corroboration, portable evidence, explicit policy, developer/agent UX, and network adoption.
6. A matching artifact does not prove the source is safe.
7. Reproducibility is operationally hard; DIVERGED is a valid outcome.
8. Source identity is a separate problem from source-to-artifact correspondence.

## Research rule

Before inventing a cryptographic/provenance primitive, check whether an established standard exists. Prefer interoperability unless a concrete requirement demands something new.
