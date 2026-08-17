import assert from "node:assert/strict";
import { test } from "node:test";
import { performStorageRoundTrip } from "../src/roundtrip.ts";
import { StorageRoundTripError, type StorageTransport, type StorageUploadReceipt } from "../src/types.ts";

const rootHash = "0x" + "11".repeat(32);
const transactionHash = "0x" + "22".repeat(32);
const bytes = new TextEncoder().encode('{"schemaVersion":"1","type":"proofrail-test-evidence"}');

class ContractTestTransport implements StorageTransport {
  downloaded = bytes;
  network = 16602;
  uploadError: Error | null = null;
  downloadError: Error | null = null;
  receipt: StorageUploadReceipt = {
    rootHashes: [rootHash],
    transactionHashes: [transactionHash],
    transactionSequences: [7],
    locallyCalculatedRootHash: rootHash,
  };

  async chainId(): Promise<number> { return this.network; }
  async upload(): Promise<StorageUploadReceipt> {
    if (this.uploadError) throw this.uploadError;
    return this.receipt;
  }
  async download(_roots: string[], options: { proof: true }): Promise<Uint8Array> {
    assert.equal(options.proof, true);
    if (this.downloadError) throw this.downloadError;
    return this.downloaded;
  }
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof StorageRoundTripError);
    assert.equal(error.code, code);
    assert.equal(JSON.stringify(error).includes("private"), false);
    return true;
  });
}

test("contract test returns structured evidence only after proof-enabled exact-byte retrieval", async () => {
  const result = await performStorageRoundTrip(bytes, new ContractTestTransport());
  assert.equal(result.network, "0G Galileo Testnet");
  assert.equal(result.chainId, 16602);
  assert.deepEqual(result.rootHashes, [rootHash]);
  assert.deepEqual(result.transactionHashes, [transactionHash]);
  assert.equal(result.uploadedSha256, result.downloadedSha256);
  assert.equal(result.proofVerificationRequested, true);
  assert.equal(result.proofVerified, true);
  assert.equal(result.bytesMatch, true);
});

test("empty evidence fails before network access", async () => {
  await expectCode(performStorageRoundTrip(new Uint8Array(), new ContractTestTransport()), "EMPTY_EVIDENCE");
});

test("wrong chain fails closed", async () => {
  const transport = new ContractTestTransport();
  transport.network = 16661;
  await expectCode(performStorageRoundTrip(bytes, transport), "WRONG_NETWORK");
});

test("invalid or inconsistent receipt evidence fails closed", async () => {
  const transport = new ContractTestTransport();
  transport.receipt = { ...transport.receipt, transactionHashes: [] };
  await expectCode(performStorageRoundTrip(bytes, transport), "INVALID_UPLOAD_RECEIPT");

  const wrongRoot = new ContractTestTransport();
  wrongRoot.receipt = { ...wrongRoot.receipt, locallyCalculatedRootHash: "0x" + "33".repeat(32) };
  await expectCode(performStorageRoundTrip(bytes, wrongRoot), "INVALID_UPLOAD_RECEIPT");
});

test("upload and download network failures are structured and retryable", async () => {
  const upload = new ContractTestTransport();
  upload.uploadError = new Error("network unavailable");
  await expectCode(performStorageRoundTrip(bytes, upload), "UPLOAD_FAILED");

  const download = new ContractTestTransport();
  download.downloadError = new Error("network unavailable");
  await expectCode(performStorageRoundTrip(bytes, download), "DOWNLOAD_FAILED");
});

test("retrieved byte substitution deterministically fails verification", async () => {
  const transport = new ContractTestTransport();
  transport.downloaded = Uint8Array.from(bytes);
  transport.downloaded[0] = transport.downloaded[0]! ^ 1;
  await expectCode(performStorageRoundTrip(bytes, transport), "BYTE_MISMATCH");
});
