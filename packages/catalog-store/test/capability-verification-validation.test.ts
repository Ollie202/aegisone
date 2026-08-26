import assert from "node:assert/strict";
import { test } from "node:test";
import { validateNewCapabilityVerification } from "../src/capability-verification-validation.ts";
import type { NewCapabilityVerification } from "../src/model.ts";

function base(overrides: Partial<NewCapabilityVerification> = {}): NewCapabilityVerification {
  return {
    resourceVersionId: "33333333-3333-4333-8333-333333333333",
    sourceClaimId: null,
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "NOT_RUN",
    sourceSnapshotSha256: null,
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "NOT_RUN",
    securityHighestSeverity: null,
    securityFindingCount: null,
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

test("a source-only inspection row (NOT_EVALUATED, no digests) is valid", () => {
  assert.deepEqual(validateNewCapabilityVerification(base({ sourceInspectionStatus: "INSPECTED" })), []);
});

test("NOT_EVALUATED correspondence cannot carry publisher/reproduced digests", () => {
  const issues = validateNewCapabilityVerification(base({
    sourceInspectionStatus: "INSPECTED",
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: "a".repeat(64),
  }));
  assert.ok(issues.some((issue) => issue.code === "not_evaluated_has_digests"));
});

test("MATCH requires equal, non-null publisher and reproduced digests", () => {
  const sha = "a".repeat(64);
  assert.deepEqual(validateNewCapabilityVerification(base({
    sourceInspectionStatus: "INSPECTED",
    correspondenceStatus: "MATCH",
    publisherSha256: sha,
    reproducedSha256: sha,
  })), []);
  const mismatchedDigests = validateNewCapabilityVerification(base({
    sourceInspectionStatus: "INSPECTED",
    correspondenceStatus: "MATCH",
    publisherSha256: sha,
    reproducedSha256: "b".repeat(64),
  }));
  assert.ok(mismatchedDigests.some((issue) => issue.code === "match_requires_equal_digests"));
  const missingReproduced = validateNewCapabilityVerification(base({
    sourceInspectionStatus: "INSPECTED",
    correspondenceStatus: "MATCH",
    publisherSha256: sha,
  }));
  assert.ok(missingReproduced.some((issue) => issue.code === "match_requires_equal_digests"));
});

test("MISMATCH requires different, non-null publisher and reproduced digests", () => {
  const sha = "a".repeat(64);
  const issues = validateNewCapabilityVerification(base({
    sourceInspectionStatus: "INSPECTED",
    correspondenceStatus: "MISMATCH",
    publisherSha256: sha,
    reproducedSha256: sha,
  }));
  assert.ok(issues.some((issue) => issue.code === "mismatch_requires_different_digests"));
});

test("source inspection NOT_RUN cannot be paired with an evaluated correspondence", () => {
  const issues = validateNewCapabilityVerification(base({
    sourceInspectionStatus: "NOT_RUN",
    correspondenceStatus: "MATCH",
    publisherSha256: "a".repeat(64),
    reproducedSha256: "a".repeat(64),
  }));
  assert.ok(issues.some((issue) => issue.code === "inspection_not_run_but_correspondence_evaluated"));
});

test("COMPLETED security requires severity and a non-negative integer finding count", () => {
  assert.ok(validateNewCapabilityVerification(base({ securityStatus: "COMPLETED" }))
    .some((issue) => issue.code === "completed_security_missing_findings"));
  assert.deepEqual(validateNewCapabilityVerification(base({
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: 0,
  })), []);
  assert.ok(validateNewCapabilityVerification(base({
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: -1,
  })).some((issue) => issue.code === "invalid_security_finding_count"));
});

test("malformed digest format is rejected regardless of status", () => {
  const issues = validateNewCapabilityVerification(base({ publisherSha256: "not-a-digest" }));
  assert.ok(issues.some((issue) => issue.code === "invalid_publisher_sha256"));
});
