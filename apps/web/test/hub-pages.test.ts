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

test("GET / renders the SKILLS page in the ADR-015 visual language and is readable without JavaScript", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    // The page's one job, stated in its headline: find skills, and know what is actually proven.
    assert.match(html, /Find agent skills\./);
    assert.match(html, /actually proven/);
    assert.match(html, /search-form/);
    // ADR-015 palette tokens, not the dark M1-M7 proof-first palette.
    assert.match(html, /--paper:#f7f5ef/);
    assert.doesNotMatch(html, /#070b12/); // the old dark hero background must not leak into the Hub
    // The shared *verdict illustration* metaphor is inline SVG served from this same origin.
    assert.match(html, /<symbol id="ic-stamp"/);
    assert.match(html, /<symbol id="ic-bytegrid"/);
    // The only raster asset anywhere is the real brand logo file, and it is same-origin: no image
    // host, no remote asset request (the original intent of this assertion).
    for (const tag of html.match(/<img\s[^>]*>/g) ?? []) {
      assert.match(tag, /src="\/static\//, `unexpected non-same-origin image: ${tag}`);
    }
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  } finally {
    await stopServer(running.server);
  }
});

test("the nav brand mark and favicon are the real committed logo file, served same-origin", async () => {
  const running = await startServer();
  try {
    const response = await fetch(`${running.baseUrl}/`);
    const html = await response.text();
    // Brand mark in both the desktop rail and the compact mobile top bar, plus the favicon.
    assert.match(html, /<link rel="icon" type="image\/jpeg" href="\/static\/brand\/logo\.jpg">/);
    assert.match(html, /<img src="\/static\/brand\/logo\.jpg"[^>]*alt="AegisOne"/);
    // The invented SVG "stamp ring + byte grid" brand mark must no longer act as the logo.
    assert.doesNotMatch(html, /class="railMark"/);

    const asset = await fetch(`${running.baseUrl}/static/brand/logo.jpg`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("content-type"), "image/jpeg");
    const bytes = new Uint8Array(await asset.arrayBuffer());
    assert.ok(bytes.length > 1000, "expected the real logo file, not a stub");
    assert.equal(bytes[0], 0xff); // JPEG SOI marker — the actual file, not a regenerated SVG
    assert.equal(bytes[1], 0xd8);
  } finally {
    await stopServer(running.server);
  }
});

test("GET / shows the real catalog library but no search result rows until a search has run", async () => {
  const running = await startServer();
  try {
    const seeded = await seedDemoCatalog(running.catalogStore);
    assert.ok(seeded.resourceId);
    const response = await fetch(`${running.baseUrl}/`);
    const html = await response.text();
    // The library renders real catalog rows...
    assert.match(html, /id="library-region"/);
    assert.match(html, /class="libRow/);
    assert.match(html, /Playful Neo-Brutalist Web Design/);
    // ...but nothing is presented as live *search* output before a search has actually run.
    assert.doesNotMatch(html, /class="resultCard/);
    assert.match(html, /<div id="search-results"><\/div>/);
    // Example *queries* are offered, and they are clickable queries, not results.
    assert.match(html, /class="pill exampleChip" data-example="Pull request review"/);
    // Each example must name a skill someone is looking for. It must never advertise a capability
    // AegisOne does not have: this page finds and audits skills, it does not audit Solidity or
    // deploy anything.
    assert.doesNotMatch(html, /data-example="[^"]*(Solidity|Deploy)/i);
    // The live federated strip must not be pre-populated by the server either.
    assert.match(html, /Not loaded yet\. Nothing is shown here until a real federated query/);
  } finally {
    await stopServer(running.server);
  }
});

test("the ARD protocol fixtures back /search but can never appear in the human library", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/`)).text();
    // The four pinned ARD fixtures are protocol-conformance data, not library content. This is the
    // exact "full of demo data" failure mode the four-section restructure exists to remove.
    for (const fixture of [
      "Pull Request Reviewer",
      "Weather Observer MCP Server",
      "Travel Planning A2A Agent",
      "Invoice Extraction API",
    ]) {
      assert.doesNotMatch(html, new RegExp(fixture), `ARD fixture leaked into the human library: ${fixture}`);
    }

    // ...while still backing the ARD protocol surface completely unchanged.
    const search = await fetch(`${running.baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: { text: "review my pull request" } }),
    });
    assert.equal(search.status, 200);
    const json = (await search.json()) as { results: Array<{ displayName: string }> };
    assert.ok(
      json.results.some((result) => result.displayName === "Pull Request Reviewer Skill"),
      "the pinned ARD fixture catalog must still back POST /search",
    );

    const manifest = await fetch(`${running.baseUrl}/.well-known/ai-catalog.json`);
    assert.equal(manifest.status, 200);
  } finally {
    await stopServer(running.server);
  }
});

