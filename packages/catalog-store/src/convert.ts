import type { CapabilityResource, CapabilityTrustEvidence } from "../../capability-model/src/model.ts";
import { assertValidCapabilityResource } from "../../capability-model/src/validate.ts";
import type { AgenticResource, ResourceDiscovery, ResourceVersion } from "./model.ts";

/**
 * Reconstructs a `CapabilityResource`-shaped view purely from catalog rows.
 *
 * This is the load-bearing trust boundary of the whole package: no matter what a
 * `resource_discoveries`/`resource_versions` row contains, `trust` is always the
 * hardcoded empty/unverified constant below. There is no field on any catalog row
 * this function reads to populate `trust` — a DB-only inserted discovery can never
 * become MATCH/MISMATCH, REPOSITORY_AUTHENTICATED, SIGNED_RELEASE, or an audit
 * result through this conversion. Real verification evidence linkage is deferred to
 * M8.6's `capability_verifications` table, which this function does not read.
 */
function emptyTrustEvidence(): CapabilityTrustEvidence {
  return {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  };
}

export function catalogRecordToCapabilityResource(
  resource: AgenticResource,
  discovery: ResourceDiscovery,
  version: ResourceVersion | null,
): CapabilityResource {
  const capabilityResource: CapabilityResource = {
    schemaVersion: "1",
    id: `${discovery.providerId}:${discovery.providerResourceId}`,
    kind: resource.kind,
    name: resource.name,
    description: resource.description,
    discovery: {
      status: discovery.discoveryStatus,
      source: discovery.providerId,
      sourceResourceId: discovery.providerResourceId,
      resourceUrl: discovery.resourceUrl ?? discovery.providerId,
      discoveredAt: discovery.observedAt,
      relevanceScore: discovery.rawRelevanceScore ?? undefined,
    },
    currentVersion: version === null
      ? null
      : {
          id: version.versionKey,
          versionLabel: version.versionLabel,
          // Only reconstruct source/distribution refs when a non-empty URL is actually
          // stored; the M8.1 model requires a non-empty repositoryUrl/url when present.
          source: version.sourceRepository === null || version.sourceRepository.length === 0
            ? null
            : {
                repositoryUrl: version.sourceRepository,
                commitSha: version.sourceCommitSha,
                subdirectory: version.sourceSubdirectory,
              },
          distribution: version.distributionUrl === null || version.distributionUrl.length === 0
            ? null
            : { url: version.distributionUrl, sha256: version.distributionSha256 },
        },
    // Always empty. See the function doc comment above.
    trust: emptyTrustEvidence(),
  };

  assertValidCapabilityResource(capabilityResource);
  return capabilityResource;
}
