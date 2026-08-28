import { isSha256 } from "../../core/src/hash.ts";
import { rebuildPublicationManifest } from "./manifest.ts";
import type {
  PublicationCorrespondenceStatus,
  PublicationEvidenceFacts,
  PublicationSecurityStatus,
  PublicationSeverity,
  PublicationSourceInspectionStatus,
  PublicationStorageLocation,
} from "./model.ts";

/**
 * ============================================================================================
 * THE GATE FOR "STORED ON 0G"
 * ============================================================================================
 * `docs/17-m8-security-boundaries.md` Threat M8-012 (source-claim/row mutation) and AGENTS.md
 * ("Supabase is mutable application memory, not proof authority") mean a `capability_verifications`
 * row is an *untrusted* input on read, even though AegisOne wrote it. The Verified Library's
 * strongest label, `STORED ON 0G`, must therefore be impossible to obtain by writing a row.
 *
 * This function is the single gate. It fails **closed** — to an explicit reason, never to a
 * downgraded-but-still-positive state — and the UI renders `STORED ON 0G` if and only if it
 * returns `ok: true`.
 *
 * What it actually enforces:
 *
 *   1. the storage root is a structurally valid, non-zero 0G Merkle root;
 *   2. the storage transaction is a structurally valid, non-zero transaction hash;
 *   3. `verifiedAt` is a real, parseable instant;
 *   4. the stored `canonicalEvidenceSha256` **recomputes exactly** from the row's own evidence
 *      facts *and the stored root* (see `manifest.ts` for why the root is inside the manifest).
 *      This is the load-bearing check: because the root is bound into the digest, a row cannot
 *      carry a root from one publication and evidence from another, and mutating any committed
 *      evidence field — correspondence status, either artifact digest, the audit result, the
 *      timestamp, or the root itself — invalidates the pair.
 *
 * What it deliberately does NOT claim: that the root exists on the 0G network. No local check can
 * establish that, and pretending otherwise would be exactly the "mock a required 0G integration
 * and present it as complete" failure AGENTS.md forbids. Existence is verified by the reader
 * against 0G itself, which is why every rendered root is accompanied by its public pointer.
 */

const HASH32_RE = /^0x[0-9a-fA-F]{64}$/;
const ZERO32_RE = /^0x0{64}$/i;

export type PublicationIntegrityFailureReason =
  | "NO_PUBLICATION_RECORDED"
  | "INVALID_STORAGE_ROOT"
  | "INVALID_STORAGE_TRANSACTION"
  | "MISSING_CANONICAL_EVIDENCE_DIGEST"
  | "INVALID_VERIFIED_AT"
  | "MANIFEST_DIGEST_MISMATCH"
  | "REGISTRY_RECORD_ID_MISMATCH";

/** The subset of a persisted `capability_verifications` row this check consumes. Structural, so
 * `apps/web` can pass a row and the worker can pass a freshly-built publication. */
export interface PersistedPublication {
  readonly artifactKind: "agent-skill";
  readonly resourceVersionId: string;
  readonly sourceInspectionStatus: PublicationSourceInspectionStatus;
  readonly sourceSnapshotSha256: string | null;
  readonly correspondenceStatus: PublicationCorrespondenceStatus;
  readonly publisherSha256: string | null;
  readonly reproducedSha256: string | null;
  readonly securityStatus: PublicationSecurityStatus;
  readonly securityHighestSeverity: PublicationSeverity | null;
  readonly securityFindingCount: number | null;
  readonly canonicalEvidenceSha256: string | null;
  readonly storageRoot: string | null;
  readonly storageTransaction: string | null;
  readonly registryContract: string | null;
  readonly registryRecordId: string | null;
  readonly registryTransaction: string | null;
  readonly verifiedAt: string | null;
}

export interface StoragePublicationVerified {
  readonly ok: true;
  /** Normalized lowercase root, safe to render. */
  readonly storageRoot: string;
  readonly storageTransaction: string;
  readonly canonicalEvidenceSha256: string;
  readonly verifiedAt: string;
  readonly network: string;
  readonly chainId: number;
}

export interface StoragePublicationRejected {
  readonly ok: false;
  readonly reason: PublicationIntegrityFailureReason;
}

export type StoragePublicationIntegrity = StoragePublicationVerified | StoragePublicationRejected;

/** The network a publication was made against. Recorded on the publication rather than assumed, so
 * a future mainnet publication cannot be silently rendered as if it were the testnet one. */
export interface PublicationNetwork {
  readonly network: string;
  readonly chainId: number;
}

function validHash32(value: string | null): value is string {
  return typeof value === "string" && HASH32_RE.test(value) && !ZERO32_RE.test(value);
}

