import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import type { CapabilityResource } from "../../../packages/capability-model/src/model.ts";
import type { DiscoveryProvider } from "../../../packages/discovery-providers/src/index.ts";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";

interface TestServer {
  baseUrl: string;
  server: Server;
}

function stubResource(id: string, providerOrigin: string, overrides: Partial<CapabilityResource> = {}): CapabilityResource {
  return {
    schemaVersion: "1",
    id,
    kind: "agent-skill",
    name: "Stub Skill",
    description: "A stubbed federated discovery result.",
    discovery: {
      status: "INDEXED",
      source: providerOrigin,
      sourceResourceId: id,
      resourceUrl: `${providerOrigin}/${id}`,
      discoveredAt: "2026-08-26T00:00:00.000Z",
      relevanceScore: 0.9,
    },
    currentVersion: null,
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

function stubProvider(id: string, resources: CapabilityResource[]): DiscoveryProvider {
  return { id, async search() { return { providerId: id, ok: true, resources, skippedInvalidCount: 0, elapsedMs: 1 }; } };
}

function stubFailingProvider(id: string): DiscoveryProvider {
  return { id, async search() { return { providerId: id, ok: false, errorCode: "timeout", message: "simulated outage", elapsedMs: 1 }; } };
}

async function startTestServer(providers: ReadonlyMap<string, DiscoveryProvider>): Promise<TestServer> {
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://proofrail.example",
    discoveryProviders: providers,
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopTestServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("POST /search with federation returns merged provider-independent CapabilityResource results", async () => {
  const providers = new Map([
    ["stub-a", stubProvider("stub-a", [stubResource("stub-a:1", "https://a.example.test")])],
    ["stub-b", stubProvider("stub-b", [stubResource("stub-b:1", "https://b.example.test")])],
  ]);
  const running = await startTestServer(providers);
  try {
    const response = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "x" }, federation: ["stub-a", "stub-b"], pageSize: 10 }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { results: CapabilityResource[]; providerStatuses: Array<{ providerId: string; ok: boolean }> };
    assert.equal(body.results.length, 2);
    assert.deepEqual(body.providerStatuses.map((s) => s.providerId).sort(), ["stub-a", "stub-b"]);
    assert.ok(body.providerStatuses.every((s) => s.ok));
    for (const resource of body.results) {
      assert.equal(resource.discovery.status, "INDEXED");
      assert.equal(resource.trust.sourceAssurance.level, "NONE");
    }
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /search federation isolates one provider's outage and still returns the healthy provider's results", async () => {
  const providers = new Map([
    ["healthy", stubProvider("healthy", [stubResource("healthy:1", "https://healthy.example.test")])],
    ["broken", stubFailingProvider("broken")],
  ]);
  const running = await startTestServer(providers);
  try {
    const response = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "x" }, federation: ["healthy", "broken"] }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { results: CapabilityResource[]; providerStatuses: Array<{ providerId: string; ok: boolean; errorCode?: string }> };
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0]!.id, "healthy:1");
    const brokenStatus = body.providerStatuses.find((s) => s.providerId === "broken")!;
    assert.equal(brokenStatus.ok, false);
    assert.equal(brokenStatus.errorCode, "timeout");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /search rejects an unknown federation provider id instead of silently ignoring it", async () => {
  const providers = new Map([["stub-a", stubProvider("stub-a", [])]]);
  const running = await startTestServer(providers);
  try {
    const response = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "x" }, federation: ["not-a-real-provider"] }),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string; message: string };
    assert.equal(body.error, "invalid_request");
    assert.match(body.message, /unsupported federation provider id/);
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /search federation still validates query/pageSize/filter bounds", async () => {
  const providers = new Map([["stub-a", stubProvider("stub-a", [])]]);
  const running = await startTestServer(providers);
  try {
    const badPageSize = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "x" }, federation: ["stub-a"], pageSize: 999 }),
    });
    assert.equal(badPageSize.status, 400);

    const badFilter = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "x", filter: { type: ["application/not-a-real-type"] } }, federation: ["stub-a"] }),
    });
    assert.equal(badFilter.status, 400);

    const emptyFederation = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "x" }, federation: [] }),
    });
    assert.equal(emptyFederation.status, 400);
  } finally {
    await stopTestServer(running.server);
  }
});
