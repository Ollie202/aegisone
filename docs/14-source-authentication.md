# M8 Source Authentication — Proving Who Authorized the Source Mapping

## Why this exists

ProofRail has always separated two questions:

1. **Which source is being claimed for this release/capability?**
2. **Do the distributed bytes correspond to independent reproduction from that source?**

M8 discovery makes the first question more important. An ARD entry, marketplace listing, README, package metadata, or user-submitted GitHub URL does not automatically prove that a publisher authorized that repository/commit as the source for the distributed capability.

A repository existing is source resolution, not source authentication.

## Source-assurance ladder

M8 uses the M8.1 levels:

### `NONE`

ProofRail has no authenticated publisher/source mapping. A discovery provider may have supplied a repository or URL, but ProofRail has not verified authority over it.

### `DECLARED`

An explicit mapping was supplied to ProofRail and the immutable source can be resolved, but publisher authority was not proven.

Typical evidence:

- normalized repository URL;
- stable repository ID if obtainable;
- exact 40-character commit SHA;
- optional subdirectory;
- declarant identity if known;
- distribution reference/digest if supplied.

### `REPOSITORY_AUTHENTICATED`

A GitHub-authenticated identity with sufficient effective authority over the exact claimed repository authenticated the source mapping.

For M8 MVP, sufficient authority is effective `write`/push or `admin`-equivalent repository access. Read-only/triage access is insufficient.

This level means only:

> a GitHub identity with sufficient repository authority authenticated this exact source claim.

It does not mean:

- the code is safe;
- the GitHub account is uncompromised;
- the claim represents every stakeholder in an organization;
- the distributed artifact matches the source.

### `SIGNED_RELEASE`

A stronger cryptographic provenance/signature path independently validates the artifact/source relationship and signer identity under an explicitly configured policy.

For the initial implementation, GitHub Artifact Attestations are the primary candidate. Merely retrieving an attestation object is not enough; its signature, timestamps and signer identity must be cryptographically verified.

## M8 GitHub App design

Use a **GitHub App**, not a classic OAuth app, for the publisher claim flow. GitHub Apps are fine-grained, repository-selectable, and can issue user access tokens.

### MVP GitHub App configuration

Suggested name:

`ProofRail Source Verifier`

Suggested production URLs:

- Homepage: `https://proofrail-app-production.up.railway.app`
- Callback: `https://proofrail-app-production.up.railway.app/auth/github/callback`
- Setup URL (optional): `https://proofrail-app-production.up.railway.app/source/claim`

Configuration principles:

- enable user authorization/web application flow;
- allow installation on any account if public product behavior is desired;
- repository selection can be `selected` by the installer;
- no webhook is required for the M8 source-claim MVP;
- no Contents write permission is required merely to verify repository authority;
- use minimum GitHub App permissions, primarily repository Metadata read for the repository/access inspection path;
- do not request Administration write simply to prove a claim.

A GitHub App private key is not required for the basic public-repository source-claim flow described below because the flow can use a short-lived GitHub App **user access token** and user-installation APIs. If later features use installation access tokens or server-to-server app APIs, then add a private key at that time and keep it only in the secret-bearing server boundary.

## Environment variables

`proofrail-app` will eventually require:

```text
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_SLUG
GITHUB_OAUTH_CALLBACK_URL
GITHUB_OAUTH_STATE_SECRET
```

Optional if persistent encrypted OAuth sessions are implemented:

```text
GITHUB_SESSION_ENCRYPTION_KEY
```

Do not add these until the GitHub App actually exists. Do not commit values.

For the basic M8 flow, do not store GitHub user access tokens in Supabase after the short claim/session window.

## OAuth/source-claim flow

### Step 1 — user starts claim authentication

Client requests:

`GET /auth/github/start?returnTo=/source/claim`

Server:

1. creates a cryptographically random nonce/state;
2. binds state to an intended return path and short expiry using an HMAC/encrypted HTTP-only cookie or server-side transient store;
3. redirects to:

`GET https://github.com/login/oauth/authorize`

with at least:

- `client_id`;
- `redirect_uri`;
- `state`.

Do not place source claim contents directly in unsigned query state.