export function checkStoragePublicationIntegrity(
  row: PersistedPublication,
  network: PublicationNetwork,
): StoragePublicationIntegrity {
  // A row with no publication at all is the ordinary, expected case for most resources. It is
  // "absent", not "failed" — the caller renders it as missing evidence, never as a finding.
  if (row.storageRoot === null && row.storageTransaction === null && row.canonicalEvidenceSha256 === null) {
    return { ok: false, reason: "NO_PUBLICATION_RECORDED" };
  }

  if (!validHash32(row.storageRoot)) return { ok: false, reason: "INVALID_STORAGE_ROOT" };
  if (!validHash32(row.storageTransaction)) return { ok: false, reason: "INVALID_STORAGE_TRANSACTION" };
  if (row.canonicalEvidenceSha256 === null || !isSha256(row.canonicalEvidenceSha256)) {
    return { ok: false, reason: "MISSING_CANONICAL_EVIDENCE_DIGEST" };
  }
  if (row.verifiedAt === null || !Number.isFinite(Date.parse(row.verifiedAt))) {
    return { ok: false, reason: "INVALID_VERIFIED_AT" };
  }

  const facts: PublicationEvidenceFacts = {
    artifactKind: row.artifactKind,
    resourceVersionId: row.resourceVersionId,
    sourceInspectionStatus: row.sourceInspectionStatus,
    sourceSnapshotSha256: row.sourceSnapshotSha256,
    correspondenceStatus: row.correspondenceStatus,
    publisherSha256: row.publisherSha256,
    reproducedSha256: row.reproducedSha256,
    securityStatus: row.securityStatus,
    securityHighestSeverity: row.securityHighestSeverity,
    securityFindingCount: row.securityFindingCount,
    verifiedAt: row.verifiedAt,
  };
  const storage: PublicationStorageLocation = {
    network: network.network,
    chainId: network.chainId,
    root: row.storageRoot,
    transaction: row.storageTransaction,
  };

  const recomputed = rebuildPublicationManifest(facts, storage);
  if (recomputed.sha256 !== row.canonicalEvidenceSha256.toLowerCase()) {
    return { ok: false, reason: "MANIFEST_DIGEST_MISMATCH" };
  }

  return {
    ok: true,
    storageRoot: row.storageRoot.toLowerCase(),
    storageTransaction: row.storageTransaction.toLowerCase(),
    canonicalEvidenceSha256: row.canonicalEvidenceSha256.toLowerCase(),
    verifiedAt: row.verifiedAt,
    network: network.network,
    chainId: network.chainId,
  };
}

export interface ChainCommitmentVerified {
  readonly ok: true;
  readonly contract: string;
  readonly recordId: string;
  readonly transaction: string;
}

export type ChainCommitmentIntegrity = ChainCommitmentVerified | { readonly ok: false; readonly reason: PublicationIntegrityFailureReason };

/**
 * The compact on-chain commitment is a **separate, independent fact** from storage, and is
 * presented as one. A resource can be stored on 0G without a chain commitment (storage succeeded,
 * the optional registry write did not run), and that is shown as an absent commitment rather than
 * as a failure of the storage fact.
 *
 * `recomputeRecordId` is injected rather than imported so this provider-independent package never
 * depends on `ethers`/`packages/registry-0g`; the caller supplies `computeRegistryRecordId`. When
 * the caller cannot supply the source-claim digest the record id commits to, it passes `null` and
 * the commitment is reported as present-but-unrecomputable — shown, with its explorer link, but
 * never asserted as re-derived.
 */
export function checkChainCommitment(
  row: PersistedPublication,
  storage: StoragePublicationVerified,
  recomputeRecordId: ((provenanceRoot: string, manifestDigest: string) => string) | null,
): ChainCommitmentIntegrity {
  if (row.registryContract === null && row.registryRecordId === null && row.registryTransaction === null) {
    return { ok: false, reason: "NO_PUBLICATION_RECORDED" };
  }
  if (!validHash32(row.registryRecordId)) return { ok: false, reason: "REGISTRY_RECORD_ID_MISMATCH" };
  if (!validHash32(row.registryTransaction)) return { ok: false, reason: "INVALID_STORAGE_TRANSACTION" };
  if (typeof row.registryContract !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(row.registryContract)) {
    return { ok: false, reason: "REGISTRY_RECORD_ID_MISMATCH" };
  }

  if (recomputeRecordId !== null) {
    const expected = recomputeRecordId(storage.storageRoot, storage.canonicalEvidenceSha256);
    if (expected.toLowerCase() !== row.registryRecordId.toLowerCase()) {
      return { ok: false, reason: "REGISTRY_RECORD_ID_MISMATCH" };
    }
  }

  return {
    ok: true,
    contract: row.registryContract,
    recordId: row.registryRecordId.toLowerCase(),
    transaction: row.registryTransaction.toLowerCase(),
  };
}
