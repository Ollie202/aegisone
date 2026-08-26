import { ARD_MEDIA_TYPES } from "../../discovery-ard/src/constants.ts";
import type { CapabilityResource } from "../../capability-model/src/model.ts";
import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  MCP_OFFICIAL_REGISTRY_BASE_URL,
  MCP_OFFICIAL_REGISTRY_PROVIDER_ID,
  MCP_OFFICIAL_REGISTRY_SERVERS_PATH,
  MCP_REGISTRY_DEFAULT_PAGE_LIMIT,
  MCP_REGISTRY_MAX_PAGE_LIMIT,
} from "./constants.ts";
import { DiscoveryProviderError } from "./errors.ts";
import type { FetchLike } from "./http.ts";
import { getBoundedJson } from "./http.ts";
import { normalizeMcpRegistryEntry } from "./mcp-registry-normalize.ts";
import type { DiscoveryProvider, DiscoveryProviderResult, DiscoveryQuery } from "./types.ts";

/**
 * Official MCP Registry read integration.
 *
 * Contract reference: `modelcontextprotocol/registry@6036804f1c62633b5e7d2927f411a6f4127f148a`.
 * Base: `https://registry.modelcontextprotocol.io`. Read family: `/v0.1/`. Verified live and
 * reachable against production during implementation (docs/15-m8-api-inventory.md section 4);
 * the observed response shape (`{ servers: [{ server, _meta }], metadata: { nextCursor?, count } }`)
 * matches the pinned contract, so no pin deviation was required.
 *
 * An entry's presence in the Registry is ecosystem publication metadata, not AegisOne
 * source/artifact proof — every normalized resource stays `INDEXED` with empty/unavailable trust
 * evidence (`mcp-registry-normalize.ts`), exactly like the M8.3 providers.
 */

export interface McpRegistryPageParams {
  readonly search?: string;
  readonly cursor?: string;
  readonly updatedSince?: string;
  readonly limit?: number;
  readonly versionLatestOnly?: boolean;
}

export interface McpRegistryPageResult {
  readonly resources: CapabilityResource[];
  readonly skippedInvalidCount: number;
  readonly nextCursor: string | null;
  readonly count: number;
}

