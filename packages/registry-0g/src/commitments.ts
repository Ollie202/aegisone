import { canonicalBytes } from "../../core/src/canonical.ts";
import { isSha256, sha256Bytes } from "../../core/src/hash.ts";
import type { VerificationJson } from "../../core/src/model.ts";

export type Bytes32Hex = `0x${string}`;

export interface RegistryCommitments {
  manifestDigest: Bytes32Hex;
  sourceClaimDigest: Bytes32Hex;
  publisherArtifactDigest: Bytes32Hex;
  reproducedArtifactDigest: Bytes32Hex;
  provenanceRoot: Bytes32Hex;
}

export function bytes32FromSha256(value: string): Bytes32Hex {
  if (!isSha256(value)) throw new TypeError("Expected a lowercase 64-character SHA-256 digest");
  return `0x${value}`;
}

export function requireBytes32(value: string, field: string): Bytes32Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new TypeError(`${field} must be a 32-byte hexadecimal value with 0x prefix`);
  }
  return value as Bytes32Hex;
}

export function createRegistryCommitments(
  verification: VerificationJson,
  provenanceRoot: string,
): RegistryCommitments {
  const sourceClaimSha256 = sha256Bytes(canonicalBytes(verification.manifest.releaseClaim));
  return {
    manifestDigest: bytes32FromSha256(verification.manifestSha256),
    sourceClaimDigest: bytes32FromSha256(sourceClaimSha256),
    publisherArtifactDigest: bytes32FromSha256(verification.artifacts.publisher.sha256),
    reproducedArtifactDigest: bytes32FromSha256(verification.artifacts.reproduced.sha256),
    provenanceRoot: requireBytes32(provenanceRoot, "provenanceRoot"),
  };
}

export function assertRegistryCommitments(value: RegistryCommitments): void {
  requireBytes32(value.manifestDigest, "manifestDigest");
  requireBytes32(value.sourceClaimDigest, "sourceClaimDigest");
  requireBytes32(value.publisherArtifactDigest, "publisherArtifactDigest");
  requireBytes32(value.reproducedArtifactDigest, "reproducedArtifactDigest");
  requireBytes32(value.provenanceRoot, "provenanceRoot");
  for (const [field, commitment] of Object.entries(value)) {
    if (/^0x0{64}$/.test(commitment)) throw new TypeError(`${field} must not be zero`);
  }
}
