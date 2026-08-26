# M8.11 — Backend contract freeze index

Status: frozen for M9 (Hub frontend) consumption as of Issue #30 / branch `agent/m8-11-backend-freeze`.

This document does not repeat contracts already frozen and documented elsewhere; it is the single
index M9 should start from, plus the two pieces that were previously undocumented (source-claim
response shapes, a single cross-endpoint error-code table) and an explicit statement of what data
point M9 needs and where it comes from.

## Where each contract lives

| Surface | Frozen in |
| --- | --- |
| `GET /.well-known/ai-catalog.json`, `POST /search` (local catalog + M8.3/M8.10 federation) | `docs/15-m8-api-inventory.md` §1 (ARD pin/shape), `PROJECT_STATE.md` M8.2/M8.3/M8.10 sections; response shape is `searchLocalCatalog`'s `ArdEntry[]`/`FederatedSearchResult` (`packages/discovery-ard`, `packages/discovery-providers`) |
| `GET /api/v1/resources/:resourceId` | `docs/20-m8-api-contract.md` |
| `GET /api/v1/resources/:resourceId/versions/:versionId` | `docs/20-m8-api-contract.md` |
| `GET /api/v1/resources/:resourceId/evidence` | `docs/20-m8-api-contract.md` |
| `POST /api/v1/policy/evaluate` | `docs/20-m8-api-contract.md` |
| `GET /auth/github/start`, `GET /auth/github/callback`, `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`, `GET /api/v1/source-claims/:claimId` | `docs/14-source-authentication.md` §"Implemented HTTP response shapes (M8.11 contract freeze)" |
| `proofrail_search`, `proofrail_inspect`, `proofrail_evaluate` (MCP) | `docs/21-m8-mcp-interface.md` |
| `@proofrail/capability-model` types (`CapabilityResource`, `CapabilityTrustEvidence`, `TrustPolicy`, `TrustPolicyResult`) | `packages/capability-model/src/model.ts` (source of truth); narrative in `docs/13-m8-backend-blueprint.md` |

## Consolidated error-code reference

Three routers currently exist in `apps/web`, and they do **not** share one error envelope shape —
this is a real, current fact about the implementation, not something this freeze silently
normalizes away (normalizing it would be a behavior change requiring its own tests). M9 must branch
on which router produced a response, not assume one shape everywhere.

### `api-v1.ts` (`/api/v1/resources/*`, `/api/v1/policy/evaluate`) and `mcp.ts` tool errors

```ts
interface ApiV1ErrorResponse {
  error: string;      // snake_case, e.g. "resource_not_found"
  errorCode: string;  // same code, upper-cased
  message: string;
  details?: unknown;  // present only for structured validation failures
}
```

| `error` | HTTP status | Meaning |
| --- | --- | --- |
| `resource_not_found` | 404 | no `agentic_resources` row with that id |
| `version_not_found` | 404 | version id does not belong to the given resource |
| `invalid_request` | 400 | malformed JSON, missing/duplicate `resource`/`resourceId`, bad path segment encoding |
| `invalid_policy` | 400 | malformed `TrustPolicy` (schema version, enum values, non-positive age) |
| `invalid_resource` | 400 | inline `resource` fails `@proofrail/capability-model` structural validation (`details` carries issues) |
| `unsupported_media_type` | 415 | non-`application/json` content type |
| `request_too_large` | 413 | body exceeds the route's byte limit |

MCP tool errors reuse this exact shape inside `CallToolResult.content[0].text` with `isError: true` (never a thrown JSON-RPC protocol error for an application-level failure).

### `product.ts` (`/search`, catalog manifest, legacy job routes) and `discovery-ard`/`discovery-providers` errors

```ts
interface ProductErrorResponse {
  error: string;      // snake_case
  errorCode: string;  // upper-cased
  message: string;
}
```

Known codes include the ARD adapter's own taxonomy (`invalid_request`, `unsupported_filter`,
`request_too_large`, `unsupported_media_type`) plus `not_found` for unmatched routes. No `details`
field on this router.

### `source-auth.ts` (`/auth/github/*`, `/api/v1/source-auth/github/repositories`, `/api/v1/source-claims*`)

```ts
interface SourceAuthErrorResponse {
  error: string;   // snake_case, e.g. "github_source_auth_unavailable"
  message: string; // no errorCode, no details field
}
```

Known codes: `invalid_return_to`, `invalid_request`, `oauth_state_invalid`, `github_source_auth_unavailable` (503), `source_auth_session_required` (401), `private_repository_unsupported`, `source_claim_not_found` (404), `source_claim_integrity_check_failed` (409), plus any `GithubSourceAuthError` code forwarded with its own upstream-derived status (4xx from GitHub, or 502 for anything else).

### MCP JSON-RPC transport-level errors (before a tool ever runs)

`POST /mcp` with a non-JSON body, a bad `Content-Type`, or a `GET`/`DELETE` request returns the
standard JSON-RPC error envelope (`{ jsonrpc: "2.0", error: { code, message, data? }, id: null }`),
distinct from both shapes above — this is the MCP SDK's own protocol-level error, not an
application error.

## Confirming M9 needs no direct Supabase access or HTML scraping

Every data point the M9 frontend plan (`docs/18-m9-frontend-plan.md`) names has a corresponding
JSON endpoint documented above:

