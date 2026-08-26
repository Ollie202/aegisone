import {
  ARD_DEFAULT_PAGE_SIZE,
  ARD_MAX_PAGE_SIZE,
  ARD_MAX_QUERY_CODE_POINTS,
  ARD_MEDIA_TYPE_TO_RESOURCE_KIND,
  parseArdSearchRequest,
  searchLocalCatalog,
  type ArdResourceMediaType,
  type LocalCatalogRecord,
} from "../../../packages/discovery-ard/src/index.ts";
import {
  federatedDiscoverySearch,
  type DiscoveryProvider,
  type DiscoveryQuery,
} from "../../../packages/discovery-providers/src/index.ts";
import { ProductRequestError } from "./errors.ts";

/**
 * The single capability-search service used by both `POST /search` (M8.2/M8.3) and the
 * `aegisone_search` MCP tool (M8.8). Moved out of `product.ts` so it has no dependency on
 * `mcp.ts` (which needs to import it) and vice versa — this module owns no HTTP/transport
 * concerns and is the one place local-catalog vs. federated dispatch is decided. Neither caller
 * reimplements search or reinterprets its results; both pass the same request shape through the
 * same M8.2 (`parseArdSearchRequest`/`searchLocalCatalog`) and M8.3 (`federatedDiscoverySearch`)
 * functions and return the result unchanged.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses the federated (non-local) `POST /search` request shape. Unlike `parseArdSearchRequest`
 * (M8.2, local catalog only, `federation` must be `"none"`), this accepts `federation` as a
 * non-empty array of registered provider ids and federates the query across them in parallel.
 */
export function parseFederatedSearchRequest(
  body: unknown,
  providers: ReadonlyMap<string, DiscoveryProvider>,
): { query: DiscoveryQuery; providerIds: string[] } {
  if (!isObject(body)) throw new ProductRequestError("invalid_request", "request body must be a JSON object");
  if (!isObject(body.query) || typeof body.query.text !== "string" || body.query.text.trim() === "") {
    throw new ProductRequestError("invalid_request", "query.text is required");
  }
  const text = body.query.text.trim();
  if ([...text].length > ARD_MAX_QUERY_CODE_POINTS) {
    throw new ProductRequestError("invalid_request", `query.text must be at most ${ARD_MAX_QUERY_CODE_POINTS} Unicode characters`);
  }

  let mediaTypes: ArdResourceMediaType[] | null = null;
  const filter = body.query.filter;
  if (filter !== undefined) {
    if (!isObject(filter)) throw new ProductRequestError("invalid_request", "query.filter must be a JSON object");
    if (filter.type !== undefined) {
      const values = typeof filter.type === "string" ? [filter.type] : filter.type;
      if (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== "string" || item.trim() === "")) {
        throw new ProductRequestError("invalid_request", "query.filter.type must be a non-empty string or array of non-empty strings");
      }
      for (const mediaType of values) {
        if (!Object.hasOwn(ARD_MEDIA_TYPE_TO_RESOURCE_KIND, mediaType)) {
          throw new ProductRequestError("invalid_request", `query.filter.type does not support media type: ${mediaType}`);
        }
      }
      mediaTypes = [...new Set(values)] as ArdResourceMediaType[];
    }
  }

  const pageSize = body.pageSize ?? ARD_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > ARD_MAX_PAGE_SIZE) {
    throw new ProductRequestError("invalid_request", `pageSize must be an integer from 1 to ${ARD_MAX_PAGE_SIZE}`);
  }

  const federation = body.federation;
  if (!Array.isArray(federation) || federation.length === 0 || federation.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new ProductRequestError("invalid_request", 'federation must be "none" or a non-empty array of provider ids');
  }
  const providerIds = [...new Set(federation as string[])];
  for (const id of providerIds) {
    if (!providers.has(id)) {
      throw new ProductRequestError("invalid_request", `unsupported federation provider id: ${id}. supported: ${[...providers.keys()].sort().join(", ")}`);
    }
  }

  return { query: { text, mediaTypes, pageSize: pageSize as number }, providerIds };
}

export interface SearchServiceDependencies {
  readonly localCatalog: readonly LocalCatalogRecord[];
  readonly searchSource: string;
  readonly discoveryProviders: ReadonlyMap<string, DiscoveryProvider>;
}

/**
 * Dispatches a parsed `POST /search` JSON body to either the M8.2 local pinned-ARD catalog search
 * or M8.3 federated discovery, exactly matching the (byte-for-byte, per PROJECT_STATE.md) M8.2
 * local-catalog behavior when `federation` is `"none"`/absent. This is the one function both
 * `product.ts`'s `POST /search` route and the `aegisone_search` MCP tool call — the MCP tool
 * never reimplements search or reinterprets its normalized/discovery-only output as AegisOne
 * trust evidence.
 */
export async function performCapabilitySearch(rawBody: unknown, deps: SearchServiceDependencies): Promise<unknown> {
  const requestsFederation = isObject(rawBody) && rawBody.federation !== undefined && rawBody.federation !== "none";
  if (requestsFederation) {
    const { query, providerIds } = parseFederatedSearchRequest(rawBody, deps.discoveryProviders);
    const providers = providerIds.map((id) => deps.discoveryProviders.get(id)!);
    return federatedDiscoverySearch(providers, query);
  }
  const searchRequest = parseArdSearchRequest(rawBody);
  return searchLocalCatalog(searchRequest, deps.localCatalog, deps.searchSource);
}
