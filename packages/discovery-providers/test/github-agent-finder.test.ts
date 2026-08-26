import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_AGENT_FINDER_ENDPOINT, GITHUB_AGENT_FINDER_PROVIDER_ID } from "../src/constants.ts";
import { createGithubAgentFinderProvider } from "../src/github-agent-finder.ts";
import { GITHUB_AGENT_FINDER_FIXTURE_RESPONSE } from "./fixtures.ts";
import { jsonResponseFetch } from "./test-fetch.ts";

test("provider id and endpoint match the pinned GitHub Agent Finder contract", () => {
  assert.equal(GITHUB_AGENT_FINDER_PROVIDER_ID, "github-agent-finder");
  assert.equal(GITHUB_AGENT_FINDER_ENDPOINT, "https://agentfinder.github.com/api/v1/search");
});

test("end-to-end: recorded GitHub Agent Finder fixture normalizes into attributed, discovery-only resources", async () => {
  const provider = createGithubAgentFinderProvider({ fetchImpl: jsonResponseFetch(GITHUB_AGENT_FINDER_FIXTURE_RESPONSE) });
  const outcome = await provider.search({ text: "deploy a secure Next.js application", mediaTypes: null, pageSize: 10 }, new AbortController().signal);

  assert.ok(outcome.ok);
  assert.equal(outcome.providerId, "github-agent-finder");
  assert.equal(outcome.resources.length, 3);
  for (const resource of outcome.resources) {
    assert.equal(resource.discovery.status, "INDEXED");
    assert.equal(resource.discovery.source, "https://agentfinder.github.com");
    assert.equal(resource.trust.sourceAssurance.level, "NONE");
    assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
    assert.ok(resource.id.startsWith("github-agent-finder:"));
  }
});
