import { createHash } from "node:crypto";
import { canonicalBytes } from "../../core/src/canonical.ts";
import type { CanonicalSourceClaimInput } from "./model.ts";

/**
 * Canonical source-claim construction (docs/14-source-authentication.md "Step 6 — construct
 * canonical source claim"). Fields that are not actually observed are omitted entirely, never
 * inferred or defaulted to null-as-a-guess, so that two claims built from identical *observed*
 * evidence always canonicalize identically, and a claim built with less evidence never collides
 * with one built with more.
 */
export function buildCanonicalSourceClaim(input: CanonicalSourceClaimInput): Record<string, unknown> {
  const repository: Record<string, unknown> = { fullName: input.repository.fullName };
  if (input.repository.id !== null) repository.id = input.repository.id;

  const source: Record<string, unknown> = { commitSha: input.source.commitSha };
  if (input.source.subdirectory !== null) source.subdirectory = input.source.subdirectory;

  const claim: Record<string, unknown> = {
    schemaVersion: "1",
    resourceId: input.resourceId,
    resourceVersionId: input.resourceVersionId,
    provider: input.provider,
    repository,
    source,
  };

  if (input.distribution) {
    const distribution: Record<string, unknown> = { url: input.distribution.url };
    if (input.distribution.sha256 !== null) distribution.sha256 = input.distribution.sha256;
    claim.distribution = distribution;
  }

  if (input.authority) {
    claim.authority = {
      githubUserId: input.authority.githubUserId,
      githubLogin: input.authority.githubLogin,
      permission: input.authority.permission,
    };
  }

  return claim;
}

/** `sourceClaimDigest = SHA256(canonicalSourceClaimBytes)` using the repository's existing
 * deterministic canonical JSON rules (`packages/core/src/canonical.ts`). */
export function computeSourceClaimDigest(canonicalClaim: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalBytes(canonicalClaim)).digest("hex");
}
