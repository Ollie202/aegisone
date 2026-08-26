import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../src/memory.ts";
import type { NewSourceClaim } from "../src/model.ts";

const RESOURCE_VERSION_ID = "33333333-3333-4333-8333-333333333333";

function declaredClaim(overrides: Partial<NewSourceClaim> = {}): NewSourceClaim {
  return {
    resourceVersionId: RESOURCE_VERSION_ID,
    provider: "github",
    assuranceLevel: "DECLARED",
    sourceRepository: "acme/auditor",
    sourceRepositoryId: 555,
    sourceRepositoryNodeId: "R_kgAA",
    sourceOwnerLogin: "acme",
    sourceOwnerId: 900,
    sourceCommitSha: "a".repeat(40),
    sourceSubdirectory: null,
    distributionUrl: null,
    distributionSha256: null,
    claimDigestSha256: "b".repeat(64),
    canonicalClaimJson: { schemaVersion: "1" },
    authenticatedAt: null,
    authorityObservations: [],
    ...overrides,
  };
}

test("first claim for a resource version is created active with no conflict", async () => {
  const store = new InMemoryCatalogStore();
  const result = await store.createSourceClaim(declaredClaim());
  assert.equal(result.claim.claimStatus, "active");
  assert.equal(result.conflict, null);
  assert.equal(result.supersededClaimId, null);
});

test("a second claim for the same stable repository supersedes the first, which is never mutated in place", async () => {
  const store = new InMemoryCatalogStore();
  const first = await store.createSourceClaim(declaredClaim());
  const second = await store.createSourceClaim(declaredClaim({ claimDigestSha256: "c".repeat(64), sourceCommitSha: "d".repeat(40) }));

  assert.equal(second.claim.claimStatus, "active");
  assert.equal(second.claim.supersedesClaimId, first.claim.id);
  assert.equal(second.supersededClaimId, first.claim.id);

  const previous = await store.getSourceClaim(first.claim.id);
  assert.equal(previous?.claimStatus, "superseded");
  // Immutable evidence fields are untouched.
  assert.equal(previous?.sourceCommitSha, "a".repeat(40));
  assert.equal(previous?.claimDigestSha256, "b".repeat(64));
});

test("a claim for a different repository on the same resource version is an explicit conflict, not a silent override", async () => {
  const store = new InMemoryCatalogStore();
  const first = await store.createSourceClaim(declaredClaim());
  const second = await store.createSourceClaim(declaredClaim({
    sourceRepository: "widgets/other",
    sourceRepositoryId: 999,
    sourceOwnerLogin: "widgets",
    sourceOwnerId: 901,
    claimDigestSha256: "e".repeat(64),
  }));

  assert.equal(second.claim.claimStatus, "conflicted");
  assert.deepEqual(second.conflict, { type: "SOURCE_CLAIM_CONFLICT", conflictingClaimId: first.claim.id });

  const firstAfter = await store.getSourceClaim(first.claim.id);
  assert.equal(firstAfter?.claimStatus, "conflicted");

  const active = await store.listActiveSourceClaimsByResourceVersion(RESOURCE_VERSION_ID);
  assert.equal(active.length, 0, "a conflicted resource version has no active claim until resolved");
});

test("read-only authority never upgrades a claim to REPOSITORY_AUTHENTICATED", async () => {
  const store = new InMemoryCatalogStore();
  const result = await store.createSourceClaim(declaredClaim({
    assuranceLevel: "DECLARED",
    authorityObservations: [{
      provider: "github",
      subjectType: "github-user",
      subjectId: "42",
      subjectLogin: "octocat",
      repositoryId: 555,
      observedPermission: "read",
      observedRoleName: "read",
      observationJson: { permission: "read" },
      observedAt: new Date().toISOString(),
    }],
  }));
  assert.equal(result.claim.assuranceLevel, "DECLARED");
});

test("authenticated authority observation is persisted alongside a REPOSITORY_AUTHENTICATED claim", async () => {
  const store = new InMemoryCatalogStore();
  const result = await store.createSourceClaim(declaredClaim({
    assuranceLevel: "REPOSITORY_AUTHENTICATED",
    authenticatedAt: new Date().toISOString(),
    authorityObservations: [{
      provider: "github",
      subjectType: "github-user",
      subjectId: "42",
      subjectLogin: "octocat",
      repositoryId: 555,
      observedPermission: "write",
      observedRoleName: "write",
      observationJson: { permission: "write" },
      observedAt: new Date().toISOString(),
    }],
  }));
  assert.equal(result.claim.assuranceLevel, "REPOSITORY_AUTHENTICATED");
  assert.equal(result.authorityObservations.length, 1);
  assert.equal(result.authorityObservations[0]?.observedPermission, "write");
});

test("getSourceClaim recomputable digest matches the stored digest for canonical claim JSON", async () => {
  const store = new InMemoryCatalogStore();
  const created = await store.createSourceClaim(declaredClaim());
  const fetched = await store.getSourceClaim(created.claim.id);
  assert.equal(fetched?.claimDigestSha256, created.claim.claimDigestSha256);
  assert.deepEqual(fetched?.canonicalClaimJson, created.claim.canonicalClaimJson);
});

test("getSourceClaim returns null for an unknown id", async () => {
  const store = new InMemoryCatalogStore();
  assert.equal(await store.getSourceClaim("does-not-exist"), null);
});