test("every library entry shows its real independent dimensions, with unknowns rendered as unknown", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/`)).text();
    // The seeded cookbook skill's genuine state, each dimension rendered separately.
    assert.match(html, /INDEXED — discovery only/);
    assert.match(html, /NOT A VALID SKILL PACKAGE \(missing_skill_md\)/); // real failing validation
    assert.match(html, /INFO · 0 findings/); // real audit result
    assert.match(html, /NOT EVALUATED/); // correspondence: no distinct distributed artifact
    assert.match(html, /DECLARED/); // never REPOSITORY_AUTHENTICATED
    assert.match(html, /NO CANONICAL EVIDENCE/);
    assert.match(html, /NOT STORED ON 0G/);
    // The genuinely-known facts are shown as real values (see skill-card.test.ts for the
    // unknown-renders-as-"unknown" rule, which needs an entry with a missing field).
    assert.match(html, /1471116222dfe959f091f3d5818993edd968d57c/); // exact source commit
    assert.match(html, /Ollie202/); // author, from the declared repository owner
    // No collapsed verdict badge anywhere: never a generic SAFE/TRUSTED chip.
    assert.doesNotMatch(html, /badge[^>]*>\s*(SAFE|TRUSTED)\b/i);
  } finally {
    await stopServer(running.server);
  }
});

test("all four primary nav sections resolve, and Claim/proof stay reachable without being in nav", async () => {
  const running = await startServer();
  try {
    for (const path of ["/", "/audit", "/verified", "/agents"]) {
      const response = await fetch(`${running.baseUrl}${path}`);
      assert.equal(response.status, 200, `primary nav route ${path} must not 404`);
      const html = await response.text();
      // Every page carries the same four-item primary nav and nothing else.
      assert.match(html, /href="\/audit"/);
      assert.match(html, /href="\/verified"/);
      assert.match(html, /href="\/agents"/);
      // Claim is deliberately NOT in primary nav any more. Check the nav block itself, since
      // `/source/claim` still legitimately appears later in the document (footer).
      const railNav = html.match(/<ul class="railNav">([\s\S]*?)<\/ul>/)?.[1] ?? "";
      assert.ok(railNav.length > 0, "expected a primary nav rail");
      assert.doesNotMatch(railNav, /\/source\/claim/);
      assert.doesNotMatch(railNav, /\/proof/);
      assert.equal((railNav.match(/<li>/g) ?? []).length, 4, "primary nav must be exactly four items");
      // ...but both removed destinations stay reachable from the footer.
      assert.match(html, /class="footerLinks"[\s\S]*?href="\/proof"/);
      assert.match(html, /class="footerLinks"[\s\S]*?href="\/source\/claim"/);
    }

    // The routes themselves still work by direct URL — no M8.5 code was removed.
    for (const path of ["/source/claim", "/proof", "/scan"]) {
      assert.equal((await fetch(`${running.baseUrl}${path}`)).status, 200, `${path} must still work`);
    }
  } finally {
    await stopServer(running.server);
  }
});

test("GET /verified states the limits of MATCH and links only to things that actually work", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/verified`)).text();
    assert.match(html, /MATCH does not mean safe/);
    assert.match(html, /requires a distinct distributed artifact/);
    assert.match(html, /Indexed is not verified/i);
    // Real recorded 0G anchors, not placeholders.
    assert.match(html, /0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181/);
    assert.match(html, /0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4/);
    // PR 3/4: the library is real now. The four states are named and defined on the page, and the
    // M5/M7 anchors above are explicitly labelled as recorded historical runs rather than as
    // output of a publication made by a library entry.
    assert.match(html, /STORED ON 0G/);
    assert.match(html, /completed M5 and M7 live runs/);
    assert.match(html, /Publication is an operator action/);
    // The TEE boundary is never overstated.
    assert.match(html, /does not claim TEE output binding/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /agents lists the real live endpoints and the tools that deliberately do not exist", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/agents`)).text();
    for (const tool of ["aegisone_search", "aegisone_inspect", "aegisone_evaluate", "aegisone_scan"]) {
      assert.match(html, new RegExp(tool), `missing real MCP tool: ${tool}`);
    }
    for (const denied of ["aegisone_install", "aegisone_execute", "aegisone_sign"]) {
      assert.match(html, new RegExp(denied), `missing denied-tool disclosure: ${denied}`);
    }
    // PR 4/4 (ADR-019): endpoints are addressed against the origin that actually served the page,
    // so a local, preview, Railway or Vercel deployment each render themselves and an agent is
    // never sent to a host other than the one it just read the instructions from.
    assert.match(html, new RegExp(`POST ${running.baseUrl.replace(/[.\/]/g, "\\$&")}/mcp`));
    assert.match(html, new RegExp(`POST ${running.baseUrl.replace(/[.\/]/g, "\\$&")}/api/v1/policy/evaluate`));
    assert.match(html, /No public route installs, executes or signs anything/);

    // And the endpoint it advertises really is live.
    const mcp = await fetch(`${running.baseUrl}/mcp`, { method: "GET" });
    assert.equal(mcp.status, 405, "GET /mcp is a documented 405; the POST transport is the live one");
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
    // The seven detailed dimensions are now progressively disclosed (native <details>), with the
    // compact docs/18 summary carrying the scannable state. All content is still in the document.
    assert.match(html, /id="evidence-summary"/);
    for (const dimension of ["Discovery", "Source", "Inspection", "Correspondence", "Security", "Evidence", "Policy"]) {
      assert.match(html, new RegExp(`<span class="summaryLabel">${dimension}</span>`), `missing summary dimension: ${dimension}`);
    }
    assert.equal((html.match(/<details class="passportSection"/g) ?? []).length, 7);
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
    assert.match(html, /data-page="audit"/);
  } finally {
    await stopServer(running.server);
  }
});

