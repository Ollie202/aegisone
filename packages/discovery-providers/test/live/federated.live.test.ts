/**
 * Live smoke test — federates a query across both real pinned providers together and asserts
 * the aggregation/dedup/partial-outage-safe path works end to end against live upstreams.
 * Not part of `pnpm check` / `pnpm test`. Run explicitly:
 *
 *   pnpm --filter @proofrail/discovery-providers test:live
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { federatedDiscoverySearch } from "../../src/aggregate.ts";
import { createGithubAgentFinderProvider } from "../../src/github-agent-finder.ts";
import { createHuggingFaceDiscoverProvider } from "../../src/hugging-face-discover.ts";

test("live: federated search across both real providers returns merged, deduplicated results", async () => {
  const providers = [createGithubAgentFinderProvider(), createHuggingFaceDiscoverProvider()];
  const { results, providerStatuses } = await federatedDiscoverySearch(providers, { text: "review a pull request", mediaTypes: null, pageSize: 10 });

  console.log("[live] federated provider statuses:", JSON.stringify(providerStatuses, null, 2));
  console.log("[live] federated result count:", results.length);

  assert.equal(providerStatuses.length, 2);
  // At least one of the two live providers must succeed for this to be a meaningful smoke test.
  assert.ok(providerStatuses.some((status) => status.ok), "expected at least one live provider to succeed");
  const ids = results.map((resource) => resource.id);
  assert.equal(new Set(ids).size, ids.length, "federated results must already be deduplicated");
});
