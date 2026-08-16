# Testing Strategy

## Principle

Test security-critical invariants, not vanity test counts.

## Core unit tests

- SHA-256 hashing known vectors.
- Artifact mutation changes digest.
- Canonical manifest serialization is byte-stable.
- Invalid/missing required manifest fields fail.
- Verification succeeds only on exact digest match.
- Missing evidence lowers verification level.
- Unsupported attestation fields never imply success.

## Contract tests

- Registration succeeds with valid record.
- Events contain expected commitments.
- Duplicate/collision behavior matches contract design.
- Empty/invalid commitments are rejected where intended.
- Reads return the exact stored record.
- Access/authorization behavior matches the ADR.

## 0G Storage integration tests

- Upload small provenance payload.
- Capture root + tx evidence.
- Download the same payload.
- Enable proof verification.
- Detect incorrect root/missing data.
- Network failures produce structured errors.

## Runner integration tests

- Local runner builds controlled fixture.
- 0G runner builds the same fixture.
- Artifact can be retrieved.
- Exact commit is recorded.
- Logs/evidence fields are captured.
- Attestation is only marked present when verifiably present.

## End-to-end tests

1. Fixture source -> build -> manifest -> storage -> registry -> verify PASS.
2. Same registered record + modified artifact -> verify FAIL.
3. Missing Storage evidence -> degraded/failed evidence state.
4. Wrong registry reference -> fail.

## Demo fixture

Keep one intentionally tiny `hello-proofrail` project whose artifact output is deterministic. This is an engineering test fixture first and a demo aid second.
