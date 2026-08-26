import type {
  CorrespondenceStatus as CapabilityCorrespondenceStatus,
  DistributionCorrespondenceEvidence,
  SecurityAssessmentEvidence,
  SourceInspectionEvidence,
} from "../../capability-model/src/model.ts";
import type { SkillEnrichmentResult } from "./model.ts";

/**
 * Maps an M8.6 enrichment result onto the three `@aegisone/capability-model` (M8.1) evidence
 * dimensions this package is responsible for: source inspection, correspondence, and security.
 * Source assurance (M8.5 `SourceAssuranceEvidence`) and canonical evidence (0G Storage/registry
 * pointers) are deliberately *not* produced here — they come from independent sources
 * (`@aegisone/source-auth-github` and, once a worker completes a live run, the storage/registry
 * clients) and must stay independent per AGENTS.md: "source assurance stays independent of
 * correspondence/audit, and vice versa". Callers assemble the full `CapabilityTrustEvidence` by
 * combining this with those other two dimensions themselves.
 */
export function toSourceInspectionEvidence(result: SkillEnrichmentResult): SourceInspectionEvidence {
  return {
    status: result.sourceInspection.status,
    exactCommitSha: result.sourceInspection.exactCommitSha,
    sourceSnapshotSha256: result.sourceInspection.sourceSnapshotSha256,
  };
}

export function toCorrespondenceEvidence(result: SkillEnrichmentResult): DistributionCorrespondenceEvidence {
  return {
    status: result.correspondence.status as CapabilityCorrespondenceStatus,
    publisherSha256: result.correspondence.publisherSha256,
    reproducedSha256: result.correspondence.reproducedSha256,
  };
}

export function toSecurityAssessmentEvidence(result: SkillEnrichmentResult): SecurityAssessmentEvidence {
  return {
    status: result.security.status,
    analysisKind: result.security.analysisKind,
    highestSeverity: result.security.highestSeverity,
    findingCount: result.security.findingCount,
  };
}
