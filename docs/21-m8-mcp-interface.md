# M8.8 — MCP interface (`aegisone_search`, `aegisone_inspect`, `aegisone_evaluate`)

Status: implemented on `agent/m8-mcp-interface` (Issue #27). Wraps the M8.7 frozen contract
(`docs/20-m8-api-contract.md`) and the M8.2/M8.3 search surface through MCP
(`docs/17-m8-security-boundaries.md` Threat M8-018 "MCP becomes a privileged backdoor").

## What this is

A **thin transport adapter**, not a second implementation of search, evidence assembly, or policy
evaluation. Every tool handler in `apps/web/src/mcp.ts` calls the exact same application services
the REST API already calls:

- `aegisone_search` → `apps/web/src/search-service.ts`'s `performCapabilitySearch` (the same
  function `POST /search` now calls; M8.2 local-catalog and M8.3 federated dispatch logic was
  moved there unchanged so both the HTTP route and this tool share it byte-for-byte).
- `aegisone_inspect` → `apps/web/src/api-v1.ts`'s `buildEvidenceResponse` (the same function
  `GET /api/v1/resources/:resourceId/evidence` now calls, including its M8.5/M8.6 integrity
  re-check before presenting `REPOSITORY_AUTHENTICATED`/`SIGNED_RELEASE`/`MATCH`/`MISMATCH`).
- `aegisone_evaluate` → `apps/web/src/api-v1.ts`'s `runPolicyEvaluation` (the same function
  `POST /api/v1/policy/evaluate` now calls: `parsePolicy` + `resolvePolicySubjectResource` +
  the unmodified M8.1 `evaluateTrustPolicy`).

No LLM, discovery provider beyond the ones already wired into the HTTP surface, GitHub OAuth,
Supabase evidence invention, blockchain call, or worker/build invocation exists anywhere in this
module.

## Package layout: `apps/web/src/mcp.ts`, not a new `packages/mcp-aegisone`

`AGENTS.md`'s "Planned M8 package boundaries" lists `packages/mcp-aegisone` as the target name for
this adapter. This implementation deliberately does not create that package, and the deviation is
recorded here rather than left implicit:

- Packages in this workspace are consumed by apps, never the reverse (`apps/web` imports from
  `packages/*` via relative paths; no package imports from `apps/*`).
- The M8.7 "same code path" requirement (`docs/20-m8-api-contract.md`) means the MCP tools must
  call the *exact* functions `apps/web/src/api-v1.ts` and the search route already use, not a
  reimplementation of them. Those functions live in `apps/web` (they assemble catalog rows into
  the frozen API response shape) and `apps/web` itself must mount the MCP HTTP route — so a
  standalone `packages/mcp-aegisone` importing them back would create `apps/web → mcp-aegisone →
  apps/web`, a circular dependency.
- Given the issue's own explicit alternative ("call into the same functions apps/web/src/api-v1.ts
  and the search handler call, or make internal HTTP calls to the running proofrail-app... pick
  whichever is more consistent with the existing repo's internal-call conventions"), and that this
  repository's only existing internal-call convention is same-process function composition (see
  how `product.ts` already wires `createApiV1Router`/`createSourceAuthRouter` together, never an
  HTTP loopback), the smallest-coherent-change choice was to add `apps/web/src/mcp.ts` alongside
  those files rather than introduce either a loopback HTTP hop or a circular package.
- `apps/web/src/search-service.ts` and `apps/web/src/errors.ts` were factored out of `product.ts`
  in this same change specifically so `mcp.ts` and `product.ts` can both depend on them without
  either depending on the other.

If a later milestone needs the search/evidence/policy assembly logic from outside `apps/web`
(e.g. a real `packages/mcp-aegisone` consumed by something other than this HTTP service), the
correct follow-up is to relocate that assembly logic into a package first, then have both
`apps/web` and the new package depend on it — not to duplicate it.

## Tool surface

Exactly three tools, matching Threat M8-018's allowlist. None of the explicitly banned tools
(`aegisone_install`, `aegisone_execute`, `aegisone_sign`, `aegisone_run_arbitrary_build`,
`aegisone_upload_secret`) exist in this codebase; a regression test in `apps/web/test/mcp.test.ts`
asserts the connected tool list is exactly the three allowed names.

### `aegisone_search`

Discovery-only. Input:

```ts
{
  text: string;              // required, 1-1000 chars
  type?: string[];            // optional ARD media-type filter(s)
  pageSize?: number;           // optional, 1-50
  federation?: "none" | string[]; // "none" (default): local pinned ARD catalog only.
                                    // array of provider ids: M8.3 federated discovery.
}
```

Output: the same JSON `POST /search` returns (local `ArdEntry` results or federated
`CapabilityResource` results, unchanged). `INDEXED` state and relevance scores are discovery
signals only — never a trust or safety verdict.

### `aegisone_inspect`

Input: `{ resourceId: string }` — the stable catalog id (`agentic_resources.id`), not the raw
ARD/federated resource id `aegisone_search` returns.

