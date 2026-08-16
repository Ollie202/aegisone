# Data Model

## Core entities

### PublisherIdentity
Optional identity evidence for who declared a release.

- `type` (`anonymous`, `github`, `signature`, future types)
- `subject`
- `assuranceLevel`
- evidence references

### SourceRef
- `provider`
- `repository`
- `commitSha`
- optional `tag`
- optional `subdirectory`

Invariant: build execution always uses an immutable commit SHA.

### ReleaseClaim
The publisher/declarant's statement connecting source and distributed artifact.

- `claimVersion`
- `projectId`
- `publisherIdentity`
- `source: SourceRef`
- `recipeDigest`
- `artifactName`
- `artifactLocation` or submitted bytes reference
- optional `releaseTag`
- `claimAssuranceLevel`

Invariant: ProofRail never silently upgrades a declared source into an authenticated publisher source.

### BuildRecipe
- `version`
- runtime/image identifier
- working directory / target package
- install command
- build command
- artifact paths
- network policy
- resource limits
- environment constraints

### Artifact
- `name`
- `size`
- `sha256`
- `role` (`publisher`, `reproduced`)

### ReproductionJob
- `jobId`
- source claim/reference
- recipe digest
- runner type
- resource limits
- start/end status
- output artifacts
- build logs/evidence references

### BuildEnvironment
- `runnerType` (`local`, `0g`, future adapters)
- runtime/image identifier
- provider/sandbox identifier
- available measurements/attestation references
- capability flags

### ComparisonResult
- publisher digest
- reproduced digest(s)
- status (`MATCH`, `MISMATCH`, `DIVERGED`, `INSUFFICIENT_EVIDENCE`)
- checks/warnings

### ProvenanceManifest
- schema version
- release/source claim
- recipe digest
- environment
- publisher artifact
- reproduced artifact(s)
- comparison result
- evidence references

### StorageEvidence
- network
- root hash/root hashes
- upload transaction hash(es)
- retrieval/proof status

### RegistryRecord
- chain ID
- contract address
- transaction hash
- claim commitment
- artifact/reproduction commitments
- provenance root
- submitter

### VerificationPolicy
Later versions:
- minimum independent builders
- required execution/identity capabilities
- acceptable source-claim assurance
- exact-match requirement

### VerificationResult
Stable machine-facing output containing:
- source-claim assurance
- local artifact digest
- expected/publisher digest
- independent reproduction evidence
- policy result
- checks/warnings
- final status

## Canonicalization

M1 uses the deterministic canonical JSON subset recorded in ADR-007: object keys are recursively sorted, array order is preserved, UTF-8 bytes are hashed, and ambiguous/unsupported values fail instead of being silently coerced. No timestamp or runtime-generated identifier enters the canonical M1 manifest. The encoding is covered by stability and rejection tests.
