export const PROOFRAIL_REGISTRY_ABI = [
  "function registerEvidence(bytes32 manifestDigest, bytes32 sourceClaimDigest, bytes32 publisherArtifactDigest, bytes32 reproducedArtifactDigest, bytes32 provenanceRoot) returns (bytes32 recordId)",
  "function computeRecordId(bytes32 manifestDigest, bytes32 sourceClaimDigest, bytes32 publisherArtifactDigest, bytes32 reproducedArtifactDigest, bytes32 provenanceRoot) pure returns (bytes32 recordId)",
  "function exists(bytes32 recordId) view returns (bool)",
  "function getEvidence(bytes32 recordId) view returns (bytes32 manifestDigest, bytes32 sourceClaimDigest, bytes32 publisherArtifactDigest, bytes32 reproducedArtifactDigest, bytes32 provenanceRoot, address submitter, uint64 registeredAt)",
  "event EvidenceRegistered(bytes32 indexed recordId, bytes32 indexed sourceClaimDigest, bytes32 indexed provenanceRoot, bytes32 manifestDigest, bytes32 publisherArtifactDigest, bytes32 reproducedArtifactDigest, address submitter, uint64 registeredAt)",
  "error EmptyCommitment(uint8 field)",
  "error EvidenceAlreadyRegistered(bytes32 recordId)",
  "error EvidenceNotFound(bytes32 recordId)",
] as const;
