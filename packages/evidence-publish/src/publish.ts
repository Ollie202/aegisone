import { performStorageRoundTrip } from "../../storage-0g/src/roundtrip.ts";
import type { StorageTransport } from "../../storage-0g/src/types.ts";
import { buildCanonicalEvidenceManifest, buildEvidenceBundleBytes } from "./manifest.ts";
import type {
  EvidenceBundle,
  PublicationRegistryCommitment,
  PublicationStorageLocation,
} from "./model.ts";

/**
 * Orchestrates a single evidence publication: canonical bundle -> 0G Storage -> (optional) compact
 * on-chain commitment.
 *
 * Both external effects are **injected transports**, never constructed here. That is what lets the
 * entire path be exercised end to end in CI against deterministic fakes without a funded run, and
 * it is why this module contains no private key, no RPC URL, and no 0G SDK import. The real
 * transports are assembled only inside `apps/worker`, the one service that holds the signer.
 *
 * Ordering is deliberate and must not be rearranged:
 *   1. upload the bundle and obtain a proof-verified root (`performStorageRoundTrip` already
 *      re-downloads with `proof: true` and asserts exact-byte equality — a failed readback throws
 *      rather than returning a root);
 *   2. build the canonical evidence manifest over the facts *plus* that root;
 *   3. only then, optionally, commit `{manifestDigest, provenanceRoot}` on chain.
 *
 * Step 3 is optional and failure there is reported, never fatal to step 1: storage succeeded and
 * saying otherwise would discard real evidence. The caller persists what actually happened.
 */

/**
 * The five commitments the on-chain registry records. Every one is a value AegisOne genuinely
 * holds — none is padded, duplicated to fill a slot, or zeroed. When the publication does not have
 * all five (for example a resource whose correspondence was never evaluated, so there is no
 * publisher/reproduced digest pair), the chain write is **skipped entirely** rather than committing
 * a filler value: a commitment that says something AegisOne cannot back is worse than no
 * commitment (AGENTS.md: missing evidence never upgrades assurance).
 */
export interface PublicationCommitments {
  readonly manifestDigest: string;
  readonly sourceClaimDigest: string;
  readonly publisherArtifactDigest: string;
  readonly reproducedArtifactDigest: string;
  readonly provenanceRoot: string;
}

export interface RegistryWriter {
  /** Writes the compact commitment and returns the mined receipt. Supplied by `apps/worker`,
   * backed by `packages/registry-0g`'s `registerEvidence`. */
  register(commitments: PublicationCommitments): Promise<{ recordId: string; transactionHash: string; contractAddress: string }>;
}

/** Derives the five commitments, or `null` when the publication genuinely lacks one of them. */
export function derivePublicationCommitments(
  facts: EvidenceBundle["facts"],
  manifestSha256: string,
  provenanceRoot: string,
): PublicationCommitments | null {
  const { sourceSnapshotSha256, publisherSha256, reproducedSha256 } = facts;
  if (sourceSnapshotSha256 === null || publisherSha256 === null || reproducedSha256 === null) return null;
  return {
    manifestDigest: `0x${manifestSha256}`,
    sourceClaimDigest: `0x${sourceSnapshotSha256}`,
    publisherArtifactDigest: `0x${publisherSha256}`,
    reproducedArtifactDigest: `0x${reproducedSha256}`,
    provenanceRoot,
  };
}

export interface PublishEvidenceOptions {
  readonly storage: StorageTransport;
  readonly network: { readonly network: string; readonly chainId: number };
  /** Omit or pass `null` to publish to Storage only, with no chain write and no spend beyond the
   * storage fee. */
  readonly registry?: RegistryWriter | null;
}

export interface PublishEvidenceResult {
  readonly storage: PublicationStorageLocation;
  readonly canonicalEvidenceSha256: string;
  readonly bundleByteLength: number;
  readonly registry: PublicationRegistryCommitment | null;
  /** Populated when the optional chain commitment was attempted and failed. Storage evidence above
   * remains valid and is still persisted — a chain failure never erases a real storage root. */
  readonly registryError: string | null;
}

export async function publishEvidenceBundle(
  bundle: EvidenceBundle,
  options: PublishEvidenceOptions,
): Promise<PublishEvidenceResult> {
  const bundleBytes = buildEvidenceBundleBytes(bundle);

  // Throws StorageRoundTripError on any failure, including a byte mismatch on readback. There is
  // no partial-success path: no root is returned unless the exact bytes were proven retrievable.
  const roundTrip = await performStorageRoundTrip(bundleBytes, options.storage);

  const root = roundTrip.rootHashes[0];
  const transaction = roundTrip.transactionHashes[0];
  if (typeof root !== "string" || typeof transaction !== "string") {
    throw new Error("0G Storage round trip returned no usable root/transaction evidence");
  }

  const storage: PublicationStorageLocation = {
    network: options.network.network,
    chainId: options.network.chainId,
    root,
    transaction,
  };

  const manifest = buildCanonicalEvidenceManifest(bundle.facts, storage);

  let registry: PublicationRegistryCommitment | null = null;
  let registryError: string | null = null;
  if (options.registry) {
    const commitments = derivePublicationCommitments(bundle.facts, manifest.sha256, storage.root);
    if (commitments === null) {
      registryError =
        "chain commitment skipped: this publication does not hold all five real commitments (source snapshot, publisher and reproduced digests are required)";
    } else {
      try {
        const receipt = await options.registry.register(commitments);
        registry = {
          contract: receipt.contractAddress,
          recordId: receipt.recordId,
          transaction: receipt.transactionHash,
        };
      } catch (error) {
        registryError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return {
    storage,
    canonicalEvidenceSha256: manifest.sha256,
    bundleByteLength: bundleBytes.byteLength,
    registry,
    registryError,
  };
}
