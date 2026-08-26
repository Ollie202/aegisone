import type { CapabilityResource, CapabilityTrustEvidence } from "../../capability-model/src/model.ts";
import { assertValidCapabilityResource } from "../../capability-model/src/validate.ts";
import {
  ARD_MEDIA_TYPE_TO_RESOURCE_KIND,
  AEGISONE_ARD_METADATA,
  RESOURCE_KIND_TO_ARD_MEDIA_TYPE,
} from "./constants.ts";
import { ArdAdapterError } from "./errors.ts";
import type {
  ArdEntry,
  ArdEntryMappingOptions,
  ArdInboundMappingContext,
  ArdMetadata,
  ArdSearchResult,
} from "./types.ts";
import { assertAbsoluteHttpUrl, assertSupportedArdResourceType, assertValidArdEntry } from "./validate.ts";

function emptyTrustEvidence(): CapabilityTrustEvidence {
  return {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: {
      status: "NONE",
      sha256: null,
      verifiedAt: null,
      storageRoot: null,
      registryRecordId: null,
    },
  };
}

function aegisOneMetadata(resource: CapabilityResource): ArdMetadata {
  return {
    [AEGISONE_ARD_METADATA.schemaVersion]: resource.schemaVersion,
    [AEGISONE_ARD_METADATA.resourceId]: resource.id,
    [AEGISONE_ARD_METADATA.resourceKind]: resource.kind,
    [AEGISONE_ARD_METADATA.discoveryStatus]: resource.discovery.status,
    [AEGISONE_ARD_METADATA.sourceAssurance]: resource.trust.sourceAssurance.level,
    [AEGISONE_ARD_METADATA.sourceInspection]: resource.trust.sourceInspection.status,
    [AEGISONE_ARD_METADATA.correspondence]: resource.trust.correspondence.status,
    [AEGISONE_ARD_METADATA.securityAssessment]: resource.trust.security.status,
    [AEGISONE_ARD_METADATA.canonicalEvidence]: resource.trust.canonicalEvidence.status,
  };
}

function cloneStrings(value: string[] | undefined): string[] | undefined {
  return value === undefined ? undefined : [...value];
}

export function capabilityResourceToArdEntry(
  resource: CapabilityResource,
  options: ArdEntryMappingOptions = {},
): ArdEntry {
  assertValidCapabilityResource(resource);

  const content = options.content ?? { url: resource.discovery.resourceUrl };
  const entry: ArdEntry = {
    identifier: options.identifier ?? resource.discovery.sourceResourceId,
    displayName: resource.name,
    type: RESOURCE_KIND_TO_ARD_MEDIA_TYPE[resource.kind],
    description: resource.description,
    tags: cloneStrings(options.tags),
    capabilities: cloneStrings(options.capabilities),
    representativeQueries: cloneStrings(options.representativeQueries),
    version: resource.currentVersion?.versionLabel ?? undefined,
    metadata: aegisOneMetadata(resource),
    ...(content.url !== undefined ? { url: content.url } : { data: structuredClone(content.data) }),
  };

  assertValidArdEntry(entry);
  return entry;
}

function scoreFromEntry(entry: ArdEntry | ArdSearchResult): number | undefined {
  if (!("score" in entry)) return undefined;
  const score = entry.score;
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new ArdAdapterError("invalid_request", "ARD search result score must be between 0 and 100");
  }
  return score / 100;
}

export function ardEntryToCapabilityResource(
  entry: ArdEntry | ArdSearchResult,
  context: ArdInboundMappingContext,
): CapabilityResource {
  assertValidArdEntry(entry);
  assertSupportedArdResourceType(entry.type);
  assertAbsoluteHttpUrl(context.source, "ARD discovery source");
  if (!Number.isFinite(Date.parse(context.discoveredAt))) {
    throw new ArdAdapterError("invalid_request", "ARD discoveredAt must be an ISO 8601 timestamp");
  }

  const resourceId = `ard:${entry.identifier}`;
  const resource: CapabilityResource = {
    schemaVersion: "1",
    id: resourceId,
    kind: ARD_MEDIA_TYPE_TO_RESOURCE_KIND[entry.type],
    name: entry.displayName,
    description: entry.description?.trim() || entry.displayName,
    discovery: {
      status: "INDEXED",
      source: context.source,
      sourceResourceId: entry.identifier,
      resourceUrl: entry.url ?? context.source,
      discoveredAt: context.discoveredAt,
      relevanceScore: scoreFromEntry(entry),
    },
    currentVersion: entry.version === undefined
      ? null
      : {
          id: `${resourceId}@${entry.version}`,
          versionLabel: entry.version,
          source: null,
          distribution: null,
        },
    // ARD metadata and trustManifest are untrusted discovery data. They cannot
    // populate AegisOne evidence, including when keys resemble our namespace.
    trust: emptyTrustEvidence(),
  };

  assertValidCapabilityResource(resource);
  return resource;
}