- **Human capability search** → `POST /search` (local or federated).
- **Resource detail / Evidence Passport** → `GET /api/v1/resources/:resourceId` and
  `GET /api/v1/resources/:resourceId/evidence` (itemized source-claim/verification history with
  per-item integrity flags — everything an "Evidence Passport" view needs, including *why* a
  dimension is unavailable, not just that it is).
- **GitHub publisher/source-claim UX** → `GET /auth/github/start` (browser redirect),
  `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`,
  `GET /api/v1/source-claims/:claimId`.
- **Deterministic policy playground** → `POST /api/v1/policy/evaluate` (accepts either an inline
  resource or a `resourceId`, so the playground can evaluate a hypothetical policy against a real
  catalog resource without the frontend reimplementing any evidence assembly).
- **Agent-facing consumption** → the three MCP tools, for any client that prefers MCP over REST.

No route in this list requires the frontend to read a Supabase table directly, hold a
service-role/anon key, or scrape server-rendered HTML for data (the existing `/`, `/jobs/:id` HTML
pages remain the pre-M8 human verification UI and are unrelated to this JSON contract).

## What is explicitly *not* frozen by this document

- The pinned upstream discovery contracts (`docs/15-m8-api-inventory.md`) can still change if an
  upstream provider changes its wire shape — that is a provider-adapter concern, not this
  application-JSON contract.
- `SIGNED_RELEASE` has no implemented emission path yet (`docs/14-source-authentication.md`); when
  it is added, its evidence shape will extend `SourceAssuranceEvidence`/`SourceClaimEvidenceItem`
  additively, not change any field documented here.
- Rate limiting / auth on top of these routes (currently all public/read-only) is not part of this
  freeze; adding it should be additive (new response headers/`429`), not a breaking shape change.

## M8.11 security regression closure (Issue #30 security gate)

Every item in `docs/17-m8-security-boundaries.md`'s "Security test matrix" and "Operational
pre-frontend security gate" was re-verified against the current `main` before this freeze. Findings:

| Item | Status | Where proven |
| --- | --- | --- |
| Public search cannot trigger live/funded 0G work | Confirmed by code inspection: `apps/web` has zero imports of `packages/sandbox-0g`/`storage-0g`/`registry-0g`, and `apps/web/package.json` depends only on `@modelcontextprotocol/sdk` + `zod`. `/search`, `/api/v1/*`, `/mcp` call only `performCapabilitySearch`/`buildEvidenceResponse`/`runPolicyEvaluation`, none of which import a 0G package. | Static check (this issue) |
| `proofrail-app` has no 0G private key | Confirmed: no `ZEROG_STORAGE_PRIVATE_KEY` (or any `ZEROG_*`) reference anywhere under `apps/web` | Static check (this issue) |
| `proofrail-worker` has no anonymous mutation/signing endpoint | Confirmed: `apps/worker/src/server.ts` serves exactly `GET /health` (200, status JSON only) and 404s every other path/method — no route accepts a body or performs a write | Static check (this issue) |
| OAuth state/replay/token logging protections | Existing `apps/web/test/source-auth.test.ts` (state signature/expiry/replay, cookie-bound single use, token never returned/logged) | Reused, confirmed still green |
| SSRF controls for server-side distribution fetch | Existing `packages/skill-verification-link/test/*` (loopback/private/link-local/CGNAT blocking, redirect re-validation, size cap, HTTPS-only) | Reused, confirmed still green |
| Redirect re-validation, archive/path/decompression/file-count limits | Existing `packages/skill-verification-link` + `packages/skill-audit` regression suites | Reused, confirmed still green |
| Request/page/upstream response limits | Existing per-route tests across `discovery-ard`, `discovery-providers`, `api-v1.test.ts`, `mcp.ts` | Reused, confirmed still green |
| Provider timeout/failure isolation | Existing `packages/discovery-providers` outage-isolation tests (M8.3/M8.10) | Reused, confirmed still green |
| GitHub read-only authority cannot become repository authenticated | Existing `source-auth.test.ts` "read-only authority never upgrades a claim" | Reused, confirmed still green |
| DB/discovery metadata cannot manufacture trust evidence, through the full REST+MCP stack | **New**: `apps/web/test/m8-11-hostile-full-stack.test.ts` — a hostile discovery-provider-shaped payload (forged `REPOSITORY_AUTHENTICATED`/`MATCH`/`AVAILABLE` trust submitted through the real `upsertDiscoveredResource` entry point) plus a hostile catalog-store row (a `CatalogStore` subclass returning a tampered source claim and a structurally-invalid capability-verification row, bypassing write-time validation to simulate a mutated Supabase row) are asserted, through a real HTTP server and a real MCP SDK client, to never reach `ALLOW`/`MATCH`/`REPOSITORY_AUTHENTICATED` on `GET /api/v1/resources/:id`, `GET /api/v1/resources/:id/evidence`, `POST /api/v1/policy/evaluate`, `proofrail_inspect`, or `proofrail_evaluate`. Prior coverage of this invariant (`api-v1.test.ts`'s DB-tampering tests) called `assembleTrustEvidence` directly at the unit level; this is the first test to drive it through the live HTTP+MCP transport end to end. | **Added this issue** |
| MCP exposes no install/execute/sign primitive | Existing `mcp.test.ts` "lists exactly the three allowed ProofRail tools" | Reused, confirmed still green |
| Canonical evidence integrity still gates cached strong verdicts | Existing `api-v1.test.ts` DB-tampering unit tests, now also covered end-to-end by the new hostile full-stack test above | Reused + extended this issue |

No existing label, test, or invariant was weakened to produce this table.
