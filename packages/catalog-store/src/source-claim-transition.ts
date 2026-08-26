/**
 * Pure decision logic for what happens when a new source claim is created for a resource
 * version that may already have an active claim (docs/14-source-authentication.md "Source
 * conflicts", docs/17-m8-security-boundaries.md Threat M8-012). Kept dependency-free so it can
 * be evaluated identically by `InMemoryCatalogStore`, `SupabaseCatalogStore`'s edge-function
 * caller, and the `proofrail-catalog` Edge Function itself (Deno cannot import this file
 * directly, so `supabase/functions/proofrail-catalog/index.ts` re-implements the same three
 * rules — keep both in sync if this logic changes; both are covered by tests).
 *
 * Rules:
 *  - no active claim for the resource version yet          -> "new"
 *  - an active claim exists for the *same* stable repository -> "supersede" (old claim becomes
 *    `superseded`; the new claim's evidence fields are still a brand-new immutable row)
 *  - an active claim exists for a *different* repository     -> "conflict" (both claims are
 *    marked `conflicted`; ProofRail never silently picks the "stronger"-looking one)
 */
export interface ActiveClaimSummary {
  readonly id: string;
  readonly sourceRepositoryId: number | null;
  readonly sourceRepository: string;
}

export type SourceClaimTransition =
  | { readonly kind: "new" }
  | { readonly kind: "supersede"; readonly supersedesClaimId: string }
  | { readonly kind: "conflict"; readonly conflictingClaimId: string };

export function resolveSourceClaimTransition(
  activeClaims: readonly ActiveClaimSummary[],
  newRepositoryId: number | null,
  newRepositoryFullName: string,
): SourceClaimTransition {
  if (activeClaims.length === 0) return { kind: "new" };

  const sameRepository = activeClaims.find((claim) =>
    newRepositoryId !== null && claim.sourceRepositoryId !== null
      ? claim.sourceRepositoryId === newRepositoryId
      : claim.sourceRepository === newRepositoryFullName,
  );
  if (sameRepository) return { kind: "supersede", supersedesClaimId: sameRepository.id };

  return { kind: "conflict", conflictingClaimId: activeClaims[0]!.id };
}
