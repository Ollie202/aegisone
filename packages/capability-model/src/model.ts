export type CapabilityResourceKind = "agent-skill" | "mcp-server" | "a2a-agent" | "api";

export type DiscoveryStatus = "INDEXED" | "STALE" | "UNAVAILABLE";
export type SourceAssuranceLevel =
  | "NONE"
  | "DECLARED"
  | "REPOSITORY_AUTHENTICATED"
  | "SIGNED_RELEASE";

export type SourceInspectionStatus = "NOT_RUN" | "INSPECTED";
export type CorrespondenceStatus =
  | "NOT_EVALUATED"
  | "INSUFFICIENT_EVIDENCE"
  | "MATCH"
  | "MISMATCH"
  | "DIVERGED";

export type SecurityAssessmentStatus = "NOT_RUN" | "COMPLETED";
export type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CanonicalEvidenceStatus = "NONE" | "AVAILABLE";
export type TrustDecision = "ALLOW" | "REVIEW" | "DENY";

export interface DiscoveryMetadata {
  status: DiscoveryStatus;
  source: string;
  sourceResourceId: string;
  resourceUrl: string;
  discoveredAt: string;
  relevanceScore?: number;
}

export interface CapabilitySourceRef {
  repositoryUrl: string;
  commitSha: string | null;
  subdirectory: string | null;
}

export interface CapabilityDistributionRef {
  url: string;
  sha256: string | null;
}

export interface CapabilityVersion {
  id: string;
  versionLabel: string | null;
  source: CapabilitySourceRef | null;
  distribution: CapabilityDistributionRef | null;
}

export interface SourceAssuranceEvidence {
  level: SourceAssuranceLevel;
  evidenceRefs: string[];
}

export interface SourceInspectionEvidence {
  status: SourceInspectionStatus;
  exactCommitSha: string | null;
  sourceSnapshotSha256: string | null;
}

export interface DistributionCorrespondenceEvidence {
  status: CorrespondenceStatus;
  publisherSha256: string | null;
  reproducedSha256: string | null;
}

export interface SecurityAssessmentEvidence {
  status: SecurityAssessmentStatus;
  analysisKind: "DETERMINISTIC_STATIC" | null;
  highestSeverity: SecuritySeverity | null;
  findingCount: number | null;
}

export interface CanonicalEvidencePointer {
  status: CanonicalEvidenceStatus;
  sha256: string | null;
  verifiedAt: string | null;
  storageRoot: string | null;
  registryRecordId: string | null;
}

export interface CapabilityTrustEvidence {
  sourceAssurance: SourceAssuranceEvidence;
  sourceInspection: SourceInspectionEvidence;
  correspondence: DistributionCorrespondenceEvidence;
  security: SecurityAssessmentEvidence;
  canonicalEvidence: CanonicalEvidencePointer;
}

export interface CapabilityResource {
  schemaVersion: "1";
  id: string;
  kind: CapabilityResourceKind;
  name: string;
  description: string;
  discovery: DiscoveryMetadata;
  currentVersion: CapabilityVersion | null;
  trust: CapabilityTrustEvidence;
}

export interface TrustPolicy {
  schemaVersion: "1";
  minimumSourceAssurance?: SourceAssuranceLevel;
  requireCorrespondence?: "MATCH";
  maximumAuditSeverity?: SecuritySeverity;
  maximumEvidenceAgeHours?: number;
  missingEvidenceDecision: Exclude<TrustDecision, "ALLOW">;
}

export interface TrustPolicyReason {
  code:
    | "source_assurance_missing"
    | "source_assurance_below_requirement"
    | "correspondence_missing"
    | "correspondence_not_match"
    | "audit_missing"
    | "audit_severity_exceeded"
    | "canonical_evidence_missing"
    | "canonical_evidence_invalid_time"
    | "canonical_evidence_stale";
  decision: Exclude<TrustDecision, "ALLOW">;
  message: string;
}

export interface TrustPolicyResult {
  schemaVersion: "1";
  decision: TrustDecision;
  reasons: TrustPolicyReason[];
}
