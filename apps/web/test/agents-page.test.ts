import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";
import { ADVERTISED_MCP_TOOLS, PRODUCTION_ORIGIN, renderAgentsPageHtml, resolveConnectOrigin } from "../src/pages/agents.ts";

/**
 * PR 4/4 (ADR-019) regression suite for the FOR AGENTS page.
 *
 * The governing rule for this page is that it may never advertise a capability the running server
 * does not have. Three separate tests enforce that mechanically rather than by review:
 *
 *  1. the advertised MCP tool names are asserted **exactly equal** to the set a real
 *     `@modelcontextprotocol/sdk` client sees over a real `POST /mcp`;
 *  2. every HTTP endpoint printed on the page is issued as a real request and must not 404;
 *  3. the trust-dimension field names shown in the page's pasted `aegisone_inspect` payload are
 *     asserted to be the field names the live API actually returns.
 *
 * If `apps/web/src/mcp.ts` or `apps/web/src/api-v1.ts` changes shape, this file fails until the
 * page is corrected. The page cannot drift away from the implementation.
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, catalogStore };
}

async function stopServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

/** The first library resource id this deployment serves, discovered the way a reader would: from
 * the rendered library, not from a fixture constant. */
async function firstLibraryResourceId(baseUrl: string): Promise<string> {
  const html = await (await fetch(`${baseUrl}/`)).text();
  const match = html.match(/href="\/resources\/([0-9a-f-]{36})"/);
  assert.ok(match, "expected the seeded library to expose at least one resource");
  return match![1]!;
}

test("the page advertises exactly the MCP tools the server actually registers", async () => {
  const running = await startServer();
  const client = new Client({ name: "aegisone-agents-page-test", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${running.baseUrl}/mcp`)));
    const { tools } = await client.listTools();
    const registered = tools.map((tool) => tool.name).sort();
    const advertised = [...ADVERTISED_MCP_TOOLS].sort();

    // Exact set equality, in both directions: the page can neither invent a tool nor hide one.
    assert.deepEqual(advertised, registered, "the FOR AGENTS page's tool list has drifted from apps/web/src/mcp.ts");

    // And the rendered HTML really prints each of them.
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();
    for (const name of registered) {
      assert.match(html, new RegExp(name), `the page must name the live tool ${name}`);
    }
  } finally {
    await client.close().catch(() => {});
    await stopServer(running.server);
  }
});

test("every HTTP endpoint printed on the page answers a real request", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();
    const resourceId = await firstLibraryResourceId(running.baseUrl);
    const resource = await (await fetch(`${running.baseUrl}/api/v1/resources/${resourceId}`)).json();
    const versionId = (resource as { currentVersionId: string }).currentVersionId;

    // Pull the advertised endpoints out of the rendered page itself, so this test exercises what a
    // reader is actually told to call rather than a list maintained beside it.
    const advertised = [...html.matchAll(/class="endpointUrl">([A-Z]+) (https?:\/\/[^<]+)</g)].map((match) => {
      const printed = new URL(match[2]!);
      assert.equal(printed.origin, running.baseUrl, "every advertised URL must address the origin that served the page");
      return {
        method: match[1]!,
        path: printed.pathname.replace(":resourceId", resourceId).replace(":versionId", versionId),
      };
    });
    assert.equal(advertised.length, 8, "expected the page to advertise all eight live endpoints");

    const bodies: Record<string, unknown> = {
      "/mcp": { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      "/search": { query: { text: "review a pull request" } },
      "/api/v1/policy/evaluate": { policy: { schemaVersion: "1", missingEvidenceDecision: "REVIEW" }, resourceId },
      "/api/v1/scan": { content: "# a harmless note" },
    };

    for (const endpoint of advertised) {
      const init: RequestInit = { method: endpoint.method };
      if (endpoint.method === "POST") {
        const body = bodies[endpoint.path];
        assert.ok(body, `no test body defined for advertised endpoint ${endpoint.path}`);
        init.body = JSON.stringify(body);
        init.headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
      }
      const response = await fetch(`${running.baseUrl}${endpoint.path}`, init);
      assert.ok(
        response.status >= 200 && response.status < 300,
        `advertised endpoint ${endpoint.method} ${endpoint.path} answered ${response.status} — the page must not advertise a route that does not work`,
      );
      await response.arrayBuffer();
    }
  } finally {
    await stopServer(running.server);
  }
});

test("the pasted evidence payload names the same trust dimensions the live API returns", async () => {
  const running = await startServer();
  try {
    const resourceId = await firstLibraryResourceId(running.baseUrl);
    const evidence = (await (await fetch(`${running.baseUrl}/api/v1/resources/${resourceId}/evidence`)).json()) as {
      trust: Record<string, Record<string, unknown>>;
      integrity: Record<string, unknown>;
    };
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();

    // Every dimension and every field inside it must be named on the page. A renamed or removed
    // backend field fails here rather than leaving a stale shape printed for agents to code against.
    for (const [dimension, fields] of Object.entries(evidence.trust)) {
      assert.match(html, new RegExp(`&quot;${dimension}&quot;`), `page omits trust dimension ${dimension}`);
      for (const field of Object.keys(fields)) {
        assert.match(html, new RegExp(`&quot;${field}&quot;`), `page omits ${dimension}.${field}`);
      }
    }
    for (const flag of Object.keys(evidence.integrity)) {
      assert.match(html, new RegExp(`&quot;${flag}&quot;`), `page omits integrity flag ${flag}`);
    }
  } finally {
    await stopServer(running.server);
  }
});

test("the page shows a real DENY with its real reason codes, and never a collapsed verdict", async () => {
  const running = await startServer();
  try {
    const resourceId = await firstLibraryResourceId(running.baseUrl);
    const result = (await (
      await fetch(`${running.baseUrl}/api/v1/policy/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policy: {
            schemaVersion: "1",
            missingEvidenceDecision: "DENY",
            minimumSourceAssurance: "REPOSITORY_AUTHENTICATED",
            requireCorrespondence: "MATCH",
          },
          resourceId,
        }),
      })
    ).json()) as { decision: string; reasons: { code: string }[] };

    // The refusal the page is built around is the one the server genuinely produces.
    assert.equal(result.decision, "DENY");
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();
    for (const reason of result.reasons) {
      assert.match(html, new RegExp(reason.code), `the page must print the real reason code ${reason.code}`);
    }
    assert.match(html, /&quot;decision&quot;: &quot;DENY&quot;/);

    // And the forbidden vocabulary stays absent, on this page as on every other.
    assert.doesNotMatch(html, /"verified"\s*:\s*true/i);
    assert.doesNotMatch(html, /"safe"\s*:\s*true/i);
    assert.doesNotMatch(html, /badge[^>]*>\s*(SAFE|TRUSTED)\b/i);
    assert.doesNotMatch(html, /"(trustScore|safetyScore|overallScore|riskScore)"/i);
    assert.doesNotMatch(html, /(trust|safety|overall)\s+score\s*[:=]\s*\d/i);
  } finally {
    await stopServer(running.server);
  }
});