Output: the exact `EvidenceApiResponse` shape from `docs/20-m8-api-contract.md`
(`GET /api/v1/resources/:resourceId/evidence`) — discovery, source assurance, source inspection,
distribution correspondence, security assessment, and canonical evidence are always reported
**independently and by name**. This tool never returns a collapsed `verified`/`safe` boolean; a
dedicated test asserts neither substring appears in the raw tool output, and a second test proves a
purely `INDEXED` (discovery-only) resource reports every dimension as
`NONE`/`NOT_RUN`/`NOT_EVALUATED` rather than an inferred/upgraded verdict.

`404 resource_not_found` (as a tool `isError` result, not a thrown protocol error) when the id does
not resolve.

### `aegisone_evaluate`

Input:

```ts
{
  policy: object;       // TrustPolicy, @aegisone/capability-model schemaVersion "1"
  resource?: object;    // inline CapabilityResource — exactly one of resource/resourceId
  resourceId?: string;  // catalog resourceId, looked up with the same integrity re-check
}
```

Output: the M8.1 `TrustPolicyResult` unchanged — `{ schemaVersion, decision: "ALLOW"|"REVIEW"|"DENY", reasons }`.
Purely deterministic; a search-relevance score can never enter this evaluation because
`aegisone_search`'s output is never fed into `aegisone_evaluate` as evidence — only an already
catalogued/verified resource (by id) or a caller-validated inline resource is.

## Malformed input / error taxonomy

All three tools validate their arguments against a published JSON Schema (via Zod, converted by
the MCP SDK) before the handler body runs. Structurally invalid arguments (empty search text,
missing `resourceId`, both/neither of `resource`/`resourceId`, an unknown federation provider id,
a malformed policy) come back as an MCP `CallToolResult` with `isError: true` and the same
`error`/`errorCode`/`message` shape the REST API uses — never a stack trace, never a silently
invented success. See `apps/web/test/mcp.test.ts` for the full set of malformed-input and
missing-evidence regression cases.

## Transport choice and why

**Streamable HTTP**, mounted at `POST /mcp` on the existing `proofrail-app` HTTP server
(`apps/web/src/product.ts`) — no third permanent Railway service, no separate deployment.

Considered stdio: rejected. Stdio assumes the MCP server is spawned as a local child process by
the client, which fits a developer's local machine but not a shared, already-running, publicly
reachable HTTP service consumed by many remote agent clients — the same shape every other M8
surface (`POST /search`, `GET /api/v1/resources/...`, `POST /api/v1/policy/evaluate`) already has.

Within Streamable HTTP, **stateless mode** (`sessionIdGenerator: undefined`) was chosen over
session-stateful mode: these three tools are pure request/response reads over already-persisted
evidence with no need for server-initiated notifications or multi-request session state, matching
the MCP TypeScript SDK's own documented stateless example
(`@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStatelessStreamableHttp.js`). A new
`McpServer`/`StreamableHTTPServerTransport` pair is constructed per HTTP request; only `POST /mcp`
is supported (`GET`/`DELETE` return `405`), since no long-lived SSE stream or session termination
semantics are needed.

`@modelcontextprotocol/sdk` was not previously a dependency anywhere in this repository. `1.30.0`
(the latest stable release as of implementation) was pinned in `apps/web/package.json`.

## Client setup

Point any MCP client that supports Streamable HTTP at:

```
POST https://<proofrail-app-host>/mcp
```

Example client configuration (the shape most MCP-aware coding agents/IDEs use for a remote
Streamable HTTP server):

```json
{
  "mcpServers": {
    "aegisone": {
      "url": "https://proofrail-app-production.up.railway.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

Locally (against `pnpm --filter @aegisone/web start`, default `http://localhost:3000`):

```json
{
  "mcpServers": {
    "aegisone": {
      "url": "http://localhost:3000/mcp",
      "transport": "streamable-http"
    }
  }
}
```

No authentication/API key is required — every tool here is read/policy-only over public evidence,
matching every other M8 public HTTP route.

## What is proven vs. what still needs a human

**Proven by automated test** (`apps/web/test/mcp.test.ts`, part of `pnpm --filter @aegisone/web test`
and root `pnpm check`/`pnpm test`): a real `@modelcontextprotocol/sdk` TypeScript `Client` (not a
hand-rolled test double) connects over an actual `StreamableHTTPClientTransport` to a real
`node:http` server running `createProductRequestHandler`, lists tools, and calls all three tools
end-to-end — including a missing-evidence/INDEXED-only regression, a fully verified
`REPOSITORY_AUTHENTICATED`/`MATCH` resource, and multiple malformed-input cases. Real output from
this run is pasted in the PR description.

**Not proven by this environment, and not claimed as proven**: that a specific external product
(Claude Desktop, Claude Code's own `/mcp` configuration, Cursor, etc.) renders or consumes these
tools correctly in its own UI. That requires a human to point a real external client at a running
`proofrail-app` deployment (local or Railway) using the config snippet above and confirm the three
tools appear and behave as expected. This gap is intentional and stated here rather than inferred
away, per `AGENTS.md`'s completion standard.
