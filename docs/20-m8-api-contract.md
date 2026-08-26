# M8.7 — Frozen stable resource/evidence/policy API contract

Status: frozen for M8.8 (MCP interface) and M9 (Hub frontend) consumption. Implemented in
`apps/web/src/api-v1.ts`, wired into `createProductRequestHandler` (`apps/web/src/product.ts`).

This is the machine-readable API surface `docs/15-m8-api-inventory.md` section 13 calls the
"Stable read API". It is a *read/serialization* layer over evidence M8.1-M8.6 already produce —
it does not compute correspondence, does not authenticate a source claim, and does not call an
LLM, a discovery provider, GitHub OAuth, Supabase to invent missing evidence, a blockchain, or the
worker/build system.

## Non-negotiable design invariant

**No response in this contract ever contains an ambiguous `verified: true` / `safe: true` field.**
Every response exposes the independent M8 trust dimensions by name:

- discovery state/provider attribution (`discovery`)
- source assurance (`trust.sourceAssurance`)
- source inspection (`trust.sourceInspection`)
- distribution correspondence (`trust.correspondence`)
- security assessment (`trust.security`)
- canonical evidence digest/freshness/0G pointers (`trust.canonicalEvidence`)

`INDEXED` discovery state never implies verification. `MATCH` never implies safe. A search
relevance score never enters any response's trust or policy fields (docs/17-m8-security-boundaries.md
Threat M8-020).

Every route response carries a top-level `schemaVersion: "1"` field.

## Integrity re-check before strong verdicts

Supabase is mutable application/catalog memory, not proof authority (`AGENTS.md`). Before a
response may present `REPOSITORY_AUTHENTICATED` / `SIGNED_RELEASE` source assurance or a `MATCH` /
`MISMATCH` / `DIVERGED` correspondence verdict, this layer re-runs the same checks M8.5/M8.6
already established at write time:

- **source claims**: `computeSourceClaimDigest` (`@aegisone/source-auth-github`) recomputes the
  claim digest from the stored canonical claim JSON. If it does not match the stored
  `claimDigestSha256`, the claim is treated as unavailable evidence (`NONE` assurance, empty
  `evidenceRefs`) — never as a downgraded-but-still-trusted level.
- **capability verifications**: `validateNewCapabilityVerification`
  (`@aegisone/catalog-store`) re-runs the MATCH/MISMATCH/DIVERGED digest-presence and
  COMPLETED-security-findings structural sanity rules. If a stored row fails them, its
  `sourceInspection`/`correspondence`/`security`/`canonicalEvidence` are all treated as
  unavailable (`NOT_RUN` / `NOT_EVALUATED` / `NONE`) rather than presented as a partially-trusted
  verdict.

Every response that carries a rolled-up `trust` object is accompanied by an `integrity` object
recording whether this re-check ran and whether it passed, per dimension:

```ts
interface EvidenceIntegrityFlags {
  present: boolean;             // was there a stored row/claim to check at all?
  integrityCheckPassed: boolean; // did the digest/structural re-check pass?
}

interface AssembledIntegrity {
  sourceAssurance: EvidenceIntegrityFlags;
  canonicalVerification: EvidenceIntegrityFlags;
}
```

## Routes

### `GET /api/v1/resources/:resourceId`

`resourceId` is the stable catalog id (`agentic_resources.id`) — not the ARD/federated
`CapabilityResource.id`, which remains available inside the nested `resource` object.

```ts
interface ResourceApiResponse {
  schemaVersion: "1";
  resourceId: string;
  currentVersionId: string | null;
  resource: CapabilityResource; // @aegisone/capability-model, full independent trust dimensions
  integrity: AssembledIntegrity;
}
```

404 `resource_not_found` when no resource exists with that id.

### `GET /api/v1/resources/:resourceId/versions/:versionId`

`versionId` is the stable catalog id (`resource_versions.id`). A version that exists but does not
belong to `resourceId` also 404s (`version_not_found`) — it never leaks another resource's version.

```ts
interface VersionApiResponse {
  schemaVersion: "1";
  resourceId: string;
  version: CapabilityVersion; // id, versionLabel, source, distribution
  trust: CapabilityTrustEvidence; // this version's own trust view, independently assembled
  integrity: AssembledIntegrity;
}
```

404 `resource_not_found` / `version_not_found` as appropriate.

### `GET /api/v1/resources/:resourceId/evidence`

Fuller evidence view for the resource's current version: the same rolled-up `trust`/`integrity` as
the resource endpoint, plus itemized history with a per-item integrity flag.