### Step 2 — GitHub callback

GitHub redirects to:

`GET /auth/github/callback?code=...&state=...`

Server must:

1. validate state exactly;
2. enforce state expiry/single use;
3. exchange the authorization code via `POST https://github.com/login/oauth/access_token`;
4. obtain the GitHub App user access token;
5. retrieve authenticated user identity from GitHub;
6. never log the code/token/client secret.

### Step 3 — discover app installations accessible to that user

Using the GitHub App user access token:

`GET https://api.github.com/user/installations`

This lists installations of this GitHub App the authenticated user can access.

Then for a selected installation:

`GET https://api.github.com/user/installations/{installation_id}/repositories`

The repository response includes the user's effective access/permissions. Match the selected repository by stable GitHub repository ID, not only owner/name text.

Alternatively/for confirmation:

`GET https://api.github.com/repos/{owner}/{repo}/collaborators/{username}/permission`

The permission response exposes the base permission (`admin`, `write`, `read`, `none`) plus `role_name`. The endpoint supports GitHub App user access tokens with Metadata read. Custom/maintain roles must be reduced carefully to an accepted base capability; do not guess from a label alone.

### Step 4 — require sufficient authority

MVP rule:

- `admin` => sufficient;
- `write`/push => sufficient;
- `maintain` when represented through effective push/write capability => sufficient;
- `read`, `triage`, `none` => insufficient.

If repository permission cannot be determined confidently, return `source_authority_insufficient` or `source_auth_failed`; do not upgrade assurance.

### Step 5 — resolve immutable repository identity/source

For the claim, independently obtain the repository record and exact commit via GitHub APIs.

Record at least:

```text
githubRepositoryId
githubRepositoryNodeId
ownerLogin
ownerId
repositoryName
repositoryFullName
repositoryHtmlUrl
resolvedCommitSha
sourceSubdirectory (nullable)
authenticatedUserLogin
authenticatedUserId
observedPermission
observedRoleName
authenticatedAt
```

The security-relevant source ref uses the exact `resolvedCommitSha`, never `main`, a branch, or an unpinned tag.

Repository names can change; stable repository ID is part of the evidence.

### Step 6 — construct canonical source claim

Conceptual schema:

```json
{
  "schemaVersion": "1",
  "resourceId": "...",
  "resourceVersionId": "...",
  "provider": "github",
  "repository": {
    "id": 123456789,
    "fullName": "acme/auditor"
  },
  "source": {
    "commitSha": "40-hex",
    "subdirectory": "skills/auditor"
  },
  "distribution": {
    "url": "https://...",
    "sha256": "64-hex"
  },
  "authority": {
    "githubUserId": 1234,
    "githubLogin": "publisher",
    "permission": "write"
  }
}
```

Fields that are not actually observed must be absent/null according to the canonical schema; never infer them.

Canonicalize using the established ProofRail deterministic canonical JSON rules and compute:

`sourceClaimDigest = SHA256(canonicalSourceClaimBytes)`

The digest becomes part of ProofRail verification/canonical evidence. Supabase may cache the claim fields but may not alter the source assurance without the evidence record.

## Source claim persistence

Recommended table is described in `docs/16-m8-database-plan.md`.

Persist:

- claim ID;
- resource/version IDs;
- provider;
- repository stable identifiers;
- exact commit/subdirectory;
- authenticated GitHub identity and effective authority observation;
- assurance level;
- canonical source-claim digest;
- canonical evidence reference when produced;
- created/authenticated timestamps.

Do **not** persist the GitHub access token as part of the claim.

## Source conflicts

A discovery record and an authenticated claim can disagree.

Examples:

- ARD says repository A; authenticated publisher claim says repository B;
- earlier authenticated source claim pins commit A; new signed provenance binds commit B for the same purported release;
- distribution metadata claims version 1.2 but authenticated release provenance corresponds to 1.3.

Do not silently pick the stronger-looking value.

Represent conflict explicitly, e.g.:

`SOURCE_CLAIM_CONFLICT`

Consumer policy should normally return `REVIEW` or `DENY` depending on configuration.

