# Data Model

## Core entities

### SourceRef
- `provider`
- `repository`
- `commitSha`
- optional `tag`

Invariant: the build always resolves to an immutable commit SHA.

### BuildRecipe
- `version`
- `runtime`
- `installCommand`
- `buildCommand`
- `artifactPaths[]`
- optional environment constraints

### Artifact
- `name`
- `path`
- `size`
- `sha256`

### BuildEnvironment
- `runnerType` (`local`, `0g`)
- runtime/image identifier
- provider/sandbox identifier when applicable
- available measurement/attestation references

### ProvenanceManifest
- schema version
- source
- recipe digest
- environment
- artifacts
- start/end timestamps
- build result
- evidence references

### StorageEvidence
- network
- root hash/root hashes
- upload transaction hash(es)
- retrieval proof status

### RegistryRecord
- chain ID
- contract address
- transaction hash
- artifact digest
- provenance root/commitment
- submitter

### VerificationResult
- artifact digest calculated locally
- expected digest
- source/provenance/registry evidence
- verification level
- checks[]
- warnings[]
- final pass/fail status

## Canonicalization requirement

The exact canonical serialization format must be decided and tested before any on-chain provenance commitment is treated as stable. This decision requires an ADR.
