import { canonicalBytes } from "./canonical.ts";
import { sha256Bytes } from "./hash.ts";
import type {
  ArtifactDigest,
  BuildEnvironment,
  BuildRecipe,
  ComparisonResult,
  ProvenanceManifest,
  ReleaseClaim,
  VerificationJson,
} from "./model.ts";
import { validateBuildRecipe, validateReleaseClaim } from "./validate.ts";

function describeArtifact(name: string, role: ArtifactDigest["role"], bytes: Uint8Array): ArtifactDigest {
  return { name, role, size: bytes.byteLength, sha256: sha256Bytes(bytes) };
}

export function recipeDigest(recipe: BuildRecipe): string {
  validateBuildRecipe(recipe);
  return sha256Bytes(canonicalBytes(recipe));
}

export function compareArtifacts(publisher: Uint8Array | null, reproduced: Uint8Array | null): ComparisonResult {
  const publisherDigest = publisher === null ? null : sha256Bytes(publisher);
  const reproducedDigest = reproduced === null ? null : sha256Bytes(reproduced);
  const bothPresent = publisher !== null && reproduced !== null;
  const equal = bothPresent && publisherDigest === reproducedDigest;
  return {
    status: !bothPresent ? "INSUFFICIENT_EVIDENCE" : equal ? "MATCH" : "MISMATCH",
    publisherDigest,
    reproducedDigest,
    checks: [
      { id: "publisher_artifact_present", passed: publisher !== null },
      { id: "reproduced_artifact_present", passed: reproduced !== null },
      { id: "sha256_equal", passed: equal },
    ],
    warnings: [],
  };
}

export function createVerification(input: {
  claim: ReleaseClaim;
  recipe: BuildRecipe;
  publisherBytes: Uint8Array;
  reproducedBytes: Uint8Array;
  environment: BuildEnvironment;
}): VerificationJson {
  validateReleaseClaim(input.claim);
  validateBuildRecipe(input.recipe);
  if (recipeDigest(input.recipe) !== input.claim.recipeDigest) {
    throw new TypeError("Release claim recipeDigest does not match the supplied recipe");
  }
  if (input.environment.sourceCommitSha !== input.claim.source.commitSha) {
    throw new TypeError("Build environment commit does not match the release claim");
  }
  const publisher = describeArtifact(input.claim.artifactName, "publisher", input.publisherBytes);
  const reproduced = describeArtifact(input.claim.artifactName, "reproduced", input.reproducedBytes);
  const comparison = compareArtifacts(input.publisherBytes, input.reproducedBytes);
  const manifest: ProvenanceManifest = {
    schemaVersion: "1",
    releaseClaim: input.claim,
    recipe: input.recipe,
    publisherArtifact: publisher,
    reproducedArtifact: reproduced,
    environment: input.environment,
    comparison,
    evidenceReferences: [],
  };
  return {
    schemaVersion: "1",
    sourceClaim: {
      assuranceLevel: input.claim.claimAssuranceLevel,
      repository: input.claim.source.repository,
      commitSha: input.claim.source.commitSha,
    },
    correspondence: comparison,
    artifacts: { publisher, reproduced },
    manifestSha256: sha256Bytes(canonicalBytes(manifest)),
    manifest,
  };
}
