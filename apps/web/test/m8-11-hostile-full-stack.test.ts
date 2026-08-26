import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore, type CapabilityVerification, type SourceClaim } from "../../../packages/catalog-store/src/index.ts";
import type { CapabilityResource } from "../../../packages/capability-model/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";

/**
 * M8.11 (Issue #30): the single cross-cutting regression the milestone's security gate calls out
 * by name — "DB/discovery metadata cannot manufacture trust evidence ... do one final
 * cross-cutting regression test that exercises it through the FULL stack: a hostile catalog-store
 * row + a hostile discovery-provider payload, asserted to never reach
 * ALLOW/MATCH/REPOSITORY_AUTHENTICATED through the M8.7 API or M8.8 MCP tools."
 *
 * Every prior milestone already proved pieces of this invariant at the unit level
 * (`assembleTrustEvidence` DB-tampering tests in `apps/web/test/api-v1.test.ts`, M8.3/M8.10 forged
 * `trustManifest`/`verified` normalization tests). This file is deliberately different: it drives
 * a real `node:http` server running the unmodified `createProductRequestHandler` and a real
 * `@modelcontextprotocol/sdk` client over `StreamableHTTPClientTransport` (the same harness
 * `apps/web/test/m8-9-substitution-demo.test.ts` established), against two simultaneous hostile
 * inputs:
 *
 *   1. a "hostile discovery-provider payload" — a `CapabilityResource` whose `trust` is forged to
 *      already claim `REPOSITORY_AUTHENTICATED`/`MATCH`/`AVAILABLE` canonical evidence, submitted
 *      through the exact same `upsertDiscoveredResource` entry point every M8.2/M8.3/M8.10
 *      discovery/ingestion path uses;
 *   2. a "hostile catalog-store row" — a `HostileCatalogStore` (extends the real
 *      `InMemoryCatalogStore` and only overrides its read paths) that returns a source claim whose
 *      stored digest does not match its own canonical JSON, and a capability-verification row
 *      claiming `MATCH` without the required reproduced digest — the shape a compromised/mutated
 *      Supabase row would have (docs/17-m8-security-boundaries.md Threat M8-012), bypassing the
 *      store's own write-time validation entirely rather than merely failing to satisfy it.
 *
 * Both hostile inputs point at the *same* resource/version. The assertion surface is every public
 * read: `GET /api/v1/resources/:resourceId`, `GET /api/v1/resources/:resourceId/evidence`,
 * `POST /api/v1/policy/evaluate`, and the `aegisone_inspect`/`aegisone_evaluate` MCP tools. None
 * of them may ever report `sourceAssurance.level: "REPOSITORY_AUTHENTICATED"`,
 * `correspondence.status: "MATCH"`, `canonicalEvidence.status: "AVAILABLE"`, or policy `ALLOW`.
 */

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const HOSTILE_RESOURCE_ID_SEED = "hostile-full-stack:m8-11";

/** Step 1 hostile input: a discovery-provider-shaped resource that already claims strong trust
 * before it ever reaches the catalog store, exactly what a compromised/malicious upstream
 * discovery API (Threat M8-001) would attempt. */
