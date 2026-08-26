import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore, type CapabilityVerification, type SourceClaim } from "../../../packages/catalog-store/src/index.ts";
import { buildCanonicalSourceClaim, computeSourceClaimDigest } from "../../../packages/source-auth-github/src/index.ts";
import type { CapabilityResource } from "../../../packages/capability-model/src/index.ts";
import { assembleTrustEvidence } from "../src/api-v1.ts";
import { createProductRequestHandler } from "../src/product.ts";

interface TestServer {
  baseUrl: string;
  server: Server;
  catalogStore: InMemoryCatalogStore;
}

async function startTestServer(): Promise<TestServer> {
  const catalogStore = new InMemoryCatalogStore();
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
    catalogStore,
    githubSourceAuthConfig: null,
    secureSourceAuthCookies: false,
  });
  const server = createServer((request, response) => {
    void handler(request, response).catch((error) => {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "internal_error", message: String(error) }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, catalogStore };
}

async function stopTestServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function skillResource(overrides: Partial<CapabilityResource> = {}): CapabilityResource {
  return {
    schemaVersion: "1",
    id: "gh:owner/repo@hello-skill",
    kind: "agent-skill",
    name: "Hello Skill",
    description: "A test Agent Skill",
    discovery: {
      status: "INDEXED",
      source: "github-agent-finder",
      sourceResourceId: "urn:ai:hello-skill",
      resourceUrl: "https://github.com/owner/repo",
      discoveredAt: "2026-08-20T00:00:00.000Z",
      relevanceScore: 0.7,
    },
    currentVersion: {
      id: "v1",
      versionLabel: "1.0.0",
      source: { repositoryUrl: "https://github.com/owner/repo", commitSha: "a".repeat(40), subdirectory: null },
      distribution: null,
    },
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
    ...overrides,
  };
}

async function seedDiscoveredResourceWithVersion(catalogStore: InMemoryCatalogStore) {
  const { resource, version } = await catalogStore.upsertDiscoveredResource(skillResource());
  if (!version) throw new Error("expected a version row");
  return { resource, version };
}

async function seedAuthenticatedClaim(catalogStore: InMemoryCatalogStore, resourceVersionId: string, resourceId: string) {
  const canonicalClaim = buildCanonicalSourceClaim({
    resourceId,
    resourceVersionId,
    provider: "github",
    repository: { id: 1, fullName: "owner/repo" },
    source: { commitSha: "a".repeat(40), subdirectory: null },
    distribution: null,
    authority: { githubUserId: 42, githubLogin: "octocat", permission: "admin" },
  });
  const claimDigestSha256 = computeSourceClaimDigest(canonicalClaim);
  return catalogStore.createSourceClaim({
    resourceVersionId,
    provider: "github",
    assuranceLevel: "REPOSITORY_AUTHENTICATED",
    sourceRepository: "owner/repo",
    sourceRepositoryId: 1,
    sourceRepositoryNodeId: "R_1",
    sourceOwnerLogin: "owner",
    sourceOwnerId: 900,
    sourceCommitSha: "a".repeat(40),
    sourceSubdirectory: null,
    distributionUrl: null,
    distributionSha256: null,
    claimDigestSha256,
    canonicalClaimJson: canonicalClaim,
    authenticatedAt: "2026-08-20T00:00:00.000Z",
    authorityObservations: [],
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/resources/:resourceId
// ---------------------------------------------------------------------------

test("GET /api/v1/resources/:resourceId returns 404 with a stable error taxonomy for an unknown id", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/resources/does-not-exist`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, "resource_not_found");
    assert.equal(body.errorCode, "RESOURCE_NOT_FOUND");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/resources/:resourceId exposes independent trust dimensions and no ambiguous verified/safe boolean", async () => {
  const running = await startTestServer();
  try {
    const { resource, version } = await seedDiscoveredResourceWithVersion(running.catalogStore);
    const claimResult = await seedAuthenticatedClaim(running.catalogStore, version.id, resource.id);
    await running.catalogStore.createCapabilityVerification({
      resourceVersionId: version.id,
      sourceClaimId: claimResult.claim.id,
      verificationJobId: null,
      artifactKind: "agent-skill",
      sourceInspectionStatus: "INSPECTED",
      sourceSnapshotSha256: "e".repeat(64),
      correspondenceStatus: "MATCH",
      publisherSha256: "b".repeat(64),
      reproducedSha256: "b".repeat(64),
      securityStatus: "COMPLETED",
      securityHighestSeverity: "INFO",
      securityFindingCount: 0,
      canonicalEvidenceSha256: "c".repeat(64),
      storageRoot: "0xroot",
      storageTransaction: "0xstoragetx",
      registryContract: "0xregistry",
      registryRecordId: "0xrecord",
      registryTransaction: "0xregistrytx",
      verifiedAt: "2026-08-21T00:00:00.000Z",
    });

    const response = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schemaVersion, "1");
    assert.equal(body.resourceId, resource.id);

    const raw = JSON.stringify(body);
    assert.ok(!/"verified"\s*:\s*true/.test(raw), "response must never contain a bare verified:true field");
    assert.ok(!/"safe"\s*:\s*true/.test(raw), "response must never contain a bare safe:true field");

    const trust = body.resource.trust;
    assert.equal(trust.sourceAssurance.level, "REPOSITORY_AUTHENTICATED");
    assert.equal(trust.sourceInspection.status, "INSPECTED");
    assert.equal(trust.correspondence.status, "MATCH");
    assert.equal(trust.security.status, "COMPLETED");
    assert.equal(trust.security.highestSeverity, "INFO");
    assert.equal(trust.canonicalEvidence.status, "AVAILABLE");
    assert.equal(trust.canonicalEvidence.sha256, "c".repeat(64));
    assert.equal(body.integrity.sourceAssurance.integrityCheckPassed, true);
    assert.equal(body.integrity.canonicalVerification.integrityCheckPassed, true);

    // discovery/provider attribution is independent of trust
    assert.equal(body.resource.discovery.status, "INDEXED");
    assert.ok(typeof body.resource.discovery.source === "string" && body.resource.discovery.source.length > 0);
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/resources/:resourceId reports NONE/NOT_EVALUATED for a purely discovered resource (INDEXED is not verification)", async () => {
  const running = await startTestServer();
  try {
    const { resource } = await seedDiscoveredResourceWithVersion(running.catalogStore);
    const response = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}`);
    const body = await response.json();
    assert.equal(body.resource.discovery.status, "INDEXED");
    assert.equal(body.resource.trust.sourceAssurance.level, "NONE");
    assert.equal(body.resource.trust.correspondence.status, "NOT_EVALUATED");
    assert.equal(body.resource.trust.canonicalEvidence.status, "NONE");
    assert.equal(body.integrity.sourceAssurance.present, false);
    assert.equal(body.integrity.canonicalVerification.present, false);
  } finally {
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/resources/:resourceId/versions/:versionId
// ---------------------------------------------------------------------------

test("GET /api/v1/resources/:resourceId/versions/:versionId returns 404 for an unknown resource", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/resources/does-not-exist/versions/also-missing`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, "resource_not_found");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/resources/:resourceId/versions/:versionId returns 404 when the version does not belong to the resource", async () => {
  const running = await startTestServer();
  try {
    const { resource } = await seedDiscoveredResourceWithVersion(running.catalogStore);
    const response = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}/versions/not-a-real-version`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, "version_not_found");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/resources/:resourceId/versions/:versionId returns the version's own trust view", async () => {
  const running = await startTestServer();
  try {
    const { resource, version } = await seedDiscoveredResourceWithVersion(running.catalogStore);
    const response = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}/versions/${version.id}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schemaVersion, "1");
    assert.equal(body.version.id, version.id);
    assert.equal(body.trust.sourceAssurance.level, "NONE");
    assert.equal(body.trust.correspondence.status, "NOT_EVALUATED");
  } finally {
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/resources/:resourceId/evidence
// ---------------------------------------------------------------------------

test("GET /api/v1/resources/:resourceId/evidence exposes source-claim and verification history with per-item integrity flags", async () => {
  const running = await startTestServer();
  try {
    const { resource, version } = await seedDiscoveredResourceWithVersion(running.catalogStore);
    const claimResult = await seedAuthenticatedClaim(running.catalogStore, version.id, resource.id);
    await running.catalogStore.createCapabilityVerification({
      resourceVersionId: version.id,
      sourceClaimId: claimResult.claim.id,
      verificationJobId: null,
      artifactKind: "agent-skill",
      sourceInspectionStatus: "NOT_RUN",
      sourceSnapshotSha256: null,
      correspondenceStatus: "NOT_EVALUATED",
      publisherSha256: null,
      reproducedSha256: null,
      securityStatus: "NOT_RUN",
      securityHighestSeverity: null,
      securityFindingCount: null,
      canonicalEvidenceSha256: null,
      storageRoot: null,
      storageTransaction: null,
      registryContract: null,
      registryRecordId: null,
      registryTransaction: null,
      verifiedAt: null,
    });

    const response = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}/evidence`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sourceClaims.length, 1);
    assert.equal(body.sourceClaims[0].assuranceLevel, "REPOSITORY_AUTHENTICATED");
    assert.equal(body.sourceClaims[0].integrityCheckPassed, true);
    assert.equal(body.capabilityVerifications.length, 1);
    assert.equal(body.capabilityVerifications[0].integrityCheckPassed, true);
    assert.equal(body.capabilityVerifications[0].correspondenceStatus, "NOT_EVALUATED");
  } finally {
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/policy/evaluate — malformed request / error taxonomy
// ---------------------------------------------------------------------------

test("POST /api/v1/policy/evaluate rejects a non-JSON content type", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    assert.equal(response.status, 415);
    const body = await response.json();
    assert.equal(body.error, "unsupported_media_type");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate rejects a request over the body size limit", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(64 * 1024) }),
    });
    assert.equal(response.status, 413);
    const body = await response.json();
    assert.equal(body.error, "request_too_large");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate rejects a missing/invalid policy with a structured error", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: skillResource() }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_policy");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate rejects an unknown missingEvidenceDecision value", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: skillResource(), policy: { schemaVersion: "1", missingEvidenceDecision: "ALLOW" } }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_policy");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate rejects a request that supplies neither resource nor resourceId", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW" } }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_request");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate rejects a request that supplies both resource and resourceId", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: skillResource(),
        resourceId: "whatever",
        policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW" },
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_request");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate rejects a malformed resource object with structural validation issues", async () => {
  const running = await startTestServer();
  try {
    const malformed = skillResource({ trust: { ...skillResource().trust, correspondence: { status: "MATCH", publisherSha256: null, reproducedSha256: null } } });
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: malformed, policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW" } }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "invalid_resource");
    assert.ok(Array.isArray(body.details) && body.details.length > 0);
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/policy/evaluate returns resource_not_found for an unknown resourceId", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: "does-not-exist", policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW" } }),
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, "resource_not_found");
  } finally {
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/policy/evaluate — ALLOW / REVIEW / DENY across missing/stale/mismatch/audit cases
// ---------------------------------------------------------------------------

test("policy ALLOWs a resource that meets every requirement supplied inline as `resource`", async () => {
  const running = await startTestServer();
  try {
    const now = Date.now();
    const resource = skillResource({
      currentVersion: { id: "v1", versionLabel: "1.0.0", source: { repositoryUrl: "https://github.com/owner/repo", commitSha: "a".repeat(40), subdirectory: null }, distribution: { url: "https://example.com/pkg.tgz", sha256: "b".repeat(64) } },
      trust: {
        sourceAssurance: { level: "REPOSITORY_AUTHENTICATED", evidenceRefs: ["claim-1"] },
        sourceInspection: { status: "INSPECTED", exactCommitSha: "a".repeat(40), sourceSnapshotSha256: "e".repeat(64) },
        correspondence: { status: "MATCH", publisherSha256: "b".repeat(64), reproducedSha256: "b".repeat(64) },
        security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0 },
        canonicalEvidence: { status: "AVAILABLE", sha256: "c".repeat(64), verifiedAt: new Date(now - 60_000).toISOString(), storageRoot: "0xroot", registryRecordId: "0xrecord" },
      },
    });
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource,
        policy: {
          schemaVersion: "1",
          missingEvidenceDecision: "DENY",
          minimumSourceAssurance: "REPOSITORY_AUTHENTICATED",
          requireCorrespondence: "MATCH",
          maximumAuditSeverity: "LOW",
          maximumEvidenceAgeHours: 24,
        },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schemaVersion, "1");
    assert.equal(body.decision, "ALLOW");
    assert.deepEqual(body.reasons, []);
  } finally {
    await stopTestServer(running.server);
  }
});

test("policy applies the configured missing-evidence decision when required evidence is absent", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: skillResource(),
        policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW", minimumSourceAssurance: "DECLARED", requireCorrespondence: "MATCH" },
      }),
    });
    const body = await response.json();
    assert.equal(body.decision, "REVIEW");
    assert.ok(body.reasons.some((reason: { code: string }) => reason.code === "source_assurance_missing"));
    assert.ok(body.reasons.some((reason: { code: string }) => reason.code === "correspondence_missing"));
  } finally {
    await stopTestServer(running.server);
  }
});

test("policy DENYs a resource observed as MISMATCH even though evidence is present", async () => {
  const running = await startTestServer();
  try {
    const resource = skillResource({
      currentVersion: {
        id: "v1",
        versionLabel: "1.0.0",
        source: { repositoryUrl: "https://github.com/owner/repo", commitSha: "a".repeat(40), subdirectory: null },
        // MATCH/MISMATCH/DIVERGED require a distinct distributed artifact reference whose digest
        // equals the publisher digest used for correspondence (capability-model validate.ts).
        distribution: { url: "https://example.com/pkg.tgz", sha256: "b".repeat(64) },
      },
      trust: {
        sourceAssurance: { level: "NONE", evidenceRefs: [] },
        sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
        correspondence: { status: "MISMATCH", publisherSha256: "b".repeat(64), reproducedSha256: "f".repeat(64) },
        security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
        canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
      },
    });
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource, policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW", requireCorrespondence: "MATCH" } }),
    });
    const body = await response.json();
    assert.equal(body.decision, "DENY");
    assert.ok(body.reasons.some((reason: { code: string }) => reason.code === "correspondence_not_match"));
  } finally {
    await stopTestServer(running.server);
  }
});

test("policy DENYs when the audit severity exceeds the configured maximum", async () => {
  const running = await startTestServer();
  try {
    const resource = skillResource({
      trust: {
        sourceAssurance: { level: "NONE", evidenceRefs: [] },
        sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
        correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
        security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "CRITICAL", findingCount: 3 },
        canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
      },
    });
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource, policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW", maximumAuditSeverity: "MEDIUM" } }),
    });
    const body = await response.json();
    assert.equal(body.decision, "DENY");
    assert.ok(body.reasons.some((reason: { code: string }) => reason.code === "audit_severity_exceeded"));
  } finally {
    await stopTestServer(running.server);
  }
});

test("policy DENYs on stale canonical evidence past the configured maximum age", async () => {
  const running = await startTestServer();
  try {
    const staleTimestamp = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
    const resource = skillResource({
      trust: {
        sourceAssurance: { level: "NONE", evidenceRefs: [] },
        sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
        correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
        security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
        canonicalEvidence: { status: "AVAILABLE", sha256: "c".repeat(64), verifiedAt: staleTimestamp, storageRoot: "0xroot", registryRecordId: "0xrecord" },
      },
    });
    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource, policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW", maximumEvidenceAgeHours: 24 } }),
    });
    const body = await response.json();
    assert.equal(body.decision, "DENY");
    assert.ok(body.reasons.some((reason: { code: string }) => reason.code === "canonical_evidence_stale"));
  } finally {
    await stopTestServer(running.server);
  }
});

test("policy evaluate by resourceId reuses the same integrity-checked resource assembly as the resource endpoint", async () => {
  const running = await startTestServer();
  try {
    const { resource, version } = await seedDiscoveredResourceWithVersion(running.catalogStore);
    await seedAuthenticatedClaim(running.catalogStore, version.id, resource.id);

    const response = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: resource.id, policy: { schemaVersion: "1", missingEvidenceDecision: "DENY", minimumSourceAssurance: "REPOSITORY_AUTHENTICATED" } }),
    });
    const body = await response.json();
    assert.equal(body.decision, "ALLOW");
  } finally {
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// DB-tampering simulation: a stored row that no longer matches its own canonical
// digest/structural invariants must fail closed, never appear as an upgraded verdict.
// ---------------------------------------------------------------------------

test("a source claim whose stored digest no longer matches its canonical JSON (simulated DB tampering) is presented as NONE, not its stored assuranceLevel", () => {
  const tamperedClaim: SourceClaim = {
    id: "tampered-claim",
    resourceVersionId: "v1",
    provider: "github",
    assuranceLevel: "REPOSITORY_AUTHENTICATED",
    claimStatus: "active",
    sourceRepository: "owner/repo",
    sourceRepositoryId: 1,
    sourceRepositoryNodeId: "R_1",
    sourceOwnerLogin: "owner",
    sourceOwnerId: 900,
    sourceCommitSha: "a".repeat(40),
    sourceSubdirectory: null,
    distributionUrl: null,
    distributionSha256: null,
    // A row directly edited in the database: the digest was computed for different canonical
    // JSON than what is now stored alongside it.
    claimDigestSha256: "0".repeat(64),
    canonicalClaimJson: { schemaVersion: "1", resourceId: "r1", resourceVersionId: "v1", provider: "github", repository: { fullName: "owner/repo" }, source: { commitSha: "a".repeat(40) } },
    authenticatedAt: "2026-08-20T00:00:00.000Z",
    createdAt: "2026-08-20T00:00:00.000Z",
    supersedesClaimId: null,
  };

  const { trust, integrity } = assembleTrustEvidence(null, [tamperedClaim], null);
  assert.equal(trust.sourceAssurance.level, "NONE");
  assert.deepEqual(trust.sourceAssurance.evidenceRefs, []);
  assert.equal(integrity.sourceAssurance.present, true);
  assert.equal(integrity.sourceAssurance.integrityCheckPassed, false);
});

test("a capability_verifications row that violates the MATCH digest-equality invariant (simulated DB tampering) is presented as unevaluated, not MATCH", () => {
  const tamperedVerification: CapabilityVerification = {
    id: "tampered-verification",
    resourceVersionId: "v1",
    sourceClaimId: null,
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "INSPECTED",
    sourceSnapshotSha256: "e".repeat(64),
    // MATCH claimed with two different digests: structurally invalid, exactly the shape a
    // direct database edit could produce without going through createCapabilityVerification.
    correspondenceStatus: "MATCH",
    publisherSha256: "b".repeat(64),
    reproducedSha256: "f".repeat(64),
    securityStatus: "NOT_RUN",
    securityHighestSeverity: null,
    securityFindingCount: null,
    canonicalEvidenceSha256: null,
    storageRoot: null,
    storageTransaction: null,
    registryContract: null,
    registryRecordId: null,
    registryTransaction: null,
    verifiedAt: null,
    createdAt: "2026-08-20T00:00:00.000Z",
  };

  const { trust, integrity } = assembleTrustEvidence(null, [], tamperedVerification);
  assert.equal(trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(trust.correspondence.publisherSha256, null);
  assert.equal(trust.correspondence.reproducedSha256, null);
  assert.equal(trust.sourceInspection.status, "NOT_RUN");
  assert.equal(integrity.canonicalVerification.present, true);
  assert.equal(integrity.canonicalVerification.integrityCheckPassed, false);
});
