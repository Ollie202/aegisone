import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalSourceClaim, computeSourceClaimDigest } from "../src/claim.ts";
import type { CanonicalSourceClaimInput } from "../src/model.ts";

const BASE: CanonicalSourceClaimInput = {
  resourceId: "11111111-1111-1111-1111-111111111111",
  resourceVersionId: "22222222-2222-2222-2222-222222222222",
  provider: "github",
  repository: { id: 123456789, fullName: "acme/auditor" },
  source: { commitSha: "a".repeat(40), subdirectory: "skills/auditor" },
};

test("canonical claim omits fields that were never observed", () => {
  const claim = buildCanonicalSourceClaim({
    ...BASE,
    repository: { id: null, fullName: "acme/auditor" },
    source: { commitSha: "a".repeat(40), subdirectory: null },
  });
  assert.equal(Object.hasOwn((claim.repository as object), "id"), false);
  assert.equal(Object.hasOwn((claim.source as object), "subdirectory"), false);
  assert.equal(Object.hasOwn(claim, "distribution"), false);
  assert.equal(Object.hasOwn(claim, "authority"), false);
});

test("canonical claim digest is deterministic and reproducible", () => {
  const claim1 = buildCanonicalSourceClaim(BASE);
  const claim2 = buildCanonicalSourceClaim(BASE);
  const digest1 = computeSourceClaimDigest(claim1);
  const digest2 = computeSourceClaimDigest(claim2);
  assert.equal(digest1, digest2);
  assert.match(digest1, /^[0-9a-f]{64}$/);
});

test("canonical claim digest is independent of source key ordering", () => {
  const claim = buildCanonicalSourceClaim(BASE);
  const reordered = {
    source: (claim as Record<string, unknown>).source,
    schemaVersion: claim.schemaVersion,
    provider: claim.provider,
    resourceVersionId: claim.resourceVersionId,
    repository: claim.repository,
    resourceId: claim.resourceId,
  };
  assert.equal(computeSourceClaimDigest(claim), computeSourceClaimDigest(reordered));
});

test("canonical claim digest changes when the authenticated authority differs", () => {
  const unauthenticated = computeSourceClaimDigest(buildCanonicalSourceClaim(BASE));
  const authenticated = computeSourceClaimDigest(buildCanonicalSourceClaim({
    ...BASE,
    authority: { githubUserId: 1234, githubLogin: "publisher", permission: "write" },
  }));
  assert.notEqual(unauthenticated, authenticated);
});

test("canonical claim digest changes when the commit SHA differs (new commit = new claim, not a broken fingerprint)", () => {
  const digestA = computeSourceClaimDigest(buildCanonicalSourceClaim(BASE));
  const digestB = computeSourceClaimDigest(buildCanonicalSourceClaim({
    ...BASE,
    source: { commitSha: "b".repeat(40), subdirectory: "skills/auditor" },
  }));
  assert.notEqual(digestA, digestB);
});

test("distribution digest is included only when actually supplied", () => {
  const withDistribution = buildCanonicalSourceClaim({
    ...BASE,
    distribution: { url: "https://example.com/artifact.tgz", sha256: "c".repeat(64) },
  });
  assert.deepEqual(withDistribution.distribution, { url: "https://example.com/artifact.tgz", sha256: "c".repeat(64) });

  const nullDistribution = buildCanonicalSourceClaim({
    ...BASE,
    distribution: { url: "https://example.com/artifact.tgz", sha256: null },
  });
  assert.deepEqual(nullDistribution.distribution, { url: "https://example.com/artifact.tgz" });
});
