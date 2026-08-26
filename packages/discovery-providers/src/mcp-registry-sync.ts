import type { CatalogStore } from "../../catalog-store/src/store.ts";
import { MCP_OFFICIAL_REGISTRY_PROVIDER_ID, MCP_REGISTRY_MAX_PAGES_PER_SYNC } from "./constants.ts";
import { DiscoveryProviderError } from "./errors.ts";
import { fetchMcpRegistryServersPage, type McpRegistryHttpOptions } from "./mcp-registry.ts";

/**
 * Bounded incremental ingestion sync for the official MCP Registry into the M8.4 catalog
 * (`@proofrail/catalog-store`). Distinct from `createMcpOfficialRegistryProvider` (a single
 * bounded page per `POST /search` call): this walks Registry list pages using the persisted
 * `ingestion_sources.cursor` (docs/16-m8-database-plan.md), so a scheduled run resumes where the
 * previous run left off rather than re-downloading the whole registry every time — the
 * `mcp-official-registry` row is already seeded by the M8.4 migration
 * (`supabase/migrations/202608260001_m8_4_capability_catalog.sql`).
 *
 * Every persisted resource still goes through the exact same `CapabilityResource` normalization
 * (`mcp-registry-normalize.ts`) as the search path: `INDEXED` discovery only, empty/unavailable
 * trust evidence, no inferred source claim or correspondence from Registry `repository`/`packages`
 * metadata (docs/17-m8-security-boundaries.md Threat M8-001).
 *
 * Bounded by `MCP_REGISTRY_MAX_PAGES_PER_SYNC` pages per call (docs/17 Threat M8-015 response
 * amplification/resource exhaustion) — a full-catalog backfill spans multiple scheduled runs via
 * the persisted cursor rather than one unbounded call.
 */

export interface McpRegistryIngestionOptions extends McpRegistryHttpOptions {
  readonly catalogStore: CatalogStore;
  readonly pageLimit?: number;
  readonly maxPages?: number;
  readonly signal?: AbortSignal;
  /** Overrides the persisted cursor/updated_since read from `ingestion_sources`, for tests. */
  readonly startCursor?: string | null;
  readonly updatedSince?: string | null;
}

export interface McpRegistryIngestionResult {
  readonly providerId: typeof MCP_OFFICIAL_REGISTRY_PROVIDER_ID;
  readonly pagesFetched: number;
  readonly resourcesUpserted: number;
  readonly skippedInvalidCount: number;
  readonly nextCursor: string | null;
  /** `true` when a page's `nextCursor` was still non-null when the page cap was hit — a future
   * run should continue from `nextCursor` rather than starting over. */
  readonly truncatedByPageCap: boolean;
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly message?: string;
}

/**
 * Runs one bounded incremental sync pass: reads the persisted cursor for
 * `mcp-official-registry`, fetches up to `maxPages` list pages starting from it, upserts every
 * normalized resource via `catalogStore.upsertDiscoveredResource`, and persists the resulting
 * cursor/`lastSuccessAt`/error state back to `ingestion_sources`. A page-level transport failure
 * stops the walk (never presented as data loss — the cursor is left at the last successfully
 * completed page and `lastErrorCode`/`lastErrorAt` are recorded), matching M8.4's
 * `markProviderDiscoveriesStale` "provider outage is availability state only" discipline
 * (docs/17 Threat M8-014).
 */
export async function runMcpOfficialRegistryIngestion(options: McpRegistryIngestionOptions): Promise<McpRegistryIngestionResult> {
  const { catalogStore } = options;
  const signal = options.signal ?? new AbortController().signal;
  const maxPages = Math.max(1, options.maxPages ?? MCP_REGISTRY_MAX_PAGES_PER_SYNC);

  const existing = await catalogStore.getIngestionSource(MCP_OFFICIAL_REGISTRY_PROVIDER_ID);
  let cursor = options.startCursor !== undefined ? options.startCursor : existing?.cursor ?? null;
  const updatedSince = options.updatedSince !== undefined ? options.updatedSince : existing?.updatedSince ?? undefined;

  const attemptStartedAt = new Date().toISOString();
  let pagesFetched = 0;
  let resourcesUpserted = 0;
  let skippedInvalidCount = 0;
  let truncatedByPageCap = false;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const result = await fetchMcpRegistryServersPage(
        { cursor: cursor ?? undefined, updatedSince: updatedSince ?? undefined, limit: options.pageLimit },
        signal,
        options,
      );
      pagesFetched += 1;
      skippedInvalidCount += result.skippedInvalidCount;

      for (const resource of result.resources) {
        await catalogStore.upsertDiscoveredResource(resource);
        resourcesUpserted += 1;
      }

      cursor = result.nextCursor;
      if (cursor === null) break;
      if (page === maxPages - 1) truncatedByPageCap = true;
    }

    await catalogStore.upsertIngestionSource(MCP_OFFICIAL_REGISTRY_PROVIDER_ID, "mcp-official-registry", {
      cursor,
      updatedSince: updatedSince ?? null,
      lastAttemptAt: attemptStartedAt,
      lastSuccessAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorAt: null,
    });

    return { providerId: MCP_OFFICIAL_REGISTRY_PROVIDER_ID, pagesFetched, resourcesUpserted, skippedInvalidCount, nextCursor: cursor, truncatedByPageCap, ok: true };
  } catch (error) {
    const errorCode = error instanceof DiscoveryProviderError ? error.code : "unknown_error";
    const message = error instanceof Error ? error.message : String(error);

    await catalogStore.upsertIngestionSource(MCP_OFFICIAL_REGISTRY_PROVIDER_ID, "mcp-official-registry", {
      cursor,
      updatedSince: updatedSince ?? null,
      lastAttemptAt: attemptStartedAt,
      lastErrorCode: errorCode,
      lastErrorAt: new Date().toISOString(),
    });

    return {
      providerId: MCP_OFFICIAL_REGISTRY_PROVIDER_ID,
      pagesFetched,
      resourcesUpserted,
      skippedInvalidCount,
      nextCursor: cursor,
      truncatedByPageCap,
      ok: false,
      errorCode,
      message,
    };
  }
}
