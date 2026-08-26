import type { CapabilityResource, CapabilityTrustEvidence } from "../../capability-model/src/model.ts";
import { assertValidCapabilityResource } from "../../capability-model/src/validate.ts";
import { MCP_OFFICIAL_REGISTRY_PROVIDER_ID } from "./constants.ts";

/**
 * Normalization for the official MCP Registry's `GET /v0.1/servers*` response entries
 * (`{ server: {...}, _meta: {...} }`), a materially different wire shape from the M8.3
 * ARD-search-shaped providers (`normalize.ts`).
 *
 * An official Registry listing is ecosystem publication metadata, not AegisOne source or
 * artifact proof (docs/15-m8-api-inventory.md section 4, docs/17-m8-security-boundaries.md
 * Threat M8-001). The Registry entry's own `repository`/`packages` fields are read only to
 * populate discovery-only pointers below; `currentVersion.source`/`currentVersion.distribution`
 * are always emitted `null` here and `trust` is always emitted empty/unavailable — exactly the
 * same discipline `normalize.ts` already applies to the M8.3 providers. A future AegisOne
 * source-claim/verification pass (M8.5/M8.6) may separately authenticate and inspect the
 * `repository.url` this function only ever stores as an unauthenticated discovery pointer.
 */

export interface NormalizeMcpRegistryEntryContext {
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

/** Registry `server.name` values are reverse-DNS/namespaced identifiers (e.g.
 * `io.github.acme/widgets`) and are themselves the stable per-server identity the
 * `/versions` sub-resource is addressed by; they are not guaranteed to be a URL path segment
 * without encoding, which callers of the `/versions` endpoints must apply separately. */
function isValidServerName(value: unknown): value is string {
  return isNonEmptyString(value);
}

/**
 * Picks a discovery `resourceUrl` for a Registry entry. Prefers the first remote endpoint (the
 * actual reachable MCP server), then the declared repository URL, then falls back to a stable
 * Registry web pointer for the exact server name — never fabricated, always resolvable back to
 * this exact upstream entry.
 */
function pickResourceUrl(server: Record<string, unknown>, registryBaseUrl: string): string | undefined {
  const remotes = server.remotes;
  if (Array.isArray(remotes)) {
    for (const remote of remotes) {
      if (isObject(remote) && isAbsoluteHttpUrl(remote.url)) return remote.url;
    }
  }
  const repository = server.repository;
  if (isObject(repository) && isAbsoluteHttpUrl(repository.url)) return repository.url;
  const name = server.name;
  if (isNonEmptyString(name)) {
    return `${registryBaseUrl}/v0.1/servers/${encodeURIComponent(name)}`;
  }
  return undefined;
}

/**
 * Normalizes one raw `{ server, _meta }` Registry list entry into a validated
 * `CapabilityResource`, or returns `null` if the entry does not carry the minimum fields
 * AegisOne requires. A dropped entry never throws and never fails the whole page fetch.
 */
export function normalizeMcpRegistryEntry(
  raw: unknown,
  context: NormalizeMcpRegistryEntryContext,
  registryBaseUrl: string,
): CapabilityResource | null {
  if (!isObject(raw)) return null;
  const server = raw.server;
  if (!isObject(server)) return null;

  const name = server.name;
  const version = server.version;
  const description = server.description;
  if (!isValidServerName(name) || !isNonEmptyString(version) || !isNonEmptyString(description)) return null;

  const resourceUrl = pickResourceUrl(server, registryBaseUrl);
  if (resourceUrl === undefined) return null;

  const title = isNonEmptyString(server.title) ? server.title.trim() : name;
  const resourceId = `${MCP_OFFICIAL_REGISTRY_PROVIDER_ID}:${name}`;
  const versionLabel = version.trim();

  const resource: CapabilityResource = {
    schemaVersion: "1",
    id: resourceId,
    kind: "mcp-server",
    name: title,
    description: description.trim(),
    discovery: {
      status: "INDEXED",
      source: registryBaseUrl,
      sourceResourceId: name,
      resourceUrl,
      discoveredAt: context.discoveredAt,
    },
    // The Registry's own `repository`/`packages` metadata is discovery data only. It is never
    // read past this point, and `currentVersion.source`/`distribution` are always `null` here:
    // only a separate AegisOne source-claim/verification pass may ever populate them.
    currentVersion: { id: `${resourceId}@${versionLabel}`, versionLabel, source: null, distribution: null },
    trust: emptyTrustEvidence(),
  };

  try {
    assertValidCapabilityResource(resource);
  } catch {
    return null;
  }
  return resource;
}
