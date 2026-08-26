import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityResource } from "../../capability-model/src/model.ts";
import { federatedDiscoverySearch } from "../src/aggregate.ts";
import type { DiscoveryProviderErrorCode } from "../src/errors.ts";
import type { DiscoveryProvider } from "../src/types.ts";

function resource(providerId: string, id: string, url: string): CapabilityResource {
  return {
    schemaVersion: "1",
    id: `${providerId}:${id}`,
    kind: "agent-skill",
    name: id,
    description: id,
    discovery: { status: "INDEXED", source: `https://${providerId}.example.test`, sourceResourceId: id, resourceUrl: url, discoveredAt: "2026-08-26T00:00:00.000Z", relevanceScore: 0.5 },
    currentVersion: null,
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

function okProvider(id: string, resources: CapabilityResource[], elapsedMs = 5): DiscoveryProvider {
  return { id, async search() { return { providerId: id, ok: true, resources, skippedInvalidCount: 0, elapsedMs }; } };
}

function failingProvider(id: string, errorCode: DiscoveryProviderErrorCode, message = "boom"): DiscoveryProvider {
  return { id, async search() { return { providerId: id, ok: false, errorCode, message, elapsedMs: 1 }; } };
}

function throwingProvider(id: string): DiscoveryProvider {
  return { id, async search() { throw new Error("provider blew up"); } };
}

const QUERY = { text: "x", mediaTypes: null, pageSize: 10 } as const;

test("merges results from multiple healthy providers", async () => {
  const a = okProvider("a", [resource("a", "1", "https://x.test/1")]);
  const b = okProvider("b", [resource("b", "2", "https://x.test/2")]);
  const { results, providerStatuses } = await federatedDiscoverySearch([a, b], QUERY);
  assert.equal(results.length, 2);
  assert.deepEqual(providerStatuses.map((s) => s.providerId).sort(), ["a", "b"]);
  assert.ok(providerStatuses.every((s) => s.ok));
});

test("one provider outage does not fail the others; partial results still come back", async () => {
  const healthy = okProvider("healthy", [resource("healthy", "1", "https://x.test/1")]);
  const broken = failingProvider("broken", "timeout");
  const { results, providerStatuses } = await federatedDiscoverySearch([healthy, broken], QUERY);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.discovery.sourceResourceId, "1");

  const healthyStatus = providerStatuses.find((s) => s.providerId === "healthy")!;
  const brokenStatus = providerStatuses.find((s) => s.providerId === "broken")!;
  assert.equal(healthyStatus.ok, true);
  assert.equal(brokenStatus.ok, false);
  assert.equal(brokenStatus.errorCode, "timeout");
});

test("a provider throwing synchronously/asynchronously is still isolated (never rejects the whole search)", async () => {
  const healthy = okProvider("healthy", [resource("healthy", "1", "https://x.test/1")]);
  const crashy = throwingProvider("crashy");
  const { results, providerStatuses } = await federatedDiscoverySearch([healthy, crashy], QUERY);
  assert.equal(results.length, 1);
  assert.equal(providerStatuses.find((s) => s.providerId === "crashy")!.ok, false);
});

test("deterministically deduplicates across providers, keeping the first provider's attribution", async () => {
  const first = okProvider("first-provider", [resource("first-provider", "dup", "https://github.com/example/skill")]);
  const second = okProvider("second-provider", [resource("second-provider", "dup", "https://github.com/example/skill")]);
  const { results } = await federatedDiscoverySearch([first, second], QUERY);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.discovery.source, "https://first-provider.example.test");
});

test("truncates merged results to the requested pageSize", async () => {
  const many = okProvider("many", Array.from({ length: 5 }, (_, index) => resource("many", `id-${index}`, `https://x.test/${index}`)));
  const { results } = await federatedDiscoverySearch([many], { text: "x", mediaTypes: null, pageSize: 2 });
  assert.equal(results.length, 2);
});

test("aborts all providers once the shared total deadline elapses", async () => {
  const slow: DiscoveryProvider = {
    id: "slow",
    search(_query, signal) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted by shared deadline")));
      });
    },
  };
  const { results, providerStatuses } = await federatedDiscoverySearch([slow], QUERY, { totalDeadlineMs: 20 });
  assert.equal(results.length, 0);
  assert.equal(providerStatuses[0]!.ok, false);
});

test("empty provider list returns empty results without error", async () => {
  const { results, providerStatuses } = await federatedDiscoverySearch([], QUERY);
  assert.deepEqual(results, []);
  assert.deepEqual(providerStatuses, []);
});
