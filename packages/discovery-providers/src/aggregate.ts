import { DEFAULT_TOTAL_SEARCH_DEADLINE_MS } from "./constants.ts";
import { dedupeCapabilityResources } from "./dedupe.ts";
import type { DiscoveryProvider, DiscoveryProviderResult, DiscoveryQuery, FederatedSearchResult } from "./types.ts";

export interface FederatedSearchOptions {
  readonly totalDeadlineMs?: number;
}

/**
 * Fans a query out to every given provider in parallel under one shared wall-clock deadline.
 *
 * - one provider failing (timeout, network error, malformed/oversized response) never fails the
 *   others: every provider result is captured independently and reported in `providerStatuses`;
 * - the shared deadline is enforced with a single `AbortController` passed to every provider, in
 *   addition to each provider's own internal per-call timeout;
 * - the merged, deduplicated `results` list preserves the caller's `providers` order as dedupe
 *   priority and is truncated to `query.pageSize`.
 */
export async function federatedDiscoverySearch(
  providers: readonly DiscoveryProvider[],
  query: DiscoveryQuery,
  options: FederatedSearchOptions = {},
): Promise<FederatedSearchResult> {
  const totalDeadlineMs = options.totalDeadlineMs ?? DEFAULT_TOTAL_SEARCH_DEADLINE_MS;
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(), totalDeadlineMs);

  let outcomes: DiscoveryProviderResult[];
  try {
    outcomes = await Promise.all(
      providers.map((provider) =>
        provider.search(query, deadlineController.signal).catch(
          (error): DiscoveryProviderResult => ({
            providerId: provider.id,
            ok: false,
            errorCode: "unknown_error",
            message: error instanceof Error ? error.message : String(error),
            elapsedMs: 0,
          }),
        ),
      ),
    );
  } finally {
    clearTimeout(deadlineTimer);
  }

  const providerStatuses = outcomes.map((outcome) =>
    outcome.ok
      ? { providerId: outcome.providerId, ok: true, resourceCount: outcome.resources.length, skippedInvalidCount: outcome.skippedInvalidCount, elapsedMs: outcome.elapsedMs }
      : { providerId: outcome.providerId, ok: false, resourceCount: 0, skippedInvalidCount: 0, errorCode: outcome.errorCode, message: outcome.message, elapsedMs: outcome.elapsedMs },
  );

  const merged = outcomes.flatMap((outcome) => (outcome.ok ? outcome.resources : []));
  const deduped = dedupeCapabilityResources(merged);

  return { results: deduped.slice(0, query.pageSize), providerStatuses };
}
