# Contributing

ProofRail is currently a solo-led project that uses AI coding agents as contributors.

## Workflow

1. Read `AGENTS.md` and `PROJECT_STATE.md`.
2. Pick work from `planning/current-sprint.md`.
3. Keep scope tied to one milestone/requirement.
4. Add or update tests with implementation changes.
5. Update documentation when reality changes.
6. Record real deployments/integrations in `hackathon/evidence.md`.

## Commits

Prefer small, descriptive commits, for example:

- `feat(core): add canonical artifact digest model`
- `feat(storage): upload provenance to 0G Storage`
- `test(registry): cover duplicate registration behavior`
- `docs(architecture): record attestation trust boundary`

## Pull requests

For material architecture/security changes, use a branch and PR even when working solo. Small documentation corrections may go directly to the default branch.

## Security-sensitive changes

Changes to hashing, canonicalization, signatures, provenance format, attestation verification, contract permissions, or trust-policy semantics require:

- tests;
- threat-model review;
- an ADR when they alter a durable design decision.
