import type { CapabilityResource, CapabilityTrustEvidence } from "../../capability-model/src/model.ts";

export function emptyTrust(): CapabilityTrustEvidence {
  return {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  };
}

/** Shaped like an M8.2 local ARD catalog entry: `resource.id` prefixed `ard:` and a
 * `urn:air:...` `sourceResourceId`, so it hits canonical-key tier 1. */
export function ardResource(overrides: Partial<CapabilityResource> = {}): CapabilityResource {
  return {
    schemaVersion: "1",
    id: "ard:urn:air:proofrail-app-production.up.railway.app:skill:hello",
    kind: "agent-skill",
    name: "Hello Skill",
    description: "A test Agent Skill",
    discovery: {
      status: "INDEXED",
      source: "https://proofrail-app-production.up.railway.app",
      sourceResourceId: "urn:air:proofrail-app-production.up.railway.app:skill:hello",
      resourceUrl: "https://proofrail-app-production.up.railway.app/skills/hello",
      discoveredAt: "2026-08-26T00:00:00.000Z",
      relevanceScore: 0.5,
    },
    currentVersion: null,
    trust: emptyTrust(),
    ...overrides,
  };
}

/** Shaped like an M8.3 federated result: `resource.id` prefixed by the short
 * `DiscoveryProvider.id` slug, a non-`urn:air` `sourceResourceId`, so it hits
 * canonical-key tier 2. */
export function federatedResource(overrides: Partial<CapabilityResource> = {}): CapabilityResource {
  return {
    schemaVersion: "1",
    id: "github-agent-finder:urn:ai:12345",
    kind: "mcp-server",
    name: "Federated MCP Server",
    description: "A federated discovery result",
    discovery: {
      status: "INDEXED",
      source: "https://agentfinder.github.com",
      sourceResourceId: "urn:ai:12345",
      resourceUrl: "https://github.com/example/mcp-server",
      discoveredAt: "2026-08-26T00:00:00.000Z",
      relevanceScore: 0.8,
    },
    currentVersion: {
      id: "github-agent-finder:urn:ai:12345@1.0.0",
      versionLabel: "1.0.0",
      source: null,
      distribution: null,
    },
    trust: emptyTrust(),
    ...overrides,
  };
}
