import { DEFAULT_MAX_RESPONSE_BYTES, DEFAULT_MAX_RESULTS_PER_PROVIDER, DEFAULT_PROVIDER_TIMEOUT_MS, DISCOVERY_PROVIDER_ALLOWED_ORIGINS } from "./constants.ts";
import { DiscoveryProviderError } from "./errors.ts";
import type { FetchLike } from "./http.ts";
import { postBoundedJson } from "./http.ts";
import { normalizeProviderEntry } from "./normalize.ts";
import type { DiscoveryProvider, DiscoveryProviderResult, DiscoveryQuery } from "./types.ts";

export interface ArdWireProviderConfig {
  readonly id: string;
  readonly endpoint: string;
  readonly allowedOrigins?: readonly string[];
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly maxResults?: number;
  readonly fetchImpl?: FetchLike;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Builds a `DiscoveryProvider` for an upstream that speaks the ARD search request/response
 * wire shape (`{ query: { text, filter? }, pageSize }` -> `{ results: [...] }`). Both pinned
 * M8.3 providers (GitHub Agent Finder and Hugging Face Discover) speak this shape.
 */
export function createArdWireDiscoveryProvider(config: ArdWireProviderConfig): DiscoveryProvider {
  const timeoutMs = config.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const maxResults = config.maxResults ?? DEFAULT_MAX_RESULTS_PER_PROVIDER;
  const allowedOrigins = config.allowedOrigins ?? DISCOVERY_PROVIDER_ALLOWED_ORIGINS;
  const providerOrigin = new URL(config.endpoint).origin;

  return {
    id: config.id,

    async search(query: DiscoveryQuery, signal: AbortSignal): Promise<DiscoveryProviderResult> {
      const startedAt = Date.now();
      const requestedPageSize = Math.max(1, Math.min(query.pageSize, maxResults));
      const requestBody: Record<string, unknown> = {
        query: {
          text: query.text,
          ...(query.mediaTypes && query.mediaTypes.length > 0 ? { filter: { type: query.mediaTypes } } : {}),
        },
        pageSize: requestedPageSize,
      };

      let raw: unknown;
      try {
        raw = await postBoundedJson({
          url: config.endpoint,
          body: requestBody,
          allowedOrigins,
          timeoutMs,
          maxResponseBytes,
          signal,
          fetchImpl: config.fetchImpl,
          allowRetry: true,
        });
      } catch (error) {
        const elapsedMs = Date.now() - startedAt;
        if (error instanceof DiscoveryProviderError) {
          return { providerId: config.id, ok: false, errorCode: error.code, message: error.message, elapsedMs };
        }
        return { providerId: config.id, ok: false, errorCode: "unknown_error", message: error instanceof Error ? error.message : String(error), elapsedMs };
      }

      const elapsedMs = Date.now() - startedAt;
      if (!isObject(raw) || !Array.isArray(raw.results)) {
        return { providerId: config.id, ok: false, errorCode: "malformed_response", message: `${config.id} response did not include a results array`, elapsedMs };
      }

      const discoveredAt = new Date().toISOString();
      const resources = [];
      let skippedInvalidCount = 0;
      for (const rawEntry of raw.results.slice(0, maxResults)) {
        const resource = normalizeProviderEntry(rawEntry, { providerId: config.id, providerOrigin, discoveredAt });
        if (resource === null) {
          skippedInvalidCount += 1;
        } else {
          resources.push(resource);
        }
      }

      return { providerId: config.id, ok: true, resources, skippedInvalidCount, elapsedMs };
    },
  };
}
