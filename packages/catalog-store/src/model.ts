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

/**
 * M8.6 capability-verification linkage/evidence-pointer persistence
 * (docs/16-m8-database-plan.md "Table: capability_verifications"). A row here is a mutable
 * *pointer/cache* into canonical ProofRail evidence already produced by the existing M7
 * Agent Skill verification pipeline (`packages/skill-audit` + `packages/core`); it is never
 * itself proof authority, and nothing in this module computes MATCH/MISMATCH — callers must
 * supply an already-validated `DistributionCorrespondenceEvidence`-shaped result. Historical:
 * every verification creates a new row; nothing here mutates a prior canonical verdict.
 */
export type ArtifactVerificationKind = "agent-skill";
export type SourceInspectionStatus = "NOT_RUN" | "INSPECTED";
export type CorrespondenceStatus = "NOT_EVALUATED" | "INSUFFICIENT_EVIDENCE" | "MATCH" | "MISMATCH" | "DIVERGED";
export type SecurityAssessmentStatus = "NOT_RUN" | "COMPLETED";
export type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface NewCapabilityVerification {
  readonly resourceVersionId: string;
  readonly sourceClaimId: string | null;
  readonly verificationJobId: string | null;
  readonly artifactKind: ArtifactVerificationKind;
  readonly sourceInspectionStatus: SourceInspectionStatus;
  /** M8.7: the exact source-snapshot digest an M8.6 `INSPECTED` result computed
   * (`SkillEnrichmentResult.sourceInspection.sourceSnapshotSha256`). `null` for `NOT_RUN` rows
   * and for any row written before this column existed — the M8.7 API serializer must treat a
   * missing digest as unavailable evidence, never infer or reconstruct it. */
  readonly sourceSnapshotSha256: string | null;
  readonly correspondenceStatus: CorrespondenceStatus;
  readonly publisherSha256: string | null;
  readonly reproducedSha256: string | null;
  readonly securityStatus: SecurityAssessmentStatus;
  readonly securityHighestSeverity: SecuritySeverity | null;
  readonly securityFindingCount: number | null;
  readonly canonicalEvidenceSha256: string | null;
  readonly storageRoot: string | null;
  readonly storageTransaction: string | null;
  readonly registryContract: string | null;
  readonly registryRecordId: string | null;
  readonly registryTransaction: string | null;
  readonly verifiedAt: string | null;
}

export interface CapabilityVerification extends NewCapabilityVerification {
  readonly id: string;
  readonly createdAt: string;
}
