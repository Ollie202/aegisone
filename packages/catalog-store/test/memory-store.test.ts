import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../src/memory.ts";
import { createCatalogStoreFromEnv } from "../src/index.ts";
import { ardResource, federatedResource } from "./fixtures.ts";

test("upserting the same resource twice keeps one stable resource and one stable discovery row", async () => {
  const store = new InMemoryCatalogStore();
  const first = await store.upsertDiscoveredResource(federatedResource());
  const second = await store.upsertDiscoveredResource(federatedResource({
    discovery: { ...federatedResource().discovery, discoveredAt: "2026-08-27T00:00:00.000Z", relevanceScore: 0.42 },
  }));

  assert.equal(first.resource.id, second.resource.id);
  assert.equal(first.discovery.id, second.discovery.id);
  assert.equal(second.discovery.rawRelevanceScore, 0.42);

  const discoveries = await store.listDiscoveriesByResource(first.resource.id);
  assert.equal(discoveries.length, 1);
});

test("two distinct resources never collide into the same catalog identity", async () => {
  const store = new InMemoryCatalogStore();
  const a = await store.upsertDiscoveredResource(ardResource());
  const b = await store.upsertDiscoveredResource(federatedResource());
  assert.notEqual(a.resource.id, b.resource.id);
  assert.notEqual(a.resource.canonicalKey, b.resource.canonicalKey);
});

test("version rows dedupe on (resourceId, versionKey) and update in place", async () => {
  const store = new InMemoryCatalogStore();
  const first = await store.upsertDiscoveredResource(federatedResource());
  assert.ok(first.version);
  const second = await store.upsertDiscoveredResource(federatedResource({
    currentVersion: { id: first.version!.versionKey, versionLabel: "1.0.0", source: null, distribution: null },
    discovery: { ...federatedResource().discovery, discoveredAt: "2026-08-28T00:00:00.000Z" },
  }));
  assert.equal(second.version!.id, first.version!.id);
  const versions = await store.listVersionsByResource(first.resource.id);
  assert.equal(versions.length, 1);
});

test("markProviderDiscoveriesStale only touches discovery_status, never resource/version identity", async () => {
  const store = new InMemoryCatalogStore();
  const kept = await store.upsertDiscoveredResource(federatedResource());
  const dropped = await store.upsertDiscoveredResource(federatedResource({
    id: "github-agent-finder:urn:ai:99999",
    discovery: { ...federatedResource().discovery, sourceResourceId: "urn:ai:99999" },
    currentVersion: null,
  }));

  const updated = await store.markProviderDiscoveriesStale("github-agent-finder", ["urn:ai:12345"]);
  assert.equal(updated.length, 1);
  assert.equal(updated[0]!.providerResourceId, "urn:ai:99999");
  assert.equal(updated[0]!.discoveryStatus, "STALE");

  // Untouched: the "seen" discovery keeps its original status.
  const keptDiscoveries = await store.listDiscoveriesByResource(kept.resource.id);
  assert.equal(keptDiscoveries[0]!.discoveryStatus, "INDEXED");

  // Resource identity for the now-stale discovery is preserved, not deleted.
  const droppedResource = await store.getResourceByCanonicalKey(dropped.resource.canonicalKey);
  assert.ok(droppedResource);
  assert.equal(droppedResource!.id, dropped.resource.id);
});

test("ingestion source upsert supports incremental-refresh cursor bookkeeping", async () => {
  const store = new InMemoryCatalogStore();
  const created = await store.upsertIngestionSource("github-agent-finder", "discovery-provider", {
    cursor: "page-2",
    lastSuccessAt: "2026-08-26T00:00:00.000Z",
  });
  assert.equal(created.cursor, "page-2");
  assert.equal(created.enabled, true);

  const updated = await store.upsertIngestionSource("github-agent-finder", "discovery-provider", {
    cursor: "page-3",
  });
  assert.equal(updated.cursor, "page-3");
  assert.equal(updated.lastSuccessAt, "2026-08-26T00:00:00.000Z");
  assert.equal(updated.createdAt, created.createdAt);

  const fetched = await store.getIngestionSource("github-agent-finder");
  assert.equal(fetched?.cursor, "page-3");
});

test("environment factory only uses memory when explicitly requested", () => {
  const store = createCatalogStoreFromEnv({ PROOFRAIL_CATALOG_STORE: "memory" });
  assert.ok(store instanceof InMemoryCatalogStore);
  assert.throws(() => createCatalogStoreFromEnv({}), /SUPABASE_URL/);
});
