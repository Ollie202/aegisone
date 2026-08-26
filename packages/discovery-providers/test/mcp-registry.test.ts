import assert from "node:assert/strict";
import { test } from "node:test";
import { MCP_OFFICIAL_REGISTRY_BASE_URL, MCP_OFFICIAL_REGISTRY_PROVIDER_ID } from "../src/constants.ts";
import { createMcpOfficialRegistryProvider, fetchMcpRegistryServersPage } from "../src/mcp-registry.ts";
import { MCP_REGISTRY_FIXTURE_PAGE_WITH_REMOTE, MCP_REGISTRY_FIXTURE_RESPONSE } from "./fixtures.ts";
import { jsonResponseFetch, neverRespondingFetch, redirectFetch, streamedOversizedFetch, textResponseFetch, throwingFetch } from "./test-fetch.ts";

test("provider id and base URL match the pinned MCP Registry contract", () => {
  assert.equal(MCP_OFFICIAL_REGISTRY_PROVIDER_ID, "mcp-official-registry");
  assert.equal(MCP_OFFICIAL_REGISTRY_BASE_URL, "https://registry.modelcontextprotocol.io");
});

test("end-to-end: recorded Registry fixture normalizes into attributed, discovery-only INDEXED resources", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: jsonResponseFetch(MCP_REGISTRY_FIXTURE_RESPONSE) });
  const outcome = await provider.search({ text: "filesystem", mediaTypes: null, pageSize: 2 }, new AbortController().signal);

  assert.ok(outcome.ok);
  assert.equal(outcome.providerId, "mcp-official-registry");
  assert.equal(outcome.resources.length, 2);
  for (const resource of outcome.resources) {
    assert.equal(resource.kind, "mcp-server");
    assert.equal(resource.discovery.status, "INDEXED");
    assert.equal(resource.trust.sourceAssurance.level, "NONE");
    assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
    assert.ok(resource.id.startsWith("mcp-official-registry:"));
  }
});

test("builds a GET request with search/limit/version=latest query parameters against the pinned origin", async () => {
  let capturedUrl: string | undefined;
  const fetchImpl = async (url: string | URL) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({ servers: [], metadata: { count: 0 } }), { status: 200, headers: { "content-type": "application/json", "content-length": "30" } });
  };
  const provider = createMcpOfficialRegistryProvider({ fetchImpl });
  await provider.search({ text: "filesystem tools", mediaTypes: null, pageSize: 5 }, new AbortController().signal);

  assert.ok(capturedUrl !== undefined);
  const url = new URL(capturedUrl);
  assert.equal(url.origin, MCP_OFFICIAL_REGISTRY_BASE_URL);
  assert.equal(url.pathname, "/v0.1/servers");
  assert.equal(url.searchParams.get("search"), "filesystem tools");
  assert.equal(url.searchParams.get("limit"), "5");
  assert.equal(url.searchParams.get("version"), "latest");
});

test("skips calling upstream and returns empty results when mediaTypes filter excludes mcp-server", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: throwingFetch("should not be called") });
  const outcome = await provider.search({ text: "x", mediaTypes: ["application/ai-skill"], pageSize: 5 }, new AbortController().signal);
  assert.ok(outcome.ok);
  assert.equal(outcome.resources.length, 0);
});

test("malformed response (missing servers array) is reported as malformed_response, not a crash", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: jsonResponseFetch({ notServers: [] }) });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 5 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "malformed_response");
});

test("non-JSON response body is reported as malformed_response", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: textResponseFetch("not json") });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 5 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "malformed_response");
});

test("timeout is reported as timeout, not left hanging", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: neverRespondingFetch(), timeoutMs: 20 });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 5 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "timeout");
});

test("oversized streamed response is rejected before buffering it all in memory", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: streamedOversizedFetch(2_000_000), maxResponseBytes: 1_000_000 });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 5 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "response_too_large");
});

test("redirect responses are blocked rather than followed", async () => {
  const provider = createMcpOfficialRegistryProvider({ fetchImpl: redirectFetch() });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 5 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "redirect_blocked");
});

test("a call to a non-allowlisted origin is refused", async () => {
  await assert.rejects(
    () => fetchMcpRegistryServersPage({}, new AbortController().signal, { baseUrl: "https://evil.example.test", allowedOrigins: [MCP_OFFICIAL_REGISTRY_BASE_URL], fetchImpl: throwingFetch() }),
    /disallowed_origin|not an allowlisted/,
  );
});

test("normalizes a page with a remote-endpoint-only server (no repository/packages)", async () => {
  const page = await fetchMcpRegistryServersPage({}, new AbortController().signal, { fetchImpl: jsonResponseFetch(MCP_REGISTRY_FIXTURE_PAGE_WITH_REMOTE) });
  assert.equal(page.resources.length, 1);
  assert.equal(page.resources[0].discovery.resourceUrl, "https://api.inference.sh/mcp");
  assert.equal(page.nextCursor, null);
});

test("pagination: nextCursor is threaded through from the upstream metadata", async () => {
  const page = await fetchMcpRegistryServersPage({}, new AbortController().signal, { fetchImpl: jsonResponseFetch(MCP_REGISTRY_FIXTURE_RESPONSE) });
  assert.equal(page.nextCursor, "io.github.Digital-Defiance/mcp-filesystem:0.1.9");
  assert.equal(page.count, 2);
});
