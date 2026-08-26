import assert from "node:assert/strict";
import { test } from "node:test";
import { validateNewCapabilityVerification } from "../../catalog-store/src/capability-verification-validation.ts";
import { buildCapabilityVerificationInput } from "../src/verification-record.ts";
import type { SkillEnrichmentResult } from "../src/model.ts";

function sourceOnlyResult(): SkillEnrichmentResult {
  return {
    schemaVersion: "1",
    artifactKind: "agent-skill",
    sourceInspection: { status: "INSPECTED", exactCommitSha: "a".repeat(40), sourceSnapshotSha256: "b".repeat(64) },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0, auditTarget: "source", report: null },
    fullVerification: null,
  };
}

function matchResult(): SkillEnrichmentResult {
  const sha = "c".repeat(64);
  return {
    schemaVersion: "1",
    artifactKind: "agent-skill",
    sourceInspection: { status: "INSPECTED", exactCommitSha: "a".repeat(40), sourceSnapshotSha256: "b".repeat(64) },
    correspondence: { status: "MATCH", publisherSha256: sha, reproducedSha256: sha },
    security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0, auditTarget: "publisher", report: null },
    fullVerification: null,
  };
}

test("a source-only result builds a valid capability_verifications row with no canonical evidence pointers", () => {
  const row = buildCapabilityVerificationInput({
    resourceVersionId: "33333333-3333-4333-8333-333333333333",
    sourceClaimId: "44444444-4444-4444-8444-444444444444",
    verificationJobId: null,
    result: sourceOnlyResult(),
  });
  assert.equal(row.correspondenceStatus, "NOT_EVALUATED");
  assert.equal(row.canonicalEvidenceSha256, null);
  assert.equal(row.storageRoot, null);
  assert.deepEqual(validateNewCapabilityVerification(row), []);
});

test("a MATCH result without an explicit canonicalEvidence input still never fabricates storage/registry pointers", () => {
  const row = buildCapabilityVerificationInput({
    resourceVersionId: "33333333-3333-4333-8333-333333333333",
    sourceClaimId: "44444444-4444-4444-8444-444444444444",
    verificationJobId: null,
    result: matchResult(),
  });
  assert.equal(row.correspondenceStatus, "MATCH");
  assert.equal(row.canonicalEvidenceSha256, null);
  assert.equal(row.verifiedAt, null);
  assert.deepEqual(validateNewCapabilityVerification(row), []);
});

test("supplying real canonical evidence attaches storage/registry pointers verbatim", () => {
  const row = buildCapabilityVerificationInput({
    resourceVersionId: "33333333-3333-4333-8333-333333333333",
    sourceClaimId: "44444444-4444-4444-8444-444444444444",
    verificationJobId: "55555555-5555-4555-8555-555555555555",
    result: matchResult(),
    canonicalEvidence: {
      sha256: "d".repeat(64),
      storageRoot: "0xroot",
      storageTransaction: "0xtx",
      registryContract: "0xregistry",
      registryRecordId: "0xrecord",
      registryTransaction: "0xregistrytx",
      verifiedAt: "2026-08-26T00:00:00.000Z",
    },
  });
  assert.equal(row.canonicalEvidenceSha256, "d".repeat(64));
  assert.equal(row.storageRoot, "0xroot");
  assert.equal(row.verifiedAt, "2026-08-26T00:00:00.000Z");
  assert.deepEqual(validateNewCapabilityVerification(row), []);
});
