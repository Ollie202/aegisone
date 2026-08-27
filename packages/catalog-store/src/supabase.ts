import type { CapabilityResource } from "../../capability-model/src/model.ts";
import { assertValidNewCapabilityVerification } from "./capability-verification-validation.ts";
import type {
  AgenticResource,
  CapabilityVerification,
  CreateOrTouchPastedSkillScanResult,
  CreateSourceClaimResult,
  IngestionSource,
  IngestionSourcePatch,
  NewCapabilityVerification,
  NewPastedSkillScan,
  NewSourceClaim,
  PastedSkillScan,
  ResourceDiscovery,
  ResourceVersion,
  SourceClaim,
  SourceClaimAuthorityObservation,
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

interface SourceClaimRow {
  id: string;
  resource_version_id: string;
  provider: string;
  assurance_level: string;
  claim_status: string;
  source_repository: string;
  source_repository_id: number | null;
  source_repository_node_id: string | null;
  source_owner_login: string | null;
  source_owner_id: number | null;
  source_commit_sha: string;
  source_subdirectory: string | null;
  distribution_url: string | null;
  distribution_sha256: string | null;
  claim_digest_sha256: string;
  canonical_claim_json: Record<string, unknown>;
  authenticated_at: string | null;
  created_at: string;
  supersedes_claim_id: string | null;
}

interface SourceClaimAuthorityObservationRow {
  id: string;
  source_claim_id: string;
  provider: string;
  subject_type: string;
  subject_id: string;
  subject_login: string | null;
  repository_id: number | null;
  observed_permission: string | null;
  observed_role_name: string | null;
  observation_json: Record<string, unknown>;
  observed_at: string;
  created_at: string;
}

interface CapabilityVerificationRow {
  id: string;
  resource_version_id: string;
  source_claim_id: string | null;
  verification_job_id: string | null;
  artifact_kind: string;
  source_inspection_status: string;
  source_snapshot_sha256: string | null;
  correspondence_status: string;
  publisher_sha256: string | null;
  reproduced_sha256: string | null;
  security_status: string;
  security_highest_severity: string | null;
  security_finding_count: number | null;
  canonical_evidence_sha256: string | null;
  storage_root: string | null;
  storage_transaction: string | null;
  registry_contract: string | null;
  registry_record_id: string | null;
  registry_transaction: string | null;
  verified_at: string | null;
  created_at: string;
}

interface PastedSkillScanRow {
  id: string;
  content_sha256: string;
  verdict: string;
  highest_severity: string;
  finding_count: number;
  findings_json: unknown;
  first_scanned_at: string;
  last_scanned_at: string;
  scan_count: number;
  created_at: string;
  updated_at: string;
}

interface EdgeResponse {
  resource?: AgenticResourceRow | null;
  discovery?: ResourceDiscoveryRow;
  version?: ResourceVersionRow | null;
  rows?: unknown[];
  ingestionSource?: IngestionSourceRow | null;
  sourceClaim?: SourceClaimRow | null;
  authorityObservations?: SourceClaimAuthorityObservationRow[];
  supersededClaimId?: string | null;
  conflict?: { type: "SOURCE_CLAIM_CONFLICT"; conflictingClaimId: string } | null;
  capabilityVerification?: CapabilityVerificationRow | null;
  pastedSkillScan?: PastedSkillScanRow | null;
  cached?: boolean;
  error?: string;
  message?: string;
}

function rowToPastedSkillScan(row: PastedSkillScanRow): PastedSkillScan {
  return {
    id: row.id,
    contentSha256: row.content_sha256,
    verdict: row.verdict as PastedSkillScan["verdict"],
    highestSeverity: row.highest_severity as PastedSkillScan["highestSeverity"],
    findingCount: row.finding_count,
    findings: (row.findings_json ?? []) as PastedSkillScan["findings"],
    firstScannedAt: row.first_scanned_at,
    lastScannedAt: row.last_scanned_at,
    scanCount: row.scan_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCapabilityVerification(row: CapabilityVerificationRow): CapabilityVerification {
  return {
    id: row.id,
    resourceVersionId: row.resource_version_id,
    sourceClaimId: row.source_claim_id,
    verificationJobId: row.verification_job_id,
    artifactKind: row.artifact_kind as CapabilityVerification["artifactKind"],
    sourceInspectionStatus: row.source_inspection_status as CapabilityVerification["sourceInspectionStatus"],
    sourceSnapshotSha256: row.source_snapshot_sha256,
    correspondenceStatus: row.correspondence_status as CapabilityVerification["correspondenceStatus"],
    publisherSha256: row.publisher_sha256,
    reproducedSha256: row.reproduced_sha256,
    securityStatus: row.security_status as CapabilityVerification["securityStatus"],
    securityHighestSeverity: row.security_highest_severity as CapabilityVerification["securityHighestSeverity"],
    securityFindingCount: row.security_finding_count,
    canonicalEvidenceSha256: row.canonical_evidence_sha256,
    storageRoot: row.storage_root,
    storageTransaction: row.storage_transaction,
    registryContract: row.registry_contract,
    registryRecordId: row.registry_record_id,
    registryTransaction: row.registry_transaction,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

function rowToSourceClaim(row: SourceClaimRow): SourceClaim {
  return {
    id: row.id,
    resourceVersionId: row.resource_version_id,
    provider: row.provider,
    assuranceLevel: row.assurance_level as SourceClaim["assuranceLevel"],
    claimStatus: row.claim_status as SourceClaim["claimStatus"],
    sourceRepository: row.source_repository,
    sourceRepositoryId: row.source_repository_id,
    sourceRepositoryNodeId: row.source_repository_node_id,
    sourceOwnerLogin: row.source_owner_login,
    sourceOwnerId: row.source_owner_id,
    sourceCommitSha: row.source_commit_sha,
    sourceSubdirectory: row.source_subdirectory,
    distributionUrl: row.distribution_url,
    distributionSha256: row.distribution_sha256,
    claimDigestSha256: row.claim_digest_sha256,
    canonicalClaimJson: row.canonical_claim_json,
    authenticatedAt: row.authenticated_at,
    createdAt: row.created_at,
    supersedesClaimId: row.supersedes_claim_id,
  };
}

function rowToAuthorityObservation(row: SourceClaimAuthorityObservationRow): SourceClaimAuthorityObservation {
  return {
    id: row.id,
    sourceClaimId: row.source_claim_id,
    provider: row.provider,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subjectLogin: row.subject_login,
    repositoryId: row.repository_id,
    observedPermission: row.observed_permission,
    observedRoleName: row.observed_role_name,
    observationJson: row.observation_json,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  };
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

/** Thin client for the token-gated `aegisone-catalog` Edge Function. Mirrors
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
    const response = await this.#fetcher(`${this.#baseUrl}/functions/v1/aegisone-catalog`, {
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

  async getResourceById(resourceId: string): Promise<AgenticResource | null> {
    const result = await this.#invoke("getResourceById", { resourceId });
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

  async getResourceVersionById(versionId: string): Promise<ResourceVersion | null> {
    const result = await this.#invoke("getResourceVersionById", { versionId });
    return result.version ? rowToVersion(result.version) : null;
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

  async createSourceClaim(input: NewSourceClaim): Promise<CreateSourceClaimResult> {
    const result = await this.#invoke("createSourceClaim", {
      resourceVersionId: input.resourceVersionId,
      provider: input.provider,
      assuranceLevel: input.assuranceLevel,
      sourceRepository: input.sourceRepository,
      sourceRepositoryId: input.sourceRepositoryId,
      sourceRepositoryNodeId: input.sourceRepositoryNodeId,
      sourceOwnerLogin: input.sourceOwnerLogin,
      sourceOwnerId: input.sourceOwnerId,
      sourceCommitSha: input.sourceCommitSha,
      sourceSubdirectory: input.sourceSubdirectory,
      distributionUrl: input.distributionUrl,
      distributionSha256: input.distributionSha256,
      claimDigestSha256: input.claimDigestSha256,
      canonicalClaimJson: input.canonicalClaimJson,
      authenticatedAt: input.authenticatedAt,
      authorityObservations: input.authorityObservations,
    });
    if (!result.sourceClaim) {
      throw new Error("Supabase catalog store did not return a source claim row");
    }
    return {
      claim: rowToSourceClaim(result.sourceClaim),
      authorityObservations: (result.authorityObservations ?? []).map(rowToAuthorityObservation),
      supersededClaimId: result.supersededClaimId ?? null,
      conflict: result.conflict ?? null,
    };
  }

  async getSourceClaim(id: string): Promise<SourceClaim | null> {
    const result = await this.#invoke("getSourceClaim", { id });
    return result.sourceClaim ? rowToSourceClaim(result.sourceClaim) : null;
  }

  async listActiveSourceClaimsByResourceVersion(resourceVersionId: string): Promise<SourceClaim[]> {
    const result = await this.#invoke("listActiveSourceClaimsByResourceVersion", { resourceVersionId });
    return (result.rows ?? []).map((row) => rowToSourceClaim(row as SourceClaimRow));
  }

  async createCapabilityVerification(input: NewCapabilityVerification): Promise<CapabilityVerification> {
    assertValidNewCapabilityVerification(input);
    const result = await this.#invoke("createCapabilityVerification", {
      resourceVersionId: input.resourceVersionId,
      sourceClaimId: input.sourceClaimId,
      verificationJobId: input.verificationJobId,
      artifactKind: input.artifactKind,
      sourceInspectionStatus: input.sourceInspectionStatus,
      sourceSnapshotSha256: input.sourceSnapshotSha256,
      correspondenceStatus: input.correspondenceStatus,
      publisherSha256: input.publisherSha256,
      reproducedSha256: input.reproducedSha256,
      securityStatus: input.securityStatus,
      securityHighestSeverity: input.securityHighestSeverity,
      securityFindingCount: input.securityFindingCount,
      canonicalEvidenceSha256: input.canonicalEvidenceSha256,
      storageRoot: input.storageRoot,
      storageTransaction: input.storageTransaction,
      registryContract: input.registryContract,
      registryRecordId: input.registryRecordId,
      registryTransaction: input.registryTransaction,
      verifiedAt: input.verifiedAt,
    });
    if (!result.capabilityVerification) {
      throw new Error("Supabase catalog store did not return a capability verification row");
    }
    return rowToCapabilityVerification(result.capabilityVerification);
  }

  async getLatestCapabilityVerification(resourceVersionId: string): Promise<CapabilityVerification | null> {
    const result = await this.#invoke("getLatestCapabilityVerification", { resourceVersionId });
    return result.capabilityVerification ? rowToCapabilityVerification(result.capabilityVerification) : null;
  }

  async listCapabilityVerificationsByResourceVersion(resourceVersionId: string): Promise<CapabilityVerification[]> {
    const result = await this.#invoke("listCapabilityVerificationsByResourceVersion", { resourceVersionId });
    return (result.rows ?? []).map((row) => rowToCapabilityVerification(row as CapabilityVerificationRow));
  }

  async getPastedSkillScanByContentHash(contentSha256: string): Promise<PastedSkillScan | null> {
    const result = await this.#invoke("getPastedSkillScanByContentHash", { contentSha256 });
    return result.pastedSkillScan ? rowToPastedSkillScan(result.pastedSkillScan) : null;
  }

  async createOrTouchPastedSkillScan(input: NewPastedSkillScan): Promise<CreateOrTouchPastedSkillScanResult> {
    const result = await this.#invoke("createOrTouchPastedSkillScan", {
      contentSha256: input.contentSha256,
      verdict: input.verdict,
      highestSeverity: input.highestSeverity,
      findingCount: input.findingCount,
      findings: input.findings,
    });
    if (!result.pastedSkillScan) {
      throw new Error("Supabase catalog store did not return a pasted skill scan row");
    }
    return { scan: rowToPastedSkillScan(result.pastedSkillScan), cached: result.cached === true };
  }
}
