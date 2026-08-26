import type { CapabilityResource, CapabilityTrustEvidence } from "../../capability-model/src/model.ts";
import { assertValidCapabilityResource } from "../../capability-model/src/validate.ts";
import { ARD_MEDIA_TYPE_TO_RESOURCE_KIND, type ArdResourceMediaType } from "../../discovery-ard/src/constants.ts";

/**
 * Lenient inbound normalization for third-party discovery providers.
 *
 * This is intentionally separate from `@aegisone/discovery-ard`'s `assertValidArdEntry`,
 * which enforces AegisOne's own outbound `urn:air:` catalog identifier convention. Real
 * external providers (observed live: GitHub Agent Finder uses `urn:ai:...`) do not follow
 * that convention, so this validator only requires the minimum ARD-search-result-shaped
 * fields AegisOne actually needs, and drops anything else silently rather than throwing.
 *
 * Upstream `trustManifest`, `metadata`, `score`, and `source` fields are read only for the
 * bounded discovery-relevance purposes below (relevance score, provider attribution) and are
 * never used to populate `trust`. `trust` is always emitted empty/unavailable here.
 */

export interface NormalizeProviderEntryContext {
  readonly providerId: string;
  readonly providerOrigin: string;
  readonly discoveredAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function emptyTrustEvidence(): CapabilityTrustEvidence {
  return {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  };
}

function normalizedScore(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 100) return undefined;
  return raw / 100;
}

/**
 * Normalizes one raw upstream search-result entry into a validated `CapabilityResource`, or
 * returns `null` if the entry does not carry the minimum fields AegisOne requires. A dropped
 * entry never throws and never fails the provider's whole search call.
 */
export function normalizeProviderEntry(raw: unknown, context: NormalizeProviderEntryContext): CapabilityResource | null {
  if (!isObject(raw)) return null;

  const identifier = raw.identifier;
  const displayName = raw.displayName;
  const type = raw.type;
  if (!isNonEmptyString(identifier) || !isNonEmptyString(displayName) || !isNonEmptyString(type)) return null;
  if (!Object.hasOwn(ARD_MEDIA_TYPE_TO_RESOURCE_KIND, type)) return null;

  const url = isAbsoluteHttpUrl(raw.url) ? raw.url : undefined;
  const data = isObject(raw.data) ? raw.data : undefined;
  if (url === undefined && data === undefined) return null;

  const description = isNonEmptyString(raw.description) ? raw.description.trim() : displayName;
  const version = isNonEmptyString(raw.version) ? raw.version.trim() : undefined;

  const resourceId = `${context.providerId}:${identifier}`;
  const resource: CapabilityResource = {
    schemaVersion: "1",
    id: resourceId,
    kind: ARD_MEDIA_TYPE_TO_RESOURCE_KIND[type as ArdResourceMediaType],
    name: displayName,
    description,
    discovery: {
      status: "INDEXED",
      source: context.providerOrigin,
      sourceResourceId: identifier,
      resourceUrl: url ?? context.providerOrigin,
      discoveredAt: context.discoveredAt,
      relevanceScore: normalizedScore(raw.score),
    },
    currentVersion: version === undefined ? null : { id: `${resourceId}@${version}`, versionLabel: version, source: null, distribution: null },
    // Upstream metadata/trustManifest/score/source are discovery data only. They are never
    // read below this line, and `trust` is always emitted empty regardless of their content.
    trust: emptyTrustEvidence(),
  };

  try {
    assertValidCapabilityResource(resource);
  } catch {
    return null;
  }
  return resource;
}
