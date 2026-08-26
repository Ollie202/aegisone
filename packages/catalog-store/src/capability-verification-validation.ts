import type { NewCapabilityVerification } from "./model.ts";

/**
 * Pure sanity-check logic for a new `capability_verifications` row (docs/16-m8-database-plan.md
 * "Table: capability_verifications" > "Database-level sanity checks"). Kept dependency-free so
 * it can run identically in `InMemoryCatalogStore`, before `SupabaseCatalogStore` calls the
 * Edge Function, and inside the `proofrail-catalog` Edge Function itself (Deno cannot import
 * this file directly; the Postgres CHECK constraints in
 * `supabase/migrations/202608260003_m8_6_capability_verifications.sql` are the authoritative,
 * always-enforced copy of the same rules — this function exists so the same bad row is rejected
 * before a network round trip, not instead of the DB constraint).
 */
const SHA256_RE = /^[0-9a-fA-F]{64}$/;

export interface CapabilityVerificationValidationIssue {
  readonly code: string;
  readonly message: string;
}

export function validateNewCapabilityVerification(input: NewCapabilityVerification): CapabilityVerificationValidationIssue[] {
  const issues: CapabilityVerificationValidationIssue[] = [];
  const push = (code: string, message: string) => issues.push({ code, message });

  if (input.publisherSha256 !== null && !SHA256_RE.test(input.publisherSha256)) {
    push("invalid_publisher_sha256", "publisherSha256 must be a SHA-256 digest when present");
  }
  if (input.reproducedSha256 !== null && !SHA256_RE.test(input.reproducedSha256)) {
    push("invalid_reproduced_sha256", "reproducedSha256 must be a SHA-256 digest when present");
  }
  if (input.canonicalEvidenceSha256 !== null && !SHA256_RE.test(input.canonicalEvidenceSha256)) {
    push("invalid_canonical_evidence_sha256", "canonicalEvidenceSha256 must be a SHA-256 digest when present");
  }
  if (input.sourceSnapshotSha256 !== null && !SHA256_RE.test(input.sourceSnapshotSha256)) {
    push("invalid_source_snapshot_sha256", "sourceSnapshotSha256 must be a SHA-256 digest when present");
  }

  const bothDigests = input.publisherSha256 !== null && input.reproducedSha256 !== null;
  switch (input.correspondenceStatus) {
    case "NOT_EVALUATED":
      if (input.publisherSha256 !== null || input.reproducedSha256 !== null) {
        push("not_evaluated_has_digests", "NOT_EVALUATED correspondence must not carry publisher/reproduced digests");
      }
      break;
    case "MATCH":
      if (!bothDigests || input.publisherSha256 !== input.reproducedSha256) {
        push("match_requires_equal_digests", "MATCH requires equal, non-null publisher and reproduced digests");
      }
      break;
    case "MISMATCH":
      if (!bothDigests || input.publisherSha256 === input.reproducedSha256) {
        push("mismatch_requires_different_digests", "MISMATCH requires different, non-null publisher and reproduced digests");
      }
      break;
    case "DIVERGED":
      if (!bothDigests) {
        push("diverged_requires_both_digests", "DIVERGED requires non-null publisher and reproduced digests");
      }
      break;
    case "INSUFFICIENT_EVIDENCE":
      break;
  }

  if (input.securityStatus === "NOT_RUN") {
    if (input.securityHighestSeverity !== null || input.securityFindingCount !== null) {
      push("not_run_security_has_findings", "NOT_RUN security assessment must not carry severity/findingCount");
    }
  } else if (input.securityStatus === "COMPLETED") {
    if (input.securityHighestSeverity === null || input.securityFindingCount === null) {
      push("completed_security_missing_findings", "COMPLETED security assessment requires severity and findingCount");
    }
    if (input.securityFindingCount !== null && (!Number.isInteger(input.securityFindingCount) || input.securityFindingCount < 0)) {
      push("invalid_security_finding_count", "findingCount must be a non-negative integer");
    }
  }

  if (input.sourceInspectionStatus === "NOT_RUN" && input.correspondenceStatus !== "NOT_EVALUATED" && input.correspondenceStatus !== "INSUFFICIENT_EVIDENCE") {
    push("inspection_not_run_but_correspondence_evaluated", "correspondence cannot be evaluated without source inspection having run");
  }

  return issues;
}

export function assertValidNewCapabilityVerification(input: NewCapabilityVerification): void {
  const issues = validateNewCapabilityVerification(input);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
  }
}
