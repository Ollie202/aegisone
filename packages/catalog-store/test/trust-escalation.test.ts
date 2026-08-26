import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCapabilityResource } from "../../capability-model/src/validate.ts";
import { catalogRecordToCapabilityResource } from "../src/convert.ts";
import { InMemoryCatalogStore } from "../src/memory.ts";
import { federatedResource } from "./fixtures.ts";

// Same regression class as M8.1/M8.2/M8.3, applied at the DB/store layer: nothing a
// discovery provider, an outage, or a forged provider_metadata payload can write into
// this store may become a ProofRail MATCH/MISMATCH, REPOSITORY_AUTHENTICATED,
// SIGNED_RELEASE, or security finding.

test("a DB-only inserted INDEXED resource remains unverified end-to-end", async () => {
  const store = new InMemoryCatalogStore();
  const { resource, discovery, version } = await store.upsertDiscoveredResource(federatedResource());
  assert.equal(discovery.discoveryStatus, "INDEXED");

  const capabilityResource = catalogRecordToCapabilityResource(resource, discovery, version);
  assert.equal(capabilityResource.trust.sourceAssurance.level, "NONE");
  assert.equal(capabilityResource.trust.sourceInspection.status, "NOT_RUN");
  assert.equal(capabilityResource.trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(capabilityResource.trust.security.status, "NOT_RUN");
  assert.equal(capabilityResource.trust.canonicalEvidence.status, "NONE");
  // The reconstructed resource must still pass M8.1's own validator: an "INDEXED but
  // unverified" resource is a valid, expected shape, not an edge case to special-case.
  assert.deepEqual(validateCapabilityResource(capabilityResource), []);
});

test("provider outage/staleness mutates discovery_status only, never the reconstructed trust view", async () => {
  const store = new InMemoryCatalogStore();
  const created = await store.upsertDiscoveredResource(federatedResource());
  const before = catalogRecordToCapabilityResource(created.resource, created.discovery, created.version);

  const [staleDiscovery] = await store.markProviderDiscoveriesStale("github-agent-finder", []);
  assert.ok(staleDiscovery);
  assert.equal(staleDiscovery!.discoveryStatus, "STALE");

  const resourceAfter = await store.getResourceByCanonicalKey(created.resource.canonicalKey);
  assert.ok(resourceAfter);
  const versionsAfter = await store.listVersionsByResource(created.resource.id);

  const after = catalogRecordToCapabilityResource(resourceAfter!, staleDiscovery!, versionsAfter[0] ?? null);
  assert.deepEqual(after.trust, before.trust);
  // Only discovery state moved; resource identity is untouched.
  assert.equal(after.discovery.status, "STALE");
  assert.equal(resourceAfter!.id, created.resource.id);
});

test("provider_metadata cannot smuggle a MATCH/REPOSITORY_AUTHENTICATED claim through the store round trip", async () => {
  const store = new InMemoryCatalogStore();
  const resource = federatedResource();
  // A forged upstream payload would arrive as raw JSON, not a typed CapabilityResource;
  // simulate that by injecting fields the plan builder never reads.
  (resource as unknown as Record<string, unknown>).trustManifest = {
    identity: "attacker",
    sourceAssurance: "REPOSITORY_AUTHENTICATED",
    correspondence: "MATCH",
  };

  const { resource: resourceRow, discovery, version } = await store.upsertDiscoveredResource(resource);
  const rebuilt = catalogRecordToCapabilityResource(resourceRow, discovery, version);
  assert.equal(rebuilt.trust.sourceAssurance.level, "NONE");
  assert.equal(rebuilt.trust.correspondence.status, "NOT_EVALUATED");
  assert.doesNotMatch(JSON.stringify(discovery.providerMetadata), /REPOSITORY_AUTHENTICATED|MATCH/);
});
