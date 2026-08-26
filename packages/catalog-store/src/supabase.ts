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
import type { CatalogStore } from "./store.ts";
import { buildResourceUpsertPlan } from "./upsert-plan.ts";

interface AgenticResourceRow {
  id: string;
  kind: string;
  canonical_key: string;
  name: string;
  description: string;
  publisher_label: string | null;
  canonical_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

interface ResourceDiscoveryRow {
  id: string;
  resource_id: string;
  provider_id: string;
  provider_resource_id: string;
  resource_url: string | null;
  media_type: string | null;
  raw_relevance_score: number | null;
  discovery_status: string;
  observed_at: string;
  expires_at: string | null;
  provider_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ResourceVersionRow {
  id: string;
  resource_id: string;
  version_key: string;
  version_label: string | null;
  source_provider: string | null;
  source_repository: string | null;
  source_repository_id: number | null;
  source_commit_sha: string | null;
  source_subdirectory: string | null;
  distribution_url: string | null;
  distribution_sha256: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

interface IngestionSourceRow {
  id: string;
  provider_type: string;
  enabled: boolean;
  last_success_at: string | null;
  last_attempt_at: string | null;
  cursor: string | null;
  updated_since: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  config_public: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface EdgeResponse {
  resource?: AgenticResourceRow | null;
  discovery?: ResourceDiscoveryRow;
  version?: ResourceVersionRow | null;
  rows?: unknown[];
  ingestionSource?: IngestionSourceRow | null;
  error?: string;
  message?: string;
}

function rowToResource(row: AgenticResourceRow): AgenticResource {
  return {
    id: row.id,
    kind: row.kind as AgenticResource["kind"],
    canonicalKey: row.canonical_key,
    name: row.name,
    description: row.description,
    publisherLabel: row.publisher_label,
    canonicalUrl: row.canonical_url,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDiscovery(row: ResourceDiscoveryRow): ResourceDiscovery {
  return {
    id: row.id,
    resourceId: row.resource_id,
    providerId: row.provider_id,
    providerResourceId: row.provider_resource_id,
    resourceUrl: row.resource_url,
    mediaType: row.media_type,
    rawRelevanceScore: row.raw_relevance_score,
    discoveryStatus: row.discovery_status as ResourceDiscovery["discoveryStatus"],
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
    providerMetadata: row.provider_metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToVersion(row: ResourceVersionRow): ResourceVersion {
  return {
    id: row.id,
    resourceId: row.resource_id,
    versionKey: row.version_key,
    versionLabel: row.version_label,
    sourceProvider: row.source_provider,
    sourceRepository: row.source_repository,
    sourceRepositoryId: row.source_repository_id,
    sourceCommitSha: row.source_commit_sha,
    sourceSubdirectory: row.source_subdirectory,
    distributionUrl: row.distribution_url,
    distributionSha256: row.distribution_sha256,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToIngestionSource(row: IngestionSourceRow): IngestionSource {
  return {
    id: row.id,
    providerType: row.provider_type,
    enabled: row.enabled,
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    cursor: row.cursor,
    updatedSince: row.updated_since,
    lastErrorCode: row.last_error_code,
    lastErrorAt: row.last_error_at,
    configPublic: row.config_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ingestionPatchToRow(patch: IngestionSourcePatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.lastSuccessAt !== undefined) row.last_success_at = patch.lastSuccessAt;
  if (patch.lastAttemptAt !== undefined) row.last_attempt_at = patch.lastAttemptAt;
  if (patch.cursor !== undefined) row.cursor = patch.cursor;
  if (patch.updatedSince !== undefined) row.updated_since = patch.updatedSince;
  if (patch.lastErrorCode !== undefined) row.last_error_code = patch.lastErrorCode;
  if (patch.lastErrorAt !== undefined) row.last_error_at = patch.lastErrorAt;
  if (patch.configPublic !== undefined) row.config_public = patch.configPublic;
  return row;
}

export interface SupabaseCatalogStoreConfig {
  url: string;
  publishableKey: string;
  appToken: string;
  fetcher?: typeof fetch;
}

/** Thin client for the token-gated `proofrail-catalog` Edge Function. Mirrors
 * `SupabaseJobStore`: Railway never holds the Supabase service-role secret, only a
 * normal publishable key plus the independent `PROOFRAIL_SUPABASE_APP_TOKEN`. */
export class SupabaseCatalogStore implements CatalogStore {
  readonly #baseUrl: string;
  readonly #publishableKey: string;
  readonly #appToken: string;
  readonly #fetcher: typeof fetch;

  constructor(config: SupabaseCatalogStoreConfig) {
    this.#baseUrl = config.url.replace(/\/$/, "");
    this.#publishableKey = config.publishableKey;
    this.#appToken = config.appToken;
    this.#fetcher = config.fetcher ?? fetch;
  }

  async #invoke(action: string, body: Record<string, unknown>): Promise<EdgeResponse> {
    const response = await this.#fetcher(`${this.#baseUrl}/functions/v1/proofrail-catalog`, {
      method: "POST",
      headers: {
        apikey: this.#publishableKey,
        authorization: `Bearer ${this.#publishableKey}`,
        "x-proofrail-app-token": this.#appToken,
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ action, ...body }),
    });
    const result = await response.json() as EdgeResponse;
    if (!response.ok) {
      throw new Error(`Supabase catalog store request failed (${response.status}): ${result.message ?? result.error ?? "unknown error"}`);
    }
    return result;
  }

  async upsertDiscoveredResource(resource: CapabilityResource): Promise<UpsertedCatalogRecord> {
    const plan = buildResourceUpsertPlan(resource);
    const result = await this.#invoke("upsertDiscoveredResource", {
      resource: plan.resource,
      discovery: plan.discovery,
      version: plan.version ?? undefined,
    });
    if (!result.resource || !result.discovery) {
      throw new Error("Supabase catalog store did not return a resource/discovery row");
    }
    return {
      resource: rowToResource(result.resource),
      discovery: rowToDiscovery(result.discovery),
      version: result.version ? rowToVersion(result.version) : null,
    };
  }

  async markProviderDiscoveriesStale(
    providerId: string,
    seenProviderResourceIds: readonly string[],
    status: StaleMarkStatus = "STALE",
  ): Promise<ResourceDiscovery[]> {
    const result = await this.#invoke("markProviderDiscoveriesStale", {
      providerId,
      seenProviderResourceIds: [...seenProviderResourceIds],
      status,
    });
    return (result.rows ?? []).map((row) => rowToDiscovery(row as ResourceDiscoveryRow));
  }

  async getResourceByCanonicalKey(canonicalKey: string): Promise<AgenticResource | null> {
    const result = await this.#invoke("getResourceByCanonicalKey", { canonicalKey });
    return result.resource ? rowToResource(result.resource) : null;
  }

  async listDiscoveriesByResource(resourceId: string): Promise<ResourceDiscovery[]> {
    const result = await this.#invoke("listDiscoveriesByResource", { resourceId });
    return (result.rows ?? []).map((row) => rowToDiscovery(row as ResourceDiscoveryRow));
  }

  async listVersionsByResource(resourceId: string): Promise<ResourceVersion[]> {
    const result = await this.#invoke("listVersionsByResource", { resourceId });
    return (result.rows ?? []).map((row) => rowToVersion(row as ResourceVersionRow));
  }

  async getIngestionSource(id: string): Promise<IngestionSource | null> {
    const result = await this.#invoke("getIngestionSource", { id });
    return result.ingestionSource ? rowToIngestionSource(result.ingestionSource) : null;
  }

  async upsertIngestionSource(id: string, providerType: string, patch: IngestionSourcePatch = {}): Promise<IngestionSource> {
    const result = await this.#invoke("upsertIngestionSource", {
      id,
      providerType,
      patch: ingestionPatchToRow(patch),
    });
    if (!result.ingestionSource) throw new Error(`Unknown ingestion source: ${id}`);
    return rowToIngestionSource(result.ingestionSource);
  }
}
