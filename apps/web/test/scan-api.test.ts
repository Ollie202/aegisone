import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { FixedWindowRateLimiter } from "../src/rate-limit.ts";
import { createProductRequestHandler, type ProductRequestHandlerOptions } from "../src/product.ts";

/**
 * `POST /api/v1/scan` real-HTTP-server integration coverage — mirrors the existing
 * `apps/web/test/api-v1.test.ts` real-server pattern. Complements the pure-function unit tests in
 * `apps/web/test/scan-service.test.ts`.
 */

interface TestServer {
  baseUrl: string;
  server: Server;
}

async function startTestServer(options: Partial<ProductRequestHandlerOptions> = {}): Promise<TestServer> {
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
    catalogStore: new InMemoryCatalogStore(),
    githubSourceAuthConfig: null,
    secureSourceAuthCookies: false,
    ...options,
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
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function postScan(baseUrl: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/api/v1/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function readFixture(relativePath: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`../../../examples/agent-skills/${relativePath}`, import.meta.url)), "utf8");
}

test("POST /api/v1/scan is publicly reachable with no auth and screens the clean-review fixture as CLEAN", async () => {
  const running = await startTestServer();
  try {
    const skillMd = await readFixture("clean-review/SKILL.md");
    const { status, json } = await postScan(running.baseUrl, { content: skillMd });
    assert.equal(status, 200);
    assert.equal(json.verdict, "CLEAN");
    assert.equal(json.schemaVersion, "1");
    assert.equal(typeof json.contentSha256, "string");
    assert.equal(json.advisoryFindings, null);
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan screens the malicious-sync fixture as BLACKLISTED", async () => {
  const running = await startTestServer();
  try {
    const skillMd = await readFixture("malicious-sync/SKILL.md");
    const extra = await readFixture("malicious-sync/extras/hidden.sh");
    const { status, json } = await postScan(running.baseUrl, {
      content: [{ path: "SKILL.md", content: skillMd }, { path: "extras/hidden.sh", content: extra }],
    });
    assert.equal(status, 200);
    assert.equal(json.verdict, "BLACKLISTED");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan: repeated identical content returns cached: false then cached: true with the same contentSha256", async () => {
  const running = await startTestServer();
  try {
    const body = { content: "a benign skill body for the cache test" };
    const first = await postScan(running.baseUrl, body);
    assert.equal(first.json.cached, false);
    const second = await postScan(running.baseUrl, body);
    assert.equal(second.json.cached, true);
    assert.equal(second.json.contentSha256, first.json.contentSha256);
    assert.equal(second.json.scanCount, 2);
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan rejects a non-JSON content type with 415", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/scan`, { method: "POST", headers: { "content-type": "text/plain" }, body: "hi" });
    assert.equal(response.status, 415);
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan rejects malformed JSON with a structured 400 error", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
    const json = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 400);
    assert.equal(typeof json.error, "string");
    assert.equal(typeof json.errorCode, "string");
    assert.equal(typeof json.message, "string");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan rejects oversized content with 413", async () => {
  const running = await startTestServer();
  try {
    const { status, json } = await postScan(running.baseUrl, { content: "x".repeat(300 * 1024) });
    assert.equal(status, 413);
    assert.equal(json.errorCode, "REQUEST_TOO_LARGE");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan returns 503 scan_unavailable when the server was not configured with scan dependencies", async () => {
  // createApiV1Router falls back to "unavailable" only when scanDeps is omitted entirely; since
  // product.ts always constructs scanDeps, this test calls the router constructor directly to
  // prove that fail-closed default exists.
  const { createApiV1Router } = await import("../src/api-v1.ts");
  const router = createApiV1Router(new InMemoryCatalogStore());
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    void router(request, response, url).then((handled) => {
      if (!handled) {
        response.writeHead(404);
        response.end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "x" }),
    });
    assert.equal(response.status, 503);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("POST /api/v1/scan: Tier 1 rate limiting returns a structured 429 once exhausted", async () => {
  const running = await startTestServer({ scanRateLimiter: new FixedWindowRateLimiter(1, 60_000) });
  try {
    const first = await postScan(running.baseUrl, { content: "first" });
    assert.equal(first.status, 200);
    const second = await postScan(running.baseUrl, { content: "second" });
    assert.equal(second.status, 429);
    assert.equal(second.json.errorCode, "SCAN_RATE_LIMITED");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan: includeAdvisoryScan without configured 0G Compute credentials returns advisory_unavailable, not a silent skip", async () => {
  const running = await startTestServer({ zeroGComputeConfig: null });
  try {
    const { status, json } = await postScan(running.baseUrl, { content: "hello", includeAdvisoryScan: true });
    assert.equal(status, 200);
    assert.equal((json.advisoryFindings as Record<string, unknown>).status, "advisory_unavailable");
  } finally {
    await stopTestServer(running.server);
  }
});

test("POST /api/v1/scan: a response never contains a bare verified:true or safe:true field", async () => {
  const running = await startTestServer();
  try {
    const { json } = await postScan(running.baseUrl, { content: "hello" });
    const raw = JSON.stringify(json);
    assert.ok(!/"verified"\s*:\s*true/.test(raw));
    assert.ok(!/"safe"\s*:\s*true/.test(raw));
  } finally {
    await stopTestServer(running.server);
  }
});
