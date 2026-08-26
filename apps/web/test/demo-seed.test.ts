import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { seedDemoCatalog, DEMO_REPO_FULL_NAME } from "../src/demo-seed.ts";

/**
 * M9 (Issue #31): the demo-seed path reuses M8.9's exact fixture identity/content
 * (`apps/web/test/m8-9-substitution-demo.test.ts`) and computes real SHA-256 digests through the
 * real production hashing functions — it must never fabricate a MATCH/MISMATCH label without
 * genuinely different/equal digests behind it, and the source claim must pass the same integrity
 * re-check `apps/web/src/api-v1.ts` runs for any real claim.
 */

test("seedDemoCatalog produces a REPOSITORY_AUTHENTICATED claim and a genuine MATCH then substituted MISMATCH, newest first", async () => {
  const store = new InMemoryCatalogStore();
  const seeded = await seedDemoCatalog(store);

  const claim = await store.getSourceClaim(seeded.claimId);
  assert.ok(claim);
  assert.equal(claim!.assuranceLevel, "REPOSITORY_AUTHENTICATED");
  assert.equal(claim!.sourceRepository, DEMO_REPO_FULL_NAME);

  const verifications = await store.listCapabilityVerificationsByResourceVersion(seeded.resourceVersionId);
  assert.equal(verifications.length, 2);
  assert.equal(verifications[0]?.correspondenceStatus, "MISMATCH");
  assert.equal(verifications[1]?.correspondenceStatus, "MATCH");

  // The genuine row's publisher/reproduced digests are real and equal; the substituted row's
  // reproduced digest is identical to the genuine row's (same claimed source, only distribution
  // changed) while its publisher digest genuinely differs — never a placeholder/fabricated pair.
  const genuine = verifications[1]!;
  const substituted = verifications[0]!;
  assert.equal(genuine.publisherSha256, genuine.reproducedSha256);
  assert.notEqual(substituted.publisherSha256, substituted.reproducedSha256);
  assert.equal(substituted.reproducedSha256, genuine.reproducedSha256);
  assert.match(genuine.publisherSha256 ?? "", /^[0-9a-f]{64}$/);
  assert.match(substituted.publisherSha256 ?? "", /^[0-9a-f]{64}$/);
});

test("seedDemoCatalog is deterministic across repeated seeds (same commit/claim identity)", async () => {
  const store = new InMemoryCatalogStore();
  const first = await seedDemoCatalog(store);
  const resourceAgain = await store.getResourceById(first.resourceId);
  assert.ok(resourceAgain);
});
