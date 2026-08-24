import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityResource, TrustPolicy } from "../src/model.ts";
import { evaluateTrustPolicy } from "../src/policy.ts";
import { validateCapabilityResource } from "../src/validate.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const COMMIT = "c".repeat(40);
const VERIFIED_AT = "2026-08-24T12:00:00.000Z";
const NOW = Date.parse("2026-08-24T18:00:00.000Z");

function indexedResource(): CapabilityResource {
  return {
    schemaVersion: "1",
    id: "skill:example/reviewer",
    kind: "agent-skill",
    name: "Example Reviewer",
    description: "Reviews pull requests.",
    discovery: {
      status: "INDEXED",
      source: "example-finder",
      sourceResourceId: "example/reviewer",
      resourceUrl: "https://example.test/skills/reviewer",
      discoveredAt: "2026-08-24T17:00:00.000Z",
      relevanceScore: 0.99,
    },
    currentVersion: {
      id: "example/reviewer@1",
      versionLabel: "1.0.0",
      source: {
        repositoryUrl: "https://github.com/example/reviewer",
        commitSha: null,
        subdirectory: null,
      },
      distribution: null,
    },
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

function verifiedMatchResource(): CapabilityResource {
  const resource = indexedResource();
  resource.currentVersion = {
    id: "example/reviewer@1",
    versionLabel: "1.0.0",
    source: {
      repositoryUrl: "https://github.com/example/reviewer",
      commitSha: COMMIT,
      subdirectory: "skill",
    },
    distribution: {
      url: "https://example.test/releases/reviewer.skill",
      sha256: SHA_A,
    },
  };
  resource.trust = {
    sourceAssurance: { level: "REPOSITORY_AUTHENTICATED", evidenceRefs: ["github:example/reviewer"] },
    sourceInspection: { status: "INSPECTED", exactCommitSha: COMMIT, sourceSnapshotSha256: SHA_B },
    correspondence: { status: "MATCH", publisherSha256: SHA_A, reproducedSha256: SHA_A },
    security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0 },
    canonicalEvidence: {
      status: "AVAILABLE",
      sha256: SHA_B,
      verifiedAt: VERIFIED_AT,
      storageRoot: "0xproof",
      registryRecordId: "0xrecord",
    },
  };
  return resource;
}

test("indexed discovery is valid without implying ProofRail verification", () => {
  const resource = indexedResource();
  assert.deepEqual(validateCapabilityResource(resource), []);
  assert.equal(resource.discovery.status, "INDEXED");
  assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(resource.trust.canonicalEvidence.status, "NONE");
});

test("source inspection can exist without distribution correspondence", () => {
  const resource = indexedResource();
  resource.currentVersion!.source!.commitSha = COMMIT;
  resource.trust.sourceInspection = { status: "INSPECTED", exactCommitSha: COMMIT, sourceSnapshotSha256: SHA_A };
  assert.deepEqual(validateCapabilityResource(resource), []);
  assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
});

test("MATCH is rejected without a distinct distribution artifact", () => {
  const resource = indexedResource();
  resource.trust.correspondence = { status: "MATCH", publisherSha256: SHA_A, reproducedSha256: SHA_A };
  const issues = validateCapabilityResource(resource);
  assert.ok(issues.some((issue) => issue.code === "invalid_correspondence" && issue.path === "currentVersion.distribution"));
});

test("MATCH requires equal publisher and independent digests", () => {
  const resource = verifiedMatchResource();
  resource.trust.correspondence = { status: "MATCH", publisherSha256: SHA_A, reproducedSha256: SHA_B };
  const issues = validateCapabilityResource(resource);
  assert.ok(issues.some((issue) => issue.code === "invalid_correspondence" && issue.message.includes("identical")));
});

test("MISMATCH requires different publisher and independent digests", () => {
  const resource = verifiedMatchResource();
  resource.trust.correspondence = { status: "MISMATCH", publisherSha256: SHA_A, reproducedSha256: SHA_A };
  const issues = validateCapabilityResource(resource);
  assert.ok(issues.some((issue) => issue.code === "invalid_correspondence" && issue.message.includes("different")));
});

test("deterministic trust policy allows qualifying verified evidence", () => {
  const policy: TrustPolicy = {
    schemaVersion: "1",
    minimumSourceAssurance: "REPOSITORY_AUTHENTICATED",
    requireCorrespondence: "MATCH",
    maximumAuditSeverity: "MEDIUM",
    maximumEvidenceAgeHours: 24,
    missingEvidenceDecision: "DENY",
  };
  assert.deepEqual(evaluateTrustPolicy(verifiedMatchResource(), policy, NOW), {
    schemaVersion: "1",
    decision: "ALLOW",
    reasons: [],
  });
});

test("missing evidence cannot silently pass a policy requirement", () => {
  const policy: TrustPolicy = {
    schemaVersion: "1",
    requireCorrespondence: "MATCH",
    maximumAuditSeverity: "HIGH",
    missingEvidenceDecision: "REVIEW",
  };
  const result = evaluateTrustPolicy(indexedResource(), policy, NOW);
  assert.equal(result.decision, "REVIEW");
  assert.deepEqual(result.reasons.map((reason) => reason.code).sort(), ["audit_missing", "correspondence_missing"]);
});

test("security findings can deny use without rewriting MATCH correspondence", () => {
  const resource = verifiedMatchResource();
  resource.trust.security.highestSeverity = "CRITICAL";
  resource.trust.security.findingCount = 1;
  const policy: TrustPolicy = {
    schemaVersion: "1",
    requireCorrespondence: "MATCH",
    maximumAuditSeverity: "MEDIUM",
    missingEvidenceDecision: "DENY",
  };
  const result = evaluateTrustPolicy(resource, policy, NOW);
  assert.equal(resource.trust.correspondence.status, "MATCH");
  assert.equal(result.decision, "DENY");
  assert.ok(result.reasons.some((reason) => reason.code === "audit_severity_exceeded"));
});

test("stale canonical evidence fails freshness policy", () => {
  const resource = verifiedMatchResource();
  const policy: TrustPolicy = {
    schemaVersion: "1",
    maximumEvidenceAgeHours: 2,
    missingEvidenceDecision: "REVIEW",
  };
  const result = evaluateTrustPolicy(resource, policy, NOW);
  assert.equal(result.decision, "DENY");
  assert.equal(result.reasons[0]?.code, "canonical_evidence_stale");
});

test("search relevance does not affect trust policy", () => {
  const high = verifiedMatchResource();
  const low = verifiedMatchResource();
  high.discovery.relevanceScore = 1;
  low.discovery.relevanceScore = 0.01;
  const policy: TrustPolicy = {
    schemaVersion: "1",
    requireCorrespondence: "MATCH",
    missingEvidenceDecision: "DENY",
  };
  assert.deepEqual(evaluateTrustPolicy(high, policy, NOW), evaluateTrustPolicy(low, policy, NOW));
});