test("no install/execute/sign primitive is offered anywhere on the page", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();

    // The denied names appear exactly once each, and only inside the explicitly-denied list — never
    // in the advertised tool list, an endpoint URL, or a code block a reader might copy.
    const deniedList = html.match(/<ul class="toolList toolList--denied">([\s\S]*?)<\/ul>/)?.[1] ?? "";
    assert.ok(deniedList.length > 0, "expected the denied-tool list to be rendered");
    for (const denied of ["aegisone_install", "aegisone_execute", "aegisone_sign", "aegisone_run_arbitrary_build", "aegisone_upload_secret"]) {
      assert.match(deniedList, new RegExp(denied), `${denied} must be disclosed as unavailable`);
      assert.equal((html.match(new RegExp(denied, "g")) ?? []).length, 1, `${denied} must appear only in the denied list`);
    }

    // No copy anywhere invites installation or execution of a discovered resource.
    assert.doesNotMatch(html, /install (?:it|the|this|a) (?:skill|resource|package)/i);
    assert.match(html, /never an instruction to run it/i);
    assert.match(html, /No public route installs, executes or signs anything/);

    // The operator-only funded route is disclosed as not agent-callable, never advertised.
    assert.match(html, /\/api\/v1\/publish/);
    assert.match(html, /deliberately not part of the agent surface/i);
    assert.doesNotMatch(html, /class="endpointUrl">POST [^<]*\/api\/v1\/publish/);
  } finally {
    await stopServer(running.server);
  }
});

