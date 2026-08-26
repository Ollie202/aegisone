# API & Interface Contracts

## Principle

All human, REST, ARD, CLI and MCP interfaces must wrap the same underlying evidence semantics. Agents and frontends must not scrape human text or invent a parallel trust model.

Stable machine output must expose independent dimensions rather than one ambiguous `verified` boolean.

## Existing CLI

### `aegisone verify <artifact>`

Hash a local artifact, resolve supplied evidence, and evaluate correspondence/policy without rebuilding.

Expected options include:

- `--manifest <path|root>`
- `--record <id|tx>`
- `--json`

### `aegisone reproduce <claim|manifest>`

Independently rebuild an exact source claim using the configured runner and compare produced artifact bytes with the publisher artifact.

### `aegisone inspect <record>`

Display source-claim identity, raw evidence, digests, attestation capabilities, and registry/storage references.

## Stable JSON principle

Machine output is versioned and explicit. Historical shape example:

```json
{
  "schemaVersion": 1,
  "sourceClaim": {
    "assurance": "DECLARED",
    "repository": "https://github.com/acme/wallet",
    "commit": "7c91ab..."
  },
  "publisherArtifact": { "sha256": "ABC123..." },
  "reproductions": [
    { "runner": "0g", "sha256": "ABC123...", "match": true }
  ],
  "status": "MATCH",
  "policy": { "passed": true }
}
```

No LLM output participates in correspondence status.

## Provider-independent core interfaces

Conceptually:

```ts
interface SourceClaimVerifier {
  verify(claim: ReleaseClaim): Promise<SourceClaimAssessment>;
}

interface BuildRunner {
  build(request: BuildRequest): Promise<BuildResult>;
}

interface EvidenceStore {
  put(bytes: Uint8Array): Promise<StoredEvidence>;
  get(id: string, verify?: boolean): Promise<Uint8Array>;
}

interface VerificationRegistry {
  register(record: RegistryWrite): Promise<RegistryReceipt>;
  resolve(id: string): Promise<RegistryRead | null>;
}
```

M8 adds the provider-independent `@aegisone/capability-model` for capability discovery/evidence/policy. ARD, GitHub and MCP provider details remain in adapters.

## M8 discovery surface

### `GET /.well-known/ai-catalog.json`

M8.2 advertises AegisOne's ARD-compatible catalog/registry surface.

The ARD contract is pinned behind an adapter; see `docs/15-m8-api-inventory.md`.

### `POST /search`

ARD-compatible discovery endpoint.

Minimum request:

```json
{
  "query": {
    "text": "find me a pull request review skill"
  },
  "pageSize": 10
}
```

Search output may contain broad real ecosystem resources. Discovery/relevance does not imply source authentication, correspondence, security, or canonical evidence.

MVP input policy:

- JSON only;
- body target maximum 32 KiB;
- query text 1–2,000 characters;
- page size default 10, maximum 25;
- supported filters explicitly enumerated;
- unsupported filters return a stable 400 error instead of being silently ignored.

## M8 stable AegisOne read API

M8.7 freezes the backend JSON contract for MCP and the later M9 frontend:

```text
GET  /api/v1/resources/:resourceId
GET  /api/v1/resources/:resourceId/versions/:versionId
GET  /api/v1/resources/:resourceId/evidence
POST /api/v1/policy/evaluate
```

### Resource/evidence response requirements

Responses expose independent fields for:

- resource kind and discovery/provider attribution;
- source assurance;
- source inspection;
- distribution correspondence;
- deterministic security assessment;
- canonical evidence availability/freshness and 0G pointers.

Do not return a single `safe: true` or generic `verified: true` value as a substitute for those dimensions.

### Policy evaluation

Conceptual request:

```json
{
  "resourceId": "...",
  "policy": {
    "schemaVersion": "1",
    "minimumSourceAssurance": "REPOSITORY_AUTHENTICATED",
    "requireCorrespondence": "MATCH",
    "maximumAuditSeverity": "MEDIUM",
    "maximumEvidenceAgeHours": 24,
    "missingEvidenceDecision": "DENY"
  }
}
```

Conceptual result:

```json
{
  "schemaVersion": "1",
  "decision": "DENY",
  "reasons": [
    {
      "code": "correspondence_not_match",
      "decision": "DENY",
      "message": "..."
    }
  ]
}
```

The endpoint is a pure wrapper over the M8.1 deterministic policy evaluator. It may not call an LLM, a build runner, a blockchain or a discovery provider to fill in missing evidence.

## M8 source-authentication API

M8.5 source claims use a GitHub App user authorization flow.

Recommended public routes:

```text
GET  /auth/github/start
GET  /auth/github/callback
GET  /api/v1/source-auth/github/repositories
POST /api/v1/source-claims
GET  /api/v1/source-claims/:claimId
```

`REPOSITORY_AUTHENTICATED` is returned only when a real GitHub-authenticated identity has sufficient effective authority over the stable claimed repository identity and the exact immutable source mapping is canonicalized/digested.

A repository URL discovered through ARD/GitHub remains `NONE` or `DECLARED` until that authority evidence exists.

See `docs/14-source-authentication.md`.

## Internal verification/execution boundary

No anonymous public generic execution endpoint is part of M8.

If app-to-worker HTTP is used, it is internal/authenticated only, conceptually:

```text
POST /internal/v1/source-claims/:claimId/verify
POST /internal/v1/verifications/:verificationId/run
GET  /internal/v1/jobs/:jobId
```

A Supabase-backed queue/polling model is also acceptable if it reuses the existing job-store cleanly. In either design, public search/read/source-auth alone cannot trigger uncontrolled 0G spending.

## M8 MCP interface

M8.8 exposes only three initial tools:

```text
aegisone_search
aegisone_inspect
aegisone_evaluate
```

These wrap the same discovery/read/policy services described above.

M8 does **not** expose initial MCP tools for:

- automatic installation;
- arbitrary execution/builds;
- signing/0G wallet operations;
- secret upload.

MCP is an integration convenience, not a trust primitive.

## Error contract

Initial stable machine-readable errors should use explicit codes such as:

```text
invalid_request
request_too_large
unsupported_filter
provider_timeout
provider_unavailable
resource_not_found
version_not_found
source_claim_not_found
source_claim_conflict
source_not_immutable
source_authority_insufficient
source_auth_expired
source_auth_failed
artifact_unavailable
artifact_too_large
insufficient_evidence
verification_not_authorized
verification_failed
internal_error
```

Do not turn upstream availability errors into AegisOne trust evidence.

## Frontend contract

M9 frontend consumes these APIs rather than direct Supabase tables and never reimplements correspondence/source-auth/policy logic in client state.

Detailed M8 backend contracts/plans:

- `docs/13-m8-backend-blueprint.md`
- `docs/14-source-authentication.md`
- `docs/15-m8-api-inventory.md`
- `docs/16-m8-database-plan.md`
- `docs/17-m8-security-boundaries.md`
