import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import {
  ARD_MAX_REQUEST_BODY_BYTES,
  ARD_MEDIA_TYPES,
  ARD_SPEC_COMMIT,
} from "../../../packages/discovery-ard/src/index.ts";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";

interface TestServer {
  baseUrl: string;
  server: Server;
}

async function startTestServer(): Promise<TestServer> {
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
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

test("GET /.well-known/ai-catalog.json advertises the pinned AegisOne search registry", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/.well-known/ai-catalog.json`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    const manifest = await response.json() as {
      specVersion: string;
      entries: Array<{ type: string; url: string; metadata: Record<string, string> }>;
    };
    assert.equal(manifest.specVersion, "1.0");
    assert.equal(manifest.entries[0]!.type, ARD_MEDIA_TYPES.registry);
    assert.equal(manifest.entries[0]!.url, "https://aegisone.example/search");
    assert.ok(Object.values(manifest.entries[0]!.metadata).includes(ARD_SPEC_COMMIT));
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /search returns each supported local resource kind with relevance-only scores", async () => {
  const running = await startTestServer();
  const cases = [
    ["review my pull request", ARD_MEDIA_TYPES.agentSkill],
    ["weather forecast", ARD_MEDIA_TYPES.mcpServer],
    ["travel itinerary", ARD_MEDIA_TYPES.a2aAgent],
    ["invoice document", ARD_MEDIA_TYPES.api],
  ] as const;
  try {
    for (const [text, mediaType] of cases) {
      const response = await fetch(`${running.baseUrl}/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: { text, filter: { type: [mediaType] } }, federation: "none", pageSize: 5 }),
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { results: Array<Record<string, unknown>>; referrals: unknown[] };
      assert.equal(body.results.length, 1);
      assert.equal(body.results[0]!.type, mediaType);
      assert.equal(typeof body.results[0]!.score, "number");
      assert.equal(body.results[0]!.source, "https://aegisone.example/search");
      assert.equal(body.results[0]!.trustManifest, undefined);
      assert.deepEqual(body.referrals, []);
    }
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /search reports unsupported filters instead of silently ignoring them", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "review", filter: { trusted: ["true"] } } }),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string; errorCode: string };
    assert.deepEqual(body, {
      error: "unsupported_filter",
      errorCode: "UNSUPPORTED_FILTER",
      message: "unsupported query.filter field(s): trusted",
    });
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /search fails cleanly for malformed, non-JSON, and oversized requests", async () => {
  const running = await startTestServer();
  try {
    const malformed = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json() as { error: string }).error, "invalid_request");

    const wrongType = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    assert.equal(wrongType.status, 415);
    assert.equal((await wrongType.json() as { error: string }).error, "invalid_request");

    const oversized = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(ARD_MAX_REQUEST_BODY_BYTES + 1),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json() as { error: string }).error, "request_too_large");
  } finally {
    await stopTestServer(running.server);
  }
});
