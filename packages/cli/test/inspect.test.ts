import assert from "node:assert/strict";
import { test } from "node:test";
import { createVerification, recipeDigest } from "../../core/src/index.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../../core/src/index.ts";
import { inspectVerification } from "../src/inspect.ts";

const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: ".",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/artifact.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 1_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "fixture@1",
  publisherIdentity: { type: "anonymous", subject: "fixture", assuranceLevel: "DECLARED", evidenceReferences: [] },
  source: { provider: "git", repository: "fixture://repo", commitSha: "a".repeat(40) },
  recipeDigest: recipeDigest(recipe),
  artifactName: "artifact.json",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "0g",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: "provider-1",
  attestationAvailable: true,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: [],
};

test("CLI inspect uses the shared core judgeable projection", () => {
  const verification = createVerification({
    claim,
    recipe,
    publisherBytes: new TextEncoder().encode("same"),
    reproducedBytes: new TextEncoder().encode("same"),
    environment,
  });
  const view = inspectVerification(verification);
  assert.equal(view.verdict, "MATCH");
  assert.equal(view.build.runnerType, "0g");
  assert.equal(view.build.attestation, "PROVIDER_EVIDENCE_ONLY");
});
