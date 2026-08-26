import assert from "node:assert/strict";
import { test } from "node:test";
import { buildResourceUpsertPlan } from "../src/upsert-plan.ts";
import { ardResource, federatedResource } from "./fixtures.ts";

test("builds a plan for a local ARD resource with no version", () => {
  const plan = buildResourceUpsertPlan(ardResource());
  assert.equal(plan.canonicalKey, "urn:air:proofrail-app-production.up.railway.app:skill:hello");
  assert.equal(plan.resource.kind, "agent-skill");
  assert.equal(plan.discovery.providerId, "ard");
  assert.equal(plan.discovery.providerResourceId, "urn:air:proofrail-app-production.up.railway.app:skill:hello");
  assert.equal(plan.discovery.discoveryStatus, "INDEXED");
  assert.equal(plan.version, null);
});

test("builds a plan for a federated resource with a version", () => {
  const plan = buildResourceUpsertPlan(federatedResource());
  assert.equal(plan.canonicalKey, "github-agent-finder::urn:ai:12345");
  assert.equal(plan.discovery.providerId, "github-agent-finder");
  assert.equal(plan.discovery.providerResourceId, "urn:ai:12345");
  assert.ok(plan.version);
  assert.equal(plan.version?.versionKey, "github-agent-finder:urn:ai:12345@1.0.0");
  assert.equal(plan.version?.versionLabel, "1.0.0");
  assert.equal(plan.version?.sourceCommitSha, null);
  assert.equal(plan.version?.distributionSha256, null);
});

test("rejects a resource that fails M8.1 validation rather than persisting it", () => {
  const invalid = ardResource({ name: "" });
  assert.throws(() => buildResourceUpsertPlan(invalid));
});

test("provider_metadata never carries anything beyond bounded discovery-derived fields", () => {
  const resource = federatedResource();
  // Simulate a compromised/forged upstream object trying to smuggle trust-looking
  // fields through extra properties. TypeScript wouldn't allow this on the typed
  // CapabilityResource, but a real upstream integration reads raw JSON, so this
  // proves the plan builder structurally cannot pick such fields up even if present.
  (resource as unknown as Record<string, unknown>).trustManifest = { verified: true };
  (resource as unknown as Record<string, unknown>).matchStatus = "MATCH";

  const plan = buildResourceUpsertPlan(resource);
  const serialized = JSON.stringify(plan.discovery.providerMetadata);
  assert.doesNotMatch(serialized, /trustManifest/);
  assert.doesNotMatch(serialized, /MATCH/);
  assert.deepEqual(Object.keys(plan.discovery.providerMetadata).sort(), ["hasCurrentVersion", "kind", "mediaType"]);
});

test("relevance score and discovery status are the only score-shaped fields persisted, and stay off the version row", () => {
  const plan = buildResourceUpsertPlan(federatedResource());
  assert.equal(plan.discovery.rawRelevanceScore, 0.8);
  assert.ok(!("relevanceScore" in plan.version!));
  assert.ok(!("rawRelevanceScore" in plan.version!));
});
