import { canonicalBytes } from "../../core/src/canonical.ts";
import { sha256Bytes } from "../../core/src/hash.ts";
import {
  bytes32FromSha256,
  requireBytes32,
  type RegistryCommitments,
} from "../../registry-0g/src/commitments.ts";
import { computeRegistryRecordId } from "../../registry-0g/src/client.ts";
import type { SkillPackageEntry, SkillVerificationResult } from "../../skill-audit/src/model.ts";
import { verifySkillPackages } from "../../skill-audit/src/verify.ts";
import type { StorageRoundTripEvidence } from "../../storage-0g/src/types.ts";

export interface SkillSourceClaim {
  schemaVersion: "1";
  repository: string;
  commitSha: string;
  subdirectory: string;
  publisherIdentity: {
    type: "github" | "anonymous" | "signature";
    subject: string;
    assuranceLevel: "DECLARED" | "REPOSITORY_AUTHENTICATED" | "SIGNED_RELEASE";
    evidenceReferences: string[];
  };
  packageFormat: "proofrail-agent-skill-package-v1";
}

export interface SkillBuildEnvironment {
  runnerType: "0g";
  network: "0G Galileo Testnet";
  chainId: 16602;
  runtime: string;
  sourceCommitSha: string;
  providerId: string;
  sandboxId: string;
  attestationAvailable: boolean;
  artifactDigestBoundToAttestation: boolean;
  evidenceReferences: string[];
}

export interface M7SkillEvidenceManifest {
  schemaVersion: "1";
  artifactKind: "agent-skill";
  sourceClaim: SkillSourceClaim;
  environment: SkillBuildEnvironment;
  verification: SkillVerificationResult;
}

export interface M7SkillSlice {
  schemaVersion: "1";
  genuine: {
    verification: SkillVerificationResult;
    manifest: M7SkillEvidenceManifest;
    canonicalEvidenceBytes: Uint8Array;
    canonicalEvidenceSha256: string;
  };
  substitutionProbe: {
    mutation: "APPEND_SPACE_TO_PUBLISHER_SKILL_MD";
    verification: SkillVerificationResult;
  };
}

export interface PreparedM7RegistryAnchor {
  targetNetwork: "0G Aristotle Mainnet";
  chainId: 16661;
  status: "PREPARED_NOT_SUBMITTED";
  commitments: RegistryCommitments;
  recordId: `0x${string}`;
  contractAddress: "0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4";
  transactionHash: null;
}

export interface StoredM7SkillSlice extends M7SkillSlice {
  storage: StorageRoundTripEvidence;
  preparedAristotleAnchor: PreparedM7RegistryAnchor;
}

function cloneEntries(entries: readonly SkillPackageEntry[]): SkillPackageEntry[] {
  return entries.map((entry) => ({ path: entry.path, bytes: new Uint8Array(entry.bytes) }));
}

function mutatePublisherSkill(entries: readonly SkillPackageEntry[]): SkillPackageEntry[] {
  const mutated = cloneEntries(entries);
  const skill = mutated.find((entry) => entry.path === "SKILL.md");
  if (!skill) throw new TypeError("Publisher skill package must contain SKILL.md for substitution probe");
  const bytes = new Uint8Array(skill.bytes.byteLength + 1);
  bytes.set(skill.bytes);
  bytes[bytes.byteLength - 1] = 0x20;
  skill.bytes = bytes;
  return mutated;
}

