export const GALILEO = Object.freeze({
  network: "0G Galileo Testnet",
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
});

export type StorageRoundTripStage =
  | "configuration"
  | "merkle"
  | "upload"
  | "download"
  | "verification";

export type StorageRoundTripErrorCode =
  | "EMPTY_EVIDENCE"
  | "OWNER_ACTION_REQUIRED"
  | "INVALID_PRIVATE_KEY"
  | "WRONG_NETWORK"
  | "MERKLE_FAILED"
  | "UPLOAD_FAILED"
  | "INVALID_UPLOAD_RECEIPT"
  | "DOWNLOAD_FAILED"
  | "BYTE_MISMATCH";

export class StorageRoundTripError extends Error {
  readonly name = "StorageRoundTripError";
  readonly code: StorageRoundTripErrorCode;
  readonly stage: StorageRoundTripStage;
  readonly retryable: boolean;

  constructor(
    code: StorageRoundTripErrorCode,
    stage: StorageRoundTripStage,
    message: string,
    retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.code = code;
    this.stage = stage;
    this.retryable = retryable;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      stage: this.stage,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export interface StorageUploadReceipt {
  rootHashes: string[];
  transactionHashes: string[];
  transactionSequences: number[];
  locallyCalculatedRootHash: string;
}

export interface StorageTransport {
  chainId(): Promise<number>;
  upload(bytes: Uint8Array): Promise<StorageUploadReceipt>;
  download(rootHashes: string[], options: { proof: true }): Promise<Uint8Array>;
}

export interface StorageRoundTripEvidence {
  schemaVersion: "1";
  network: "0G Galileo Testnet";
  chainId: 16602;
  rpcUrl: string;
  indexerUrl: string;
  rootHashes: string[];
  transactionHashes: string[];
  transactionSequences: number[];
  uploadedSha256: string;
  downloadedSha256: string;
  byteLength: number;
  proofVerificationRequested: true;
  proofVerified: true;
  bytesMatch: true;
}
