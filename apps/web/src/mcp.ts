import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { ArdAdapterError, type LocalCatalogRecord } from "../../../packages/discovery-ard/src/index.ts";
import type { DiscoveryProvider } from "../../../packages/discovery-providers/src/index.ts";
import type { CatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { ApiV1Error, buildEvidenceResponse, readJsonBody, requireJsonContentType, runPolicyEvaluation } from "./api-v1.ts";
import { performCapabilitySearch, type SearchServiceDependencies } from "./search-service.ts";
import { ProductRequestError } from "./errors.ts";

/**
 * M8.8 (Issue #27): exposes `aegisone_search`, `aegisone_inspect`, and `aegisone_evaluate`
 * through MCP (docs/17-m8-security-boundaries.md Threat M8-018 "MCP becomes a privileged
 * backdoor").
 *
 * This module is a *thin transport adapter* only. Every tool handler below calls the exact same
 * application services `apps/web/src/api-v1.ts` (M8.7, the frozen stable API) and
 * `apps/web/src/search-service.ts` (M8.2/M8.3 search dispatch, factored out of `product.ts` for
 * this reuse) already expose to `POST /search`, `GET /api/v1/resources/:resourceId/evidence`, and
 * `POST /api/v1/policy/evaluate` — never a second search engine, a second policy evaluator, or an
 * alternate interpretation of evidence. Nothing here calls an LLM, a discovery provider beyond the
 * ones already wired into the HTTP surface, GitHub OAuth, Supabase to invent missing evidence, a
 * blockchain, or the worker/build system.
 *
 * Threat M8-018's explicit denylist (`aegisone_install`, `aegisone_execute`, `aegisone_sign`,
 * `aegisone_run_arbitrary_build`, `aegisone_upload_secret`) has no code path here: there are
 * exactly three registered tools, all read/policy-only, and none of them can reach the worker,
 * a signer, or any install/execute primitive.
 *
 * Transport choice: Streamable HTTP (the current MCP SDK's recommended remote transport,
 * `@modelcontextprotocol/sdk` 1.30.0), mounted at `POST /mcp` on the existing `proofrail-app`
 * HTTP server — no third permanent Railway service, no stdio child-process model (which does not
 * fit an already-running shared HTTP service consumed by many remote agent clients). Each request
 * gets its own `McpServer`/`StreamableHTTPServerTransport` pair in stateless mode
 * (`sessionIdGenerator: undefined`), matching the MCP TypeScript SDK's own documented stateless
 * server example (`examples/server/simpleStatelessStreamableHttp.ts`): these tools are pure
 * request/response reads over already-persisted evidence, so no cross-request session state or
 * server-initiated notification stream is needed.
 */

const MAX_MCP_REQUEST_BODY_BYTES = 256 * 1024;

export interface McpServerDependencies extends SearchServiceDependencies {
  readonly catalogStore: CatalogStore;
}

interface ToolTextResult {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
}

function jsonResult(value: unknown): ToolTextResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(code: string, message: string, details?: unknown): ToolTextResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: code, errorCode: code.toUpperCase(), message, ...(details !== undefined ? { details } : {}) }, null, 2),
      },
    ],
    isError: true,
  };
}

/** Every tool handler funnels its failures through here so a malformed/adversarial MCP request
 * gets the same structured error taxonomy the REST API returns — never a stack trace, and never a
 * silently-invented success. */
function toToolErrorResult(error: unknown): ToolTextResult {
  if (error instanceof ApiV1Error) return errorResult(error.code, error.message, error.details);
  if (error instanceof ProductRequestError) return errorResult(error.code, error.message);
  if (error instanceof ArdAdapterError) return errorResult(error.code, error.message);
  return errorResult("internal_error", error instanceof Error ? error.message : String(error));
}

const SEARCH_INPUT_SHAPE = {
  text: z
    .string()
    .min(1, "text must not be empty")
    .max(1000)
    .describe("Natural-language capability search query text (Agent Skills, MCP servers, A2A agents, generic APIs)."),
  type: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe("Optional ARD resource media-type filter(s) to restrict the search to (e.g. an Agent Skill / MCP server / A2A agent / API resource type)."),
  pageSize: z.number().int().min(1).max(50).optional().describe("Maximum number of results to return. Defaults to the ARD adapter's default page size."),
  federation: z
    .union([z.literal("none"), z.array(z.string().min(1)).min(1)])
    .optional()
    .describe(
      '"none" (default) searches only the local pinned ARD catalog fixture. A non-empty array of registered discovery provider ids (e.g. GitHub Agent Finder, Hugging Face Discover) federates the same query to those live providers instead.',
    ),
};

const INSPECT_INPUT_SHAPE = {
  resourceId: z
    .string()
    .min(1, "resourceId must not be empty")
    .describe("Stable AegisOne catalog resource id (agentic_resources.id) — NOT the raw ARD/federated CapabilityResource id returned by aegisone_search."),
};

