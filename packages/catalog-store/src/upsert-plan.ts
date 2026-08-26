import type { CapabilityResource, CapabilityResourceKind, DiscoveryStatus } from "../../capability-model/src/model.ts";
import { assertValidCapabilityResource } from "../../capability-model/src/validate.ts";
import { RESOURCE_KIND_TO_ARD_MEDIA_TYPE } from "../../discovery-ard/src/constants.ts";
import { computeCanonicalKeyFromResource, deriveProviderId } from "./canonical-key.ts";

/**
 * Pure, DB-free translation of a validated `CapabilityResource` (M8.1 model) into the
 * wire-shaped input the catalog store persists. Kept separate from any Supabase/memory
 * store so dedup-key and field-mapping behavior is unit-testable without a database.
 *
 * Only discovery/version bookkeeping fields are read from `resource`. `resource.trust`
 * is never read here and nothing in this module writes to a trust/evidence table.
 */

const MAX_PROVIDER_METADATA_JSON_BYTES = 4096;

export interface ResourceUpsertPlanResource {
  readonly canonicalKey: string;
  readonly kind: CapabilityResourceKind;
  readonly name: string;
  readonly description: string;
  readonly publisherLabel: string | null;
  readonly canonicalUrl: string | null;
}

export interface ResourceUpsertPlanDiscovery {
  readonly providerId: string;
  readonly providerResourceId: string;
  readonly resourceUrl: string | null;
  readonly mediaType: string | null;
  readonly rawRelevanceScore: number | null;
  readonly discoveryStatus: DiscoveryStatus;
  readonly observedAt: string;
  readonly providerMetadata: Record<string, unknown>;
}

export interface ResourceUpsertPlanVersion {
  readonly versionKey: string;
  readonly versionLabel: string | null;
  readonly sourceProvider: string | null;
  readonly sourceRepository: string | null;
  readonly sourceRepositoryId: number | null;
  readonly sourceCommitSha: string | null;
  readonly sourceSubdirectory: string | null;
  readonly distributionUrl: string | null;
  readonly distributionSha256: string | null;
}

export interface ResourceUpsertPlan {
  readonly canonicalKey: string;
  readonly resource: ResourceUpsertPlanResource;
  readonly discovery: ResourceUpsertPlanDiscovery;
  readonly version: ResourceUpsertPlanVersion | null;
}

function boundedProviderMetadata(resource: CapabilityResource): Record<string, unknown> {
  const metadata = {
    kind: resource.kind,
    mediaType: RESOURCE_KIND_TO_ARD_MEDIA_TYPE[resource.kind],
    hasCurrentVersion: resource.currentVersion !== null,
  };
  // Defensive cap. These derived fields are always small; this guards against a future
  // change accidentally widening what gets stored here rather than trusting call sites.
  if (JSON.stringify(metadata).length > MAX_PROVIDER_METADATA_JSON_BYTES) {
    return { kind: resource.kind };
  }
  return metadata;
}

export function buildResourceUpsertPlan(resource: CapabilityResource): ResourceUpsertPlan {
  assertValidCapabilityResource(resource);

  const canonicalKey = computeCanonicalKeyFromResource(resource);
  const providerId = deriveProviderId(resource);
  const version = resource.currentVersion;

  return {
    canonicalKey,
    resource: {
      canonicalKey,
      kind: resource.kind,
      name: resource.name,
      description: resource.description,
      publisherLabel: null,
      canonicalUrl: null,
    },
    discovery: {
      providerId,
      providerResourceId: resource.discovery.sourceResourceId,
      resourceUrl: resource.discovery.resourceUrl,
      mediaType: RESOURCE_KIND_TO_ARD_MEDIA_TYPE[resource.kind],
      rawRelevanceScore: resource.discovery.relevanceScore ?? null,
      discoveryStatus: resource.discovery.status,
      observedAt: resource.discovery.discoveredAt,
      providerMetadata: boundedProviderMetadata(resource),
    },
    version: version === null
      ? null
      : {
          versionKey: version.id,
          versionLabel: version.versionLabel,
          sourceProvider: null,
          sourceRepository: version.source?.repositoryUrl ?? null,
          sourceRepositoryId: null,
          sourceCommitSha: version.source?.commitSha ?? null,
          sourceSubdirectory: version.source?.subdirectory ?? null,
          distributionUrl: version.distribution?.url ?? null,
          distributionSha256: version.distribution?.sha256 ?? null,
        },
  };
}
