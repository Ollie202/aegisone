/**
 * Live smoke test — makes a real network call to the pinned GitHub Agent Finder endpoint.
 *
 * This is intentionally NOT part of `pnpm check` / `pnpm test` (the root scripts and this
 * package's own `check`/`test` scripts only glob `test/*.test.ts`, not `test/live/**`). Run it
 * explicitly:
 *
 *   pnpm --filter @aegisone/discovery-providers test:live
 *
 * Per AGENTS.md, live network calls are separate smoke/integration evidence; CI/unit tests use
 * the deterministic fixtures in ../fixtures.ts instead.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createGithubAgentFinderProvider } from "../../src/github-agent-finder.ts";

test("live: GitHub Agent Finder returns real, normalized, discovery-only results", async () => {
  const provider = createGithubAgentFinderProvider();
  const outcome = await provider.search({ text: "deploy a secure Next.js application", mediaTypes: null, pageSize: 5 }, new AbortController().signal);

  console.log("[live] github-agent-finder outcome:", JSON.stringify(outcome, null, 2));

  assert.ok(outcome.ok, `expected GitHub Agent Finder to succeed, got: ${JSON.stringify(outcome)}`);
  assert.ok(outcome.resources.length > 0, "expected at least one real result");
  for (const resource of outcome.resources) {
    assert.equal(resource.discovery.status, "INDEXED");
    assert.equal(resource.trust.sourceAssurance.level, "NONE");
    assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
  }
});
