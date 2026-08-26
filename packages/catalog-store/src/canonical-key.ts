import type { CapabilityResource } from "../../capability-model/src/model.ts";

/**
 * Deterministic, dedup-only catalog identity key.
 *
 * This mirrors the preference order in docs/16-m8-database-plan.md:
 *   1. a valid globally stable ARD identifier (`urn:air:...`);
 *   2. provider stable ID plus provider namespace;
 *   3. a normalized canonical URL.
 *
 * `canonical_key` is deduplication bookkeeping only. It is never treated as proof of
 * publisher identity, and nothing here reads or writes AegisOne trust evidence.
 */

const ARD_IDENTIFIER_RE = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;

export interface CanonicalKeyInput {
  readonly sourceResourceId?: string | null;
  readonly providerId?: string | null;
  readonly resourceUrl?: string | null;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

export function computeCanonicalKey(input: CanonicalKeyInput): string {
  const sourceResourceId = input.sourceResourceId?.trim();
  if (sourceResourceId && ARD_IDENTIFIER_RE.test(sourceResourceId)) {
    return sourceResourceId;
  }

  const providerId = input.providerId?.trim();
  if (providerId && sourceResourceId) {
    return `${providerId}::${sourceResourceId}`;
  }

  const resourceUrl = input.resourceUrl?.trim();
  if (resourceUrl) {
    const normalized = normalizeUrl(resourceUrl);
    if (normalized) return normalized;
  }

  throw new Error(
    "computeCanonicalKey requires a globally stable urn:air identifier, a provider ID + provider resource ID, or a resource URL",
  );
}

/**
 * Both real M8.2 (`ard:<identifier>`) and M8.3 (`<providerId>:<identifier>`) normalizers
 * build `CapabilityResource.id` as `<shortProviderSlug>:<providerResourceId>`. Deriving the
 * short provider slug from that prefix (rather than `discovery.source`, which is a full
 * origin URL) keeps `resource_discoveries.provider_id` aligned with the short
 * `ingestion_sources.id` slugs (e.g. `github-agent-finder`) used for incremental refresh.
 */
export function deriveProviderId(resource: CapabilityResource): string {
  const separatorIndex = resource.id.indexOf(":");
  if (separatorIndex > 0) return resource.id.slice(0, separatorIndex);
  return resource.discovery.source;
}

export function computeCanonicalKeyFromResource(resource: CapabilityResource): string {
  return computeCanonicalKey({
    sourceResourceId: resource.discovery.sourceResourceId,
    providerId: deriveProviderId(resource),
    resourceUrl: resource.discovery.resourceUrl,
  });
}
