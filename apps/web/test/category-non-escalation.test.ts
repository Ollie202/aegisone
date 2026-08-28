import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateTrustPolicy, type CapabilityResource, type TrustPolicy } from "../../../packages/capability-model/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { classifySkillCategory } from "../src/ui/skill-category.mjs";
import { SkillLibraryLoader } from "../src/library.ts";
import { seedCookbookSkill } from "../src/library-seed.ts";
import { loadAssembledResource } from "../src/api-v1.ts";

/**
 * ADR-016 non-escalation invariant.
 *
 * A category is browse metadata. Like a search relevance score (AGENTS.md: "Search
 * relevance/ranking is never a trust or safety score and must not enter deterministic policy
 * evaluation"), it must be structurally unable to influence trust evidence or a policy decision.
 *
 * These tests attack that from three directions: the data shape, the policy evaluator, and the
 * serialized API surface.
 */

function resourceWithText(name: string, description: string): CapabilityResource {
  return {
    schemaVersion: "1",
    id: `test:${name.replaceAll(" ", "-").toLowerCase()}`,
    kind: "agent-skill",
    name,
    description,
    discovery: {
      status: "INDEXED",
      source: "test",
      sourceResourceId: `urn:air:test.example:skill:${name.replaceAll(" ", "-").toLowerCase()}`,
      resourceUrl: "https://example.com/skill",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      relevanceScore: 0.99,
    },
    currentVersion: null,
    trust: {
      sourceAssurance: { level: "DECLARED", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

/** Fixed clock: policy evaluation must be a pure function of (resource, policy, now). */
const NOW = Date.parse("2026-06-01T00:00:00.000Z");

const POLICY: TrustPolicy = {
  schemaVersion: "1",
  minimumSourceAssurance: "REPOSITORY_AUTHENTICATED",
  requireCorrespondence: "MATCH",
  maximumAuditSeverity: "LOW",
  missingEvidenceDecision: "REVIEW",
};

test("two resources that classify into different categories evaluate to the identical decision", () => {
  // Same trust evidence, wildly different category-driving text.
  const security = resourceWithText("Vulnerability exploit scanner", "CVE threat model pentest secrets");
  const design = resourceWithText("Tailwind CSS layout kit", "typography responsive figma component library");

  assert.notEqual(
    classifySkillCategory({ name: security.name, description: security.description }).id,
    classifySkillCategory({ name: design.name, description: design.description }).id,
    "fixture must actually classify differently for this test to mean anything",
  );

  const a = evaluateTrustPolicy(security, POLICY, NOW);
  const b = evaluateTrustPolicy(design, POLICY, NOW);
  assert.deepEqual(a, b, "category must not change a policy decision or its reasons");
  assert.equal(a.decision, "DENY");
});

test("a maximal relevance score cannot improve a policy decision either", () => {
  const low = resourceWithText("Some skill", "Some description");
  const high: CapabilityResource = {
    ...low,
    discovery: { ...low.discovery, relevanceScore: 1 },
  };
  const none: CapabilityResource = {
    ...low,
    discovery: { ...low.discovery, relevanceScore: 0 },
  };
  assert.deepEqual(evaluateTrustPolicy(high, POLICY, NOW), evaluateTrustPolicy(none, POLICY, NOW));
});

test("the policy evaluator is not even given a category — it is absent from the model it reads", () => {
  const resource = resourceWithText("Solidity auditor", "smart contract evm");
  // `CapabilityResource` has no category field anywhere, at any depth.
  assert.equal(JSON.stringify(resource).includes("categor"), false);
  // Injecting one anyway must change nothing: the evaluator reads only `trust`.
  const contaminated = { ...resource, category: "security", categoryScore: 1 } as unknown as CapabilityResource;
  assert.deepEqual(evaluateTrustPolicy(contaminated, POLICY, NOW), evaluateTrustPolicy(resource, POLICY, NOW));
});

test("a library entry keeps category as a sibling of trust, never nested inside it", async () => {
  const store = new InMemoryCatalogStore();
  await seedCookbookSkill(store);
  const library = await new SkillLibraryLoader(store).load();
  const entry = library.entries[0];
  assert.ok(entry);

  assert.ok(Object.hasOwn(entry, "category"), "entry must carry a category");
  assert.ok(Object.hasOwn(entry, "trust"), "entry must carry trust");
  // The load-bearing shape assertion: nothing category-shaped may exist inside the trust object.
  assert.equal(JSON.stringify(entry.trust).toLowerCase().includes("categor"), false);
  assert.equal(JSON.stringify(entry.trust).toLowerCase().includes("relevance"), false);
  assert.equal(Object.hasOwn(entry.trust as object, "category"), false);
});

test("the served resource API carries no category at all, so no agent can consume one as evidence", async () => {
  const store = new InMemoryCatalogStore();
  const seeded = await seedCookbookSkill(store);
  const assembled = await loadAssembledResource(store, seeded.resourceId);
  assert.ok(assembled);
  // Category is a view-layer concept only; it never reaches persistence or the public API.
  assert.equal(JSON.stringify(assembled.capability).toLowerCase().includes("categor"), false);
});

test("category is never persisted to the catalog store", async () => {
  const store = new InMemoryCatalogStore();
  const seeded = await seedCookbookSkill(store);
  const resource = await store.getResourceById(seeded.resourceId);
  const discoveries = await store.listDiscoveriesByResource(seeded.resourceId);
  const versions = await store.listVersionsByResource(seeded.resourceId);
  for (const row of [resource, ...discoveries, ...versions]) {
    assert.equal(JSON.stringify(row).toLowerCase().includes("categor"), false);
  }
});
