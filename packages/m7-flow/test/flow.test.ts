import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readSkillDirectory } from "../../skill-audit/src/package.ts";
import type { StorageRoundTripEvidence } from "../../storage-0g/src/types.ts";
import { attachM7StorageEvidence, createM7SkillSlice } from "../src/index.ts";

const cleanPath = fileURLToPath(new URL("../../../examples/agent-skills/clean-review/", import.meta.url));
const COMMIT = "32748a084bf977089a9ad1d5b0858f4041a51fff";

function sourceClaim() {
  return {
    schemaVersion: "1" as const,
    repository: "https://github.com/Ollie202/aegisone.git",
    commitSha: COMMIT,
    subdirectory: "examples/agent-skills/clean-review",
    publisherIdentity: {
      type: "github" as const,
      subject: "Ollie202/aegisone",
      assuranceLevel: "DECLARED" as const,
      evidenceReferences: ["https://github.com/Ollie202/aegisone"],
    },
    packageFormat: "proofrail-agent-skill-package-v1" as const,
  };
}

function environment() {
  return {
    runnerType: "0g" as const,
    network: "0G Galileo Testnet" as const,
    chainId: 16602 as const,
    runtime: "node-22",
    sourceCommitSha: COMMIT,
    providerId: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
    sandboxId: "fixture-sandbox",
    attestationAvailable: true,
    artifactDigestBoundToAttestation: false,
    evidenceReferences: ["0g-sandbox:fixture-sandbox"],
  };
}

test("M7 creates MATCH evidence plus deterministic MISMATCH substitution", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const slice = createM7SkillSlice({
    sourceClaim: sourceClaim(),
    environment: environment(),
    publisherEntries: clean.entries,
    reproducedEntries: clean.entries,
    publisherDirectoryName: clean.directoryName,
    reproducedDirectoryName: clean.directoryName,
  });
  assert.equal(slice.genuine.verification.correspondence.status, "MATCH");
  assert.equal(slice.genuine.verification.audit.findingCount, 0);
  assert.equal(slice.substitutionProbe.verification.correspondence.status, "MISMATCH");
  assert.match(slice.genuine.canonicalEvidenceSha256, /^[0-9a-f]{64}$/);
  assert.ok(slice.genuine.canonicalEvidenceBytes.byteLength > 0);
});

test("M7 Storage binding derives compact registry commitments from exact stored evidence", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const slice = createM7SkillSlice({
    sourceClaim: sourceClaim(),
    environment: environment(),
    publisherEntries: clean.entries,
    reproducedEntries: clean.entries,
    publisherDirectoryName: clean.directoryName,
    reproducedDirectoryName: clean.directoryName,
  });
  const storage: StorageRoundTripEvidence = {
    schemaVersion: "1",
    network: "0G Galileo Testnet",
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
    rootHashes: [`0x${"ab".repeat(32)}`],
    transactionHashes: [`0x${"cd".repeat(32)}`],
    transactionSequences: [1],
    uploadedSha256: slice.genuine.canonicalEvidenceSha256,
    downloadedSha256: slice.genuine.canonicalEvidenceSha256,
    byteLength: slice.genuine.canonicalEvidenceBytes.byteLength,
    proofVerificationRequested: true,
    proofVerified: true,
    bytesMatch: true,
  };
  const stored = attachM7StorageEvidence(slice, storage);
  assert.equal(stored.preparedAristotleAnchor.status, "PREPARED_NOT_SUBMITTED");
  assert.equal(stored.preparedAristotleAnchor.commitments.publisherArtifactDigest, `0x${slice.genuine.verification.publisherPackage.sha256}`);
  assert.equal(stored.preparedAristotleAnchor.commitments.reproducedArtifactDigest, `0x${slice.genuine.verification.reproducedPackage.sha256}`);
  assert.equal(stored.preparedAristotleAnchor.commitments.provenanceRoot, storage.rootHashes[0]);
  assert.match(stored.preparedAristotleAnchor.recordId, /^0x[0-9a-f]{64}$/);
  assert.equal(stored.preparedAristotleAnchor.transactionHash, null);
});

test("M7 rejects Storage evidence for different canonical bytes", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const slice = createM7SkillSlice({
    sourceClaim: sourceClaim(),
    environment: environment(),
    publisherEntries: clean.entries,
    reproducedEntries: clean.entries,
    publisherDirectoryName: clean.directoryName,
    reproducedDirectoryName: clean.directoryName,
  });
  const storage: StorageRoundTripEvidence = {
    schemaVersion: "1",
    network: "0G Galileo Testnet",
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
    rootHashes: [`0x${"ab".repeat(32)}`],
    transactionHashes: [],
    transactionSequences: [],
    uploadedSha256: "00".repeat(32),
    downloadedSha256: "00".repeat(32),
    byteLength: 1,
    proofVerificationRequested: true,
    proofVerified: true,
    bytesMatch: true,
  };
  assert.throws(() => attachM7StorageEvidence(slice, storage), /does not correspond/);
});
