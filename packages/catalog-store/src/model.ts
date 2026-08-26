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
