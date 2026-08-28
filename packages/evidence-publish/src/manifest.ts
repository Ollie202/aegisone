import { canonicalBytes } from "../../core/src/canonical.ts";
import { sha256Bytes } from "../../core/src/hash.ts";
import type {
  EvidenceBundle,
  PublicationEvidenceFacts,
  PublicationStorageLocation,
} from "./model.ts";

/**
 * ============================================================================================
 * WHY THE STORAGE ROOT IS INSIDE THE MANIFEST, AND WHY THAT ORDER MATTERS
 * ============================================================================================
 * A publication is a two-phase act, and the phases are deliberately not symmetric:
 *
 *   Phase 1 — the *bundle* (exact package bytes + canonical audit report + evidence facts) is
 *             serialized canonically and uploaded to 0G Storage. 0G returns a Merkle root, which
 *             is a commitment to those exact bytes; `performStorageRoundTrip` additionally proves
 *             the bytes read back are byte-identical, so the root genuinely locates this bundle.
 *
 *   Phase 2 — the *canonical evidence manifest* is built over the evidence facts **plus the root
 *             from phase 1**, and hashed. That digest is what `capability_verifications.
 *             canonical_evidence_sha256` stores and what the on-chain registry commits to as
 *             `manifestDigest` (with the same root as `provenanceRoot`).
 *
 * The manifest cannot be inside the bundle it describes — a document cannot contain the hash of
 * itself — so the root must flow forward, never backward. The payoff is the property the Verified
 * Library depends on: **the storage root is cryptographically bound into the canonical evidence
 * digest.** A stored root and a stored evidence digest can never be mixed and matched from two
 * different publications, and mutating either one in the database invalidates the pair. That is
 * what `checkPublicationIntegrity` re-verifies on every read.
 *
 * Honest limit, stated here rather than glossed: this binding proves *internal coherence* of a
 * recorded publication. It does not, and cannot, prove locally that the root exists on the 0G
 * network — only 0G can answer that. That is precisely why every surface that renders a root also
 * renders its public explorer/retrieval pointer, so a reader verifies existence against 0G rather
 * than against AegisOne's own database.
 */

/** Canonical bundle bytes — phase 1. Uploaded to 0G Storage verbatim. */
export function buildEvidenceBundleBytes(bundle: EvidenceBundle): Uint8Array {
  return canonicalBytes({
    schemaVersion: "1",
    kind: "aegisone-evidence-bundle",
    facts: factsToCanonical(bundle.facts),
    // Base64 keeps the exact bytes intact through canonical JSON without inventing a text
    // encoding for a binary package. The digest is carried alongside so a reader of the bundle
    // never has to trust the transport to have preserved it.
    package: {
      sha256: sha256Bytes(bundle.packageBytes),
      byteLength: bundle.packageBytes.byteLength,
      base64: Buffer.from(bundle.packageBytes).toString("base64"),
    },
    auditReport: bundle.auditReport,
  });
}

/** Plain-object projection of the evidence facts, in a fixed shape. `canonicalJson` sorts keys, so
 * field order here is irrelevant to the digest — but the field *set* is load-bearing. */
function factsToCanonical(facts: PublicationEvidenceFacts): Record<string, unknown> {
  return {
    artifactKind: facts.artifactKind,
    resourceVersionId: facts.resourceVersionId,
    sourceInspectionStatus: facts.sourceInspectionStatus,
    sourceSnapshotSha256: facts.sourceSnapshotSha256,
    correspondenceStatus: facts.correspondenceStatus,
    publisherSha256: facts.publisherSha256,
    reproducedSha256: facts.reproducedSha256,
    securityStatus: facts.securityStatus,
    securityHighestSeverity: facts.securityHighestSeverity,
    securityFindingCount: facts.securityFindingCount,
    verifiedAt: facts.verifiedAt,
  };
}

export interface CanonicalEvidenceManifest {
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

/**
 * Canonical evidence manifest — phase 2. Built from the evidence facts and the storage location
 * returned by phase 1.
 *
 * This is the ONLY function that may produce a `canonical_evidence_sha256` value, and
 * `rebuildPublicationManifest` below is the same computation applied to a persisted row. Keeping
 * them a single code path (rather than a writer and a separate re-implemented verifier) is what
 * stops the two from drifting into disagreement.
 */
export function buildCanonicalEvidenceManifest(
  facts: PublicationEvidenceFacts,
  storage: PublicationStorageLocation,
): CanonicalEvidenceManifest {
  const bytes = canonicalBytes({
    schemaVersion: "1",
    kind: "aegisone-canonical-evidence-manifest",
    facts: factsToCanonical(facts),
    storage: {
      network: storage.network,
      chainId: storage.chainId,
      root: storage.root.toLowerCase(),
      transaction: storage.transaction.toLowerCase(),
    },
  });
  return { bytes, sha256: sha256Bytes(bytes) };
}

/**
 * Recomputes the manifest digest for an already-persisted publication.
 *
 * Intentionally a thin alias of `buildCanonicalEvidenceManifest`: the re-check must be the exact
 * computation the publish performed, or it is not a check at all.
 */
export function rebuildPublicationManifest(
  facts: PublicationEvidenceFacts,
  storage: PublicationStorageLocation,
): CanonicalEvidenceManifest {
  return buildCanonicalEvidenceManifest(facts, storage);
}
