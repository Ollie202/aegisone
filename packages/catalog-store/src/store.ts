import type { CapabilityResource } from "../../capability-model/src/model.ts";
import type {
  AgenticResource,
  CapabilityVerification,
  CreateSourceClaimResult,
  IngestionSource,
  IngestionSourcePatch,
  NewCapabilityVerification,
  NewSourceClaim,
  ResourceDiscovery,
  ResourceVersion,
  SourceClaim,
  StaleMarkStatus,
  UpsertedCatalogRecord,
} from "./model.ts";

/**
 * Server-side-only mutable catalog persistence boundary. Nothing implementing this
 * interface may derive a ProofRail trust/evidence value from a stored row; see
 * `convert.ts` for the one place catalog rows are turned back into a
 * `CapabilityResource` view, which always emits empty/unverified trust.
 */
export interface CatalogStore {
  /** Find-or-create the resource by deterministic canonical key, then upsert its
   * provider discovery observation and (if present) current version row. */
  upsertDiscoveredResource(resource: CapabilityResource): Promise<UpsertedCatalogRecord>;

  /** Incremental-refresh outage handling: marks discovery rows for `providerId` not
   * present in `seenProviderResourceIds` as `status` (default `STALE`). Never deletes
   * resource/version identity. */
  markProviderDiscoveriesStale(
    providerId: string,
    seenProviderResourceIds: readonly string[],
    status?: StaleMarkStatus,
  ): Promise<ResourceDiscovery[]>;

  getResourceByCanonicalKey(canonicalKey: string): Promise<AgenticResource | null>;
  listDiscoveriesByResource(resourceId: string): Promise<ResourceDiscovery[]>;
  listVersionsByResource(resourceId: string): Promise<ResourceVersion[]>;

  getIngestionSource(id: string): Promise<IngestionSource | null>;
  upsertIngestionSource(id: string, providerType: string, patch?: IngestionSourcePatch): Promise<IngestionSource>;

  /** Creates a new immutable source-claim row (docs/16 "Table: source_claims"). If an active
   * claim already exists for `input.resourceVersionId`, this resolves the transition
   * (`source-claim-transition.ts`): same stable repository supersedes it, a different
   * repository is recorded as an explicit `SOURCE_CLAIM_CONFLICT`. Never mutates the immutable
   * evidence fields of a prior claim; only its `claimStatus` may change. */
  createSourceClaim(input: NewSourceClaim): Promise<CreateSourceClaimResult>;
  getSourceClaim(id: string): Promise<SourceClaim | null>;
  listActiveSourceClaimsByResourceVersion(resourceVersionId: string): Promise<SourceClaim[]>;

  /** Inserts a new immutable `capability_verifications` row (docs/16 "Table:
   * capability_verifications"). Always creates a new row — never mutates a prior canonical
   * verdict. Rejects rows that violate the MATCH/MISMATCH/DIVERGED digest-presence sanity
   * rules before any network/storage write (`capability-verification-validation.ts`). */
  createCapabilityVerification(input: NewCapabilityVerification): Promise<CapabilityVerification>;
  getLatestCapabilityVerification(resourceVersionId: string): Promise<CapabilityVerification | null>;
  listCapabilityVerificationsByResourceVersion(resourceVersionId: string): Promise<CapabilityVerification[]>;
}
