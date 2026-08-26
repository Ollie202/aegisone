# ADR-012 — Authenticate source claims with GitHub repository authority

## Status

Accepted for M8.5.

## Context

AegisOne correspondence is only meaningful relative to an explicit source claim. Discovery systems, package metadata and user input can all point to a GitHub repository, but a repository URL or existing commit does not prove that the publisher authorized that repository/revision as the source for a distributed capability.

M8 therefore needs a concrete first source-authentication mechanism that is feasible for a solo builder, interoperable with public GitHub repositories, and does not conflate identity/authority with artifact correspondence or code safety.

The provider-independent M8.1 model already defines source assurance levels:

- `NONE`
- `DECLARED`
- `REPOSITORY_AUTHENTICATED`
- `SIGNED_RELEASE`

The implementation must define exactly what earns the stronger levels.

## Decision

Use a **GitHub App user authorization flow** as the first M8 source-authentication adapter.

### `NONE`

No authenticated explicit source mapping exists. A discovery provider may have supplied a repository URL/identifier, but AegisOne has not proven publisher authority.

### `DECLARED`

An explicit mapping to a resolvable exact source commit exists, but repository authority has not been proven.

### `REPOSITORY_AUTHENTICATED`

Earned only when all of the following are observed and validated:

1. the claimant completes a real GitHub App user authorization flow;
2. AegisOne resolves the authenticated GitHub user identity;
3. AegisOne resolves the relevant GitHub App installation/repository access;
4. the authenticated user has sufficient effective **write/push or admin-equivalent** authority over the claimed repository;
5. AegisOne records the repository's stable GitHub numeric ID in addition to human-readable owner/name;
6. the claimed source is resolved to an exact immutable 40-character commit SHA;
7. the exact source claim is canonicalized deterministically and SHA-256 digested;
8. the authority observation and authentication time are recorded as evidence.

Read-only, triage-only, unknown or unverifiable authority cannot earn this level.

A historical authenticated claim records authority observed at claim time. It is not silently rewritten when the repository is renamed/transferred or a newer claim appears.

### `SIGNED_RELEASE`

This is a stronger, optional assurance level and is **not** earned merely because a GitHub attestation API returns a bundle.

The artifact/source/signer provenance must be cryptographically verified under explicit expected constraints. The initial preferred implementation candidate is GitHub-supported artifact attestation verification (for example worker-side `gh attestation verify` with the expected repository/source digest and signer constraints).

If a tested verifier is unavailable or verification fails, the assurance remains below `SIGNED_RELEASE`.

## Canonical source claim

The authenticated claim contains only observed/explicit values, conceptually:

```text
resource/version identity
stable GitHub repository identity
exact source commit
optional source subdirectory
optional distinct distribution reference/digest
authenticated GitHub user identity
observed effective repository authority
```

The canonical claim digest becomes part of AegisOne evidence and may later be included in canonical 0G evidence/commitments.

Mutable Supabase rows may cache the claim/evidence but cannot manufacture/rewrite the authenticated assurance without passing the source-claim integrity checks.

## Security boundary

The source-auth flow proves repository authority at a point in time. It does **not** prove:

- benign publisher intent;
- an uncompromised GitHub account;
- code safety/security;
- correspondence between distributed bytes and source;
- approval by every member/stakeholder of an organization.

Those remain separate evidence dimensions.

OAuth/user tokens must not be logged or persisted as ordinary long-term plaintext catalog data. The basic public-repository M8 claim flow should discard short-lived user authorization material after the claim/session window.

Private-source independent reproduction is out of scope for M8 even if repository authority can be observed.

## Alternatives considered

### Trust the repository URL from ARD/marketplace metadata

Rejected. Anyone/upstream metadata can point at a public repository.

### Require a commit author signature only

Rejected as the primary mechanism. Commit authorship/signature does not necessarily prove authority to publish the distributed resource mapping, and repositories can have more complex governance.

### Require publisher to commit an AegisOne challenge file into the repository

Not selected for the MVP because it creates repository mutations/UX friction and still needs a clear account/permission model. It may become an additional domain/repository challenge adapter later.

### Use only GitHub Artifact Attestations

Not selected as the sole source-auth path because many Skills/releases will not already publish attestations. Attestations are a stronger optional tier rather than a prerequisite for every authenticated source claim.

### Treat authenticated GitHub ownership as `MATCH`

Rejected. Repository authority and artifact correspondence are independent questions.

## Consequences

Positive:

- concrete, understandable source-assurance claim;
- free/current GitHub platform primitives;
- no need to call a random repo “official”;
- stable repository IDs reduce rename confusion;
- stronger signed provenance can slot in later without changing correspondence semantics.

Trade-offs:

- requires the user/publisher to complete GitHub authentication/installation;
- GitHub account compromise remains residual risk;
- private repositories require future secret-isolated acquisition design;
- `SIGNED_RELEASE` remains unavailable for resources without cryptographically verified provenance.

## Implementation

Issue #24 / M8.5 implements this decision. Detailed route/API/security/database design is in:

- `docs/14-source-authentication.md`
- `docs/15-m8-api-inventory.md`
- `docs/16-m8-database-plan.md`
- `docs/17-m8-security-boundaries.md`
