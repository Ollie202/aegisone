# Prior Art

## Categories to track

### Provenance standards
- SLSA provenance
- in-toto attestations
- SBOM formats

### Artifact signing/transparency
- Sigstore/Cosign
- Rekor/transparency-log patterns
- GitHub Artifact Attestations

### Reproducible builds
- reproducible-builds.org ecosystem
- deterministic compiler/package practices

### Independent rebuild / decentralized verification
- Trustix and related independent-build verification concepts
- Lila / recent research in decentralized software supply-chain verification

### TEE build provenance
- Kettle and similar confidential-build research
- 0G Tapp/TDX evidence capabilities

## Research rule

Before implementing a new cryptographic/provenance primitive, check whether an established standard already exists. Prefer interoperability over inventing a bespoke format unless a clear requirement demands otherwise.
