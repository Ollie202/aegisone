import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { buildCanonicalSourceClaim, computeSourceClaimDigest } from "../../../packages/source-auth-github/src/index.ts";
import type { CapabilityResource } from "../../../packages/capability-model/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";

/**
 * M8.8 (Issue #27): end-to-end proof that a *real* MCP TypeScript SDK client (not a hand-rolled
 * test double) can connect over the actual chosen transport (Streamable HTTP, mounted at
 * `POST /mcp` on the same `proofrail-app` HTTP server `createProductRequestHandler` builds) and
 * call all three AegisOne tools. What this proves: the wire protocol, tool schemas, and handler
 * wiring all work end-to-end against a real in-process HTTP server using the official SDK's own
 * client. What this does NOT prove: that a specific external product (Claude Desktop, Claude
 * Code's own MCP config, etc.) renders/consumes these tools correctly in its UI — that step
 * requires a human to point a real external client at a running deployment (documented in the PR).
 */

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

async function connectRealMcpClient(baseUrl: string): Promise<Client> {
  const client = new Client({ name: "aegisone-mcp-test-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);
  return client;
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

async function seedIndexedOnlyResource(catalogStore: InMemoryCatalogStore) {
  const { resource } = await catalogStore.upsertDiscoveredResource(skillResource());
  return resource;
}

async function seedAuthenticatedMatchResource(catalogStore: InMemoryCatalogStore) {
  const { resource, version } = await catalogStore.upsertDiscoveredResource(
    skillResource({ id: "gh:owner/repo@verified-skill", name: "Verified Skill" }),
  );
  if (!version) throw new Error("expected a version row");

  const canonicalClaim = buildCanonicalSourceClaim({
    resourceId: resource.id,
    resourceVersionId: version.id,
    provider: "github",
    repository: { id: 1, fullName: "owner/repo" },
    source: { commitSha: "a".repeat(40), subdirectory: null },
    distribution: null,
    authority: { githubUserId: 42, githubLogin: "octocat", permission: "admin" },
  });
  await catalogStore.createSourceClaim({
    resourceVersionId: version.id,
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
    claimDigestSha256: computeSourceClaimDigest(canonicalClaim),
    canonicalClaimJson: canonicalClaim,
    authenticatedAt: "2026-08-20T00:00:00.000Z",
    authorityObservations: [],
  });

  await catalogStore.createCapabilityVerification({
    resourceVersionId: version.id,
    sourceClaimId: null,
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "INSPECTED",
    sourceSnapshotSha256: "a".repeat(64),
    correspondenceStatus: "MATCH",
    publisherSha256: "b".repeat(64),
    reproducedSha256: "b".repeat(64),
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: 0,
    canonicalEvidenceSha256: "c".repeat(64),
    storageRoot: "0x" + "d".repeat(64),
    storageTransaction: "0x" + "e".repeat(64),
    registryContract: "0x" + "f".repeat(40),
    registryRecordId: "0x" + "1".repeat(64),
    registryTransaction: "0x" + "2".repeat(64),
    verifiedAt: "2026-08-20T01:00:00.000Z",
  });

  return resource;
}

function firstTextPayload(result: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  const textBlock = result.content.find((block) => block.type === "text");
  assert.ok(textBlock?.text, "expected a text content block");
  return JSON.parse(textBlock.text!) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool surface / Threat M8-018 denylist
// ---------------------------------------------------------------------------

test("a real MCP SDK client can connect over Streamable HTTP and lists exactly the three allowed AegisOne tools", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["aegisone_evaluate", "aegisone_inspect", "aegisone_search"]);

    const forbidden = ["aegisone_install", "aegisone_execute", "aegisone_sign", "aegisone_run_arbitrary_build", "aegisone_upload_secret"];
    for (const bannedName of forbidden) {
      assert.ok(!names.includes(bannedName), `${bannedName} must never be exposed (docs/17 Threat M8-018)`);
    }

    for (const tool of tools) {
      assert.ok(tool.description && tool.description.length > 0, `${tool.name} must document its behavior`);
      assert.ok(tool.inputSchema && typeof tool.inputSchema === "object", `${tool.name} must publish a JSON schema`);
    }
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// aegisone_search
// ---------------------------------------------------------------------------

test("aegisone_search wraps the same local ARD catalog search POST /search uses", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({ name: "aegisone_search", arguments: { text: "review my pull request", type: ["application/ai-skill"] } });
    assert.notEqual(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    const results = payload.results as Array<Record<string, unknown>>;
    assert.equal(results.length, 1);
    assert.equal(results[0]!.type, "application/ai-skill");
    assert.equal(typeof results[0]!.score, "number");
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_search rejects empty query text without ever reaching the search service (malformed input)", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({ name: "aegisone_search", arguments: { text: "" } });
    assert.equal(result.isError, true);
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_search surfaces an unsupported federation provider id as a structured tool error, not a crash", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({ name: "aegisone_search", arguments: { text: "anything", federation: ["not-a-real-provider"] } });
    assert.equal(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    assert.equal(payload.error, "invalid_request");
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// aegisone_inspect
// ---------------------------------------------------------------------------

test("aegisone_inspect returns resource_not_found for an unknown resourceId", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({ name: "aegisone_inspect", arguments: { resourceId: "does-not-exist" } });
    assert.equal(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    assert.equal(payload.error, "resource_not_found");
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_inspect rejects a missing resourceId (malformed input)", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({ name: "aegisone_inspect", arguments: {} });
    assert.equal(result.isError, true);
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_inspect never upgrades a purely INDEXED resource: every trust dimension stays NONE/NOT_RUN/NOT_EVALUATED", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const resource = await seedIndexedOnlyResource(running.catalogStore);
    const result = await client.callTool({ name: "aegisone_inspect", arguments: { resourceId: resource.id } });
    assert.notEqual(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    const trust = payload.trust as Record<string, Record<string, unknown>>;
    assert.equal(trust.sourceAssurance!.level, "NONE");
    assert.equal(trust.sourceInspection!.status, "NOT_RUN");
    assert.equal(trust.correspondence!.status, "NOT_EVALUATED");
    assert.equal(trust.security!.status, "NOT_RUN");
    assert.equal(trust.canonicalEvidence!.status, "NONE");

    // Regression: no ambiguous verified/safe boolean anywhere in the raw tool text output, and no
    // dimension collapsed into one flag (docs/17 Threat M8-020, enforced again at the MCP layer).
    const rawText = (result.content as Array<{ type: string; text?: string }>).find((block) => block.type === "text")!.text!;
    assert.doesNotMatch(rawText, /"verified"\s*:\s*true/);
    assert.doesNotMatch(rawText, /"safe"\s*:\s*true/);
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_inspect reports independent MATCH/REPOSITORY_AUTHENTICATED dimensions for a fully verified resource", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const resource = await seedAuthenticatedMatchResource(running.catalogStore);
    const result = await client.callTool({ name: "aegisone_inspect", arguments: { resourceId: resource.id } });
    assert.notEqual(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    const trust = payload.trust as Record<string, Record<string, unknown>>;
    assert.equal(trust.sourceAssurance!.level, "REPOSITORY_AUTHENTICATED");
    assert.equal(trust.correspondence!.status, "MATCH");
    assert.equal(trust.security!.status, "COMPLETED");
    // Independent dimensions: correspondence MATCH does not imply security findings were skipped,
    // and neither implies the other. Both are reported by name, never merged.
    assert.ok("highestSeverity" in trust.security!);
    assert.ok("findingCount" in trust.security!);
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// aegisone_evaluate
// ---------------------------------------------------------------------------

test("aegisone_evaluate DENYs an inline resource missing required evidence under a DENY missing-evidence policy", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({
      name: "aegisone_evaluate",
      arguments: {
        policy: { schemaVersion: "1", missingEvidenceDecision: "DENY", minimumSourceAssurance: "REPOSITORY_AUTHENTICATED", requireCorrespondence: "MATCH" },
        resource: skillResource(),
      },
    });
    assert.notEqual(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    assert.equal(payload.decision, "DENY");
    assert.ok(Array.isArray(payload.reasons) && (payload.reasons as unknown[]).length > 0);
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_evaluate ALLOWs a fully verified resourceId under a satisfied policy, reusing the same integrity-checked assembly as GET /api/v1/resources/:resourceId", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const resource = await seedAuthenticatedMatchResource(running.catalogStore);
    const result = await client.callTool({
      name: "aegisone_evaluate",
      arguments: {
        policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW", minimumSourceAssurance: "REPOSITORY_AUTHENTICATED", requireCorrespondence: "MATCH", maximumAuditSeverity: "MEDIUM" },
        resourceId: resource.id,
      },
    });
    assert.notEqual(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    assert.equal(payload.decision, "ALLOW");
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_evaluate rejects supplying both resource and resourceId (malformed input)", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({
      name: "aegisone_evaluate",
      arguments: {
        policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW" },
        resource: skillResource(),
        resourceId: "also-set",
      },
    });
    assert.equal(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    assert.equal(payload.error, "invalid_request");
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

test("aegisone_evaluate rejects a malformed policy object (malformed input)", async () => {
  const running = await startTestServer();
  const client = await connectRealMcpClient(running.baseUrl);
  try {
    const result = await client.callTool({
      name: "aegisone_evaluate",
      arguments: { policy: { schemaVersion: "1", missingEvidenceDecision: "not-a-real-value" }, resource: skillResource() },
    });
    assert.equal(result.isError, true);
    const payload = firstTextPayload(result as { content: Array<{ type: string; text?: string }> });
    assert.equal(payload.error, "invalid_policy");
  } finally {
    await client.close();
    await stopTestServer(running.server);
  }
});

// ---------------------------------------------------------------------------
// Transport-level guards (raw HTTP, no SDK client)
// ---------------------------------------------------------------------------

test("POST /mcp rejects a non-JSON content type before ever constructing a server/transport", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/mcp`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    assert.equal(response.status, 415);
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /mcp is rejected (stateless server-initiated notifications are not needed by these read-only tools)", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/mcp`);
    assert.equal(response.status, 405);
  } finally {
    await stopTestServer(running.server);
  }
});
