import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { seedDemoCatalog } from "../src/demo-seed.ts";
import { createProductRequestHandler } from "../src/product.ts";
import { listStaticAssetPaths } from "../src/static-assets.ts";

/**
 * M9 (Issue #31): route-level tests for the new Hub pages, driven through a real `node:http`
 * server exactly like the existing M8.7-M8.11 test files (`api-v1.test.ts`, `mcp.test.ts`,
 * `m8-9-substitution-demo.test.ts`) — never a mocked handler.
 */

interface Running {
  baseUrl: string;
  server: Server;
  catalogStore: InMemoryCatalogStore;
}

async function startServer(): Promise<Running> {
  const catalogStore = new InMemoryCatalogStore();
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
    catalogStore,
    githubSourceAuthConfig: null,
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, catalogStore };
}

async function stopServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("GET / renders the Hub search page in the ADR-015 visual language and is readable without JavaScript", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /What capability does your/);
    assert.match(html, /search-form/);
    // ADR-015 palette tokens, not the dark M1-M7 proof-first palette.
    assert.match(html, /--paper:#f7f5ef/);
    assert.doesNotMatch(html, /#070b12/); // the old dark hero background must not leak into the Hub
    // The single shared illustration metaphor is inline SVG served from this same origin — never a
    // remote image/asset request.
    assert.match(html, /<symbol id="ic-stamp"/);
    assert.match(html, /<symbol id="ic-bytegrid"/);
    assert.doesNotMatch(html, /<img\s/);
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /?q=... server-renders real search results (no-JS-required path)", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/?q=review%20a%20pull%20request`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /value="review a pull request"/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /proof still serves the unmodified M1-M7 dark proof-first landing page", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/proof`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Don.t trust the release\. Rebuild it\./);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /resources/:id 404s cleanly for an unknown resource", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/resources/does-not-exist`);
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.match(html, /Resource not found/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /resources/:id renders every independent Evidence Passport dimension for a real seeded resource", async () => {
  const running = await startServer();
  try {
    const seeded = await seedDemoCatalog(running.catalogStore);
    const response = await fetch(`${running.baseUrl}/resources/${encodeURIComponent(seeded.resourceId)}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    for (const section of ["Capability", "Source assurance", "Distribution correspondence", "Security audit", "Independent execution", "Canonical evidence", "Verification history"]) {
      assert.match(html, new RegExp(`<h2>${section}</h2>`), `missing section: ${section}`);
    }
    assert.match(html, /REPOSITORY AUTHENTICATED/);
    // Most recent history row is MISMATCH; earlier MATCH row still present, neither collapsed away.
    assert.match(html, />MISMATCH</);
    assert.match(html, />MATCH</);
    assert.match(html, /No findings is not proof of safety/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /resources/:id?demo=1 seeds and clearly labels the demo fixture, never presenting it as live production evidence", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/?demo=1`);
    const html = await response.text();
    const match = html.match(/\/resources\/([^"?]+)\?demo=1/);
    assert.ok(match, "expected the Hub demo banner to link to a demo resource");
    const resourceResponse = await fetch(`${running.baseUrl}/resources/${match![1]}?demo=1`);
    assert.equal(resourceResponse.status, 200);
    const resourceHtml = await resourceResponse.text();
    assert.match(resourceHtml, /DEMO FIXTURE/);
    assert.match(resourceHtml, /not live production evidence/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /source/claim renders the real M8.5-backed flow and surfaces GitHub-App-not-configured clearly", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/source/claim`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /GitHub App has not been configured/);
    assert.match(html, /id="connect-github" disabled/);
    assert.match(html, /Create source claim/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /scan renders the paste-to-scan page with the real verdict vocabulary and no fabricated verdict", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/scan`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="scan-form"/);
    assert.match(html, /id="scan-content"/);
    assert.match(html, /name="includeAdvisoryScan"/);
    for (const verdict of ["CLEAN", "FLAGGED", "BLACKLISTED"]) {
      assert.match(html, new RegExp(verdict), `missing verdict vocabulary: ${verdict}`);
    }
    // No scan has run, so the page must not present any verdict as this content's result.
    assert.doesNotMatch(html, /data-verdict=/);
    // The page must state the structural limits of a paste rather than implying source evidence.
    assert.match(html, /not a safety guarantee/);
    assert.match(html, /no claimed publisher/);
    assert.match(html, /data-page="scan"/);
  } finally {
    await stopServer(running.server);
  }
});

test("POST /api/v1/scan drives the /scan page's verdict rendering end-to-end through the real route", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "# Harmless skill\n\nJust prose, no commands.\n" }),
    });
    assert.equal(response.status, 200);
    const json = (await response.json()) as { verdict: string; contentSha256: string; advisoryFindings: unknown; scanCount: number };
    assert.ok(["CLEAN", "FLAGGED", "BLACKLISTED"].includes(json.verdict));
    // Not requested, so the advisory field must be explicitly null rather than an invented result.
    assert.equal(json.advisoryFindings, null);
    const { scanResultHtml } = await import("../src/ui/scan-view.mjs");
    const html = scanResultHtml(json);
    assert.match(html, new RegExp(`data-verdict="${json.verdict}"`));
    // The paste path structurally has no source claim and no correspondence; both must be visible.
    assert.match(html, /NO SOURCE CLAIM/);
    assert.match(html, /NOT EVALUATED/);
  } finally {
    await stopServer(running.server);
  }
});

test("static asset allowlist serves exactly the declared files and nothing via path traversal", async () => {
  const running = await startServer();
  try {
    for (const path of listStaticAssetPaths()) {
      const response = await fetch(`${running.baseUrl}${path}`);
      assert.equal(response.status, 200, `expected ${path} to serve`);
      assert.match(response.headers.get("content-type") ?? "", /javascript/);
    }
    const traversal = await fetch(`${running.baseUrl}/static/../../package.json`);
    assert.notEqual(traversal.status, 200);
    const unknown = await fetch(`${running.baseUrl}/static/ui/does-not-exist.mjs`);
    assert.equal(unknown.status, 404);
  } finally {
    await stopServer(running.server);
  }
});

test("no page response anywhere contains a bare \"verified\":true or generic SAFE badge", async () => {
  const running = await startServer();
  try {
    const seeded = await seedDemoCatalog(running.catalogStore);
    const paths = ["/", "/proof", "/source/claim", "/scan", `/resources/${seeded.resourceId}`];
    for (const path of paths) {
      const response = await fetch(`${running.baseUrl}${path}`);
      const html = await response.text();
      assert.doesNotMatch(html, /"verified"\s*:\s*true/i, path);
    }
  } finally {
    await stopServer(running.server);
  }
});