Historical authenticated claims are immutable evidence. A new source mapping creates a new claim/version rather than rewriting the old record.

## Private repositories

Private-source independent builds add secret handling and are **out of scope for M8 MVP**.

The M8 source-auth flow may technically identify a user's private repository if the GitHub App installation permits it, but ProofRail should not claim it can independently reproduce private source until a separate secret-isolated source acquisition design is implemented and reviewed.

For M8, support full verification only for public GitHub sources.

## Stronger `SIGNED_RELEASE` path — GitHub Artifact Attestations

### Discovery/listing

For a known artifact SHA-256 and claimed GitHub repository:

`GET https://api.github.com/repos/{owner}/{repo}/attestations/{subject_digest}`

where:

`subject_digest = sha256:HEX_DIGEST`

This can identify candidate attestation bundles for public resources, but a successful HTTP response does **not** earn `SIGNED_RELEASE`.

### Required cryptographic verification

Preferred MVP implementation is to perform GitHub-supported verification in the worker using GitHub CLI tooling:

```text
gh attestation verify <artifact-path> \
  --repo <owner/repo> \
  --source-digest <expected-source-commit-sha> \
  --format json
```

Where a known release/signer workflow is part of the publisher policy, additionally pin:

```text
--signer-workflow <host/owner/repo/path/to/workflow>
```

or an equivalent signer identity/digest constraint.

The verification must succeed and the resulting verified statement must agree with the artifact digest and expected source identity before emitting `SIGNED_RELEASE`.

Do not treat GitHub-hosted metadata as cryptographic verification by itself.

If the required `gh` version/toolchain is not present in Railway, Codex should either:

1. add it deliberately to the `proofrail-worker` image/build environment with version pinning and tests; or
2. defer `SIGNED_RELEASE` and leave the level unavailable while shipping `REPOSITORY_AUTHENTICATED`.

Do not weaken the definition merely to avoid installing the verifier.

## Future source-auth adapters — not required for M8

Architecture should allow additional providers later:

- npm provenance/trusted publishing;
- Sigstore/cosign keyless signatures;
- domain/DNS challenge bindings;
- HTTP `.well-known` publisher assertions;
- package-registry ownership;
- on-chain publisher identity/authorization.

These are separate adapters that produce normalized `SourceAssuranceEvidence`. Do not mix their provider details into the capability model.

## Security threats and mitigations

### OAuth CSRF/login confusion

- cryptographically random state;
- state expiry;
- single use;
- SameSite + Secure + HttpOnly cookies;
- exact callback allowlist.

### Token theft

- never log tokens;
- short session lifetime;
- no plaintext token persistence;
- HTTPS only;
- no token returned to browser JavaScript if server-side session works.

### Repo rename/transfer confusion

- record stable repository ID and owner ID;
- re-fetch repository metadata during claim creation;
- do not identify proof only by `owner/name` string.

### Permission downgrade after claim

A historical claim records the authority observed at claim time. It does not assert perpetual access. UI/API should expose `authenticatedAt` and optionally re-check current authority separately without rewriting historical proof.

### Compromised GitHub account

`REPOSITORY_AUTHENTICATED` cannot solve account compromise. Stronger signed provenance, multi-party governance, or later publisher identities can reduce this risk. Do not overclaim.

## M8.5 acceptance criteria

`REPOSITORY_AUTHENTICATED` is complete only when:

- [ ] real GitHub App user authorization flow works against production callback;
- [ ] OAuth state is validated and replay-resistant;
- [ ] authenticated GitHub user is resolved;
- [ ] app installation/repository access is checked;
- [ ] stable repository identity is recorded;
- [ ] effective write/admin-equivalent authority is observed;
- [ ] exact immutable commit is resolved independently;
- [ ] source claim canonicalizes deterministically;
- [ ] claim digest is reproducible in tests;
- [ ] insufficient read-only authority cannot upgrade a claim;
- [ ] a random ARD/GitHub URL remains `NONE` or `DECLARED`;
- [ ] no OAuth token/client secret appears in logs, DB fixtures, responses or commits;
- [ ] historical claim evidence is immutable/new claim creates a new record;
- [ ] full repository tests and security checks are green.
