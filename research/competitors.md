# Competitors & Alternatives

ProofRail must not pretend the software-provenance category is empty.

## GitHub Artifact Attestations

GitHub can generate and verify artifact attestations tying artifacts to repository/workflow/build context.

Reference: https://docs.github.com/en/actions/concepts/security/artifact-attestations

**Implication:** "We sign a build from GitHub Actions" is not enough differentiation.

## Sigstore / Cosign

Open-source signing and transparency tooling for software artifacts and containers.

Reference: https://docs.sigstore.dev/

**Implication:** ProofRail should interoperate with existing signing/provenance ecosystems rather than claim all signing is obsolete.

## SLSA

Software supply-chain framework with formal provenance concepts and increasing assurance levels.

Reference: https://slsa.dev/

**Implication:** Build provenance is established prior art. Our angle is independent reproduction/trust-policy usability and the specific decentralized/confidential execution network.

## Reproducible Builds

Long-running ecosystem effort to make identical source/build inputs produce identical outputs.

Reference: https://reproducible-builds.org/

**Implication:** Multi-builder agreement depends heavily on reproducible build discipline; many projects will not match automatically.

## Kettle

2026 research on TEE-backed software building/provenance.

Reference: https://arxiv.org/abs/2605.08363

**Implication:** TEE-attested builds themselves are not novel. ProofRail must differentiate on developer workflow, independent reproduction, explicit trust policies, network/adoption, and interoperability.

## Strategic differentiation

The intended moat is not "we use hashes" or "we use a TEE." It is a usable, provider-adaptable verification network where independent builders produce inspectable evidence and users choose what combination of evidence they require.
