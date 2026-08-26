import type { CapabilityResourceKind, DiscoveryStatus } from "../../capability-model/src/model.ts";

export type { CapabilityResourceKind, DiscoveryStatus };

/**
 * Mutable catalog/discovery domain types persisted in the existing ProofRail
 * Supabase project (M8.4). These are application/catalog memory only: nothing here
 * is, or can become, a ProofRail MATCH/MISMATCH, source-assurance, security, or
 * canonical-evidence value. See docs/16-m8-database-plan.md.
 */

export interface AgenticResource {
  readonly id: string;
  readonly kind: CapabilityResourceKind;
  readonly canonicalKey: string;
  readonly name: string;
  readonly description: string;
  readonly publisherLabel: string | null;
  readonly canonicalUrl: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceDiscovery {
  readonly id: string;
  readonly resourceId: string;
  readonly providerId: string;
  readonly providerResourceId: string;
  readonly resourceUrl: string | null;
  readonly mediaType: string | null;
  readonly rawRelevanceScore: number | null;
  readonly discoveryStatus: DiscoveryStatus;
  readonly observedAt: string;
  readonly expiresAt: string | null;
  readonly providerMetadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceVersion {
  readonly id: string;
  readonly resourceId: string;
  readonly versionKey: string;
  readonly versionLabel: string | null;
  readonly sourceProvider: string | null;
  readonly sourceRepository: string | null;
  readonly sourceRepositoryId: number | null;
  readonly sourceCommitSha: string | null;
  readonly sourceSubdirectory: string | null;
  readonly distributionUrl: string | null;
  readonly distributionSha256: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IngestionSource {
  readonly id: string;
  readonly providerType: string;
  readonly enabled: boolean;
  readonly lastSuccessAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly cursor: string | null;
  readonly updatedSince: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorAt: string | null;
  readonly configPublic: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IngestionSourcePatch {
  enabled?: boolean;
  lastSuccessAt?: string | null;
  lastAttemptAt?: string | null;
  cursor?: string | null;
  updatedSince?: string | null;
  lastErrorCode?: string | null;
  lastErrorAt?: string | null;
  configPublic?: Record<string, unknown>;
}

export interface UpsertedCatalogRecord {
  readonly resource: AgenticResource;
  readonly discovery: ResourceDiscovery;
  readonly version: ResourceVersion | null;
}

export type StaleMarkStatus = "STALE" | "UNAVAILABLE";

/**
 * M8.5 source-claim persistence (docs/16-m8-database-plan.md "Table: source_claims" /
 * "Table: source_claim_authority_observations"). These rows are historical evidence:
 * `claim_status` is the only field allowed to transition after creation (active -> superseded /
 * conflicted / revoked); every other column — repository/commit/authority/digest/canonical JSON —
 * is immutable once written. A new source mapping always creates a new claim row.
 */
export type SourceAssuranceLevel = "NONE" | "DECLARED" | "REPOSITORY_AUTHENTICATED" | "SIGNED_RELEASE";
export type SourceClaimStatus = "active" | "superseded" | "conflicted" | "revoked";

export interface SourceClaimAuthorityObservationInput {
  readonly provider: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly subjectLogin: string | null;
  readonly repositoryId: number | null;
  readonly observedPermission: string | null;
  readonly observedRoleName: string | null;
  readonly observationJson: Record<string, unknown>;
  readonly observedAt: string;
}

export interface SourceClaimAuthorityObservation extends SourceClaimAuthorityObservationInput {
  readonly id: string;
  readonly sourceClaimId: string;
  readonly createdAt: string;
}

export interface NewSourceClaim {
  readonly resourceVersionId: string;
  readonly provider: string;
  readonly assuranceLevel: SourceAssuranceLevel;
  readonly sourceRepository: string;
  readonly sourceRepositoryId: number | null;
  readonly sourceRepositoryNodeId: string | null;
  readonly sourceOwnerLogin: string | null;
  readonly sourceOwnerId: number | null;
  readonly sourceCommitSha: string;
  readonly sourceSubdirectory: string | null;
  readonly distributionUrl: string | null;
  readonly distributionSha256: string | null;
  readonly claimDigestSha256: string;
  readonly canonicalClaimJson: Record<string, unknown>;
  readonly authenticatedAt: string | null;
  readonly authorityObservations: readonly SourceClaimAuthorityObservationInput[];
}

export interface SourceClaim {
  readonly id: string;
  readonly resourceVersionId: string;
  readonly provider: string;
  readonly assuranceLevel: SourceAssuranceLevel;
  readonly claimStatus: SourceClaimStatus;
  readonly sourceRepository: string;
  readonly sourceRepositoryId: number | null;
  readonly sourceRepositoryNodeId: string | null;
  readonly sourceOwnerLogin: string | null;
  readonly sourceOwnerId: number | null;
  readonly sourceCommitSha: string;
  readonly sourceSubdirectory: string | null;
  readonly distributionUrl: string | null;
  readonly distributionSha256: string | null;
  readonly claimDigestSha256: string;
  readonly canonicalClaimJson: Record<string, unknown>;
  readonly authenticatedAt: string | null;
  readonly createdAt: string;
  readonly supersedesClaimId: string | null;
}

/** Explicit conflict representation (docs/14 "Source conflicts"): never silently resolved by
 * picking the "stronger" claim. */
export interface SourceClaimConflict {
  readonly type: "SOURCE_CLAIM_CONFLICT";
  readonly conflictingClaimId: string;
}

export interface CreateSourceClaimResult {
  readonly claim: SourceClaim;
  readonly authorityObservations: readonly SourceClaimAuthorityObservation[];
  readonly supersededClaimId: string | null;
  readonly conflict: SourceClaimConflict | null;
}
