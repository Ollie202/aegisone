# M8 External API / Protocol Inventory

**Purpose:** remove discovery/research ambiguity before implementation. External contracts evolve; M8 pins the observed contract used by each adapter and keeps it behind provider-specific code.

## 1. ARD — Agentic Resource Discovery

### Pin

- Repository: `ards-project/ard-spec`
- Observed specification: **v0.9 Draft / Proposal**
- Pinned commit: `1d25abcf07e081f604dba3ae5398b16c79f20b7b`
- Spec date: 2026-05-28

Do not compile application semantics directly against upstream `main`.

### Required ProofRail server endpoints

```text
GET  /.well-known/ai-catalog.json
POST /search
```

The spec also defines broader registry interfaces such as `/explore` and `/agents`, but M8.2 only needs the minimum search/catalog surface specified by Issue #21.

### Search request shape

Minimum:

```json
{
  "query": {
    "text": "find me a pull request review skill"
  },
  "pageSize": 10
}
```

Optional filter:

```json
{
  "query": {
    "text": "review my pull request",
    "filter": {
      "type": ["application/ai-skill"]
    }
  },
  "pageSize": 10
}
```

Search score is relevance only. It is not ProofRail trust/security evidence.

### Important ARD invariants

- catalog entry uses exactly one content form where applicable: `url` xor `data`;
- media type identifies resource family;
- `metadata.*` is extensible but registry support for filters is provider-defined;
- ARD trust manifests are discovery metadata and cannot create ProofRail source assurance/correspondence;
- ProofRail-specific fields should be namespaced under `metadata.org.proofrail.*` or equivalent adapter namespace;
- unsupported filters must be explicit errors instead of silently ignored security assumptions.

## 2. GitHub Agent Finder

### Contract reference pin

- Repository: `ards-project/ard-connectors`
- Pinned observed commit: `53cc4f3a4596cf51482fabeb554d124ca248ed07`

### Endpoint

```text
POST https://agentfinder.github.com/api/v1/search
```

### Authentication

None required for the documented public endpoint.

### Request

ARD search request:

```json
{
  "query": {
    "text": "deploy a secure Next.js application"
  },
  "pageSize": 10
}
```

Optional resource filter follows provider-supported ARD fields.

### M8 adapter policy

- default timeout target: 3 seconds;
- max response bytes: choose a bounded value, recommended 1 MiB for MVP;
- max accepted results: 25 per call even if upstream returns more;
- validate response before normalization;
- retain upstream resource identifier and source attribution;
- do not treat returned source URL, trustManifest or relevance score as ProofRail verification;
- retry at most once for safe transient failures if total search deadline permits; no retry storm.

## 3. Hugging Face Discover

### Pin

- Repository: `huggingface/hf-discover`
- Pinned observed commit: `49c927439fcaa8f210cfd42186c0641acef579fa`

### Hosted REST endpoint

```text
POST https://huggingface-hf-discover.hf.space/search
```

### Hosted MCP endpoint

```text
https://huggingface-hf-discover.hf.space/mcp
```

ProofRail M8.3 uses the REST endpoint; M8.8 exposes ProofRail's own MCP interface rather than proxying this MCP endpoint directly.

### Search request example

```json
{
  "query": {
    "text": "upload files to a dataset repo",
    "filter": {
      "type": ["application/ai-skill"]
    }
  },
  "pageSize": 5
}
```

The hosted server currently combines indexed Skills and Hugging Face Space-derived capabilities. `application/mcp-server-card+json` is the current MCP card media type in responses; a legacy MCP media-type alias may be accepted upstream but ProofRail should normalize to the pinned ARD form.

### Authentication

Public search does not require ProofRail to provision a paid API key. The upstream implementation can accept optional request-scoped HF credentials for private/expanded access, but M8 must not require or forward user HF tokens.

### M8 adapter policy

Same safety envelope as Agent Finder:

- ~3 second provider timeout;
- 1 MiB response limit target;
- 25-result cap;
- strict response validation;
- provider failure isolated from other discovery providers;
- no server-side arbitrary catalog navigation supplied by the public caller. HF itself intentionally keeps arbitrary URL navigation client-side due SSRF concerns; ProofRail should follow the same principle.

## 4. Official MCP Registry

### Pin

- Repository: `modelcontextprotocol/registry`
- Pinned observed commit: `6036804f1c62633b5e7d2927f411a6f4127f148a`
- Use stable API family: `/v0.1/`

