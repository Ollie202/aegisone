import assert from "node:assert/strict";
import { test } from "node:test";
import { createArdWireDiscoveryProvider } from "../src/ard-wire-provider.ts";
import { DISCOVERY_PROVIDER_ALLOWED_ORIGINS } from "../src/constants.ts";
import { GITHUB_AGENT_FINDER_FIXTURE_RESPONSE } from "./fixtures.ts";
import { jsonResponseFetch, textResponseFetch, throwingFetch } from "./test-fetch.ts";

const ENDPOINT = "https://agentfinder.github.com/api/v1/search";

test("maps a valid fixture response into normalized, ranked resources", async () => {
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    fetchImpl: jsonResponseFetch(GITHUB_AGENT_FINDER_FIXTURE_RESPONSE),
  });
  const outcome = await provider.search({ text: "deploy a secure Next.js application", mediaTypes: null, pageSize: 10 }, new AbortController().signal);
  assert.ok(outcome.ok);
  assert.equal(outcome.resources.length, 3);
  assert.equal(outcome.skippedInvalidCount, 0);
  assert.equal(outcome.resources[0]!.discovery.sourceResourceId, "urn:ai:github.com:openai:skills:vercel-deploy");
  assert.equal(outcome.resources[0]!.discovery.relevanceScore, 0.8);
});

test("caps accepted results at maxResults even if upstream returns more", async () => {
  const bigResponse = { results: Array.from({ length: 40 }, (_, index) => ({ identifier: `id-${index}`, displayName: `Skill ${index}`, type: "application/ai-skill", url: `https://example.test/${index}`, score: 50 })) };
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    maxResults: 25,
    fetchImpl: jsonResponseFetch(bigResponse),
  });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 25 }, new AbortController().signal);
  assert.ok(outcome.ok);
  assert.equal(outcome.resources.length, 25);
});

test("skips individually malformed entries but keeps valid ones from the same response", async () => {
  const mixedResponse = {
    results: [
      { identifier: "good-1", displayName: "Good One", type: "application/ai-skill", url: "https://example.test/good-1" },
      { identifier: "bad-missing-name", type: "application/ai-skill", url: "https://example.test/bad" },
      { identifier: "bad-unsupported-type", displayName: "Bad Type", type: "application/x-unsupported", url: "https://example.test/bad2" },
      { identifier: "good-2", displayName: "Good Two", type: "application/ai-skill", url: "https://example.test/good-2" },
    ],
  };
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    fetchImpl: jsonResponseFetch(mixedResponse),
  });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 10 }, new AbortController().signal);
  assert.ok(outcome.ok);
  assert.equal(outcome.resources.length, 2);
  assert.equal(outcome.skippedInvalidCount, 2);
});

test("reports a structured failure (not a throw) for a malformed top-level response", async () => {
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    fetchImpl: jsonResponseFetch({ notResults: [] }),
  });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 10 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "malformed_response");
});

test("reports a structured failure for non-JSON provider output", async () => {
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    fetchImpl: textResponseFetch("<html>not json</html>"),
  });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 10 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "malformed_response");
});

test("reports a structured failure instead of throwing when the network call fails", async () => {
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    fetchImpl: throwingFetch("connection reset"),
  });
  const outcome = await provider.search({ text: "x", mediaTypes: null, pageSize: 10 }, new AbortController().signal);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.errorCode, "network_error");
});

test("sends the mediaTypes filter and clamps pageSize to maxResults", async () => {
  let capturedBody: unknown;
  const provider = createArdWireDiscoveryProvider({
    id: "github-agent-finder",
    endpoint: ENDPOINT,
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    maxResults: 25,
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await provider.search({ text: "find a skill", mediaTypes: ["application/ai-skill"], pageSize: 999 }, new AbortController().signal);
  assert.deepEqual(capturedBody, { query: { text: "find a skill", filter: { type: ["application/ai-skill"] } }, pageSize: 25 });
});