const EVALUATE_INPUT_SHAPE = {
  policy: z
    .record(z.string(), z.unknown())
    .describe(
      'A TrustPolicy object (@aegisone/capability-model, schemaVersion "1"): missingEvidenceDecision ("REVIEW"|"DENY") required; minimumSourceAssurance, requireCorrespondence ("MATCH"), maximumAuditSeverity, maximumEvidenceAgeHours all optional. Validated by the exact same parser POST /api/v1/policy/evaluate uses.',
    ),
  resource: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("An inline CapabilityResource to evaluate against the policy. Exactly one of resource/resourceId must be supplied."),
  resourceId: z
    .string()
    .min(1)
    .optional()
    .describe("A stable catalog resource id to look up (with the same integrity re-check GET /api/v1/resources/:resourceId uses) and evaluate. Exactly one of resource/resourceId must be supplied."),
};

/**
 * Builds a fresh MCP server exposing exactly the three AegisOne M8.8 tools. Called once per
 * request in `createMcpRequestHandler` below (stateless mode).
 */
export function createAegisOneMcpServer(deps: McpServerDependencies): McpServer {
  const server = new McpServer({ name: "aegisone", version: "1" });

  server.registerTool(
    "aegisone_search",
    {
      title: "AegisOne capability search",
      description:
        "Discovery-only search over agentic capabilities (Agent Skills, MCP servers, A2A agents, generic APIs) — the same ARD-based local/federated search POST /search uses. Results carry a discovery/relevance signal ONLY: INDEXED discovery state and relevance ranking never imply AegisOne verification, source authentication, or safety, and a repository existing in these results is not proof a publisher authorized it as source. Call aegisone_inspect on a specific resourceId before treating any result as trustworthy, and never install/execute a discovered resource automatically.",
      inputSchema: SEARCH_INPUT_SHAPE,
    },
    async (args) => {
      try {
        const rawBody: Record<string, unknown> = {
          query: { text: args.text, ...(args.type ? { filter: { type: args.type } } : {}) },
          ...(args.pageSize !== undefined ? { pageSize: args.pageSize } : {}),
          federation: args.federation ?? "none",
        };
        const result = await performCapabilitySearch(rawBody, { localCatalog: deps.localCatalog, searchSource: deps.searchSource, discoveryProviders: deps.discoveryProviders });
        return jsonResult(result);
      } catch (error) {
        return toToolErrorResult(error);
      }
    },
  );

  server.registerTool(
    "aegisone_inspect",
    {
      title: "AegisOne resource evidence inspection",
      description:
        "Reads the independent AegisOne trust dimensions for one catalog resource — discovery/provider attribution, source assurance, source inspection, distribution correspondence, security assessment, and canonical evidence — via the exact same integrity-rechecked assembly GET /api/v1/resources/:resourceId/evidence uses. Dimensions are always reported independently and by name; this tool never collapses them into a single verified/safe boolean, missing evidence is reported as missing (never inferred), and INDEXED discovery state or a MATCH correspondence verdict never imply the resource is safe to install or execute.",
      inputSchema: INSPECT_INPUT_SHAPE,
    },
    async ({ resourceId }) => {
      try {
        const payload = await buildEvidenceResponse(deps.catalogStore, resourceId);
        if (!payload) return errorResult("resource_not_found", `No resource with id ${resourceId}`);
        return jsonResult(payload);
      } catch (error) {
        return toToolErrorResult(error);
      }
    },
  );

  server.registerTool(
    "aegisone_evaluate",
    {
      title: "AegisOne deterministic policy evaluation",
      description:
        "Evaluates a caller-supplied deterministic TrustPolicy against either an inline resource or a catalog resourceId, via the exact same M8.1 evaluateTrustPolicy function POST /api/v1/policy/evaluate wraps. Returns ALLOW / REVIEW / DENY plus structured machine-readable reasons. Purely deterministic: no LLM, no search-relevance score enters the decision, and this tool performs no install/execute/sign/build action of its own — it only evaluates policy over evidence that was already recorded elsewhere.",
      inputSchema: EVALUATE_INPUT_SHAPE,
    },
    async (args) => {
      try {
        const result = await runPolicyEvaluation(deps.catalogStore, args as Record<string, unknown>);
        return jsonResult(result);
      } catch (error) {
        return toToolErrorResult(error);
      }
    },
  );

  return server;
}

/**
 * Mounts the M8.8 MCP interface at `POST /mcp` on the existing `proofrail-app` HTTP server
 * (`product.ts`). Streamable HTTP, stateless mode: a new `McpServer`/transport pair per request,
 * matching the MCP SDK's own stateless example. The request body is read/size-capped the same way
 * every other JSON POST route in this app already is (`readJsonBody`, M8.7's 32 KiB-class limit
 * family) before being handed to the transport, rather than letting the transport read the raw
 * socket unbounded.
 */
export function createMcpRequestHandler(deps: McpServerDependencies) {
  return async function handleMcpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let parsedBody: unknown;
    try {
      requireJsonContentType(request);
      parsedBody = await readJsonBody(request, MAX_MCP_REQUEST_BODY_BYTES);
    } catch (error) {
      const code = error instanceof ApiV1Error ? error.code : "invalid_request";
      const status = error instanceof ApiV1Error ? error.status : 400;
      response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(`${JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: error instanceof Error ? error.message : String(error), data: code } , id: null })}\n`);
      return;
    }

    const server = createAegisOneMcpServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, parsedBody);
  };
}
