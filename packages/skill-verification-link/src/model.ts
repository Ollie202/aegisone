import type { SkillAuditReport, SkillFormatValidation, SkillPackageEntry, SkillVerificationResult } from "../../skill-audit/src/model.ts";

/**
 * M8.6 orchestration/linkage types. Nothing here is a new verification engine: every value
 * produced by this package is either read straight off `@proofrail/skill-audit` /
 * `@proofrail/core` output, or a hardcoded constant chosen because a required input (a distinct
 * distribution artifact) was never supplied. See `enrichment.ts` for why `MATCH`/`MISMATCH` is
 * structurally unreachable from a source-only call.
 */

export type ArtifactKind = "agent-skill";
export type SourceInspectionStatus = "NOT_RUN" | "INSPECTED";
export type CorrespondenceStatus = "NOT_EVALUATED" | "INSUFFICIENT_EVIDENCE" | "MATCH" | "MISMATCH" | "DIVERGED";
export type SecurityAssessmentStatus = "NOT_RUN" | "COMPLETED";
export type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Identifies the exact immutable source commit to inspect/reproduce from. Always required for
 * source acquisition; never a branch/tag name (AGENTS.md "immutable source revisions use exact
 * commit SHAs, not mutable branches"). */
export interface SourceAcquisitionRequest {
  readonly repositoryUrl: string;
  readonly commitSha: string;
  readonly subdirectory: string | null;
}

/** A bounded, explicit distribution reference (docs/17 Threat M8-003). Never an arbitrary
 * server-side fetch target chosen by search relevance or discovery metadata. */
export interface DistributionArtifactRequest {
  readonly url: string;
  readonly expectedSha256: string | null;
}

export interface SourceInspectionOutcome {
  readonly status: "INSPECTED";
  readonly exactCommitSha: string;
  readonly directoryName: string;
  readonly entries: readonly SkillPackageEntry[];
  readonly sourceSnapshotSha256: string;
  readonly format: SkillFormatValidation;
}

export interface DistributionAcquisitionOutcome {
  readonly directoryName: string;
  readonly entries: readonly SkillPackageEntry[];
  readonly publisherSha256: string;
}

export interface CorrespondenceOutcome {
  readonly status: CorrespondenceStatus;
  readonly publisherSha256: string | null;
  readonly reproducedSha256: string | null;
}

export interface SecurityOutcome {
  readonly status: SecurityAssessmentStatus;
  readonly analysisKind: "DETERMINISTIC_STATIC" | null;
  readonly highestSeverity: SecuritySeverity | null;
  readonly findingCount: number | null;
  /** Which package the deterministic audit actually ran against. `"source"` when only source
   * inspection was available; `"publisher"` (the distributed artifact) once correspondence was
   * evaluated, matching the existing M7 `auditTarget: "publisher"` convention. */
  readonly auditTarget: "source" | "publisher" | null;
  readonly report: SkillAuditReport | null;
}

export interface SkillEnrichmentResult {
  readonly schemaVersion: "1";
  readonly artifactKind: ArtifactKind;
  readonly sourceInspection: {
    readonly status: SourceInspectionStatus;
    readonly exactCommitSha: string | null;
    readonly sourceSnapshotSha256: string | null;
  };
  readonly correspondence: CorrespondenceOutcome;
  readonly security: SecurityOutcome;
  /** Present only when both a publisher package and a source-reproduced package were compared,
   * i.e. exactly the case where correspondence could be evaluated. Reusing
   * `SkillVerificationResult` verbatim (never reimplemented) for anyone who needs the full M7
   * shape (both format validations, the canonical package summaries, etc). */
  readonly fullVerification: SkillVerificationResult | null;
}
