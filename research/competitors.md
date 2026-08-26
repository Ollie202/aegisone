# Competitors & Alternatives

AegisOne must be built with the assumption that software provenance is a mature category.

## GitHub Artifact Attestations

GitHub creates cryptographically signed build provenance linking artifacts to repository, workflow/environment, commit SHA, and other build identity information. GitHub explicitly warns that attestations do not guarantee an artifact is secure.

References:
- https://docs.github.com/en/actions/concepts/security/artifact-attestations
- https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations

**Implication:** publisher-side provenance is not sufficient differentiation. AegisOne should consume/interoperate with attestations where useful and focus on independent corroboration.

## Sigstore / Cosign / in-toto

Established signing, transparency, and supply-chain attestation tooling.

**Implication:** do not invent proprietary signatures/attestation formats unless necessary.

References:
- https://docs.sigstore.dev/
- https://in-toto.io/

## SLSA

SLSA formalizes software build provenance and verification. Its reproducible-build guidance distinguishes ordinary reproducibility from **verified reproducibility**, where two or more independent build systems corroborate provenance.

References:
- https://slsa.dev/
- https://slsa.dev/spec/v1.2/verifying-artifacts
- https://slsa.dev/spec/v1.0-rc1/faq

**Implication:** independent reproduction is legitimate security architecture, but not a complete solution and not our invention.

## Reproducible Builds

Long-running effort around deterministic source-to-binary builds and common nondeterminism such as timestamps, filesystem ordering, paths, locales, randomness, and toolchain differences.

Reference:
- https://reproducible-builds.org/

**Implication:** arbitrary repositories will not automatically reproduce. Narrow supported build families and honest DIVERGED states are essential.

## Kettle / TEE-attested builds

Recent work already demonstrates TEE-backed build provenance and binding build metadata/output digests to attestation.

**Implication:** "we build in a TEE" is not novel. 0G-specific product integration plus independent-network UX is the opportunity.

## Trustix / Lila / decentralized rebuilders

Existing/recent systems explore comparing build results across providers or decentralized reproducibility monitoring.

**Implication:** multi-builder networks are also prior art. Our eventual differentiation must be usability, cross-environment adapters, policy evidence, agent consumption, and adoption.

## Strategic position

AegisOne should aim to be:

> **the easy verification/policy layer that aggregates independent reproduction evidence for humans, CI, and agents**

not:

> "a new hash/signature/TEE primitive."

## Kill condition

If the Wave 3 implementation becomes only `publisher hash -> blockchain`, stop and rethink it. That is weaker than existing provenance tooling and does not justify the product.