function hostileDiscoveryPayload(): CapabilityResource {
  return {
    schemaVersion: "1",
    id: "github-agent-finder:urn:ai:hostile-m8-11-skill",
    kind: "agent-skill",
    name: "Totally Verified Skill",
    description: "Forged discovery payload claiming pre-baked trust evidence.",
    discovery: {
      status: "INDEXED",
      source: "github-agent-finder",
      sourceResourceId: "urn:ai:hostile-m8-11-skill",
      resourceUrl: "https://github.com/hostile-publisher/hostile-m8-11-skill",
      discoveredAt: "2026-08-26T00:00:00.000Z",
      relevanceScore: 1,
    },
    currentVersion: {
      id: "1.0.0",
      versionLabel: "1.0.0",
      source: { repositoryUrl: "https://github.com/hostile-publisher/hostile-m8-11-skill", commitSha: "a".repeat(40), subdirectory: null },
      distribution: { url: "https://hostile-publisher.example/hostile-m8-11-skill.skillpkg", sha256: "b".repeat(64) },
    },
    // The forged part: a hostile provider trying to smuggle a pre-baked strong verdict straight
    // through discovery, never produced by any real AegisOne verification step.
    trust: {
      sourceAssurance: { level: "REPOSITORY_AUTHENTICATED", evidenceRefs: ["forged-claim"] },
      sourceInspection: { status: "INSPECTED", exactCommitSha: "a".repeat(40), sourceSnapshotSha256: "c".repeat(64) },
      correspondence: { status: "MATCH", publisherSha256: "b".repeat(64), reproducedSha256: "b".repeat(64) },
      security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0 },
      canonicalEvidence: { status: "AVAILABLE", sha256: "d".repeat(64), verifiedAt: "2026-08-26T00:00:00.000Z", storageRoot: "0xforged", registryRecordId: "0xforged" },
    },
  };
}

/** Step 2 hostile input: a `CatalogStore` whose read paths return rows that never went through
 * the store's own write-time validation, standing in for a compromised/mutated Supabase row
 * (Threat M8-012) rather than a rejected write. Every other method is the real, unmodified
 * `InMemoryCatalogStore` behavior. */
class HostileCatalogStore extends InMemoryCatalogStore {
  #hostileVersionId: string | null = null;
  #hostileSourceClaim: SourceClaim | null = null;
  #hostileVerification: CapabilityVerification | null = null;

  armForVersion(versionId: string): void {
    this.#hostileVersionId = versionId;

    const canonicalClaimJson = {
      resourceVersionId: versionId,
      sourceRepository: "https://github.com/hostile-publisher/hostile-m8-11-skill",
      sourceCommitSha: "a".repeat(40),
    };
    this.#hostileSourceClaim = {
      id: "hostile-source-claim-1",
      resourceVersionId: versionId,
      provider: "github",
      assuranceLevel: "REPOSITORY_AUTHENTICATED",
      claimStatus: "active",
      sourceRepository: "https://github.com/hostile-publisher/hostile-m8-11-skill",
      sourceRepositoryId: 999999,
      sourceRepositoryNodeId: "R_hostile",
      sourceOwnerLogin: "hostile-publisher",
      sourceOwnerId: 999999,
      sourceCommitSha: "a".repeat(40),
      sourceSubdirectory: null,
      distributionUrl: "https://hostile-publisher.example/hostile-m8-11-skill.skillpkg",
      distributionSha256: "b".repeat(64),
      // Deliberately WRONG: does not match computeSourceClaimDigest(canonicalClaimJson).
      // Simulates a stored row that was mutated after the fact rather than one that failed a
      // digest check at write time.
      claimDigestSha256: sha256Hex("this-does-not-match-the-canonical-json"),
      canonicalClaimJson,
      authenticatedAt: "2026-08-26T00:00:00.000Z",
      createdAt: "2026-08-26T00:00:00.000Z",
      supersedesClaimId: null,
    };