export interface McpRegistryHttpOptions {
  readonly baseUrl?: string;
  readonly allowedOrigins?: readonly string[];
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly fetchImpl?: FetchLike;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildServersUrl(baseUrl: string, params: McpRegistryPageParams, limit: number): string {
  const url = new URL(MCP_OFFICIAL_REGISTRY_SERVERS_PATH, baseUrl);
  url.searchParams.set("limit", String(limit));
  if (params.search !== undefined && params.search.trim() !== "") url.searchParams.set("search", params.search.trim());
  if (params.cursor !== undefined && params.cursor.trim() !== "") url.searchParams.set("cursor", params.cursor.trim());
  if (params.updatedSince !== undefined && params.updatedSince.trim() !== "") url.searchParams.set("updated_since", params.updatedSince.trim());
  if (params.versionLatestOnly !== false) url.searchParams.set("version", "latest");
  return url.toString();
}

/**
 * Fetches and normalizes a single bounded page of `GET /v0.1/servers`. Never throws for
 * malformed/dropped individual entries (they are counted in `skippedInvalidCount`); throws
 * `DiscoveryProviderError` for transport-level failures (timeout, oversized response, disallowed
 * origin, malformed top-level JSON shape), matching the M8.3 providers' error taxonomy.
 */
export async function fetchMcpRegistryServersPage(
  params: McpRegistryPageParams,
  signal: AbortSignal,
  options: McpRegistryHttpOptions = {},
): Promise<McpRegistryPageResult> {
  const baseUrl = options.baseUrl ?? MCP_OFFICIAL_REGISTRY_BASE_URL;
  const allowedOrigins = options.allowedOrigins ?? [MCP_OFFICIAL_REGISTRY_BASE_URL];
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const limit = Math.max(1, Math.min(params.limit ?? MCP_REGISTRY_DEFAULT_PAGE_LIMIT, MCP_REGISTRY_MAX_PAGE_LIMIT));

  const url = buildServersUrl(baseUrl, params, limit);
  const raw = await getBoundedJson({
    url,
    allowedOrigins,
    timeoutMs,
    maxResponseBytes,
    signal,
    fetchImpl: options.fetchImpl,
    allowRetry: true,
  });

  if (!isObject(raw) || !Array.isArray(raw.servers)) {
    throw new DiscoveryProviderError("malformed_response", "MCP Registry response did not include a servers array");
  }

  const metadata = isObject(raw.metadata) ? raw.metadata : {};
  const nextCursor = typeof metadata.nextCursor === "string" && metadata.nextCursor.trim() !== "" ? metadata.nextCursor : null;
  const count = typeof metadata.count === "number" && Number.isFinite(metadata.count) ? metadata.count : raw.servers.length;

  const discoveredAt = new Date().toISOString();
  const resources: CapabilityResource[] = [];
  let skippedInvalidCount = 0;
  for (const entry of raw.servers.slice(0, limit)) {
    const resource = normalizeMcpRegistryEntry(entry, { discoveredAt }, baseUrl);
    if (resource === null) {
      skippedInvalidCount += 1;
    } else {
      resources.push(resource);
    }
  }

  return { resources, skippedInvalidCount, nextCursor, count };
}

export interface McpOfficialRegistryProviderOptions extends McpRegistryHttpOptions {
  readonly maxResults?: number;
}

/**
 * `DiscoveryProvider` adapter over the Registry's `search` list query parameter, so it plugs
 * into the same `federatedDiscoverySearch`/`POST /search` surface the M8.3 providers use. This
 * is a single bounded page fetch per call (no cross-page traversal inside `search`, matching the
 * shared per-provider timeout/size/result-count discipline); `runMcpOfficialRegistryIngestion`
 * below is the separate incremental multi-page sync path for catalog persistence.
 */
export function createMcpOfficialRegistryProvider(options: McpOfficialRegistryProviderOptions = {}): DiscoveryProvider {
  const maxResults = options.maxResults ?? MCP_REGISTRY_DEFAULT_PAGE_LIMIT;

  return {
    id: MCP_OFFICIAL_REGISTRY_PROVIDER_ID,

    async search(query: DiscoveryQuery, signal: AbortSignal): Promise<DiscoveryProviderResult> {
      const startedAt = Date.now();

      if (query.mediaTypes && query.mediaTypes.length > 0 && !query.mediaTypes.includes(ARD_MEDIA_TYPES.mcpServer)) {
        return { providerId: MCP_OFFICIAL_REGISTRY_PROVIDER_ID, ok: true, resources: [], skippedInvalidCount: 0, elapsedMs: Date.now() - startedAt };
      }

      const limit = Math.max(1, Math.min(query.pageSize, maxResults));
      try {
        const page = await fetchMcpRegistryServersPage({ search: query.text, limit }, signal, options);
        return {
          providerId: MCP_OFFICIAL_REGISTRY_PROVIDER_ID,
          ok: true,
          resources: page.resources,
          skippedInvalidCount: page.skippedInvalidCount,
          elapsedMs: Date.now() - startedAt,
        };
      } catch (error) {
        const elapsedMs = Date.now() - startedAt;
        if (error instanceof DiscoveryProviderError) {
          return { providerId: MCP_OFFICIAL_REGISTRY_PROVIDER_ID, ok: false, errorCode: error.code, message: error.message, elapsedMs };
        }
        return { providerId: MCP_OFFICIAL_REGISTRY_PROVIDER_ID, ok: false, errorCode: "unknown_error", message: error instanceof Error ? error.message : String(error), elapsedMs };
      }
    },
  };
}
