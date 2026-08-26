import assert from "node:assert/strict";
import { test } from "node:test";
import { SupabaseCatalogStore } from "../src/supabase.ts";
import { federatedResource } from "./fixtures.ts";

interface RecordedRequest {
  url: string;
  init?: RequestInit;
}

function makeStore(responder: (action: string, body: Record<string, unknown>) => unknown) {
  const requests: RecordedRequest[] = [];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ url: String(url), init });
    const body = JSON.parse(String(init?.body)) as { action: string } & Record<string, unknown>;
    const { action, ...rest } = body;
    return new Response(JSON.stringify(responder(action, rest)), { status: 200, headers: { "content-type": "application/json" } });
  };
  const store = new SupabaseCatalogStore({
    url: "https://aegisone.supabase.co",
    publishableKey: "sb_publishable_test",
    appToken: "server-app-secret",
    fetcher: fakeFetch as typeof fetch,
  });
  return { store, requests };
}

const resourceRow = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "mcp-server",
  canonical_key: "github-agent-finder::urn:ai:12345",
  name: "Federated MCP Server",
  description: "A federated discovery result",
  publisher_label: null,
  canonical_url: null,
  first_seen_at: "2026-08-26T00:00:00.000Z",
  last_seen_at: "2026-08-26T00:00:00.000Z",
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

const discoveryRow = {
  id: "22222222-2222-4222-8222-222222222222",
  resource_id: resourceRow.id,
  provider_id: "github-agent-finder",
  provider_resource_id: "urn:ai:12345",
  resource_url: "https://github.com/example/mcp-server",
  media_type: "application/mcp-server-card+json",
  raw_relevance_score: 0.8,
  discovery_status: "INDEXED",
  observed_at: "2026-08-26T00:00:00.000Z",
  expires_at: null,
  provider_metadata: { kind: "mcp-server" },
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

test("upsertDiscoveredResource sends the derived plan and the app token header", async () => {
  const { store, requests } = makeStore((action) => {
    assert.equal(action, "upsertDiscoveredResource");
    return { resource: resourceRow, discovery: discoveryRow, version: null };
  });
  const result = await store.upsertDiscoveredResource(federatedResource({ currentVersion: null }));
  assert.equal(result.resource.id, resourceRow.id);
  assert.equal(result.discovery.providerId, "github-agent-finder");
  assert.equal(result.version, null);

  assert.equal(requests.length, 1);
  assert.match(requests[0]!.url, /functions\/v1\/aegisone-catalog$/);
  const headers = requests[0]!.init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer sb_publishable_test");
  assert.equal(headers["x-proofrail-app-token"], "server-app-secret");
  const body = JSON.parse(String(requests[0]!.init?.body));
  assert.equal(body.resource.canonicalKey, "github-agent-finder::urn:ai:12345");
  assert.equal(body.discovery.providerId, "github-agent-finder");
});

test("markProviderDiscoveriesStale posts providerId/seen list/status and maps returned rows", async () => {
  const { store, requests } = makeStore((action, body) => {
    assert.equal(action, "markProviderDiscoveriesStale");
    assert.equal(body.providerId, "github-agent-finder");
    assert.deepEqual(body.seenProviderResourceIds, ["urn:ai:12345"]);
    assert.equal(body.status, "STALE");
    return { rows: [{ ...discoveryRow, discovery_status: "STALE" }] };
  });
  const updated = await store.markProviderDiscoveriesStale("github-agent-finder", ["urn:ai:12345"]);
  assert.equal(updated.length, 1);
  assert.equal(updated[0]!.discoveryStatus, "STALE");
  assert.equal(requests.length, 1);
});

test("getResourceByCanonicalKey returns null without throwing when nothing is found", async () => {
  const { store } = makeStore((action) => {
    assert.equal(action, "getResourceByCanonicalKey");
    return { resource: null };
  });
  assert.equal(await store.getResourceByCanonicalKey("nothing-here"), null);
});

test("upsertIngestionSource maps camelCase patch fields to the Edge Function's snake_case row", async () => {
  const { store } = makeStore((action, body) => {
    assert.equal(action, "upsertIngestionSource");
    assert.equal(body.id, "github-agent-finder");
    assert.deepEqual(body.patch, { cursor: "page-2", enabled: true });
    return {
      ingestionSource: {
        id: "github-agent-finder",
        provider_type: "discovery-provider",
        enabled: true,
        last_success_at: null,
        last_attempt_at: null,
        cursor: "page-2",
        updated_since: null,
        last_error_code: null,
        last_error_at: null,
        config_public: {},
        created_at: "2026-08-26T00:00:00.000Z",
        updated_at: "2026-08-26T00:00:00.000Z",
      },
    };
  });
  const result = await store.upsertIngestionSource("github-agent-finder", "discovery-provider", { cursor: "page-2", enabled: true });
  assert.equal(result.cursor, "page-2");
});

test("a non-OK Edge Function response raises rather than returning a fabricated row", async () => {
  const fakeFetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ error: "database_error", message: "boom" }), { status: 400, headers: { "content-type": "application/json" } });
  const store = new SupabaseCatalogStore({
    url: "https://aegisone.supabase.co",
    publishableKey: "sb_publishable_test",
    appToken: "server-app-secret",
    fetcher: fakeFetch as typeof fetch,
  });
  await assert.rejects(() => store.upsertDiscoveredResource(federatedResource()), /boom/);
});
