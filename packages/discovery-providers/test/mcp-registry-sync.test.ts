import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../catalog-store/src/memory.ts";
import { runMcpOfficialRegistryIngestion } from "../src/mcp-registry-sync.ts";
import { MCP_REGISTRY_FIXTURE_PAGE_WITH_REMOTE, MCP_REGISTRY_FIXTURE_RESPONSE } from "./fixtures.ts";
import { jsonResponseFetch, throwingFetch } from "./test-fetch.ts";

/** Serves fixture pages in sequence keyed by request order, for pagination tests. */
function sequentialPagesFetch(pages: unknown[]): typeof fetch {
  let call = 0;
  return (async () => {
    const body = pages[Math.min(call, pages.length - 1)];
    call += 1;
    const text = JSON.stringify(body);
    return new Response(text, { status: 200, headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(text, "utf8")) } });
  }) as typeof fetch;
}

test("one sync pass upserts every normalized resource and persists the returned cursor", async () => {
  const store = new InMemoryCatalogStore();
  const result = await runMcpOfficialRegistryIngestion({ catalogStore: store, maxPages: 1, fetchImpl: jsonResponseFetch(MCP_REGISTRY_FIXTURE_RESPONSE) });

  assert.equal(result.ok, true);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.resourcesUpserted, 2);
  assert.equal(result.nextCursor, "io.github.Digital-Defiance/mcp-filesystem:0.1.9");

  const source = await store.getIngestionSource("mcp-official-registry");
  assert.ok(source !== null);
  assert.equal(source.cursor, "io.github.Digital-Defiance/mcp-filesystem:0.1.9");
  assert.ok(source.lastSuccessAt !== null);
  assert.equal(source.lastErrorCode, null);

  const resource = await store.getResourceByCanonicalKey("mcp-official-registry::com.pulsemcp/remote-filesystem");
  assert.ok(resource !== null);
});

test("pagination stops once a page reports no nextCursor", async () => {
  const store = new InMemoryCatalogStore();
  // First page has a nextCursor; second (terminal) page has none.
  const result = await runMcpOfficialRegistryIngestion({
    catalogStore: store,
    maxPages: 5,
    fetchImpl: sequentialPagesFetch([MCP_REGISTRY_FIXTURE_RESPONSE, MCP_REGISTRY_FIXTURE_PAGE_WITH_REMOTE]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.resourcesUpserted, 3);
  assert.equal(result.nextCursor, null);
  assert.equal(result.truncatedByPageCap, false);
});

test("a bounded page cap stops the walk even when more pages remain, and reports truncatedByPageCap", async () => {
  const store = new InMemoryCatalogStore();
  const result = await runMcpOfficialRegistryIngestion({
    catalogStore: store,
    maxPages: 1,
    fetchImpl: jsonResponseFetch(MCP_REGISTRY_FIXTURE_RESPONSE), // always has a nextCursor
  });

  assert.equal(result.ok, true);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.truncatedByPageCap, true);
  assert.equal(result.nextCursor, "io.github.Digital-Defiance/mcp-filesystem:0.1.9");
});

test("resuming from a persisted cursor picks up where the previous run left off", async () => {
  const store = new InMemoryCatalogStore();
  await store.upsertIngestionSource("mcp-official-registry", "mcp-official-registry", { cursor: "some-previous-cursor" });

  let capturedUrl: string | undefined;
  const fetchImpl = (async (url: string | URL) => {
    capturedUrl = String(url);
    const text = JSON.stringify(MCP_REGISTRY_FIXTURE_PAGE_WITH_REMOTE);
    return new Response(text, { status: 200, headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(text, "utf8")) } });
  }) as typeof fetch;

  await runMcpOfficialRegistryIngestion({ catalogStore: store, fetchImpl });

  assert.ok(capturedUrl !== undefined);
  assert.equal(new URL(capturedUrl).searchParams.get("cursor"), "some-previous-cursor");
});

test("a transport failure stops the walk, records the error on ingestion_sources, and never fabricates resources", async () => {
  const store = new InMemoryCatalogStore();
  const result = await runMcpOfficialRegistryIngestion({ catalogStore: store, fetchImpl: throwingFetch("simulated outage") });

  assert.equal(result.ok, false);
  assert.equal(result.resourcesUpserted, 0);

  const source = await store.getIngestionSource("mcp-official-registry");
  assert.ok(source !== null);
  assert.equal(source.lastSuccessAt, null);
  assert.equal(source.lastErrorCode, "network_error");
  assert.ok(source.lastErrorAt !== null);
});

test("regression: an ingested MCP resource remains INDEXED/unverified end-to-end through the catalog store", async () => {
  const store = new InMemoryCatalogStore();
  await runMcpOfficialRegistryIngestion({ catalogStore: store, fetchImpl: jsonResponseFetch(MCP_REGISTRY_FIXTURE_RESPONSE) });

  const resource = await store.getResourceByCanonicalKey("mcp-official-registry::com.pulsemcp/remote-filesystem");
  assert.ok(resource !== null);
  const discoveries = await store.listDiscoveriesByResource(resource.id);
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].discoveryStatus, "INDEXED");
  // No capability_verifications/source_claims row exists for this resource version.
  const versions = await store.listVersionsByResource(resource.id);
  assert.equal(versions.length, 1);
  const verifications = await store.listCapabilityVerificationsByResourceVersion(versions[0].id);
  assert.equal(verifications.length, 0);
});
