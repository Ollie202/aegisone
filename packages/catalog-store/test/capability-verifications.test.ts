import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../src/memory.ts";
import type { NewCapabilityVerification } from "../src/model.ts";

function sourceOnly(overrides: Partial<NewCapabilityVerification> = {}): NewCapabilityVerification {
  return {
    resourceVersionId: "33333333-3333-4333-8333-333333333333",
    sourceClaimId: "44444444-4444-4444-8444-444444444444",
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "INSPECTED",
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: 0,
    canonicalEvidenceSha256: null,
    storageRoot: null,
    storageTransaction: null,
    registryContract: null,
    registryRecordId: null,
    registryTransaction: null,
    verifiedAt: null,
    ...overrides,
  };
}

test("createCapabilityVerification persists a source-only row without correspondence", async () => {
  const store = new InMemoryCatalogStore();
  const row = await store.createCapabilityVerification(sourceOnly());
  assert.equal(row.sourceInspectionStatus, "INSPECTED");
  assert.equal(row.correspondenceStatus, "NOT_EVALUATED");
  assert.equal(row.publisherSha256, null);
  assert.equal(row.reproducedSha256, null);
  assert.ok(row.id);
  assert.ok(row.createdAt);
});

test("createCapabilityVerification rejects a MATCH row missing digests (fails closed at the store boundary)", async () => {
  const store = new InMemoryCatalogStore();
  await assert.rejects(
    store.createCapabilityVerification(sourceOnly({ correspondenceStatus: "MATCH" })),
    /match_requires_equal_digests/,
  );
});

test("a DB-only mutated correspondence status without matching digests can never be inserted", async () => {
  const store = new InMemoryCatalogStore();
  const sha = "a".repeat(64);
  // Attempting to smuggle MISMATCH with equal digests (i.e. claiming a difference that isn't
  // real) must also fail closed.
  await assert.rejects(
    store.createCapabilityVerification(sourceOnly({
      correspondenceStatus: "MISMATCH",
      publisherSha256: sha,
      reproducedSha256: sha,
    })),
    /mismatch_requires_different_digests/,
  );
});

test("every verification creates a new historical row; nothing mutates a prior canonical verdict", async () => {
  const store = new InMemoryCatalogStore();
  const first = await store.createCapabilityVerification(sourceOnly());
  const sha = "a".repeat(64);
  const second = await store.createCapabilityVerification(sourceOnly({
    correspondenceStatus: "MATCH",
    publisherSha256: sha,
    reproducedSha256: sha,
    canonicalEvidenceSha256: "b".repeat(64),
    verifiedAt: "2026-08-26T00:00:00.000Z",
  }));
  assert.notEqual(first.id, second.id);

  const rows = await store.listCapabilityVerificationsByResourceVersion(sourceOnly().resourceVersionId);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find((row) => row.id === first.id), first);

  const latest = await store.getLatestCapabilityVerification(sourceOnly().resourceVersionId);
  assert.equal(latest?.id, second.id);
  assert.equal(latest?.correspondenceStatus, "MATCH");
});

test("getLatestCapabilityVerification returns null when nothing has been recorded", async () => {
  const store = new InMemoryCatalogStore();
  assert.equal(await store.getLatestCapabilityVerification("does-not-exist"), null);
});