### Base URL

```text
https://registry.modelcontextprotocol.io
```

### Read endpoints used by M8.10

```text
GET /v0.1/servers
GET /v0.1/servers/{serverName}/versions
GET /v0.1/servers/{serverName}/versions/{version}
```

`serverName` and `version` path values must be URL encoded.

Useful list query parameters:

```text
limit
cursor
updated_since
search
version=latest
include_deleted
```

Example incremental/latest query:

```text
GET /v0.1/servers?updated_since=2026-08-01T00:00:00Z&version=latest&limit=100
```

### Authentication

Read/list ingestion is public. Publishing/auth endpoints are out of scope.

### M8 trust policy

An official Registry entry is strong ecosystem metadata, not ProofRail source/artifact proof. Initial ingested MCP resources must remain `INDEXED` unless a separate ProofRail evidence path exists.

Do not call the Registry's GitHub/DNS publishing-auth mechanisms on behalf of resources merely to manufacture ProofRail assurance.

## 5. GitHub REST — exact source acquisition and repository identity

### API version

Send:

```text
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
```

where supported by the current endpoint.

### Repository metadata

```text
GET https://api.github.com/repos/{owner}/{repo}
```

Record stable repository `id` and `node_id` in addition to full name.

### Exact commit

```text
GET https://api.github.com/repos/{owner}/{repo}/commits/{ref}
```

Security-sensitive build/source claims must resolve to a full immutable 40-character commit SHA.

### Exact source archive

```text
GET https://api.github.com/repos/{owner}/{repo}/tarball/{ref}
```

The existing ProofRail source-acquisition path already uses exact-SHA GitHub retrieval for M7. Reuse/harden it rather than creating a second downloader.

### Public authentication/cost

Public repository reads can work unauthenticated but are more rate-limited. A token can raise limits, but M8 must remain functional for the small public demo without a paid API.

## 6. GitHub App — source authentication

See `docs/14-source-authentication.md` for the full security design.

### User authorization start

```text
GET https://github.com/login/oauth/authorize
```

Important parameters:

```text
client_id
redirect_uri
state
```

### Exchange authorization code

```text
POST https://github.com/login/oauth/access_token
```

Use server-side credentials. Never log code/token/client secret.

### Authenticated user identity

```text
GET https://api.github.com/user
```

### Installations accessible to GitHub App user token

```text
GET https://api.github.com/user/installations
```

### Repositories accessible within installation

```text
GET https://api.github.com/user/installations/{installation_id}/repositories
```

The response exposes the user's repository access/permissions. Match stable repository ID.

### Specific repository permission confirmation

```text
GET https://api.github.com/repos/{owner}/{repo}/collaborators/{username}/permission
```

Observed base permissions include `admin`, `write`, `read`, `none`; role name may preserve custom roles. Maintain can map to write/base push semantics. M8 should require effective write/push or admin-equivalent authority for `REPOSITORY_AUTHENTICATED`.

This endpoint supports GitHub App user access tokens with Metadata read under the current docs.

### GitHub App permissions for M8 MVP

Keep minimal. The public source-claim flow can be built around repository Metadata read/user installation access; do not request Contents write or Administration write just to verify authority.

## 7. GitHub Artifact Attestations — optional stronger source/release evidence

### List candidate attestations for repository + subject digest

```text
GET https://api.github.com/repos/{owner}/{repo}/attestations/{subject_digest}
```

`subject_digest` form:

```text
sha256:HEX_DIGEST
```

Public repository attestations may be listable without a token, but **listing is not verification**.

### Required verification tool

Preferred worker command:

```text
gh attestation verify <artifact-path> \
  --repo <owner/repo> \
  --source-digest <expected-source-commit-sha> \
  --format json
```

When the publisher's signer workflow is known/policy-bound, additionally enforce one of:

```text
--signer-workflow <host/owner/repo/path/to/workflow>
--signer-repo <owner/repo>
--signer-digest <sha>
```

GitHub's verifier validates signed attestation identity/provenance. A successful cryptographic verification may feed `SIGNED_RELEASE` evidence if every expected constraint agrees.

Do not parse a REST attestation listing and mark it signed without the cryptographic verifier.

## 8. npm provenance / trusted publishing — future adapter

Not required for M8 backend MVP.

Useful later for npm-distributed agent packages because trusted publishing can issue provenance connecting package publication to a CI identity/source workflow.

