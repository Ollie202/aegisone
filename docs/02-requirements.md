# Requirements

## Functional requirements

- **FR-001** — The system must identify a source repository by immutable commit SHA before building.
- **FR-002** — The system must accept a constrained build recipe rather than arbitrary undocumented manual steps.
- **FR-003** — The system must produce at least one declared artifact from the build.
- **FR-004** — The system must calculate a SHA-256 digest for each declared artifact.
- **FR-005** — The system must generate a canonical provenance manifest containing source, recipe, environment, artifact, and evidence metadata.
- **FR-006** — The verifier must independently recalculate a local artifact digest.
- **FR-007** — Verification must fail when the local digest differs from the provenance/registry digest.
- **FR-008** — Provenance evidence must be uploadable to 0G Storage.
- **FR-009** — Stored evidence must be retrievable with verification enabled where supported by the SDK.
- **FR-010** — A minimal build record must be registerable on 0G Chain mainnet for the Wave 3 submission.
- **FR-011** — The public verifier must expose source commit, artifact digest, storage reference, registry transaction, and verification state.
- **FR-012** — The CLI must support `verify <artifact>` for the Wave 3 demo.
- **FR-013** — The system must preserve underlying evidence so verification is not dependent on a green badge from the web UI.
- **FR-014** — The 0G runner adapter must expose evidence truthfully; unavailable attestation properties must be represented as unavailable, not inferred.

## Non-functional requirements

- **NFR-001 Security** — Private keys must never enter the browser bundle, repository, logs, or provenance output.
- **NFR-002 Determinism** — Manifest canonicalization must produce stable bytes for logically identical records.
- **NFR-003 Portability** — Core hashing/provenance/verification logic must not depend directly on 0G SDKs.
- **NFR-004 Cost** — Default development must use local/testnet/free-tier infrastructure. Any paid service requires explicit approval.
- **NFR-005 Testability** — Core verification logic must run fully offline in unit tests.
- **NFR-006 Observability** — Every external step must return a structured success/failure result with evidence identifiers when available.
- **NFR-007 Failure safety** — Missing evidence must degrade the verification level rather than silently pass.
- **NFR-008 UX** — A judge should understand the success/failure state without blockchain expertise.
- **NFR-009 Performance** — Local artifact verification should be dominated by file hashing, not remote network calls.
- **NFR-010 Documentation** — Security claims and verification levels must match implementation reality.