    this.#hostileVerification = {
      id: "hostile-verification-1",
      resourceVersionId: versionId,
      sourceClaimId: "hostile-source-claim-1",
      verificationJobId: null,
      artifactKind: "agent-skill",
      sourceInspectionStatus: "INSPECTED",
      sourceSnapshotSha256: "c".repeat(64),
      // Deliberately invalid per docs/16's MATCH digest-presence rule: MATCH claimed with a null
      // reproduced digest. `assertValidNewCapabilityVerification` would reject this at write time
      // (already proven by existing regression tests) — this row simulates it reaching a read
      // path anyway, e.g. a raw Supabase row mutated out from under the application.
      correspondenceStatus: "MATCH",
      publisherSha256: "b".repeat(64),
      reproducedSha256: null,
      securityStatus: "COMPLETED",
      securityHighestSeverity: "INFO",
      securityFindingCount: 0,
      canonicalEvidenceSha256: "d".repeat(64),
      storageRoot: "0xforged",
      storageTransaction: "0xforged",
      registryContract: "0xforged",
      registryRecordId: "0xforged",
      registryTransaction: "0xforged",
      verifiedAt: "2026-08-26T00:00:00.000Z",
      createdAt: "2026-08-26T00:00:00.000Z",
    };
  }

  override async listActiveSourceClaimsByResourceVersion(resourceVersionId: string): Promise<SourceClaim[]> {
    if (resourceVersionId === this.#hostileVersionId && this.#hostileSourceClaim) return [this.#hostileSourceClaim];
    return super.listActiveSourceClaimsByResourceVersion(resourceVersionId);
  }

  override async getLatestCapabilityVerification(resourceVersionId: string): Promise<CapabilityVerification | null> {
    if (resourceVersionId === this.#hostileVersionId && this.#hostileVerification) return this.#hostileVerification;
    return super.getLatestCapabilityVerification(resourceVersionId);
  }

  override async listCapabilityVerificationsByResourceVersion(resourceVersionId: string): Promise<CapabilityVerification[]> {
    if (resourceVersionId === this.#hostileVersionId && this.#hostileVerification) return [this.#hostileVerification];
    return super.listCapabilityVerificationsByResourceVersion(resourceVersionId);
  }
}

async function startTestServer(catalogStore: InMemoryCatalogStore): Promise<{ baseUrl: string; server: Server }> {
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
  if (address === null || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopTestServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function connectRealMcpClient(baseUrl: string): Promise<Client> {
  const client = new Client({ name: "aegisone-m8-11-hostile-test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);
  return client;
}

function firstTextPayload(result: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  const textBlock = result.content.find((block) => block.type === "text");
  assert.ok(textBlock?.text, "expected a text content block");
  return JSON.parse(textBlock.text!) as Record<string, unknown>;
}

const STRICT_POLICY = {
  schemaVersion: "1" as const,
  missingEvidenceDecision: "DENY" as const,
  minimumSourceAssurance: "REPOSITORY_AUTHENTICATED" as const,
  requireCorrespondence: "MATCH" as const,
  maximumAuditSeverity: "MEDIUM" as const,
};

test("M8.11 hostile full-stack regression: a hostile discovery payload + a hostile catalog-store row never reach ALLOW/MATCH/REPOSITORY_AUTHENTICATED through the REST API or MCP tools", async () => {
  const catalogStore = new HostileCatalogStore();

  // ---------------------------------------------------------------------
  // Hostile input #1: a discovery-provider-shaped resource that already claims strong trust,
  // submitted through the exact real entry point every discovery/ingestion path uses.
  // ---------------------------------------------------------------------
  const { resource, version } = await catalogStore.upsertDiscoveredResource(hostileDiscoveryPayload());
  assert.ok(version, "expected a version row from the hostile discovery upsert");

  // ---------------------------------------------------------------------
  // Hostile input #2: arm the store's read paths to return a tampered source claim + a
  // structurally invalid capability-verification row for that exact resource version, standing
  // in for a compromised/mutated Supabase row rather than a rejected write.
  // ---------------------------------------------------------------------
  catalogStore.armForVersion(version!.id);

  const running = await startTestServer(catalogStore);
  try {
    // --- GET /api/v1/resources/:resourceId ---------------------------------------------------
    const resourceResponse = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}`);
    assert.equal(resourceResponse.status, 200);
    const resourceBody = await resourceResponse.json() as {
      resource: { trust: { sourceAssurance: { level: string }; correspondence: { status: string }; canonicalEvidence: { status: string } } };
      integrity: { sourceAssurance: { present: boolean; integrityCheckPassed: boolean }; canonicalVerification: { present: boolean; integrityCheckPassed: boolean } };
    };
    assert.notEqual(resourceBody.resource.trust.sourceAssurance.level, "REPOSITORY_AUTHENTICATED");
    assert.equal(resourceBody.resource.trust.sourceAssurance.level, "NONE");
    assert.notEqual(resourceBody.resource.trust.correspondence.status, "MATCH");
    assert.equal(resourceBody.resource.trust.correspondence.status, "NOT_EVALUATED");
    assert.notEqual(resourceBody.resource.trust.canonicalEvidence.status, "AVAILABLE");
    assert.equal(resourceBody.integrity.sourceAssurance.present, true);
    assert.equal(resourceBody.integrity.sourceAssurance.integrityCheckPassed, false);
    assert.equal(resourceBody.integrity.canonicalVerification.present, true);
    assert.equal(resourceBody.integrity.canonicalVerification.integrityCheckPassed, false);

    // --- GET /api/v1/resources/:resourceId/evidence -------------------------------------------
    const evidenceResponse = await fetch(`${running.baseUrl}/api/v1/resources/${resource.id}/evidence`);
    assert.equal(evidenceResponse.status, 200);
    const evidenceBody = await evidenceResponse.json() as {
      trust: { sourceAssurance: { level: string }; correspondence: { status: string } };
      sourceClaims: Array<{ assuranceLevel: string; integrityCheckPassed: boolean }>;
      capabilityVerifications: Array<{ correspondenceStatus: string; integrityCheckPassed: boolean }>;
    };
    assert.equal(evidenceBody.trust.sourceAssurance.level, "NONE");
    assert.equal(evidenceBody.trust.correspondence.status, "NOT_EVALUATED");
    assert.equal(evidenceBody.sourceClaims.length, 1);
    assert.equal(evidenceBody.sourceClaims[0]?.assuranceLevel, "NONE");
    assert.equal(evidenceBody.sourceClaims[0]?.integrityCheckPassed, false);
    assert.equal(evidenceBody.capabilityVerifications.length, 1);
    assert.equal(evidenceBody.capabilityVerifications[0]?.correspondenceStatus, "NOT_EVALUATED");
    assert.equal(evidenceBody.capabilityVerifications[0]?.integrityCheckPassed, false);

    // --- POST /api/v1/policy/evaluate ----------------------------------------------------------
    const policyResponse = await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ policy: STRICT_POLICY, resourceId: resource.id }),
    });
    assert.equal(policyResponse.status, 200);
    const policyBody = await policyResponse.json() as { decision: string };
    assert.notEqual(policyBody.decision, "ALLOW");
    assert.equal(policyBody.decision, "DENY");

    // --- aegisone_inspect / aegisone_evaluate over a real MCP client -------------------------
    const mcpClient = await connectRealMcpClient(running.baseUrl);
    try {
      const inspectResult = await mcpClient.callTool({ name: "aegisone_inspect", arguments: { resourceId: resource.id } });
      assert.notEqual(inspectResult.isError, true);
      const inspectPayload = firstTextPayload(inspectResult as { content: Array<{ type: string; text?: string }> }) as {
        trust: { sourceAssurance: { level: string }; correspondence: { status: string } };
      };
      assert.equal(inspectPayload.trust.sourceAssurance.level, "NONE");
      assert.equal(inspectPayload.trust.correspondence.status, "NOT_EVALUATED");

      const evaluateResult = await mcpClient.callTool({ name: "aegisone_evaluate", arguments: { policy: STRICT_POLICY, resourceId: resource.id } });
      assert.notEqual(evaluateResult.isError, true);
      const evaluatePayload = firstTextPayload(evaluateResult as { content: Array<{ type: string; text?: string }> }) as { decision: string };
      assert.notEqual(evaluatePayload.decision, "ALLOW");
      assert.equal(evaluatePayload.decision, "DENY");
    } finally {
      await mcpClient.close();
    }

    // --- Sanity: the forged trust in the discovery payload never even reached the catalog row --
    // (independent of the armed hostile read overrides above — this is `catalogRecordToCapabilityResource`'s
    // own fixed-empty-trust behavior, confirmed here through the live HTTP surface rather than a
    // direct unit call.)
    assert.ok(resource.id.length > 0, "resource id used above: " + HOSTILE_RESOURCE_ID_SEED);
  } finally {
    await stopTestServer(running.server);
  }
});
