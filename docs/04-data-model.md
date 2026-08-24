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

## M8 capability discovery model

M8 adds a provider-independent `@proofrail/capability-model` layer. It is deliberately separate from ARD or any particular discovery provider.

### CapabilityResource
A logical resource discoverable by a human or agent.

- `kind`: `agent-skill`, `mcp-server`, `a2a-agent`, or `api`
- stable ProofRail resource ID
- human name/description
- discovery metadata
- optional current version/source/distribution references
- independent trust-evidence dimensions

### DiscoveryMetadata
Mutable catalog information only:

- source/indexer name
- upstream resource ID/URL
- discovered timestamp
- optional relevance score
- state such as `INDEXED`, `STALE`, or `UNAVAILABLE`

Invariant: discovery/relevance is not ProofRail verification and is never consumed by the trust-policy evaluator.

### CapabilityVersion
The exact resource version being reasoned about.

- optional version label
- optional source repository + immutable commit SHA + subdirectory
- optional distinct distribution URL + distribution SHA-256

A source snapshot and a distributed artifact are intentionally different concepts. ProofRail may inspect source without having enough evidence to claim distribution correspondence.

### CapabilityTrustEvidence
Independent dimensions:

- **source assurance** — `NONE`, `DECLARED`, `REPOSITORY_AUTHENTICATED`, `SIGNED_RELEASE`
- **source inspection** — whether an exact immutable source snapshot was independently inspected
- **distribution correspondence** — `NOT_EVALUATED`, `INSUFFICIENT_EVIDENCE`, `MATCH`, `MISMATCH`, `DIVERGED`
- **security assessment** — deterministic audit status, severity, and finding count
- **canonical evidence pointer** — canonical evidence digest, timestamp, and optional 0G Storage/registry pointers

Invariants:

- `MATCH`, `MISMATCH`, and `DIVERGED` require a distinct distributed artifact digest and an independently reproduced digest.
- `MATCH` requires equal publisher/distribution and reproduced digests.
- `MISMATCH` requires different digests.
- source-only inspection cannot emit `MATCH`/`MISMATCH`.
- security findings never rewrite correspondence.
- mutable catalog rows may cache evidence summaries, but cannot manufacture canonical evidence.

### TrustPolicy
Consumer-owned deterministic policy. Initial M8 policy can require:

- minimum source assurance
- exact `MATCH` correspondence
- maximum security severity
- maximum evidence age
- explicit behavior when required evidence is missing (`REVIEW` or `DENY`)

### TrustPolicyResult
Machine-readable result:

- `ALLOW`
- `REVIEW`
- `DENY`
- structured reasons

Policy evaluation is deterministic, takes the evaluation time explicitly, has no LLM/API dependency, and never uses search relevance as a trust signal.

See ADR-010 for the architectural separation.

## Canonicalization

M1 uses the deterministic canonical JSON subset recorded in ADR-007: object keys are recursively sorted, array order is preserved, UTF-8 bytes are hashed, and ambiguous/unsupported values fail instead of being silently coerced. No timestamp or runtime-generated identifier enters the canonical M1 manifest. The encoding is covered by stability and rejection tests.
