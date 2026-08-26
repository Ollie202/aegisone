import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityResource } from "../../capability-model/src/model.ts";
import { dedupeCapabilityResources } from "../src/dedupe.ts";

function resource(id: string, providerId: string, overrides: Partial<CapabilityResource["discovery"]> = {}): CapabilityResource {
  return {
    schemaVersion: "1",
    id: `${providerId}:${id}`,
    kind: "agent-skill",
    name: "Same Skill",
    description: "d",
    discovery: {
      status: "INDEXED",
      source: `https://${providerId}.example.test`,
      sourceResourceId: id,
      resourceUrl: "https://github.com/example/skills/tree/main/skills/same-skill",
      discoveredAt: "2026-08-26T00:00:00.000Z",
      relevanceScore: 0.5,
      ...overrides,
    },
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

test("deduplicates by normalized resourceUrl, keeping the first-seen provider's attribution", () => {
  const first = resource("a1", "github-agent-finder");
  const second = resource("b7", "hugging-face-discover");
  const deduped = dedupeCapabilityResources([first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]!.discovery.source, first.discovery.source);
  assert.equal(deduped[0]!.discovery.sourceResourceId, "a1");
});

test("trailing slash, query string casing, and fragment differences still dedupe to the same key", () => {
  const first = resource("a1", "github-agent-finder", { resourceUrl: "https://GitHub.com/example/skills/tree/main/skills/same-skill/" });
  const second = resource("b7", "hugging-face-discover", { resourceUrl: "https://github.com/example/skills/tree/main/skills/same-skill#readme" });
  assert.equal(dedupeCapabilityResources([first, second]).length, 1);
});

test("does not deduplicate genuinely distinct resource URLs", () => {
  const first = resource("a1", "github-agent-finder", { resourceUrl: "https://github.com/example/skills/tree/main/skills/skill-one" });
  const second = resource("b7", "hugging-face-discover", { resourceUrl: "https://github.com/example/skills/tree/main/skills/skill-two" });
  assert.equal(dedupeCapabilityResources([first, second]).length, 2);
});

test("dedup order is deterministic: input order decides which duplicate is kept", () => {
  const first = resource("a1", "github-agent-finder");
  const second = resource("b7", "hugging-face-discover");
  const keptFirst = dedupeCapabilityResources([first, second]);
  const keptSecond = dedupeCapabilityResources([second, first]);
  assert.equal(keptFirst[0]!.discovery.sourceResourceId, "a1");
  assert.equal(keptSecond[0]!.discovery.sourceResourceId, "b7");
});
