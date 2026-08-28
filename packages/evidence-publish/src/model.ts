/**
 * Shared types for the AegisOne 0G evidence-publication path.
 *
 * This package is deliberately **provider-independent** (AGENTS.md "0G-specific behavior lives
 * behind adapters"): it defines what an evidence publication *is*, how its canonical manifest is
 * serialized, and how a persisted publication is re-checked. It performs no network I/O itself and
 * imports no 0G SDK. The actual Storage upload and chain write are supplied by the caller as
 * injected transports (`packages/storage-0g`'s `StorageTransport` and a registry writer), exactly
 * the discipline `packages/compute-0g` already uses for its untested-live transport.
 */

export type PublicationArtifactKind = "agent-skill";

export type PublicationSourceInspectionStatus = "NOT_RUN" | "INSPECTED";
export type PublicationCorrespondenceStatus =
  | "NOT_EVALUATED"
  | "INSUFFICIENT_EVIDENCE"
  | "MATCH"
  | "MISMATCH"
  | "DIVERGED";
export type PublicationSecurityStatus = "NOT_RUN" | "COMPLETED";
export type PublicationSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * The evidence facts a publication commits to.
 *
 * Every field here is also a persisted column on `capability_verifications`
 * (docs/16-m8-database-plan.md). That is not a coincidence — it is the load-bearing property that
 * makes `rebuildPublicationManifest` able to recompute a stored publication's manifest digest from
 * the row alone, with no side data and no network call. If a field is ever added here that the row
 * cannot supply, the integrity re-check silently stops being a check; `integrity.ts` guards that
 * with an explicit field-coverage test.
 */
export interface PublicationEvidenceFacts {
  readonly artifactKind: PublicationArtifactKind;
  readonly resourceVersionId: string;
  readonly sourceInspectionStatus: PublicationSourceInspectionStatus;
  readonly sourceSnapshotSha256: string | null;
  readonly correspondenceStatus: PublicationCorrespondenceStatus;
  readonly publisherSha256: string | null;
  readonly reproducedSha256: string | null;
  readonly securityStatus: PublicationSecurityStatus;
  readonly securityHighestSeverity: PublicationSeverity | null;
  readonly securityFindingCount: number | null;
  /** ISO-8601 instant the underlying verification completed. Part of the committed manifest, so a
   * publication cannot be silently back- or forward-dated after the fact. */
  readonly verifiedAt: string;
}

/** Where the evidence bundle actually landed on 0G Storage. */
export interface PublicationStorageLocation {
  readonly network: string;
  readonly chainId: number;
  /** 0G Storage Merkle root — `0x` + 64 hex. Commits to the exact uploaded bundle bytes. */
  readonly root: string;
  readonly transaction: string;
}

/** The optional compact on-chain commitment. Large payload in Storage, small commitment on chain. */
export interface PublicationRegistryCommitment {
  readonly contract: string;
  readonly recordId: string;
  readonly transaction: string;
}

/**
 * The bytes AegisOne uploads to 0G Storage: the exact artifact package, the canonical audit
 * report, and the evidence facts. Held as an explicit structure (never a loose blob) so the bundle
 * is deterministic and re-derivable.
 */
export interface EvidenceBundle {
  readonly facts: PublicationEvidenceFacts;
  /** The exact skill package bytes AegisOne packaged/hashed. Not a re-encoding of the source. */
  readonly packageBytes: Uint8Array;
  /** The deterministic audit report as produced by `packages/skill-audit`. */
  readonly auditReport: unknown;
}
