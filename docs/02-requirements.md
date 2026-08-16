# Requirements

## Functional requirements

- **FR-001** — Every verification must begin from an explicit source/release claim; the system must not infer an "official" repository without evidence.
- **FR-002** — The source revision used for a build must resolve to an immutable Git commit SHA.
- **FR-003** — The system must represent source-claim assurance separately from build-correspondence assurance.
- **FR-004** — The system must accept a constrained build recipe rather than undocumented manual build steps.
- **FR-005** — The system must accept or retrieve the artifact the publisher actually distributes.
- **FR-006** — The system must independently rebuild at least one declared artifact from the exact source revision.
- **FR-007** — The system must calculate SHA-256 for both publisher and reproduced artifacts.
- **FR-008** — The core comparison must deterministically return `MATCH`, `MISMATCH`, `DIVERGED/NOT_REPRODUCIBLE`, or `INSUFFICIENT_EVIDENCE` as appropriate.
- **FR-009** — A new Git commit/release must be represented as a new revision/claim; prior release evidence must remain immutable.
- **FR-010** — The system must generate a canonical provenance/comparison manifest containing source claim, recipe, environment, artifact digests, and evidence references.
- **FR-011** — The verifier must independently recalculate a local artifact digest.
- **FR-012** — Provenance evidence must be uploadable to 0G Storage and retrievable with proof verification where supported.
- **FR-013** — A compact build/reproduction commitment must be registerable on 0G Chain mainnet for Wave 3.
- **FR-014** — The public verifier must expose source-claim level, commit, publisher digest, reproduced digest, Storage reference, registry transaction, and available execution evidence.
- **FR-015** — The CLI must provide stable machine-readable JSON output for agent/automation consumption.
- **FR-016** — The 0G runner must report unavailable attestation capabilities explicitly rather than infer them.
- **FR-017** — Build requests must enforce configured time/CPU/disk/output limits and fail cleanly when unsupported.

## Non-functional requirements

- **NFR-001 Security** — Private keys/API credentials must never enter browser bundles, Git history, provenance, or logs.
- **NFR-002 Determinism** — Manifest canonicalization must produce stable bytes for logically identical records.
- **NFR-003 Portability** — Core source-claim, hashing, comparison, and policy logic must not import 0G SDKs.
- **NFR-004 Cost** — Development defaults to local/testnet/free-tier infrastructure; paid services require explicit approval.
- **NFR-005 Testability** — Core verification logic must run fully offline in unit tests.
- **NFR-006 Observability** — Every external step returns structured success/failure and evidence identifiers when available.
- **NFR-007 Failure safety** — Missing evidence can only lower assurance; it may never silently upgrade a result.
- **NFR-008 UX** — A judge should understand the core MATCH/MISMATCH behavior without blockchain knowledge.
- **NFR-009 Performance** — Consumer verification should normally be dominated by local hashing and evidence checks, not rebuilding.
- **NFR-010 Resource safety** — Arbitrary repository size/complexity must never imply unbounded compute.
- **NFR-011 Documentation** — Product copy must never conflate source ownership, artifact correspondence, reproducibility, TEE execution, or software safety.
- **NFR-012 Agent stability** — JSON field semantics and status enums become versioned contracts once released.
