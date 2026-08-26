/**
 * Live smoke test — makes real network calls to the pinned production MCP Registry
 * (`https://registry.modelcontextprotocol.io`).
 *
 * This is intentionally NOT part of `pnpm check` / `pnpm test` (the root scripts and this
 * package's own `check`/`test` scripts only glob `test/*.test.ts`, not `test/live/**`). Run it
 * explicitly:
 *
 *   pnpm --filter @proofrail/discovery-providers test:live
 *
 * Per AGENTS.md, live network calls are separate smoke/integration evidence; CI/unit tests use
 * the deterministic fixtures in ../fixtures.ts instead.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../../catalog-store/src/memory.ts";
import { createMcpOfficialRegistryProvider, fetchMcpRegistryServersPage } from "../../src/mcp-registry.ts";
import { runMcpOfficialRegistryIngestion } from "../../src/mcp-registry-sync.ts";

test("live: MCP Registry search returns real, normalized, discovery-only INDEXED resources", async () => {
  const provider = createMcpOfficialRegistryProvider();
  const outcome = await provider.search({ text: "filesystem", mediaTypes: null, pageSize: 5 }, new AbortController().signal);

  console.log("[live] mcp-official-registry search outcome:", JSON.stringify(outcome, null, 2));

  assert.ok(outcome.ok, `expected the MCP Registry search to succeed, got: ${JSON.stringify(outcome)}`);
  assert.ok(outcome.resources.length > 0, "expected at least one real result");
  for (const resource of outcome.resources) {
    assert.equal(resource.kind, "mcp-server");
    assert.equal(resource.discovery.status, "INDEXED");
    assert.equal(resource.trust.sourceAssurance.level, "NONE");
    assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
  }
});

test("live: a bare GET /v0.1/servers page (no search filter) returns real entries with pagination metadata", async () => {
  const page = await fetchMcpRegistryServersPage({ limit: 5 }, new AbortController().signal);
  console.log("[live] mcp-official-registry raw page: count =", page.count, "nextCursor =", page.nextCursor, "resources =", page.resources.length);
  assert.ok(page.resources.length > 0);
});

test("live: one bounded incremental ingestion pass persists real MCP Registry resources into an in-memory catalog store", async () => {
  const store = new InMemoryCatalogStore();
  const result = await runMcpOfficialRegistryIngestion({ catalogStore: store, maxPages: 1, pageLimit: 10 });

  console.log("[live] mcp-official-registry ingestion result:", JSON.stringify(result, null, 2));

  assert.ok(result.ok, `expected ingestion to succeed, got: ${JSON.stringify(result)}`);
  assert.ok(result.resourcesUpserted > 0);

  const source = await store.getIngestionSource("mcp-official-registry");
  assert.ok(source !== null);
  assert.ok(source.lastSuccessAt !== null);
});
