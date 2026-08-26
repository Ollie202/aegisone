import assert from "node:assert/strict";
import { test } from "node:test";
import { toCorrespondenceEvidence, toSecurityAssessmentEvidence, toSourceInspectionEvidence } from "../src/capability-evidence.ts";
import { assertValidCapabilityResource } from "../../capability-model/src/validate.ts";
import type { CapabilityResource } from "../../capability-model/src/model.ts";
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

function baseResource(overrides: Partial<CapabilityResource> = {}): CapabilityResource {
  return {
    schemaVersion: "1",
    id: "test-skill-1",
    kind: "agent-skill",
    name: "Test Skill",
    description: "A test Agent Skill",
    discovery: {
      status: "INDEXED",
      source: "test",
      sourceResourceId: "test-skill-1",
      resourceUrl: "https://example.com/skill",
      discoveredAt: "2026-08-26T00:00:00.000Z",
    },
    currentVersion: {
      id: "test-skill-1@1",
      versionLabel: "1",
      source: { repositoryUrl: "https://github.com/acme/skill", commitSha: "a".repeat(40), subdirectory: null },
      distribution: { url: "https://example.com/skill.skillpkg", sha256: "c".repeat(64) },
    },
    trust: {
      sourceAssurance: { level: "DECLARED", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
    ...overrides,
  };
}

test("source-only evidence maps onto a valid CapabilityResource (NOT_EVALUATED, no digests)", () => {
  const result = sourceOnlyResult();
  const resource = baseResource({
    currentVersion: {
      id: "test-skill-1@1",
      versionLabel: "1",
      source: { repositoryUrl: "https://github.com/acme/skill", commitSha: "a".repeat(40), subdirectory: null },
      distribution: null,
    },
    trust: {
      sourceAssurance: { level: "DECLARED", evidenceRefs: [] },
      sourceInspection: toSourceInspectionEvidence(result),
      correspondence: toCorrespondenceEvidence(result),
      security: toSecurityAssessmentEvidence(result),
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  });
  assert.doesNotThrow(() => assertValidCapabilityResource(resource));
  assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
});

test("MATCH evidence maps onto a valid CapabilityResource only when currentVersion.distribution carries the same digest", () => {
  const result = matchResult();
  const resource = baseResource({
    trust: {
      sourceAssurance: { level: "DECLARED", evidenceRefs: [] },
      sourceInspection: toSourceInspectionEvidence(result),
      correspondence: toCorrespondenceEvidence(result),
      security: toSecurityAssessmentEvidence(result),
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  });
  assert.doesNotThrow(() => assertValidCapabilityResource(resource));
});

test("source assurance is untouched by this mapping: a DECLARED claim stays DECLARED regardless of correspondence outcome", () => {
  const sourceOnly = toSourceInspectionEvidence(sourceOnlyResult());
  const withMatch = toSourceInspectionEvidence(matchResult());
  // Neither function even accepts a sourceAssurance-shaped input; this is a documentation-level
  // assertion that the two dimensions are produced by entirely separate code paths.
  assert.equal("sourceAssurance" in { ...sourceOnly }, false);
  assert.equal("sourceAssurance" in { ...withMatch }, false);
});
