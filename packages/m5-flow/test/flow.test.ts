import assert from "node:assert/strict";
import { test } from "node:test";
import { recipeDigest } from "../../core/src/verify.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../../core/src/model.ts";
import type { StorageRoundTripEvidence } from "../../storage-0g/src/types.ts";
import { attachStorageEvidence, createJudgeableSlice } from "../src/index.ts";

const bytes = (value: string) => new TextEncoder().encode(value);
const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: "examples/hello-proofrail",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/hello-proofrail.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 60_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "hello-proofrail@1.0.0",
  publisherIdentity: { type: "github", subject: "Ollie202/proofrail-0g", assuranceLevel: "DECLARED", evidenceReferences: [] },
  source: { provider: "git", repository: "https://github.com/Ollie202/proofrail-0g.git", commitSha: "e9c82277cef2f7630977e2473664e14eed2f860d" },
  recipeDigest: recipeDigest(recipe),
  artifactName: "hello-proofrail.json",
  artifactLocation: "examples/hello-proofrail/fixtures/publisher/hello-proofrail.json",
  releaseTag: "v1.0.0",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "0g",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  attestationAvailable: true,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: ["tdx:provider-evidence"],
};

test("M5 slice derives real-demo MATCH and deterministic one-byte MISMATCH from the same reproduced bytes", () => {
  const slice = createJudgeableSlice({ claim, recipe, publisherBytes: bytes("artifact"), reproducedBytes: bytes("artifact"), environment });
  assert.equal(slice.genuine.view.verdict, "MATCH");
  assert.equal(slice.substitutionProbe.view.verdict, "MISMATCH");
  assert.notEqual(slice.substitutionProbe.verification.artifacts.publisher.sha256, slice.genuine.verification.artifacts.publisher.sha256);
  assert.equal(slice.substitutionProbe.verification.artifacts.reproduced.sha256, slice.genuine.verification.artifacts.reproduced.sha256);
});

test("M5 storage attachment binds the exact canonical evidence SHA and prepares Aristotle without submitting it", () => {
  const slice = createJudgeableSlice({ claim, recipe, publisherBytes: bytes("artifact"), reproducedBytes: bytes("artifact"), environment });
  const root = `0x${"ab".repeat(32)}`;
  const storage: StorageRoundTripEvidence = {
    schemaVersion: "1",
    network: "0G Galileo Testnet",
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
    rootHashes: [root],
    transactionHashes: [`0x${"cd".repeat(32)}`],
    transactionSequences: [1],
    uploadedSha256: slice.genuine.canonicalEvidenceSha256,
    downloadedSha256: slice.genuine.canonicalEvidenceSha256,
    byteLength: slice.genuine.canonicalEvidenceBytes.byteLength,
    proofVerificationRequested: true,
    proofVerified: true,
    bytesMatch: true,
  };
  const stored = attachStorageEvidence(slice, storage);
  assert.equal(stored.preparedRegistryAnchor.status, "PREPARED_NOT_SUBMITTED");
  assert.equal(stored.preparedRegistryAnchor.chainId, 16661);
  assert.equal(stored.preparedRegistryAnchor.commitments.provenanceRoot, root);
  assert.equal(stored.preparedRegistryAnchor.transactionHash, null);
});

test("M5 fails closed if Storage evidence points at different bytes", () => {
  const slice = createJudgeableSlice({ claim, recipe, publisherBytes: bytes("artifact"), reproducedBytes: bytes("artifact"), environment });
  const storage: StorageRoundTripEvidence = {
    schemaVersion: "1",
    network: "0G Galileo Testnet",
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
    rootHashes: [`0x${"ab".repeat(32)}`],
    transactionHashes: [`0x${"cd".repeat(32)}`],
    transactionSequences: [1],
    uploadedSha256: "0".repeat(64),
    downloadedSha256: "0".repeat(64),
    byteLength: 1,
    proofVerificationRequested: true,
    proofVerified: true,
    bytesMatch: true,
  };
  assert.throws(() => attachStorageEvidence(slice, storage), /does not correspond/);
});
