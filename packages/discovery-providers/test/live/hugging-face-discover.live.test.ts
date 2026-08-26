/**
 * Live smoke test — makes a real network call to the pinned Hugging Face Discover endpoint.
 * Not part of `pnpm check` / `pnpm test`. Run explicitly:
 *
 *   pnpm --filter @aegisone/discovery-providers test:live
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHuggingFaceDiscoverProvider } from "../../src/hugging-face-discover.ts";

test("live: Hugging Face Discover returns real, normalized, discovery-only results", async () => {
  const provider = createHuggingFaceDiscoverProvider();
  const outcome = await provider.search({ text: "upload files to a dataset repo", mediaTypes: null, pageSize: 5 }, new AbortController().signal);

  console.log("[live] hugging-face-discover outcome:", JSON.stringify(outcome, null, 2));

  assert.ok(outcome.ok, `expected Hugging Face Discover to succeed, got: ${JSON.stringify(outcome)}`);
  assert.ok(outcome.resources.length > 0, "expected at least one real result");
  for (const resource of outcome.resources) {
    assert.equal(resource.discovery.status, "INDEXED");
    assert.equal(resource.trust.sourceAssurance.level, "NONE");
  }
});
