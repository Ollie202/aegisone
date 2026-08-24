import type {
  CapabilityResource,
  CapabilitySourceRef,
  DistributionCorrespondenceEvidence,
  SecurityAssessmentEvidence,
  SourceInspectionEvidence,
} from "./model.ts";

export interface CapabilityModelIssue {
  code:
    | "invalid_identity"
    | "invalid_discovery"
    | "invalid_relevance_score"
    | "invalid_source_ref"
    | "invalid_source_inspection"
    | "invalid_correspondence"
    | "invalid_security_assessment"
    | "invalid_canonical_evidence";
  path: string;
  message: string;
}

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isIsoTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateSourceRef(source: CapabilitySourceRef, issues: CapabilityModelIssue[]): void {
  if (!isNonEmpty(source.repositoryUrl)) {
    issues.push({ code: "invalid_source_ref", path: "currentVersion.source.repositoryUrl", message: "repositoryUrl must be non-empty" });
  }
  if (source.commitSha !== null && !COMMIT_SHA_RE.test(source.commitSha)) {
    issues.push({ code: "invalid_source_ref", path: "currentVersion.source.commitSha", message: "commitSha must be an immutable 40-character Git SHA when present" });
  }
}

function validateSourceInspection(value: SourceInspectionEvidence, issues: CapabilityModelIssue[]): void {
  if (value.status === "NOT_RUN") {
    if (value.exactCommitSha !== null || value.sourceSnapshotSha256 !== null) {
      issues.push({ code: "invalid_source_inspection", path: "trust.sourceInspection", message: "NOT_RUN source inspection cannot carry snapshot evidence" });
    }
    return;
  }

  if (value.exactCommitSha === null || !COMMIT_SHA_RE.test(value.exactCommitSha)) {
    issues.push({ code: "invalid_source_inspection", path: "trust.sourceInspection.exactCommitSha", message: "INSPECTED source evidence requires an exact immutable Git SHA" });
  }
  if (value.sourceSnapshotSha256 === null || !SHA256_RE.test(value.sourceSnapshotSha256)) {
    issues.push({ code: "invalid_source_inspection", path: "trust.sourceInspection.sourceSnapshotSha256", message: "INSPECTED source evidence requires a SHA-256 snapshot digest" });
  }
}

function validateCorrespondence(value: DistributionCorrespondenceEvidence, issues: CapabilityModelIssue[]): void {
  const hasPublisher = value.publisherSha256 !== null && SHA256_RE.test(value.publisherSha256);
  const hasReproduced = value.reproducedSha256 !== null && SHA256_RE.test(value.reproducedSha256);

  if (value.publisherSha256 !== null && !SHA256_RE.test(value.publisherSha256)) {
    issues.push({ code: "invalid_correspondence", path: "trust.correspondence.publisherSha256", message: "publisherSha256 must be a SHA-256 digest" });
  }
  if (value.reproducedSha256 !== null && !SHA256_RE.test(value.reproducedSha256)) {
    issues.push({ code: "invalid_correspondence", path: "trust.correspondence.reproducedSha256", message: "reproducedSha256 must be a SHA-256 digest" });
  }

  if (value.status === "NOT_EVALUATED") {
    if (value.publisherSha256 !== null || value.reproducedSha256 !== null) {
      issues.push({ code: "invalid_correspondence", path: "trust.correspondence", message: "NOT_EVALUATED correspondence cannot carry comparison digests" });
    }
    return;
  }

  if (value.status === "MATCH" || value.status === "MISMATCH" || value.status === "DIVERGED") {
    if (!hasPublisher || !hasReproduced) {
      issues.push({ code: "invalid_correspondence", path: "trust.correspondence", message: `${value.status} requires both publisher and independently reproduced SHA-256 digests` });
      return;
    }
  }

  if (value.status === "MATCH" && value.publisherSha256 !== value.reproducedSha256) {
    issues.push({ code: "invalid_correspondence", path: "trust.correspondence", message: "MATCH requires identical publisher and reproduced digests" });
  }

  if (value.status === "MISMATCH" && value.publisherSha256 === value.reproducedSha256) {
    issues.push({ code: "invalid_correspondence", path: "trust.correspondence", message: "MISMATCH requires different publisher and reproduced digests" });
  }
}

