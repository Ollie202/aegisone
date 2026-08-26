import type { CapabilityResource } from "../../capability-model/src/model.ts";
import type {
  AgenticResource,
  IngestionSource,
  IngestionSourcePatch,
  ResourceDiscovery,
  ResourceVersion,
  StaleMarkStatus,
  UpsertedCatalogRecord,
} from "./model.ts";

/**
 * Server-side-only mutable catalog persistence boundary. Nothing implementing this
 * interface may derive a ProofRail trust/evidence value from a stored row; see
 * `convert.ts` for the one place catalog rows are turned back into a
 * `CapabilityResource` view, which always emits empty/unverified trust.
 */
export interface CatalogStore {
  /** Find-or-create the resource by deterministic canonical key, then upsert its
   * provider discovery observation and (if present) current version row. */
  upsertDiscoveredResource(resource: CapabilityResource): Promise<UpsertedCatalogRecord>;

  /** Incremental-refresh outage handling: marks discovery rows for `providerId` not
   * present in `seenProviderResourceIds` as `status` (default `STALE`). Never deletes
   * resource/version identity. */
  markProviderDiscoveriesStale(
    providerId: string,
    seenProviderResourceIds: readonly string[],
    status?: StaleMarkStatus,
  ): Promise<ResourceDiscovery[]>;

  getResourceByCanonicalKey(canonicalKey: string): Promise<AgenticResource | null>;
  listDiscoveriesByResource(resourceId: string): Promise<ResourceDiscovery[]>;
  listVersionsByResource(resourceId: string): Promise<ResourceVersion[]>;

  getIngestionSource(id: string): Promise<IngestionSource | null>;
  upsertIngestionSource(id: string, providerType: string, patch?: IngestionSourcePatch): Promise<IngestionSource>;
}
