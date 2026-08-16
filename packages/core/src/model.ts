export type Sha256 = string;

export type SourceAssuranceLevel =
  | "DECLARED"
  | "REPOSITORY_AUTHENTICATED"
  | "SIGNED_RELEASE";

export type CorrespondenceStatus =
  | "MATCH"
  | "MISMATCH"
  | "DIVERGED"
  | "INSUFFICIENT_EVIDENCE";

export interface SourceRef {
  provider: "git";
  repository: string;
  commitSha: string;
  tag?: string;
  subdirectory?: string;
}

export interface PublisherIdentity {
  type: "anonymous" | "github" | "signature";
  subject: string;
  assuranceLevel: SourceAssuranceLevel;
  evidenceReferences: string[];
}

export interface ReleaseClaim {
  claimVersion: "1";
  projectId: string;
  publisherIdentity: PublisherIdentity;
  source: SourceRef;
  recipeDigest: Sha256;
  artifactName: string;
  artifactLocation?: string;
  releaseTag?: string;
  claimAssuranceLevel: SourceAssuranceLevel;
}

export interface ResourceLimits {
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface BuildCommand {
  executable: string;
  args: string[];
}

export interface BuildRecipe {
  version: "1";
  runtime: string;
  workingDirectory: string;
  commands: BuildCommand[];
  artifactPath: string;
  networkPolicy: "none";
  resourceLimits: ResourceLimits;
  environment: Record<string, string>;
}

export interface ArtifactDigest {
  name: string;
  role: "publisher" | "reproduced";
  size: number;
  sha256: Sha256;
}

export interface ComparisonCheck {
  id: "publisher_artifact_present" | "reproduced_artifact_present" | "sha256_equal";
  passed: boolean;
}

export interface ComparisonResult {
  status: CorrespondenceStatus;
  publisherDigest: Sha256 | null;
  reproducedDigest: Sha256 | null;
  checks: ComparisonCheck[];
  warnings: string[];
}

export interface BuildEnvironment {
  runnerType: "local" | "0g";
  runtime: string;
  sourceCommitSha: string;
  providerId: string | null;
  attestationAvailable: boolean;
  artifactDigestBoundToAttestation: boolean;
  evidenceReferences: string[];
}

export interface ProvenanceManifest {
  schemaVersion: "1";
  releaseClaim: ReleaseClaim;
  recipe: BuildRecipe;
  publisherArtifact: ArtifactDigest;
  reproducedArtifact: ArtifactDigest;
  environment: BuildEnvironment;
  comparison: ComparisonResult;
  evidenceReferences: string[];
}

export interface VerificationJson {
  schemaVersion: "1";
  sourceClaim: {
    assuranceLevel: SourceAssuranceLevel;
    repository: string;
    commitSha: string;
  };
  correspondence: ComparisonResult;
  artifacts: {
    publisher: ArtifactDigest;
    reproduced: ArtifactDigest;
  };
  manifestSha256: Sha256;
  manifest: ProvenanceManifest;
}
