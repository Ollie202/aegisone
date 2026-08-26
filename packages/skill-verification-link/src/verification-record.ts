import type { NewCapabilityVerification } from "../../catalog-store/src/model.ts";
import type { SkillEnrichmentResult } from "./model.ts";

/**
 * Builds the docs/16-m8-database-plan.md `capability_verifications` insert shape from an M8.6
 * enrichment result. This is a normalized *linkage/pointer* row only (AGENTS.md: "Supabase is
 * mutable application/catalog memory, not proof authority") — `canonicalEvidenceSha256` /
 * `storageRoot` / `registryRecordId` etc. stay `null` unless the caller separately completed a
 * real 0G Storage/registry round trip and supplies that evidence explicitly; this function never
 * invents them.
 */
export function buildCapabilityVerificationInput(input: {
  readonly resourceVersionId: string;
  readonly sourceClaimId: string | null;
  readonly verificationJobId: string | null;
  readonly result: SkillEnrichmentResult;
  readonly canonicalEvidence?: {
    readonly sha256: string;
    readonly storageRoot: string | null;
    readonly storageTransaction: string | null;
    readonly registryContract: string | null;
    readonly registryRecordId: string | null;
    readonly registryTransaction: string | null;
    readonly verifiedAt: string;
  } | null;
}): NewCapabilityVerification {
  const evidence = input.canonicalEvidence ?? null;
  return {
    resourceVersionId: input.resourceVersionId,
    sourceClaimId: input.sourceClaimId,
    verificationJobId: input.verificationJobId,
    artifactKind: input.result.artifactKind,
    sourceInspectionStatus: input.result.sourceInspection.status,
    sourceSnapshotSha256: input.result.sourceInspection.sourceSnapshotSha256,
    correspondenceStatus: input.result.correspondence.status,
    publisherSha256: input.result.correspondence.publisherSha256,
    reproducedSha256: input.result.correspondence.reproducedSha256,
    securityStatus: input.result.security.status,
    securityHighestSeverity: input.result.security.highestSeverity,
    securityFindingCount: input.result.security.findingCount,
    canonicalEvidenceSha256: evidence?.sha256 ?? null,
    storageRoot: evidence?.storageRoot ?? null,
    storageTransaction: evidence?.storageTransaction ?? null,
    registryContract: evidence?.registryContract ?? null,
    registryRecordId: evidence?.registryRecordId ?? null,
    registryTransaction: evidence?.registryTransaction ?? null,
    verifiedAt: evidence?.verifiedAt ?? null,
  };
}