function validateSecurity(value: SecurityAssessmentEvidence, issues: CapabilityModelIssue[]): void {
  if (value.status === "NOT_RUN") {
    if (value.analysisKind !== null || value.highestSeverity !== null || value.findingCount !== null) {
      issues.push({ code: "invalid_security_assessment", path: "trust.security", message: "NOT_RUN security assessment cannot carry findings" });
    }
    return;
  }

  if (value.analysisKind !== "DETERMINISTIC_STATIC") {
    issues.push({ code: "invalid_security_assessment", path: "trust.security.analysisKind", message: "completed M8 security evidence must be deterministic static analysis" });
  }
  if (value.highestSeverity === null) {
    issues.push({ code: "invalid_security_assessment", path: "trust.security.highestSeverity", message: "completed security assessment requires highestSeverity" });
  }
  if (value.findingCount === null || !Number.isInteger(value.findingCount) || value.findingCount < 0) {
    issues.push({ code: "invalid_security_assessment", path: "trust.security.findingCount", message: "completed security assessment requires a non-negative integer findingCount" });
  }
}

export function validateCapabilityResource(resource: CapabilityResource): CapabilityModelIssue[] {
  const issues: CapabilityModelIssue[] = [];

  if (!isNonEmpty(resource.id) || !isNonEmpty(resource.name) || !isNonEmpty(resource.description)) {
    issues.push({ code: "invalid_identity", path: "resource", message: "resource id, name, and description must be non-empty" });
  }

  const discovery = resource.discovery;
  if (!isNonEmpty(discovery.source) || !isNonEmpty(discovery.sourceResourceId) || !isNonEmpty(discovery.resourceUrl) || !isIsoTime(discovery.discoveredAt)) {
    issues.push({ code: "invalid_discovery", path: "discovery", message: "discovery metadata requires source, sourceResourceId, resourceUrl, and a valid discoveredAt timestamp" });
  }
  if (discovery.relevanceScore !== undefined && (!Number.isFinite(discovery.relevanceScore) || discovery.relevanceScore < 0 || discovery.relevanceScore > 1)) {
    issues.push({ code: "invalid_relevance_score", path: "discovery.relevanceScore", message: "relevanceScore must be between 0 and 1" });
  }

  if (resource.currentVersion?.source) {
    validateSourceRef(resource.currentVersion.source, issues);
  }

  if (resource.trust.sourceAssurance.level === "NONE" && resource.trust.sourceAssurance.evidenceRefs.length > 0) {
    issues.push({ code: "invalid_source_ref", path: "trust.sourceAssurance.evidenceRefs", message: "NONE source assurance cannot carry assurance evidence refs" });
  }

  validateSourceInspection(resource.trust.sourceInspection, issues);
  validateCorrespondence(resource.trust.correspondence, issues);
  validateSecurity(resource.trust.security, issues);

  const canonical = resource.trust.canonicalEvidence;
  if (canonical.status === "NONE") {
    if (canonical.sha256 !== null || canonical.verifiedAt !== null || canonical.storageRoot !== null || canonical.registryRecordId !== null) {
      issues.push({ code: "invalid_canonical_evidence", path: "trust.canonicalEvidence", message: "NONE canonical evidence cannot carry proof pointers" });
    }
  } else {
    if (canonical.sha256 === null || !SHA256_RE.test(canonical.sha256)) {
      issues.push({ code: "invalid_canonical_evidence", path: "trust.canonicalEvidence.sha256", message: "AVAILABLE canonical evidence requires a SHA-256 digest" });
    }
    if (canonical.verifiedAt === null || !isIsoTime(canonical.verifiedAt)) {
      issues.push({ code: "invalid_canonical_evidence", path: "trust.canonicalEvidence.verifiedAt", message: "AVAILABLE canonical evidence requires a valid verifiedAt timestamp" });
    }
  }

  if (resource.trust.correspondence.status === "MATCH" || resource.trust.correspondence.status === "MISMATCH" || resource.trust.correspondence.status === "DIVERGED") {
    if (resource.currentVersion?.distribution?.sha256 === null || resource.currentVersion?.distribution?.sha256 === undefined) {
      issues.push({ code: "invalid_correspondence", path: "currentVersion.distribution", message: "distribution correspondence requires a distinct distributed artifact reference and digest" });
    } else if (resource.currentVersion.distribution.sha256 !== resource.trust.correspondence.publisherSha256) {
      issues.push({ code: "invalid_correspondence", path: "currentVersion.distribution.sha256", message: "distribution digest must equal the publisher digest used for correspondence" });
    }
  }

  return issues;
}

export function assertValidCapabilityResource(resource: CapabilityResource): void {
  const issues = validateCapabilityResource(resource);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
}