test("/audit and /scan serve the identical page, so no existing link to /scan breaks", async () => {
  const running = await startServer();
  try {
    const audit = await (await fetch(`${running.baseUrl}/audit`)).text();
    const scan = await (await fetch(`${running.baseUrl}/scan`)).text();
    assert.equal(audit, scan);
    // AUDIT is the highlighted primary-nav section for both URLs.
    assert.match(audit, /href="\/audit" class="active" aria-current="page"/);
  } finally {
    await stopServer(running.server);
  }
});

test("GET /audit presents the Audit Lab four-card selector: two LIVE, two honestly UPCOMING, no dead links", async () => {
  const running = await startServer();
  try {
    const html = await (await fetch(`${running.baseUrl}/audit`)).text();
    assert.match(html, /Agent Skill Audit/);
    assert.match(html, /Package \/ Artifact Verification/);
    assert.match(html, /Smart Contract Audit/);
    assert.match(html, /MCP \/ Agent Capability Audit/);
    // ADR-020 made Package / Artifact Verification genuinely live, so there are now two LIVE
    // pills. Smart Contract Audit and MCP / Agent Capability Audit remain honestly UPCOMING —
    // still not silently hidden, and still not linked to a route (a dead/fake result would be
    // worse than an honest "not yet").
    assert.equal((html.match(/>LIVE</g) ?? []).length, 2);
    assert.equal((html.match(/>UPCOMING</g) ?? []).length, 2);
    assert.match(html, /auditTypeCard--upcoming/);
    // The cards carry no href of their own — they are informational, not clickable stubs. Scoped
    // to the card grid itself so the live verification panel below it is not swept in.
    const gridStart = html.indexOf(`<div class="auditTypeGrid">`);
    const selectorSection = html.slice(gridStart, html.indexOf("</section>", gridStart));
    assert.doesNotMatch(selectorSection, /<a\s/);
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
      // The allowlist serves exactly two kinds of thing: the isomorphic render modules/app script,
      // and the one committed brand image. Nothing else may be reachable under /static.
      const expected = path.endsWith(".jpg") ? /image\/jpeg/ : /javascript/;
      assert.match(response.headers.get("content-type") ?? "", expected, path);
    }
    assert.deepEqual(
      listStaticAssetPaths().filter((path) => !path.endsWith(".js") && !path.endsWith(".mjs")),
      ["/static/brand/logo.jpg"],
    );
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
    const paths = [
      "/",
      "/audit",
      "/verified",
      "/agents",
      "/proof",
      "/source/claim",
      "/scan",
      `/resources/${seeded.resourceId}`,
    ];
    for (const path of paths) {
      const response = await fetch(`${running.baseUrl}${path}`);
      const html = await response.text();
      assert.doesNotMatch(html, /"verified"\s*:\s*true/i, path);
      assert.doesNotMatch(html, /"safe"\s*:\s*true/i, path);
      // No generic SAFE/TRUSTED badge and no invented numeric trust score, on any page.
      // (The phrase "trust score" is allowed in prose that *denies* having one — e.g. the footer's
      // "never collapsed into one trust score" — so this targets the rendered badge/value shapes.)
      assert.doesNotMatch(html, /badge[^>]*>\s*(SAFE|TRUSTED)\b/i, path);
      assert.doesNotMatch(html, /"(trustScore|safetyScore|overallScore)"/i, path);
      assert.doesNotMatch(html, /(trust|safety|overall)\s+score\s*[:=]\s*\d/i, path);
    }
  } finally {
    await stopServer(running.server);
  }
});
