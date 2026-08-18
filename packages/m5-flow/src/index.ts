import { canonicalBytes } from "../../core/src/canonical.ts";
import { sha256Bytes } from "../../core/src/hash.ts";
import { createVerification } from "../../core/src/verify.ts";
import { createVerificationView, type VerificationView } from "../../core/src/presentation.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim, VerificationJson } from "../../core/src/model.ts";
import { createRegistryCommitments, type RegistryCommitments } from "../../registry-0g/src/commitments.ts";
import type { StorageRoundTripEvidence } from "../../storage-0g/src/types.ts";

export interface JudgeableSlice {
  schemaVersion: "1";
  genuine: {
    verification: VerificationJson;
    view: VerificationView;
    canonicalEvidenceBytes: Uint8Array;
    canonicalEvidenceSha256: string;
  };
  substitutionProbe: {
    mutation: "FLIP_FIRST_PUBLISHER_BYTE";
    verification: VerificationJson;
    view: VerificationView;
  };
}

export interface PreparedRegistryAnchor {
  targetNetwork: "0G Aristotle Mainnet";
  chainId: 16661;
  status: "PREPARED_NOT_SUBMITTED";
  commitments: RegistryCommitments;
  contractAddress: null;
  transactionHash: null;
}

export interface StoredJudgeableSlice extends JudgeableSlice {
  storage: StorageRoundTripEvidence;
  preparedRegistryAnchor: PreparedRegistryAnchor;
}

function flipFirstByte(value: Uint8Array): Uint8Array {
  if (value.byteLength === 0) throw new TypeError("Publisher artifact must not be empty for substitution probe");
  const mutated = value.slice();
  mutated[0] = mutated[0]! ^ 0x01;
  return mutated;
}

export function createJudgeableSlice(input: {
  claim: ReleaseClaim;
  recipe: BuildRecipe;
  publisherBytes: Uint8Array;
  reproducedBytes: Uint8Array;
  environment: BuildEnvironment;
}): JudgeableSlice {
  if (input.environment.runnerType !== "0g") {
    throw new TypeError("M5 judgeable slice requires an independent 0G reproduction environment");
  }
  const genuine = createVerification(input);
  if (genuine.correspondence.status !== "MATCH") {
    throw new TypeError(`Expected genuine publisher bytes to MATCH the independent reproduction, received ${genuine.correspondence.status}`);
  }
  const substituted = createVerification({
    ...input,
    publisherBytes: flipFirstByte(input.publisherBytes),
  });
  if (substituted.correspondence.status !== "MISMATCH") {
    throw new TypeError(`Substitution probe must produce MISMATCH, received ${substituted.correspondence.status}`);
  }
  const canonicalEvidenceBytes = canonicalBytes(genuine);
  return {
    schemaVersion: "1",
    genuine: {
      verification: genuine,
      view: createVerificationView(genuine),
      canonicalEvidenceBytes,
      canonicalEvidenceSha256: sha256Bytes(canonicalEvidenceBytes),
    },
    substitutionProbe: {
      mutation: "FLIP_FIRST_PUBLISHER_BYTE",
      verification: substituted,
      view: createVerificationView(substituted),
    },
  };
}

export function attachStorageEvidence(slice: JudgeableSlice, storage: StorageRoundTripEvidence): StoredJudgeableSlice {
  if (!storage.proofVerified || !storage.bytesMatch || storage.chainId !== 16602) {
    throw new TypeError("M5 requires proof-verified exact-byte 0G Galileo Storage evidence");
  }
  if (storage.uploadedSha256 !== slice.genuine.canonicalEvidenceSha256 || storage.downloadedSha256 !== slice.genuine.canonicalEvidenceSha256) {
    throw new TypeError("0G Storage evidence does not correspond to the canonical M5 verification bytes");
  }
  if (storage.rootHashes.length !== 1) {
    throw new TypeError("M5 registry preparation currently requires one canonical 0G Storage root");
  }
  const commitments = createRegistryCommitments(slice.genuine.verification, storage.rootHashes[0]!);
  return {
    ...slice,
    storage,
    preparedRegistryAnchor: {
      targetNetwork: "0G Aristotle Mainnet",
      chainId: 16661,
      status: "PREPARED_NOT_SUBMITTED",
      commitments,
      contractAddress: null,
      transactionHash: null,
    },
  };
}
