import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogRecordToCapabilityResource } from "../src/convert.ts";
import type { AgenticResource, ResourceDiscovery, ResourceVersion } from "../src/model.ts";

function agenticResource(overrides: Partial<AgenticResource> = {}): AgenticResource {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "agent-skill",
    canonicalKey: "github-agent-finder::urn:ai:12345",
    name: "Federated MCP Server",
    description: "A federated discovery result",
    publisherLabel: null,
    canonicalUrl: null,
    firstSeenAt: "2026-08-26T00:00:00.000Z",
    lastSeenAt: "2026-08-26T00:00:00.000Z",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

function resourceDiscovery(overrides: Partial<ResourceDiscovery> = {}): ResourceDiscovery {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    resourceId: "11111111-1111-4111-8111-111111111111",
    providerId: "github-agent-finder",
    providerResourceId: "urn:ai:12345",
    resourceUrl: "https://github.com/example/mcp-server",
    mediaType: "application/mcp-server-card+json",
    rawRelevanceScore: 0.8,
    discoveryStatus: "INDEXED",
    observedAt: "2026-08-26T00:00:00.000Z",
    expiresAt: null,
    providerMetadata: { kind: "mcp-server" },
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

test("a DB-only discovery row converts to a CapabilityResource with empty/unverified trust", () => {
  const resource = catalogRecordToCapabilityResource(agenticResource(), resourceDiscovery(), null);
  assert.deepEqual(resource.trust, {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  });
  assert.equal(resource.discovery.status, "INDEXED");
});

test("a compromised discovery row cannot smuggle trust-looking data through provider_metadata", () => {
  const forged = resourceDiscovery({
    providerMetadata: {
      trust: { correspondence: { status: "MATCH", publisherSha256: "a".repeat(64), reproducedSha256: "a".repeat(64) } },
      verified: true,
      sourceAssurance: "REPOSITORY_AUTHENTICATED",
    },
  });
  const resource = catalogRecordToCapabilityResource(agenticResource(), forged, null);
  assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(resource.trust.sourceAssurance.level, "NONE");
});

test("a version row with source commit + distribution digest still yields NOT_EVALUATED correspondence", () => {
  const version: ResourceVersion = {
    id: "33333333-3333-4333-8333-333333333333",
    resourceId: "11111111-1111-4111-8111-111111111111",
    versionKey: "github-agent-finder:urn:ai:12345@1.0.0",
    versionLabel: "1.0.0",
    sourceProvider: null,
    sourceRepository: "https://github.com/example/mcp-server",
    sourceRepositoryId: null,
    sourceCommitSha: "a".repeat(40),
    sourceSubdirectory: null,
    distributionUrl: "https://github.com/example/mcp-server/releases/v1.0.0.tgz",
    distributionSha256: "b".repeat(64),
    firstSeenAt: "2026-08-26T00:00:00.000Z",
    lastSeenAt: "2026-08-26T00:00:00.000Z",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  };
  const resource = catalogRecordToCapabilityResource(agenticResource(), resourceDiscovery(), version);
  assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(resource.trust.correspondence.publisherSha256, null);
  assert.equal(resource.currentVersion?.source?.commitSha, "a".repeat(40));
  assert.equal(resource.currentVersion?.distribution?.sha256, "b".repeat(64));
});
