import { verifySkillPackages } from "../../skill-audit/src/verify.ts";
import type { SkillVerificationResult } from "../../skill-audit/src/model.ts";
import { assertVerificationAuthorization, type VerificationAuthorization } from "./authorization.ts";
import { fetchDistributionArtifact, type DistributionFetchOptions } from "./distribution-fetch.ts";
import { auditSourceInspection, inspectSourceOnly } from "./source-acquisition.ts";
import type {
  DistributionArtifactRequest,
  SkillEnrichmentResult,
  SourceAcquisitionRequest,
  SourceInspectionOutcome,
} from "./model.ts";

/**
 * Top-level M8.6 orchestrator. THIS FUNCTION IS THE STRUCTURAL ENFORCEMENT POINT for "source
 * inspection alone cannot emit MATCH/MISMATCH" (AGENTS.md, docs/13 M8.6):
 *
 *   - `request.distribution === null`               -> `evaluateSourceOnly` runs. It contains
 *     no reference to `verifySkillPackages`/`compareArtifacts` anywhere in its body — there is
 *     no `publisherEntries` value in scope for it to pass in. Grep this file: the only call to
 *     `verifySkillPackages` is inside `evaluateWithDistribution`, which is only reachable when a
 *     distribution artifact was actually fetched.
 *   - `request.distribution !== null`                -> `evaluateWithDistribution` runs, which
 *     always calls the *existing*, unmodified `verifySkillPackages` (packages/skill-audit) to
 *     get `MATCH`/`MISMATCH`/`INSUFFICIENT_EVIDENCE` — never a reimplementation of that
 *     comparison.
 *
 * Requires an already-minted `VerificationAuthorization` (see `authorization.ts`) as a
 * parameter: this package adds no HTTP route of its own, and nothing else in this repository
 * can currently construct that type, so calling this function at all requires holding a valid
 * worker/admin token.
 */
export async function runSkillVerificationEnrichment(input: {
  readonly authorization: VerificationAuthorization;
  readonly source: SourceAcquisitionRequest;
  readonly distribution: DistributionArtifactRequest | null;
  readonly allowLocalFixtureRepository?: boolean;
  readonly distributionFetchOptions?: DistributionFetchOptions;
}): Promise<SkillEnrichmentResult> {
  assertVerificationAuthorization(input.authorization);

  const sourceInspection = await inspectSourceOnly(input.source, {
    allowLocalFixtureRepository: input.allowLocalFixtureRepository,
  });

  if (input.distribution === null) {
    return evaluateSourceOnly(sourceInspection);
  }

  const distribution = await fetchDistributionArtifact(input.distribution, input.distributionFetchOptions);
  return evaluateWithDistribution(sourceInspection, distribution);
}

function evaluateSourceOnly(sourceInspection: SourceInspectionOutcome): SkillEnrichmentResult {
  const audit = auditSourceInspection(sourceInspection);
  return {
    schemaVersion: "1",
    artifactKind: "agent-skill",
    sourceInspection: {
      status: "INSPECTED",
      exactCommitSha: sourceInspection.exactCommitSha,
      sourceSnapshotSha256: sourceInspection.sourceSnapshotSha256,
    },
    // Hardcoded: no comparison function is invoked in this branch, so this is structurally the
    // only value `correspondence.status` can hold here.
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: {
      status: "COMPLETED",
      analysisKind: "DETERMINISTIC_STATIC",
      highestSeverity: audit.highestSeverity,
      findingCount: audit.findingCount,
      auditTarget: "source",
      report: audit,
    },
    fullVerification: null,
  };
}

function evaluateWithDistribution(
  sourceInspection: SourceInspectionOutcome,
  distribution: Awaited<ReturnType<typeof fetchDistributionArtifact>>,
): SkillEnrichmentResult {
  const full: SkillVerificationResult = verifySkillPackages({
    publisherEntries: distribution.entries,
    reproducedEntries: sourceInspection.entries,
    publisherDirectoryName: distribution.directoryName,
    reproducedDirectoryName: sourceInspection.directoryName,
  });

  return {
    schemaVersion: "1",
    artifactKind: "agent-skill",
    sourceInspection: {
      status: "INSPECTED",
      exactCommitSha: sourceInspection.exactCommitSha,
      sourceSnapshotSha256: sourceInspection.sourceSnapshotSha256,
    },
    correspondence: {
      status: full.correspondence.status,
      publisherSha256: full.correspondence.publisherDigest,
      reproducedSha256: full.correspondence.reproducedDigest,
    },
    security: {
      status: "COMPLETED",
      analysisKind: "DETERMINISTIC_STATIC",
      highestSeverity: full.audit.highestSeverity,
      findingCount: full.audit.findingCount,
      auditTarget: "publisher",
      report: full.audit,
    },
    fullVerification: full,
  };
}