test("the page states, rather than hides, what is not available today", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();
    // ADR-017: the publish path is wired and tested, but no funded live run has happened, so no
    // resource has a 0G storage root. That must be said, not implied by omission.
    assert.match(html, /Not available today/i);
    assert.match(html, /storageRoot is null everywhere/);
    assert.match(html, /no funded live run has happened/);
    assert.match(html, /SIGNED_RELEASE/);
    assert.match(html, /no authentication on any tool or read endpoint/i);

    // And the claim is true of this deployment: every resource really does have a null storage root.
    const resourceId = await firstLibraryResourceId(running.baseUrl);
    const resource = (await (await fetch(`${running.baseUrl}/api/v1/resources/${resourceId}`)).json()) as {
      resource: { trust: { canonicalEvidence: { storageRoot: string | null } } };
    };
    assert.equal(resource.resource.trust.canonicalEvidence.storageRoot, null);
  } finally {
    await stopServer(running.server);
  }
});

test("connection instructions address the origin that served the page, and reject a hostile Host header", async () => {
  const running = await startServer();
  try {
    const host = new URL(running.baseUrl).host;
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();
    assert.match(html, new RegExp(`http://${host.replace(".", "\\.")}/mcp`), "the MCP config must address this server");
    // The production origin is named as a fact, separately from the copy-paste blocks.
    assert.match(html, new RegExp(PRODUCTION_ORIGIN.replace(/[.\/]/g, "\\$&")));

    // A malformed/hostile Host falls back to the configured public base URL rather than being
    // rendered into a config block a reader is invited to copy.
    const hostile = await (
      await fetch(`${running.baseUrl}/agents`, { headers: { host: "evil.example/path?x=1" } })
    ).text().catch(() => "");
    if (hostile.length > 0) {
      assert.doesNotMatch(hostile, /evil\.example\/path/, "a malformed Host must never reach a copy-paste block");
    }
  } finally {
    await stopServer(running.server);
  }
});

test("resolveConnectOrigin only ever produces an origin it can vouch for", () => {
  const fallback = "https://aegisone.example";
  // Valid hosts are honoured, with the forwarded scheme when one is supplied.
  assert.equal(resolveConnectOrigin("aegisone-three.vercel.app", "https", fallback), "https://aegisone-three.vercel.app");
  assert.equal(resolveConnectOrigin("aegisone-three.vercel.app", "https,http", fallback), "https://aegisone-three.vercel.app");
  assert.equal(resolveConnectOrigin("example.com:8443", undefined, fallback), "https://example.com:8443");
  // Loopback defaults to http, because https on localhost would not actually work.
  assert.equal(resolveConnectOrigin("localhost:3000", undefined, fallback), "http://localhost:3000");
  assert.equal(resolveConnectOrigin("127.0.0.1:3000", undefined, fallback), "http://127.0.0.1:3000");
  // Anything that is not a bare host[:port] falls back — including scheme smuggling, paths,
  // credentials, whitespace and markup.
  for (const hostile of [
    undefined,
    "",
    "evil.example/path",
    "evil.example?x=1",
    "user:pass@evil.example",
    "evil.example #comment",
    'evil.example"><script>',
    "javascript:alert(1)",
    "//evil.example",
    "a".repeat(300),
  ]) {
    assert.equal(resolveConnectOrigin(hostile, undefined, fallback), fallback, `hostile host accepted: ${String(hostile)}`);
  }
  // A forwarded proto that is not http/https is ignored rather than interpolated.
  assert.equal(resolveConnectOrigin("example.com", "javascript", fallback), "https://example.com");
});

test("the rendered page escapes every value it interpolates", () => {
  const html = renderAgentsPageHtml({
    connectOrigin: 'https://example.com/"><script>alert(1)</script>',
    advisoryConfigured: false,
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("the advisory tier is reported as an explicit availability state, both ways", () => {
  const off = renderAgentsPageHtml({ connectOrigin: "https://aegisone.example", advisoryConfigured: false });
  assert.match(off, /not configured on this deployment/);
  assert.match(off, /advisory_unavailable/);
  const on = renderAgentsPageHtml({ connectOrigin: "https://aegisone.example", advisoryConfigured: true });
  assert.match(on, /advisory tier is configured here/);
  // Either way, the advisory can never change the deterministic verdict.
  assert.match(off, /deterministic verdict is unaffected/);
  assert.match(on, /never set or override the deterministic verdict/);
});