If added, normalize it as a provider-specific source-assurance adapter; do not place npm fields in `@proofrail/capability-model`.

## 9. Sigstore / cosign — future adapter

Not required for M8.

Future use:

- keyless identity verification;
- artifact signature/provenance checks;
- Rekor/transparency evidence where applicable.

Like GitHub attestations, verification policy must constrain the expected identity; a cryptographically valid signature from the wrong identity is not sufficient.

## 10. Supabase — current ProofRail project

The existing ProofRail Supabase project is active and currently contains only:

```text
public.verification_jobs
public.proofrail_app_auth
```

Both currently have RLS enabled.

M8 must extend this project with migrations; do not create a second Supabase project.

See `docs/16-m8-database-plan.md`.

Current production app variables already include:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
PROOFRAIL_SUPABASE_APP_TOKEN
PROOFRAIL_JOB_STORE
```

Do not repurpose `PROOFRAIL_SUPABASE_APP_TOKEN` as a GitHub OAuth secret or worker auth secret.

## 11. Railway — current production topology

Project: `proofrail-0g`

Services:

```text
proofrail-app
proofrail-worker
```

Do not add a third permanent service for M8.

### `proofrail-app`

Current production domain:

```text
https://proofrail-app-production.up.railway.app
```

Current start command:

```text
pnpm --filter @proofrail/web start
```

Current health path:

```text
/health
```

### `proofrail-worker`

Current start command:

```text
node --experimental-strip-types apps/worker/src/server.ts
```

Current health path:

```text
/health
```

Worker currently requires `ZEROG_STORAGE_PRIVATE_KEY` at startup and exposes no public signing route. Preserve that boundary.

### Future M8 variable names

On `proofrail-app` after GitHub App exists:

```text
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_SLUG
GITHUB_OAUTH_CALLBACK_URL
GITHUB_OAUTH_STATE_SECRET
```

For app-to-worker auth if an internal HTTP boundary is chosen:

```text
PROOFRAIL_WORKER_INTERNAL_TOKEN
```

Use a separate independently generated value on each service. Do not reuse the Supabase app token or 0G private key.

If queue/polling through Supabase is used instead, this variable may be unnecessary.

On `proofrail-worker` only if GitHub attestation verification needs authenticated private access:

```text
GITHUB_TOKEN
```

Do not require it for public attestation/source demo if unauthenticated public lookup/verification is sufficient.

## 12. 0G integrations — reuse existing implementations

M8 does not introduce a new 0G API.

Reuse the proven pinned integration packages/configuration recorded in `docs/06-integrations.md`:

- 0G Galileo chain ID `16602`;
- 0G Storage SDK already pinned in repository;
- existing Sandbox provider path;
- existing Galileo registry contract;
- existing M5 Aristotle mainnet registry only as historical evidence.

No new Aristotle write is required for M8 MVP.

Search/discovery must never trigger a funded 0G operation. Only an explicit authorized verification job may do so.

## 13. Runtime APIs ProofRail itself should expose by backend freeze

### Discovery

```text
GET  /.well-known/ai-catalog.json
POST /search
```

### Stable read API

```text
GET  /api/v1/resources/:resourceId
GET  /api/v1/resources/:resourceId/versions/:versionId
GET  /api/v1/resources/:resourceId/evidence
POST /api/v1/policy/evaluate
```

### GitHub source auth / claims

```text
GET  /auth/github/start
GET  /auth/github/callback
GET  /api/v1/source-auth/github/repositories
POST /api/v1/source-claims
GET  /api/v1/source-claims/:claimId
```

### Agent/MCP tools

```text
proofrail_search
proofrail_inspect
proofrail_evaluate
```

No public `proofrail_install`, `proofrail_execute`, `proofrail_sign`, or generic arbitrary-build tool in M8.

## Adapter implementation checklist

For every external provider:

- [ ] immutable contract/doc pin recorded;
- [ ] provider-specific parser isolated;
- [ ] strict timeout;
- [ ] maximum response bytes;
- [ ] maximum record count;
- [ ] schema validation;
- [ ] source attribution retained;
- [ ] malformed provider result cannot become trust evidence;
- [ ] partial outage handled explicitly;
- [ ] tests use deterministic recorded fixtures, not live network by default;
- [ ] live smoke test separate from unit/CI path;
- [ ] no token/secret logging.