```ts
interface EvidenceApiResponse {
  schemaVersion: "1";
  resourceId: string;
  currentVersionId: string | null;
  trust: CapabilityTrustEvidence;
  integrity: AssembledIntegrity;
  sourceClaims: SourceClaimEvidenceItem[];        // currently active claim(s) only
  capabilityVerifications: CapabilityVerificationEvidenceItem[]; // full history, newest first
}

interface SourceClaimEvidenceItem {
  id: string;
  assuranceLevel: SourceAssuranceLevel;  // "NONE" when integrityCheckPassed is false
  claimStatus: "active" | "superseded" | "conflicted" | "revoked";
  sourceRepository: string;
  sourceCommitSha: string;
  sourceSubdirectory: string | null;
  distributionUrl: string | null;
  distributionSha256: string | null;
  authenticatedAt: string | null;        // null when integrityCheckPassed is false
  createdAt: string;
  supersedesClaimId: string | null;
  integrityCheckPassed: boolean;
}

interface CapabilityVerificationEvidenceItem {
  id: string;
  artifactKind: "agent-skill";
  sourceInspectionStatus: SourceInspectionStatus;
  sourceSnapshotSha256: string | null;
  correspondenceStatus: CorrespondenceStatus;
  publisherSha256: string | null;
  reproducedSha256: string | null;
  securityStatus: SecurityAssessmentStatus;
  securityHighestSeverity: SecuritySeverity | null;
  securityFindingCount: number | null;
  canonicalEvidenceSha256: string | null;
  storageRoot: string | null;
  storageTransaction: string | null;
  registryContract: string | null;
  registryRecordId: string | null;
  registryTransaction: string | null;
  verifiedAt: string | null;
  createdAt: string;
  integrityCheckPassed: boolean; // false => every evidence-bearing field above is null/NOT_* above
}
```

`sourceClaims` currently reflects the catalog store's active-claim query only (a superseded or
conflicted claim is not yet independently listed by this endpoint); this matches the current
`CatalogStore` read surface and is not a regression from M8.5/M8.6.

404 `resource_not_found` when the resource does not exist.

### `POST /api/v1/policy/evaluate`

Wraps the existing M8.1 deterministic evaluator (`evaluateTrustPolicy`,
`@aegisone/capability-model`) unchanged. Pure function over supplied/fetched evidence and policy
config — no LLM, discovery provider, GitHub OAuth, Supabase evidence invention, blockchain, or
worker/build call.

Request body (JSON, ≤32 KiB, same limit class as `POST /search`):

```ts
interface PolicyEvaluateRequest {
  policy: TrustPolicy; // @aegisone/capability-model
  // exactly one of the following two:
  resource?: CapabilityResource;  // caller-supplied resource, validated before evaluation
  resourceId?: string;            // looked up + assembled server-side (same integrity re-check
                                   // as GET /api/v1/resources/:resourceId)
}
```

Response is the M8.1 `TrustPolicyResult` unchanged:

```ts
interface TrustPolicyResult {
  schemaVersion: "1";
  decision: "ALLOW" | "REVIEW" | "DENY";
  reasons: TrustPolicyReason[]; // structured { code, decision, message } — never free-text only
}
```

Errors:

- `415 unsupported_media_type` — non-`application/json` content type.
- `413 request_too_large` — body exceeds 32 KiB.
- `400 invalid_request` — malformed JSON, or neither/both of `resource`/`resourceId` supplied.
- `400 invalid_policy` — `policy` missing/malformed (bad `schemaVersion`, unknown
  `missingEvidenceDecision`/`minimumSourceAssurance`/`maximumAuditSeverity`, non-`"MATCH"`
  `requireCorrespondence`, non-positive `maximumEvidenceAgeHours`).
- `400 invalid_resource` — inline `resource` fails `@aegisone/capability-model` structural
  validation; `details` carries the structured issue list.
- `404 resource_not_found` — `resourceId` does not resolve to a stored resource.

## Error taxonomy (all routes)

Every error response has the shape:

```ts
interface ApiV1ErrorResponse {
  error: string;      // stable snake_case code, e.g. "resource_not_found"
  errorCode: string;  // the same code, upper-cased, e.g. "RESOURCE_NOT_FOUND"
  message: string;
  details?: unknown;  // present only for structured validation failures (e.g. invalid_resource)
}
```

Known codes: `resource_not_found`, `version_not_found`, `invalid_request`, `invalid_policy`,
`invalid_resource`, `unsupported_media_type` (415), `request_too_large` (413).

## What this contract deliberately does not do

- Does not expose a single ambiguous `verified`/`safe` boolean anywhere.
- Does not leak a raw `agentic_resources` / `resource_versions` / `source_claims` /
  `capability_verifications` database row — every field is produced by an explicit serializer in
  `apps/web/src/api-v1.ts`.
- Does not let a discovery/relevance score, ARD `trustManifest`, or provider metadata reach
  `trust` or the policy evaluator.
- Does not run new verification logic: `MATCH`/`MISMATCH`/`REPOSITORY_AUTHENTICATED` values shown
  here are always read from evidence M8.5/M8.6 already produced and persisted, re-checked for
  integrity at read time, never recomputed here.
- Does not expose MCP tool transport (`aegisone_search`/`aegisone_inspect`/`aegisone_evaluate`
  are M8.8, Issue #27) — this is the plain HTTP JSON contract those tools are expected to wrap.
