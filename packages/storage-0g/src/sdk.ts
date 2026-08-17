import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { normalizePrivateKey } from "./private-key.ts";
import { GALILEO, StorageRoundTripError, type StorageTransport, type StorageUploadReceipt } from "./types.ts";

export interface ZeroGSdkTransportOptions {
  privateKey: string;
  rpcUrl?: string;
  indexerUrl?: string;
}

export class ZeroGSdkTransport implements StorageTransport {
  readonly rpcUrl: string;
  readonly indexerUrl: string;
  readonly provider: ethers.JsonRpcProvider;
  readonly signer: ethers.Wallet;
  readonly indexer: Indexer;

  constructor(options: ZeroGSdkTransportOptions) {
    const privateKey = normalizePrivateKey(options.privateKey);
    this.rpcUrl = options.rpcUrl ?? GALILEO.rpcUrl;
    this.indexerUrl = options.indexerUrl ?? GALILEO.indexerUrl;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.indexer = new Indexer(this.indexerUrl);
  }

  async chainId(): Promise<number> {
    return Number((await this.provider.getNetwork()).chainId);
  }

  async upload(bytes: Uint8Array): Promise<StorageUploadReceipt> {
    const data = new MemData(bytes);
    const [tree, treeError] = await data.merkleTree();
    if (treeError !== null || tree === null) {
      throw new StorageRoundTripError("MERKLE_FAILED", "merkle", "Could not calculate the 0G Merkle root", false, {
        cause: treeError,
      });
    }
    const locallyCalculatedRootHash = tree.rootHash();
    if (locallyCalculatedRootHash === null) {
      throw new StorageRoundTripError("MERKLE_FAILED", "merkle", "0G Merkle tree did not produce a root", false);
    }
    const [result, uploadError] = await this.indexer.upload(data, this.rpcUrl, this.signer, {
      expectedReplica: 1,
      finalityRequired: true,
      skipTx: false,
      skipIfFinalized: false,
    });
    if (uploadError !== null) {
      throw new StorageRoundTripError("UPLOAD_FAILED", "upload", "0G Storage SDK rejected the upload", true, {
        cause: uploadError,
      });
    }
    if ("rootHash" in result) {
      return {
        rootHashes: [result.rootHash],
        transactionHashes: [result.txHash],
        transactionSequences: [result.txSeq],
        locallyCalculatedRootHash,
      };
    }
    return {
      rootHashes: result.rootHashes,
      transactionHashes: result.txHashes,
      transactionSequences: result.txSeqs,
      locallyCalculatedRootHash,
    };
  }

  async download(rootHashes: string[], options: { proof: true }): Promise<Uint8Array> {
    const [blob, downloadError] = rootHashes.length === 1
      ? await this.indexer.downloadToBlob(rootHashes[0]!, { proof: options.proof })
      : await this.indexer.downloadToBlob(rootHashes, { proof: options.proof });
    if (downloadError !== null) {
      throw new StorageRoundTripError("DOWNLOAD_FAILED", "download", "0G Storage SDK rejected the download", true, {
        cause: downloadError,
      });
    }
    return new Uint8Array(await blob.arrayBuffer());
  }
}