export function createM7SkillSlice(input: {
  sourceClaim: SkillSourceClaim;
  environment: SkillBuildEnvironment;
  publisherEntries: readonly SkillPackageEntry[];
  reproducedEntries: readonly SkillPackageEntry[];
  publisherDirectoryName: string;
  reproducedDirectoryName: string;
}): M7SkillSlice {
  if (!/^[0-9a-f]{40}$/i.test(input.sourceClaim.commitSha)) throw new TypeError("M7 source claim requires a full Git commit SHA");
  if (input.environment.chainId !== 16602 || input.environment.network !== "0G Galileo Testnet") {
    throw new TypeError("M7 independent reproduction requires 0G Galileo Testnet");
  }
  if (input.environment.sourceCommitSha.toLowerCase() !== input.sourceClaim.commitSha.toLowerCase()) {
    throw new TypeError("M7 build environment commit does not match the source claim");
  }
  if (input.sourceClaim.packageFormat !== "proofrail-agent-skill-package-v1") {
    throw new TypeError("Unsupported Agent Skill package format");
  }

  const genuine = verifySkillPackages({
    publisherEntries: input.publisherEntries,
    reproducedEntries: input.reproducedEntries,
    publisherDirectoryName: input.publisherDirectoryName,
    reproducedDirectoryName: input.reproducedDirectoryName,
  });
  if (!genuine.publisherFormat.valid || !genuine.reproducedFormat.valid) {
    throw new TypeError("M7 genuine skill packages must both pass baseline Agent Skills format validation");
  }
  if (genuine.correspondence.status !== "MATCH") {
    throw new TypeError(`Expected genuine Agent Skill package to MATCH independent reproduction, received ${genuine.correspondence.status}`);
  }

  const substitution = verifySkillPackages({
    publisherEntries: mutatePublisherSkill(input.publisherEntries),
    reproducedEntries: input.reproducedEntries,
    publisherDirectoryName: input.publisherDirectoryName,
    reproducedDirectoryName: input.reproducedDirectoryName,
  });
  if (substitution.correspondence.status !== "MISMATCH") {
    throw new TypeError(`M7 substitution probe must produce MISMATCH, received ${substitution.correspondence.status}`);
  }

  const manifest: M7SkillEvidenceManifest = {
    schemaVersion: "1",
    artifactKind: "agent-skill",
    sourceClaim: input.sourceClaim,
    environment: input.environment,
    verification: genuine,
  };
  const canonicalEvidenceBytes = canonicalBytes(manifest);
  return {
    schemaVersion: "1",
    genuine: {
      verification: genuine,
      manifest,
      canonicalEvidenceBytes,
      canonicalEvidenceSha256: sha256Bytes(canonicalEvidenceBytes),
    },
    substitutionProbe: {
      mutation: "APPEND_SPACE_TO_PUBLISHER_SKILL_MD",
      verification: substitution,
    },
  };
}

export function attachM7StorageEvidence(slice: M7SkillSlice, storage: StorageRoundTripEvidence): StoredM7SkillSlice {
  if (storage.chainId !== 16602 || storage.network !== "0G Galileo Testnet" || !storage.proofVerified || !storage.bytesMatch) {
    throw new TypeError("M7 requires proof-verified exact-byte 0G Galileo Storage evidence");
  }
  if (
    storage.uploadedSha256 !== slice.genuine.canonicalEvidenceSha256
    || storage.downloadedSha256 !== slice.genuine.canonicalEvidenceSha256
  ) {
    throw new TypeError("0G Storage evidence does not correspond to the canonical M7 skill evidence bytes");
  }
  if (storage.rootHashes.length !== 1) throw new TypeError("M7 registry preparation currently requires one canonical 0G Storage root");

  const verification = slice.genuine.verification;
  const commitments: RegistryCommitments = {
    manifestDigest: bytes32FromSha256(slice.genuine.canonicalEvidenceSha256),
    sourceClaimDigest: bytes32FromSha256(sha256Bytes(canonicalBytes(slice.genuine.manifest.sourceClaim))),
    publisherArtifactDigest: bytes32FromSha256(verification.publisherPackage.sha256),
    reproducedArtifactDigest: bytes32FromSha256(verification.reproducedPackage.sha256),
    provenanceRoot: requireBytes32(storage.rootHashes[0]!, "provenanceRoot"),
  };

  return {
    ...slice,
    storage,
    preparedAristotleAnchor: {
      targetNetwork: "0G Aristotle Mainnet",
      chainId: 16661,
      status: "PREPARED_NOT_SUBMITTED",
      commitments,
      recordId: computeRegistryRecordId(commitments),
      contractAddress: "0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4",
      transactionHash: null,
    },
  };
}
