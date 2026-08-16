import { sha256Bytes } from "../../core/src/hash.ts";
import {
  GALILEO,
  StorageRoundTripError,
  type StorageRoundTripEvidence,
  type StorageTransport,
  type StorageUploadReceipt,
} from "./types.ts";

function validHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function validateReceipt(receipt: StorageUploadReceipt): void {
  const count = receipt.rootHashes.length;
  if (
    count === 0 ||
    receipt.transactionHashes.length !== count ||
    receipt.transactionSequences.length !== count ||
    receipt.rootHashes.some((value) => !validHash(value)) ||
    receipt.transactionHashes.some((value) => !validHash(value))
  ) {
    throw new StorageRoundTripError(
      "INVALID_UPLOAD_RECEIPT",
      "upload",
      "0G Storage returned incomplete or invalid root/transaction evidence",
      false,
    );
  }
  if (count === 1 && receipt.rootHashes[0]?.toLowerCase() !== receipt.locallyCalculatedRootHash.toLowerCase()) {
    throw new StorageRoundTripError(
      "INVALID_UPLOAD_RECEIPT",
      "upload",
      "0G Storage receipt root does not match the locally calculated Merkle root",
      false,
    );
  }
}

export async function performStorageRoundTrip(
  canonicalEvidenceBytes: Uint8Array,
  transport: StorageTransport,
): Promise<StorageRoundTripEvidence> {
  if (canonicalEvidenceBytes.byteLength === 0) {
    throw new StorageRoundTripError("EMPTY_EVIDENCE", "configuration", "Canonical evidence must not be empty", false);
  }

  let actualChainId: number;
  try {
    actualChainId = await transport.chainId();
  } catch (cause) {
    throw new StorageRoundTripError("WRONG_NETWORK", "configuration", "Could not verify the configured 0G network", true, { cause });
  }
  if (actualChainId !== GALILEO.chainId) {
    throw new StorageRoundTripError(
      "WRONG_NETWORK",
      "configuration",
      `Expected Galileo chain ${GALILEO.chainId}, received ${actualChainId}`,
      false,
    );
  }

  let receipt: StorageUploadReceipt;
  try {
    receipt = await transport.upload(canonicalEvidenceBytes);
  } catch (cause) {
    if (cause instanceof StorageRoundTripError) throw cause;
    throw new StorageRoundTripError("UPLOAD_FAILED", "upload", "0G Storage upload failed", true, { cause });
  }
  validateReceipt(receipt);

  let downloaded: Uint8Array;
  try {
    downloaded = await transport.download(receipt.rootHashes, { proof: true });
  } catch (cause) {
    if (cause instanceof StorageRoundTripError) throw cause;
    throw new StorageRoundTripError("DOWNLOAD_FAILED", "download", "Proof-enabled 0G Storage download failed", true, { cause });
  }

  const uploadedSha256 = sha256Bytes(canonicalEvidenceBytes);
  const downloadedSha256 = sha256Bytes(downloaded);
  if (uploadedSha256 !== downloadedSha256 || !Buffer.from(canonicalEvidenceBytes).equals(Buffer.from(downloaded))) {
    throw new StorageRoundTripError(
      "BYTE_MISMATCH",
      "verification",
      "Downloaded bytes do not exactly match the canonical evidence uploaded",
      false,
    );
  }

  return {
    schemaVersion: "1",
    network: GALILEO.network,
    chainId: GALILEO.chainId,
    rpcUrl: GALILEO.rpcUrl,
    indexerUrl: GALILEO.indexerUrl,
    rootHashes: receipt.rootHashes,
    transactionHashes: receipt.transactionHashes,
    transactionSequences: receipt.transactionSequences,
    uploadedSha256,
    downloadedSha256,
    byteLength: canonicalEvidenceBytes.byteLength,
    proofVerificationRequested: true,
    proofVerified: true,
    bytesMatch: true,
  };
}
